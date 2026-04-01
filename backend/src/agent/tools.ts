import { query } from '../db/pool';

// ── Tool: List users with filters ─────────────────────────────────────────────

export async function listUsers(args: {
  role?: string;
  status?: string;
  limit?: number;
}): Promise<object[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (args.role) {
    params.push(args.role);
    conditions.push(`u.role = $${params.length}`);
  }
  if (args.status) {
    params.push(args.status);
    conditions.push(`u.status = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(args.limit || 20, 50);
  params.push(limit);

  const result = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.created_at,
            u.email_verified, u.failed_login_attempts,
            m.first_name AS manager_first, m.last_name AS manager_last
     FROM users u
     LEFT JOIN users m ON m.id = u.manager_id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}

// ── Tool: Get user details + permissions ──────────────────────────────────────

export async function getUserPermissions(args: {
  email?: string;
  user_id?: string;
}): Promise<object> {
  let userResult;

  if (args.email) {
    userResult = await query(
      `SELECT id, email, first_name, last_name, role, status, manager_id, created_at, email_verified
       FROM users WHERE email = $1`,
      [args.email],
    );
  } else if (args.user_id) {
    userResult = await query(
      `SELECT id, email, first_name, last_name, role, status, manager_id, created_at, email_verified
       FROM users WHERE id = $1`,
      [args.user_id],
    );
  } else {
    return { error: 'Provide email or user_id' };
  }

  if (userResult.rows.length === 0) {
    return { error: 'User not found' };
  }

  const user = userResult.rows[0];

  const permsResult = await query(
    `SELECT p.atom, p.label, p.module, COALESCE(up.granted, true) AS granted,
            up.granted_by, up.updated_at AS override_at
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     LEFT JOIN user_permissions up ON up.user_id = $1 AND up.permission_id = p.id
     WHERE rp.role = $2
     ORDER BY p.module, p.atom`,
    [user.id, user.role],
  );

  const overrideCount = permsResult.rows.filter((r: any) => r.override_at).length;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      status: user.status,
      email_verified: user.email_verified,
      created_at: user.created_at,
    },
    permissions: permsResult.rows,
    total_permissions: permsResult.rows.length,
    overridden_permissions: overrideCount,
  };
}

// ── Tool: Query audit logs ────────────────────────────────────────────────────

export async function queryAuditLogs(args: {
  action?: string;
  actor_email?: string;
  hours?: number;
  limit?: number;
}): Promise<object[]> {
  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (args.action) {
    params.push(args.action);
    conditions.push(`al.action = $${params.length}`);
  }
  if (args.actor_email) {
    params.push(args.actor_email);
    conditions.push(`actor.email = $${params.length}`);
  }
  if (args.hours) {
    params.push(args.hours);
    conditions.push(`al.created_at > NOW() - INTERVAL '${parseInt(String(args.hours))} hours'`);
  }

  const limit = Math.min(args.limit || 20, 100);
  params.push(limit);

  const result = await query(
    `SELECT al.action, al.metadata, al.ip_address, al.created_at,
            actor.email AS actor_email,
            CONCAT(actor.first_name, ' ', actor.last_name) AS actor_name,
            CONCAT(target.first_name, ' ', target.last_name) AS target_name
     FROM audit_logs al
     LEFT JOIN users actor ON actor.id = al.actor_id
     LEFT JOIN users target ON target.id = al.target_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY al.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}

// ── Tool: Get role summary ────────────────────────────────────────────────────

export async function getRoleSummary(): Promise<object> {
  const userCounts = await query(
    `SELECT role, status, COUNT(*) as count
     FROM users
     GROUP BY role, status
     ORDER BY role, status`,
  );

  const rolePerms = await query(
    `SELECT rp.role, p.atom, p.label, p.module
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     ORDER BY rp.role, p.module, p.atom`,
  );

  // Group permissions by role
  const grouped: Record<string, { permissions: string[]; userCounts: Record<string, number> }> = {};

  for (const row of rolePerms.rows) {
    if (!grouped[row.role]) grouped[row.role] = { permissions: [], userCounts: {} };
    grouped[row.role].permissions.push(`${row.atom} (${row.module})`);
  }

  for (const row of userCounts.rows) {
    if (!grouped[row.role]) grouped[row.role] = { permissions: [], userCounts: {} };
    grouped[row.role].userCounts[row.status] = parseInt(row.count);
  }

  return grouped;
}

// ── Tool: Get permission usage stats ──────────────────────────────────────────

export async function getPermissionStats(): Promise<object> {
  const result = await query(
    `SELECT
       p.atom,
       p.label,
       p.module,
       (SELECT COUNT(DISTINCT u.id) FROM users u JOIN role_permissions rp ON rp.role = u.role WHERE rp.permission_id = p.id) AS users_via_role,
       (SELECT COUNT(*) FROM user_permissions up WHERE up.permission_id = p.id AND up.granted = true) AS user_grants,
       (SELECT COUNT(*) FROM user_permissions up WHERE up.permission_id = p.id AND up.granted = false) AS user_revokes
     FROM permissions p
     ORDER BY p.module, p.atom`,
  );

  return result.rows;
}

// ── Tool: Check security events ───────────────────────────────────────────────

export async function getSecuritySummary(args: { hours?: number }): Promise<object> {
  const hours = args.hours || 24;

  const failedLogins = await query(
    `SELECT COUNT(*) as count, target.email
     FROM audit_logs al
     LEFT JOIN users target ON target.id = al.target_id
     WHERE al.action = 'auth.failed_attempt'
       AND al.created_at > NOW() - INTERVAL '${hours} hours'
     GROUP BY target.email
     ORDER BY count DESC
     LIMIT 10`,
  );

  const bannedUsers = await query(
    `SELECT COUNT(*) as count
     FROM audit_logs
     WHERE action = 'user.banned'
       AND created_at > NOW() - INTERVAL '${hours} hours'`,
  );

  const lockedUsers = await query(
    `SELECT email, failed_login_attempts, locked_until
     FROM users
     WHERE locked_until > NOW()
     ORDER BY locked_until DESC`,
  );

  const loginMethods = await query(
    `SELECT action, COUNT(*) as count
     FROM audit_logs
     WHERE action IN ('auth.login', 'auth.google_login', 'auth.facebook_login')
       AND created_at > NOW() - INTERVAL '${hours} hours'
     GROUP BY action`,
  );

  return {
    period_hours: hours,
    failed_logins_by_user: failedLogins.rows,
    total_bans: bannedUsers.rows[0]?.count || 0,
    currently_locked_accounts: lockedUsers.rows,
    login_methods: loginMethods.rows,
  };
}
