import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt';
import { auditLog } from '../services/audit.service';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const result = await query(
    `SELECT id, email, password_hash, first_name, last_name, role, status,
            failed_login_attempts, locked_until
     FROM users WHERE email = $1`,
    [email]
  );

  const user = result.rows[0];

  // Generic error to prevent user enumeration
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.status === 'banned') {
    return res.status(403).json({ message: 'Account banned' });
  }

  // Brute-force lockout check
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(429).json({ message: 'Account temporarily locked. Try again later.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    // Increment failed attempts; lock after 5
    const attempts = user.failed_login_attempts + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await query(
      `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
      [attempts, lockUntil, user.id]
    );

    await auditLog({ actorId: null, targetId: user.id, action: 'auth.failed_attempt', req });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ message: 'Account suspended' });
  }

  // Reset failed attempts on success
  await query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
    [user.id]
  );

  const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: refreshToken, jti: refreshJti } = generateRefreshToken(user.id);

  // Store hashed refresh token
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2 WHERE id = $3`,
    [hashToken(refreshToken), refreshExpiry, user.id]
  );

  await auditLog({ actorId: user.id, targetId: user.id, action: 'auth.login', req });

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  return res.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    },
  });
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
export async function refresh(req: Request, res: Response) {
  const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token' });
  }

  let payload: any;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  const result = await query(
    `SELECT id, email, role, status, refresh_token_hash, refresh_token_expires_at
     FROM users WHERE id = $1`,
    [payload.sub]
  );

  const user = result.rows[0];
  if (!user || user.status !== 'active') {
    return res.status(401).json({ message: 'User inactive' });
  }

  if (
    !user.refresh_token_hash ||
    user.refresh_token_hash !== hashToken(refreshToken) ||
    new Date(user.refresh_token_expires_at) < new Date()
  ) {
    return res.status(401).json({ message: 'Refresh token invalid or expired' });
  }

  // Rotate refresh token
  const { token: newRefreshToken } = generateRefreshToken(user.id);
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2 WHERE id = $3`,
    [hashToken(newRefreshToken), newExpiry, user.id]
  );

  const newAccessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });

  res.cookie(REFRESH_COOKIE, newRefreshToken, COOKIE_OPTIONS);
  return res.json({ accessToken: newAccessToken });
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
export async function logout(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      // Import inline to avoid circular
      const { verifyAccessToken } = await import('../utils/jwt');
      const { jti } = verifyAccessToken(token);
      // Blacklist the current access token JTI until it naturally expires
      await query(
        `INSERT INTO session_blacklist (jti, expires_at) VALUES ($1, NOW() + INTERVAL '15 minutes')
         ON CONFLICT DO NOTHING`,
        [jti]
      );
    } catch { /* ignore invalid tokens at logout */ }
  }

  // Clear refresh token from DB and cookie
  if (req.user) {
    await query(`UPDATE users SET refresh_token_hash = NULL, refresh_token_expires_at = NULL WHERE id = $1`, [req.user.id]);
    await auditLog({ actorId: req.user.id, targetId: req.user.id, action: 'auth.logout', req });
  }

  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  return res.json({ message: 'Logged out' });
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export async function me(req: Request, res: Response) {
  const user = req.user!;

  const permsResult = await query(
    `SELECT p.atom, p.label, p.module
     FROM resolved_user_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.user_id = $1 AND rp.granted = true`,
    [user.id]
  );

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status,
    },
    permissions: permsResult.rows,
  });
}