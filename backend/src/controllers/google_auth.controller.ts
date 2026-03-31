import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { query } from '../db/pool';
import { generateAccessToken, generateRefreshToken, hashToken } from '../utils/jwt';
import { auditLog } from '../services/audit.service';
import { ACCESS_COOKIE, REFRESH_COOKIE, COMMON_COOKIE_OPTIONS } from '../config/cookies';
import { createPendingAuth } from '../utils/pendingAuth';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// In-memory used-codes set (use Redis in production)
const usedCodes = new Set<string>();

// ── GET /api/auth/google ──────────────────────────────────────────────────────
export function googleRedirect(req: Request, res: Response) {
  // Generate a random state token to prevent CSRF + detect replays
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in a short-lived cookie so we can verify it on callback
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000, // 5 minutes
    path: '/',
  });

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'consent',
    state,                  // Google will echo this back in the callback
  });

  return res.redirect(url);
}

// ── GET /api/auth/google/callback ─────────────────────────────────────────────
export async function googleCallback(req: Request, res: Response) {
  const { code, state } = req.query;

  // Use OAUTH_REDIRECT_FRONTEND if set; otherwise use the first value of FRONTEND_URL
  const frontendUrl = process.env.OAUTH_REDIRECT_FRONTEND
    || (process.env.FRONTEND_URL ?? '').split(',')[0].trim();

  // ── 1. Validate state (CSRF protection) ──────────────────────────────────
  const storedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', { path: '/' });

  if (!storedState || storedState !== state) {
    console.error('OAuth state mismatch — possible CSRF or replay');
    return res.redirect(`${frontendUrl}/login?error=google_failed`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${frontendUrl}/login?error=google_failed`);
  }

  // ── 2. One-time code guard (prevents double-execution in dev/StrictMode) ──
  if (usedCodes.has(code)) {
    console.warn('Google OAuth code already used — ignoring duplicate request');
    // Don't redirect to error — the first request is probably succeeding.
    // Just send a blank 200 so the browser stops retrying.
    return res.status(200).send('');
  }
  usedCodes.add(code);

  // Clean up old codes after 2 minutes to avoid memory leak
  setTimeout(() => usedCodes.delete(code), 2 * 60 * 1000);

  try {
    // ── 3. Exchange code for tokens ─────────────────────────────────────────
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // ── 4. Verify ID token and extract profile ──────────────────────────────
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const googlePayload = ticket.getPayload();
    if (!googlePayload?.email) {
      return res.redirect(`${frontendUrl}/login?error=google_no_email`);
    }

    const { sub: googleId, email, given_name, family_name, picture } = googlePayload;

    // ── 5. Find or create user ──────────────────────────────────────────────
    let user: any;

    // Try by google_id first
    const byGoogleId = await query(
      `SELECT id, email, first_name, last_name, role, status FROM users WHERE google_id = $1`,
      [googleId]
    );

    if (byGoogleId.rows.length > 0) {
      user = byGoogleId.rows[0];
    } else {
      // Try by email — link accounts if the email already exists
      const byEmail = await query(
        `SELECT id, email, first_name, last_name, role, status FROM users WHERE email = $1`,
        [email]
      );

      if (byEmail.rows.length > 0) {
        user = byEmail.rows[0];
        await query(
          `UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3`,
          [googleId, picture, user.id]
        );
      } else {
        // New user — create with 'customer' role by default
        const result = await query(
          `INSERT INTO users (email, google_id, first_name, last_name, role, avatar_url)
           VALUES ($1, $2, $3, $4, 'customer', $5)
           RETURNING id, email, first_name, last_name, role, status`,
          [email, googleId, given_name ?? '', family_name ?? '', picture]
        );
        user = result.rows[0];
        await auditLog({ actorId: user.id, targetId: user.id, action: 'user.created_via_google', req });
      }
    }

    if (user.status === 'banned') {
      return res.redirect(`${frontendUrl}/login?error=account_banned`);
    }
    if (user.status === 'suspended') {
      return res.redirect(`${frontendUrl}/login?error=account_suspended`);
    }

    // ── 6. Issue your existing JWT cookies (identical to /auth/login) ───────
    const accessToken  = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
    const { token: refreshToken } = generateRefreshToken(user.id);

    await query(
      `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2 WHERE id = $3`,
      [hashToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), user.id]
    );

    await auditLog({ actorId: user.id, targetId: user.id, action: 'auth.google_login', req });

    res.cookie(ACCESS_COOKIE, accessToken, { ...COMMON_COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...COMMON_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    // Use a one-time token for the callback redirect (secure, not the actual JWT)
    const pendingToken = createPendingAuth(accessToken);
    return res.redirect(`${frontendUrl}/callback?token=${pendingToken}`);
    

  } catch (err: any) {
    // Google throws "invalid_grant" when a code is reused — safe to ignore
    if (err?.message?.includes('invalid_grant')) {
      console.warn('Google invalid_grant — code already exchanged, ignoring');
      return res.status(200).send('');
    }
    console.error('Google OAuth error:', err);
    const frontendUrlFallback = process.env.OAUTH_REDIRECT_FRONTEND
      || (process.env.FRONTEND_URL ?? '').split(',')[0].trim();
    return res.redirect(`${frontendUrlFallback}/login?error=google_failed`);
  }
}