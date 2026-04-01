import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import { auditLog } from './audit.service';
import { sendVerificationEmail } from './emailVerification.service';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt';
import { consumePendingAuth } from '../utils/pendingAuth';
import { User } from '../interfaces';
import { Request } from 'express';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    emailVerified: boolean;
  };
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

interface ExchangeResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
  };
  permissions: { atom: string }[];
}

interface MeResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
  };
  permissions: { atom: string; label: string; module: string }[];
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
  req: Request,
): Promise<LoginResult> {
  const result = await query(
    `SELECT id, email, password_hash, first_name, last_name, role, status,
            failed_login_attempts, locked_until, email_verified
     FROM users WHERE email = $1`,
    [email],
  );

  const user = result.rows[0];

  if (!user) {
    throw { status: 401, message: 'Invalid credentials' };
  }

  if (user.status === 'banned') {
    throw { status: 403, message: 'Account banned' };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw { status: 429, message: 'Account temporarily locked.' };
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    const attempts = user.failed_login_attempts + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await query(
      `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
      [attempts, lockUntil, user.id],
    );

    await auditLog({ actorId: null, targetId: user.id, action: 'auth.failed_attempt', req });
    throw { status: 401, message: 'Invalid credentials' };
  }

  // Reset failed attempts
  await query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
    [user.id],
  );

  const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: refreshToken } = generateRefreshToken(user.id);

  // Store hashed refresh token
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2 WHERE id = $3`,
    [hashToken(refreshToken), refreshExpiry, user.id],
  );

  await auditLog({ actorId: user.id, targetId: user.id, action: 'auth.login', req });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      emailVerified: user.email_verified,
    },
  };
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export async function refresh(refreshToken: string): Promise<RefreshResult> {
  let payload: any;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw { status: 401, message: 'Invalid refresh token' };
  }

  const result = await query(
    `SELECT id, email, role, status, refresh_token_hash, refresh_token_expires_at
     FROM users WHERE id = $1`,
    [payload.sub],
  );

  const user = result.rows[0];
  if (!user || user.status !== 'active') {
    throw { status: 401, message: 'User inactive' };
  }

  if (
    !user.refresh_token_hash ||
    user.refresh_token_hash !== hashToken(refreshToken) ||
    new Date(user.refresh_token_expires_at) < new Date()
  ) {
    throw { status: 401, message: 'Refresh token invalid' };
  }

  const newAccessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: newRefreshToken } = generateRefreshToken(user.id);

  await query(
    `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2 WHERE id = $3`,
    [hashToken(newRefreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), user.id],
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(
  token: string | undefined,
  user: User | undefined,
  req: Request,
): Promise<void> {
  if (token) {
    try {
      const { verifyAccessToken } = await import('../utils/jwt');
      const { jti } = verifyAccessToken(token);
      await query(
        `INSERT INTO session_blacklist (jti, expires_at) VALUES ($1, NOW() + INTERVAL '15 minutes')
         ON CONFLICT DO NOTHING`,
        [jti],
      );
    } catch {
      /* skip invalid token */
    }
  }

  if (user) {
    await query(
      `UPDATE users SET refresh_token_hash = NULL, refresh_token_expires_at = NULL WHERE id = $1`,
      [user.id],
    );
    await auditLog({ actorId: user.id, targetId: user.id, action: 'auth.logout', req });
  }
}

// ── Me ────────────────────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<MeResult> {
  const userResult = await query(
    `SELECT id, email, first_name, last_name, role, status FROM users WHERE id = $1`,
    [userId],
  );

  const user = userResult.rows[0];
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  const permsResult = await query<{ atom: string; label: string; module: string }>(
    `SELECT p.atom, p.label, p.module
     FROM resolved_user_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.user_id = $1 AND rp.granted = true`,
    [userId],
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status,
    },
    permissions: permsResult.rows,
  };
}

// ── Exchange (OAuth pending token) ────────────────────────────────────────────

export async function exchangePendingToken(pendingToken: string): Promise<ExchangeResult> {
  const accessToken = consumePendingAuth(pendingToken);
  if (!accessToken) {
    throw { status: 401, message: 'Invalid or expired auth token' };
  }

  let payload: any;
  try {
    const { verifyAccessToken } = await import('../utils/jwt');
    payload = verifyAccessToken(accessToken);
  } catch {
    throw { status: 401, message: 'Token expired' };
  }

  const userResult = await query(
    `SELECT id, email, first_name, last_name, role, status FROM users WHERE id = $1`,
    [payload.sub],
  );
  const user = userResult.rows[0];
  if (!user) {
    throw { status: 401, message: 'User not found' };
  }

  const permsResult = await query<{ atom: string }>(
    `SELECT p.atom
     FROM resolved_user_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.user_id = $1 AND rp.granted = true`,
    [user.id],
  );

  return {
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
  };
}

// ── Verify email ──────────────────────────────────────────────────────────────

export async function verifyEmail(token: string, req: Request): Promise<string> {
  const { verifyEmailToken } = await import('./emailVerification.service');
  const userId = await verifyEmailToken(token);
  if (!userId) {
    throw { status: 400, message: 'Invalid or expired verification token' };
  }

  await auditLog({ actorId: userId, targetId: userId, action: 'auth.email_verified', req });
  return userId;
}

// ── Resend verification ───────────────────────────────────────────────────────

export async function resendVerification(email: string): Promise<string> {
  const result = await query(
    `SELECT id, email, email_verified FROM users WHERE email = $1`,
    [email],
  );

  const user = result.rows[0];
  if (!user) {
    return 'If the email exists, a verification link has been sent.';
  }

  if (user.email_verified) {
    return 'Email is already verified.';
  }

  await sendVerificationEmail(user.id, user.email);
  return 'If the email exists, a verification link has been sent.';
}
