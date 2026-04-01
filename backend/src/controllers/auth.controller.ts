import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from '../config/cookies';
import { getFrontendUrl } from '../utils/url';

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password, req);

    res.cookie(ACCESS_COOKIE, result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
export async function refresh(req: Request, res: Response) {
  const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token' });
  }

  try {
    const result = await authService.refresh(refreshToken);

    res.cookie(ACCESS_COOKIE, result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({ accessToken: result.accessToken });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
export async function logout(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.[ACCESS_COOKIE];

  await authService.logout(token, req.user, req);

  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });

  return res.json({ message: 'Logged out successfully' });
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export async function me(req: Request, res: Response) {
  try {
    const result = await authService.getMe(req.user!.id);
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── POST /api/auth/exchange ───────────────────────────────────────────────────
export async function exchange(req: Request, res: Response) {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Token required' });
  }

  try {
    const result = await authService.exchangePendingToken(token);

    res.cookie(ACCESS_COOKIE, result.accessToken, ACCESS_COOKIE_OPTIONS);

    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── GET /api/auth/verify-email ─────────────────────────────────────────────────
export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Verification token required' });
  }

  try {
    await authService.verifyEmail(token, req);
    const frontendUrl = getFrontendUrl();
    return res.redirect(`${frontendUrl}/login?verified=true`);
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── POST /api/auth/resend-verification ─────────────────────────────────────────
export async function resendVerification(req: Request, res: Response) {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Email required' });
  }

  const message = await authService.resendVerification(email);
  return res.json({ message });
}
