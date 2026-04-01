import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import { auditLog } from './audit.service';
import { validatePassword } from '../utils/password';
import { sendVerificationEmail } from './emailVerification.service';
import { User } from '../interfaces';
import { Request } from 'express';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  manager_id: string | null;
  created_at: Date;
  manager_first_name: string | null;
  manager_last_name: string | null;
}

interface UserRecord {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  manager_id: string | null;
  created_at: Date;
}

interface ListUsersOptions {
  page: number;
  limit: number;
  role?: string;
  status?: string;
}

interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  manager_id?: string;
}

interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  status?: string;
}

// ── List users ────────────────────────────────────────────────────────────────

export async function listUsers(
  actor: User,
  opts: ListUsersOptions,
): Promise<{ users: UserListItem[]; page: number; limit: number }> {
  const { page, limit, role, status } = opts;
  const offset = (page - 1) * limit;

  let sql = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status,
           u.manager_id, u.created_at,
           m.first_name AS manager_first_name, m.last_name AS manager_last_name
    FROM users u
    LEFT JOIN users m ON m.id = u.manager_id
    WHERE 1=1
  `;
  const params: any[] = [];

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
  params.push(limit, offset);

  const result = await query<UserListItem>(sql, params);
  return { users: result.rows, page, limit };
}

// ── Create user ───────────────────────────────────────────────────────────────

export async function createUser(
  actor: User,
  input: CreateUserInput,
  req: Request,
): Promise<UserRecord> {
  const { email, password, first_name, last_name, role, manager_id } = input;

  // Role hierarchy enforcement
  if (actor.role === 'manager' && !['agent', 'customer'].includes(role)) {
    throw { status: 403, message: 'Managers can only create agents or customers' };
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw { status: 409, message: 'Email already in use' };
  }

  const pwValidation = validatePassword(password);
  if (!pwValidation.valid) {
    throw { status: 400, message: 'Weak password', errors: pwValidation.errors };
  }

  const password_hash = await bcrypt.hash(password, 12);
  const assignedManager = actor.role === 'manager' ? actor.id : manager_id;

  const result = await query<UserRecord>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, manager_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, first_name, last_name, role, status, created_at`,
    [email, password_hash, first_name, last_name, role, assignedManager],
  );

  const newUser = result.rows[0];
  await auditLog({ actorId: actor.id, targetId: newUser.id, action: 'user.created', req });
  await sendVerificationEmail(newUser.id, newUser.email);

  return newUser;
}

// ── Get single user ───────────────────────────────────────────────────────────

export async function getUser(
  actor: User,
  userId: string,
): Promise<UserRecord> {
  const result = await query<UserRecord>(
    `SELECT id, email, first_name, last_name, role, status, manager_id, created_at
     FROM users WHERE id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: 'User not found' };
  }

  const user = result.rows[0];

  // Managers can only view their own team members
  if (actor.role === 'manager' && user.manager_id !== actor.id && user.id !== actor.id) {
    throw { status: 403, message: 'Access denied' };
  }

  return user;
}

// ── Update user ───────────────────────────────────────────────────────────────

export async function updateUser(
  actor: User,
  userId: string,
  input: UpdateUserInput,
  req: Request,
): Promise<UserRecord> {
  const { first_name, last_name, status } = input;

  const target = await query('SELECT id, role, manager_id FROM users WHERE id = $1', [userId]);
  if (target.rows.length === 0) {
    throw { status: 404, message: 'User not found' };
  }

  const t = target.rows[0];
  if (actor.role === 'manager' && t.manager_id !== actor.id) {
    throw { status: 403, message: 'Access denied' };
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (first_name) { params.push(first_name); updates.push(`first_name = $${params.length}`); }
  if (last_name) { params.push(last_name); updates.push(`last_name = $${params.length}`); }
  if (status && actor.role !== 'agent') { params.push(status); updates.push(`status = $${params.length}`); }

  if (updates.length === 0) {
    throw { status: 400, message: 'No fields to update' };
  }

  params.push(userId);
  const result = await query<UserRecord>(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}
     RETURNING id, email, first_name, last_name, role, status`,
    params,
  );

  await auditLog({
    actorId: actor.id,
    targetId: userId,
    action: 'user.updated',
    metadata: input,
    req,
  });

  return result.rows[0];
}

// ── Delete user (soft-delete via ban) ─────────────────────────────────────────

export async function deleteUser(
  actor: User,
  userId: string,
  req: Request,
): Promise<void> {
  if (actor.id === userId) {
    throw { status: 400, message: 'Cannot delete your own account' };
  }

  await query(`UPDATE users SET status = 'banned' WHERE id = $1`, [userId]);
  await auditLog({ actorId: actor.id, targetId: userId, action: 'user.banned', req });
}
