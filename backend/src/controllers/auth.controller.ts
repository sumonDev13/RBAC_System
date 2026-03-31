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
import { User } from '../interfaces';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from '../config/cookies';
import { consumePendingAuth } from '../utils/pendingAuth';
import { verifyEmailToken } from '../services/emailVerification.service';

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

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (user.status === 'banned') {
    return res.status(403).json({ message: 'Account banned' });
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(429).json({ message: 'Account temporarily locked.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    const attempts = user.failed_login_attempts + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await query(
      `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
      [attempts, lockUntil, user.id]
    );

    await auditLog({ actorId: null, targetId: user.id, action: 'auth.failed_attempt', req });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Reset failed attempts
  await query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);

  const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: refreshToken } = generateRefreshToken(user.id);

  // Store hashed refresh token in DB
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2 WHERE id = $3`,
    [hashToken(refreshToken), refreshExpiry, user.id]
  );

  await auditLog({ actorId: user.id, targetId: user.id, action: 'auth.login', req });

  // Set Cookies
  res.cookie(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);

  return res.json({
    accessToken, // Still return for Redux, but Cookie is the primary backup
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

  // Validate stored hash
  if (
    !user.refresh_token_hash ||
    user.refresh_token_hash !== hashToken(refreshToken) ||
    new Date(user.refresh_token_expires_at) < new Date()
  ) {
    return res.status(401).json({ message: 'Refresh token invalid' });
  }

  // Rotate Tokens (Security Best Practice)
  const newAccessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: newRefreshToken } = generateRefreshToken(user.id);
  
  await query(
    `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2 WHERE id = $3`,
    [hashToken(newRefreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), user.id]
  );

  res.cookie(ACCESS_COOKIE, newAccessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie(REFRESH_COOKIE, newRefreshToken, REFRESH_COOKIE_OPTIONS);

  return res.json({ accessToken: newAccessToken });
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
export async function logout(req: Request, res: Response) {
  // 1. Blacklist current Access Token if possible
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.[ACCESS_COOKIE];

  if (token) {
    try {
      const { verifyAccessToken } = await import('../utils/jwt');
      const { jti } = verifyAccessToken(token);
      await query(
        `INSERT INTO session_blacklist (jti, expires_at) VALUES ($1, NOW() + INTERVAL '15 minutes') 
         ON CONFLICT DO NOTHING`,
        [jti]
      );
    } catch { /* skip invalid token */ }
  }

  // 2. Clear Database Record
  if (req.user) {
    await query(`UPDATE users SET refresh_token_hash = NULL, refresh_token_expires_at = NULL WHERE id = $1`, [req.user.id]);
    await auditLog({ actorId: req.user.id, targetId: req.user.id, action: 'auth.logout', req });
  }

  // 3. Clear Browser Cookies
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });

  return res.json({ message: 'Logged out successfully' });
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export async function me(req: Request, res: Response) {
  const user = req.user! as User; // Populated by authenticate middleware

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

// ── POST /api/auth/exchange ───────────────────────────────────────────────────
// Exchanges a one-time pending token for the actual access token + user data
export async function exchange(req: Request, res: Response) {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Token required' });
  }

  const accessToken = consumePendingAuth(token);
  if (!accessToken) {
    return res.status(401).json({ message: 'Invalid or expired auth token' });
  }

  // Verify the access token is still valid
  let payload: any;
  try {
    const { verifyAccessToken } = await import('../utils/jwt');
    payload = verifyAccessToken(accessToken);
  } catch {
    return res.status(401).json({ message: 'Token expired' });
  }

  // Set cookies
  res.cookie(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);

  // Fetch user + permissions
  const userResult = await query(
    `SELECT id, email, first_name, last_name, role, status FROM users WHERE id = $1`,
    [payload.sub]
  );
  const user = userResult.rows[0];
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  const permsResult = await query<{ atom: string }>(
    `SELECT p.atom
     FROM resolved_user_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.user_id = $1 AND rp.granted = true`,
    [user.id]
  );

  return res.json({
    accessToken,
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

// ── GET /api/auth/verify-email ─────────────────────────────────────────────────
export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Verification token required' });
  }

  const userId = await verifyEmailToken(token);
  if (!userId) {
    return res.status(400).json({ message: 'Invalid or expired verification token' });
  }

  await auditLog({ actorId: userId, targetId: userId, action: 'auth.email_verified', req });

  const frontendUrl = process.env.OAUTH_REDIRECT_FRONTEND
    || (process.env.FRONTEND_URL ?? '').split(',')[0].trim();

  return res.redirect(`${frontendUrl}/login?verified=true`);
}