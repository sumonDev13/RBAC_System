import { query } from '../db/pool';
import { auditLog } from './audit.service';
import { TTLCache } from '../utils/cache';
import { User } from '../interfaces';
import { Request } from 'express';

// ── Permission cache (TTL: 5 minutes) ────────────────────────────────────────

const permissionCache = new TTLCache<string[]>(5 * 60 * 1000);

/**
 * Fetch resolved permission atoms for a user, with caching.
 * Returns an array of permission atom strings (e.g. ['users.view', 'dashboard.view']).
 */
export async function getResolvedPermissions(userId: string): Promise<string[]> {
  const cached = permissionCache.get(userId);
  if (cached) return cached;

  const result = await query<{ atom: string }>(
    `SELECT p.atom
     FROM resolved_user_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.user_id = $1 AND rp.granted = true`,
    [userId],
  );

  const atoms = result.rows.map((r) => r.atom);
  permissionCache.set(userId, atoms);
  return atoms;
}

/**
 * Invalidate cached permissions for a user.
 * Call this after granting/revoking permissions or changing a user's role.
 */
export function invalidateUserPermissions(userId: string): void {
  permissionCache.delete(userId);
}

/**
 * Invalidate all cached permissions (e.g. after bulk role_permission changes).
 */
export function invalidateAllPermissions(): void {
  permissionCache.clear();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PermissionAtom {
  id: string;
  atom: string;
  label: string;
  description: string | null;
  module: string;
}

interface UserPermissionRow {
  id: string;
  atom: string;
  label: string;
  module: string;
  granted: boolean;
  granted_by: string | null;
  override_at: Date | null;
}

// ── List all permission atoms ─────────────────────────────────────────────────

export async function listPermissions(): Promise<PermissionAtom[]> {
  const result = await query<PermissionAtom>(
    `SELECT id, atom, label, description, module FROM permissions ORDER BY module, atom`,
  );
  return result.rows;
}

// ── Get resolved permissions for a specific user (with manager scoping) ───────

export async function getUserPermissions(
  actor: User,
  targetUserId: string,
): Promise<UserPermissionRow[]> {
  // Managers can only inspect their team members
  if (actor.role === 'manager') {
    const t = await query('SELECT manager_id FROM users WHERE id = $1', [targetUserId]);
    if (!t.rows[0] || t.rows[0].manager_id !== actor.id) {
      throw { status: 403, message: 'Access denied' };
    }
  }

  const result = await query<UserPermissionRow>(
    `SELECT p.id, p.atom, p.label, p.module,
            COALESCE(up.granted, true) AS granted,
            up.granted_by,
            up.updated_at AS override_at
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     JOIN users u ON u.role = rp.role AND u.id = $1
     LEFT JOIN user_permissions up ON up.user_id = $1 AND up.permission_id = p.id
     ORDER BY p.module, p.atom`,
    [targetUserId],
  );

  return result.rows;
}

// ── Set user permissions (with grant ceiling) ─────────────────────────────────

export async function setUserPermissions(
  actor: User,
  targetUserId: string,
  permissions: { permission_id: string; granted: boolean }[],
  req: Request,
): Promise<void> {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw { status: 400, message: 'permissions array required' };
  }

  // Verify target exists and actor can manage them
  const targetResult = await query('SELECT id, role, manager_id FROM users WHERE id = $1', [targetUserId]);
  if (targetResult.rows.length === 0) {
    throw { status: 404, message: 'User not found' };
  }

  const target = targetResult.rows[0];
  if (actor.role === 'manager' && target.manager_id !== actor.id) {
    throw { status: 403, message: 'Access denied' };
  }

  // Grant ceiling: actor cannot grant permissions they don't hold themselves
  const actorPermsResult = await query<{ atom: string; permission_id: string }>(
    `SELECT permission_id, atom FROM resolved_user_permissions WHERE user_id = $1 AND granted = true`,
    [actor.id],
  );
  const actorPermIds = new Set(actorPermsResult.rows.map((r) => r.permission_id));

  const toGrant = permissions.filter((p) => p.granted);
  const forbidden = toGrant.filter((p) => !actorPermIds.has(p.permission_id));

  if (forbidden.length > 0) {
    throw {
      status: 403,
      message: 'Grant ceiling violation: you cannot grant permissions you do not hold',
      forbidden: forbidden.map((f) => f.permission_id),
    };
  }

  // Upsert each permission
  for (const { permission_id, granted } of permissions) {
    await query(
      `INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, permission_id)
       DO UPDATE SET granted = EXCLUDED.granted, granted_by = EXCLUDED.granted_by, updated_at = NOW()`,
      [targetUserId, permission_id, granted, actor.id],
    );

    await auditLog({
      actorId: actor.id,
      targetId: targetUserId,
      action: granted ? 'permission.granted' : 'permission.revoked',
      metadata: { permission_id },
      req,
    });
  }

  // Invalidate cache for the target user
  invalidateUserPermissions(targetUserId);
}
