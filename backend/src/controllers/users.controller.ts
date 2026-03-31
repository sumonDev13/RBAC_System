import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import { auditLog } from '../services/audit.service';
import { validatePassword } from '../utils/password';

// ── GET /api/users ────────────────────────────────────────────────────────────
export async function listUsers(req: Request, res: Response) {
  const actor = req.user!;
  const { page = '1', limit = '20', role, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status,
           u.manager_id, u.created_at,
           m.first_name AS manager_first_name, m.last_name AS manager_last_name
    FROM users u
    LEFT JOIN users m ON m.id = u.manager_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Managers can only see their own team
  if (actor.role === 'manager') {
    params.push(actor.id);
    sql += ` AND u.manager_id = $${params.length}`;
  }

  if (role) {
    params.push(role);
    sql += ` AND u.role = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND u.status = $${params.length}`;
  }

  sql += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ users: result.rows, page: Number(page), limit: Number(limit) });
}

// ── POST /api/users ───────────────────────────────────────────────────────────
export async function createUser(req: Request, res: Response) {
  const actor = req.user!;
  const { email, password, first_name, last_name, role, manager_id } = req.body;

  // Role hierarchy enforcement: managers can only create agents/customers
  if (actor.role === 'manager' && !['agent', 'customer'].includes(role)) {
    return res.status(403).json({ message: 'Managers can only create agents or customers' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const pwValidation = validatePassword(password);
  if (!pwValidation.valid) {
    return res.status(400).json({ message: 'Weak password', errors: pwValidation.errors });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const assignedManager = actor.role === 'manager' ? actor.id : manager_id;

  const result = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, manager_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, first_name, last_name, role, status, created_at`,
    [email, password_hash, first_name, last_name, role, assignedManager]
  );

  const newUser = result.rows[0];
  await auditLog({ actorId: actor.id, targetId: newUser.id, action: 'user.created', req });

  return res.status(201).json({ user: newUser });
}

// ── GET /api/users/:id ────────────────────────────────────────────────────────
export async function getUser(req: Request, res: Response) {
  const actor = req.user!;
  const { id } = req.params;

  const result = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.manager_id, u.created_at
     FROM users u WHERE u.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = result.rows[0];

  // Managers can only view their own team members
  if (actor.role === 'manager' && user.manager_id !== actor.id && user.id !== actor.id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  return res.json({ user });
}

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
export async function updateUser(req: Request, res: Response) {
  const actor = req.user!;
  const { id } = req.params;
  const { first_name, last_name, status } = req.body;

  // Verify actor can touch this user
  const target = await query('SELECT id, role, manager_id FROM users WHERE id = $1', [id]);
  if (target.rows.length === 0) return res.status(404).json({ message: 'User not found' });

  const t = target.rows[0];
  if (actor.role === 'manager' && t.manager_id !== actor.id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Managers cannot change role
  const updates: string[] = [];
  const params: any[] = [];

  if (first_name) { params.push(first_name); updates.push(`first_name = $${params.length}`); }
  if (last_name)  { params.push(last_name);  updates.push(`last_name = $${params.length}`); }
  if (status && actor.role !== 'agent') { params.push(status); updates.push(`status = $${params.length}`); }

  if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

  params.push(id);
  const result = await query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}
     RETURNING id, email, first_name, last_name, role, status`,
    params
  );

  await auditLog({
    actorId: actor.id, targetId: Array.isArray(id) ? id[0] : id, action: 'user.updated',
    metadata: req.body, req,
  });

  return res.json({ user: result.rows[0] });
}

// ── DELETE /api/users/:id (soft-delete via ban) ───────────────────────────────
export async function deleteUser(req: Request, res: Response) {
  const actor = req.user!;
  const { id } = req.params;

  if (actor.id === id) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }

  await query(`UPDATE users SET status = 'banned' WHERE id = $1`, [id]);
  await auditLog({ actorId: actor.id, targetId: Array.isArray(id) ? id[0] : id, action: 'user.banned', req });

  return res.json({ message: 'User banned' });
}