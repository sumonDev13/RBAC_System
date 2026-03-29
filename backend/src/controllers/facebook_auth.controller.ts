import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool';
import { generateAccessToken, generateRefreshToken, hashToken } from '../utils/jwt';
import { auditLog } from '../services/audit.service';

const FB_APP_ID     = process.env.FACEBOOK_APP_ID     ?? '';
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET ?? '';
const FB_REDIRECT   = process.env.FACEBOOK_REDIRECT_URI ?? '';

const ACCESS_COOKIE  = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

const COMMON_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// In-memory used-codes guard (prevents double-execution in dev / StrictMode)
const usedCodes = new Set<string>();

function getFrontendUrl() {
  return (
    process.env.OAUTH_REDIRECT_FRONTEND ||
    (process.env.FRONTEND_URL ?? '').split(',')[0].trim()
  );
}

// ── GET /api/auth/facebook ────────────────────────────────────────────────────
export function facebookRedirect(req: Request, res: Response) {
  const state = crypto.randomBytes(16).toString('hex');

  res.cookie('fb_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id:     FB_APP_ID,
    redirect_uri:  FB_REDIRECT,
    // scope:         'email,public_profile',
    response_type: 'code',
    state,
  });

  return res.redirect(
    `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}&scope=public_profile,email`
  );
}

// ── GET /api/auth/facebook/callback ──────────────────────────────────────────
export async function facebookCallback(req: Request, res: Response) {
  const { code, state } = req.query as { code?: string; state?: string };
  const frontendUrl = getFrontendUrl();

  // ── 1. Validate CSRF state ────────────────────────────────────────────────
  const storedState = req.cookies?.fb_oauth_state;
  res.clearCookie('fb_oauth_state', { path: '/' });

  if (!storedState || storedState !== state) {
    console.error('Facebook OAuth state mismatch — possible CSRF');
    return res.redirect(`${frontendUrl}/login?error=facebook_failed`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=facebook_failed`);
  }

  // ── 2. One-time code guard ────────────────────────────────────────────────
  if (usedCodes.has(code)) {
    console.warn('Facebook OAuth code already used — ignoring duplicate');
    return res.status(200).send('');
  }
  usedCodes.add(code);
  setTimeout(() => usedCodes.delete(code), 2 * 60 * 1000);

  try {
    // ── 3. Exchange code for access token ────────────────────────────────────
    const tokenParams = new URLSearchParams({
      client_id:     FB_APP_ID,
      client_secret: FB_APP_SECRET,
      redirect_uri:  FB_REDIRECT,
      code,
    });

    const tokenRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?${tokenParams.toString()}`
    );
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: any };

    if (!tokenData.access_token) {
      console.error('Facebook token exchange failed:', tokenData.error);
      return res.redirect(`${frontendUrl}/login?error=facebook_failed`);
    }

    // ── 4. Fetch user profile ─────────────────────────────────────────────────
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,first_name,last_name,email,picture.type(large)&access_token=${tokenData.access_token}`
    );
    const profile = (await profileRes.json()) as {
      id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
      error?: any;
    };

    if (!profile.id || profile.error) {
      console.error('Facebook profile fetch failed:', profile.error);
      return res.redirect(`${frontendUrl}/login?error=facebook_no_profile`);
    }

    const { id: facebookId, first_name, last_name, picture } = profile;
    const email     = profile.email ?? null;
    const avatarUrl = picture?.data?.url ?? null;

    // ── 5. Find or create user ────────────────────────────────────────────────
    let user: any;

    // Try by facebook_id first
    const byFbId = await query(
      `SELECT id, email, first_name, last_name, role, status
         FROM users WHERE facebook_id = $1`,
      [facebookId]
    );

    if (byFbId.rows.length > 0) {
      user = byFbId.rows[0];
    } else if (email) {
      // Try linking by email if account already exists
      const byEmail = await query(
        `SELECT id, email, first_name, last_name, role, status
           FROM users WHERE email = $1`,
        [email]
      );

      if (byEmail.rows.length > 0) {
        user = byEmail.rows[0];
        await query(
          `UPDATE users SET facebook_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3`,
          [facebookId, avatarUrl, user.id]
        );
      } else {
        // Brand-new user
        const result = await query(
          `INSERT INTO users (email, facebook_id, first_name, last_name, role, avatar_url)
           VALUES ($1, $2, $3, $4, 'customer', $5)
           RETURNING id, email, first_name, last_name, role, status`,
          [email, facebookId, first_name ?? '', last_name ?? '', avatarUrl]
        );
        user = result.rows[0];
        await auditLog({ actorId: user.id, targetId: user.id, action: 'user.created_via_facebook', req });
      }
    } else {
      // Facebook account has no email — create with a placeholder
      const placeholder = `fb_${facebookId}@noemail.local`;
      const existing = await query(
        `SELECT id, email, first_name, last_name, role, status FROM users WHERE email = $1`,
        [placeholder]
      );

      if (existing.rows.length > 0) {
        user = existing.rows[0];
        await query(`UPDATE users SET facebook_id = $1 WHERE id = $2`, [facebookId, user.id]);
      } else {
        const result = await query(
          `INSERT INTO users (email, facebook_id, first_name, last_name, role, avatar_url)
           VALUES ($1, $2, $3, $4, 'customer', $5)
           RETURNING id, email, first_name, last_name, role, status`,
          [placeholder, facebookId, first_name ?? '', last_name ?? '', avatarUrl]
        );
        user = result.rows[0];
        await auditLog({ actorId: user.id, targetId: user.id, action: 'user.created_via_facebook', req });
      }
    }

    if (user.status === 'banned') {
      return res.redirect(`${frontendUrl}/login?error=account_banned`);
    }
    if (user.status === 'suspended') {
      return res.redirect(`${frontendUrl}/login?error=account_suspended`);
    }

    // ── 6. Issue JWT cookies (identical to Google flow) ───────────────────────
    const accessToken  = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
    const { token: refreshToken } = generateRefreshToken(user.id);

    await query(
      `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2 WHERE id = $3`,
      [hashToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), user.id]
    );

    await auditLog({ actorId: user.id, targetId: user.id, action: 'auth.facebook_login', req });

    res.cookie(ACCESS_COOKIE, accessToken, { ...COMMON_COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...COMMON_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    console.log('Facebook OAuth: redirecting to callback');
    return res.redirect(`${frontendUrl}/callback?token=${accessToken}`);

  } catch (err: any) {
    console.error('Facebook OAuth error:', err);
    return res.redirect(`${getFrontendUrl()}/login?error=facebook_failed`);
  }
}
