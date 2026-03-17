import { Request, Response } from 'express';
import { query } from '../db/pool';
import { auditLog } from '../services/audit.service';

// ── GET /api/permissions ── all available atoms ───────────────────────────────
export async function listPermissions(_req: Request, res: Response) {
  const result = await query(
    `SELECT id, atom, label, description, module FROM permissions ORDER BY module, atom`
  );
  return res.json({ permissions: result.rows });
}

// ── GET /api/users/:id/permissions ── resolved permissions for a user ─────────
export async function getUserPermissions(req: Request, res: Response) {
  const actor = req.user!;
  const { id } = req.params;

  // Managers can only inspect their team members
  if (actor.role === 'manager') {
    const t = await query('SELECT manager_id FROM users WHERE id = $1', [id]);
    if (!t.rows[0] || t.rows[0].manager_id !== actor.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
  }

  const result = await query(
    `SELECT p.id, p.atom, p.label, p.module,
            COALESCE(up.granted, true) AS granted,
            up.granted_by,
            up.updated_at AS override_at
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     JOIN users u ON u.role = rp.role AND u.id = $1
     LEFT JOIN user_permissions up ON up.user_id = $1 AND up.permission_id = p.id
     ORDER BY p.module, p.atom`,
    [id]
  );

  return res.json({ permissions: result.rows });
}

// ── PUT /api/users/:id/permissions ── grant/revoke with ceiling check ─────────
export async function setUserPermissions(req: Request, res: Response) {
  const actor = req.user!;
  let { id: targetUserId } = req.params;
  if (Array.isArray(targetUserId)) {
    targetUserId = targetUserId[0];
  }
  const { permissions } = req.body as {
    permissions: { permission_id: string; granted: boolean }[];
  };

  if (!Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({ message: 'permissions array required' });
  }

  // Verify target exists and actor can manage them
  const targetResult = await query('SELECT id, role, manager_id FROM users WHERE id = $1', [targetUserId]);
  if (targetResult.rows.length === 0) return res.status(404).json({ message: 'User not found' });

  const target = targetResult.rows[0];
  if (actor.role === 'manager' && target.manager_id !== actor.id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Grant ceiling: actor cannot grant permissions they don't hold themselves
  const actorPermsResult = await query<{ atom: string; permission_id: string }>(
    `SELECT permission_id, atom FROM resolved_user_permissions WHERE user_id = $1 AND granted = true`,
    [actor.id]
  );
  const actorPermIds = new Set(actorPermsResult.rows.map((r) => r.permission_id));

  // Filter out any grants the actor doesn't hold
  const toGrant = permissions.filter((p) => p.granted);
  const forbidden = toGrant.filter((p) => !actorPermIds.has(p.permission_id));

  if (forbidden.length > 0) {
    return res.status(403).json({
      message: 'Grant ceiling violation: you cannot grant permissions you do not hold',
      forbidden: forbidden.map((f) => f.permission_id),
    });
  }

  // Upsert each permission
  for (const { permission_id, granted } of permissions) {
    await query(
      `INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, permission_id)
       DO UPDATE SET granted = EXCLUDED.granted, granted_by = EXCLUDED.granted_by, updated_at = NOW()`,
      [targetUserId, permission_id, granted, actor.id]
    );

    await auditLog({
      actorId: actor.id,
      targetId: targetUserId,
      action: granted ? 'permission.granted' : 'permission.revoked',
      metadata: { permission_id },
      req,
    });
  }

  return res.json({ message: 'Permissions updated' });
}