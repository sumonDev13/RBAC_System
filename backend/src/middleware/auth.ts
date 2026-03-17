import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { query } from '../db/pool';

// ── Verify JWT and attach user + resolved permissions to req ──────────────────
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    // Check if token is blacklisted (logout/revoke)
    const blacklisted = await query(
      'SELECT 1 FROM session_blacklist WHERE jti = $1 AND expires_at > NOW()',
      [payload.jti]
    );
    if (blacklisted.rows.length > 0) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }

    // Fetch full user
    const userResult = await query(
      `SELECT id, email, first_name, last_name, role, status, manager_id, created_at, updated_at
       FROM users WHERE id = $1 AND status = 'active'`,
      [payload.sub]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = userResult.rows[0];

    // Fetch resolved permissions (atoms the user actually holds)
    const permsResult = await query<{ atom: string }>(
      `SELECT atom FROM resolved_user_permissions
       WHERE user_id = $1 AND granted = true`,
      [payload.sub]
    );

    req.userPermissions = permsResult.rows.map((r) => r.atom);

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// ── Require specific permission atom ─────────────────────────────────────────
export function requirePermission(atom: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userPermissions?.includes(atom)) {
      return res.status(403).json({
        message: 'Forbidden',
        required: atom,
      });
    }
    next();
  };
}

// ── Require one of many permission atoms (OR logic) ───────────────────────────
export function requireAnyPermission(...atoms: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const has = atoms.some((a) => req.userPermissions?.includes(a));
    if (!has) {
      return res.status(403).json({
        message: 'Forbidden',
        required: atoms,
      });
    }
    next();
  };
}

// ── Require specific role (for hierarchy checks) ──────────────────────────────
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient role' });
    }
    next();
  };
}