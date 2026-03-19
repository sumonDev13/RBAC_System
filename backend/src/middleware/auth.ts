import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { query } from '../db/pool';

// ── Verify JWT and attach user + resolved permissions to req ──────────────────
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    // Check both possible cookie names just to be safe for now
    let token = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : (req.cookies?.access_token || req.cookies?.accessToken);

    if (!token) {
      console.error("❌ Auth Failed: No token found in headers or cookies");
      return res.status(401).json({ message: 'No token provided' });
    }

    const payload = verifyAccessToken(token);

    // DEBUG: Check if the blacklist is causing the 401
    const blacklisted = await query(
      'SELECT 1 FROM session_blacklist WHERE jti = $1 AND expires_at > NOW()',
      [payload.jti]
    );
    
    if (blacklisted.rows.length > 0) {
      console.error(`❌ Auth Failed: Token JTI ${payload.jti} is blacklisted`);
      return res.status(401).json({ message: 'Token has been revoked' });
    }

  const userResult = await query(
  `SELECT id, email, first_name, last_name, role, status
   FROM users WHERE id = $1 AND status = 'active'`,
  [payload.sub]
);

if (userResult.rows.length === 0) {
  return res.status(401).json({ message: 'User not found or inactive' });
}

req.user = userResult.rows[0];
    
   const permsResult = await query<{ atom: string }>(
  `SELECT p.atom 
   FROM resolved_user_permissions rp
   JOIN permissions p ON p.id = rp.permission_id
   WHERE rp.user_id = $1 AND rp.granted = true`,
  [payload.sub]
);

req.userPermissions = permsResult.rows.map((r) => r.atom);


    next();
  } catch (err: any) {
    console.error("❌ JWT Verification Error:", err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
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