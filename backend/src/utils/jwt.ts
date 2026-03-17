import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

export interface AccessTokenPayload {
  sub: string;       // user id
  email: string;
  role: string;
  jti: string;       // unique token id (for blacklisting)
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

// ✅ Read at call time — dotenv is guaranteed to have run by then
export function generateAccessToken(payload: Omit<AccessTokenPayload, 'jti'>): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, secret, { expiresIn: '15m' } as SignOptions);
}

export function generateRefreshToken(userId: string): { token: string; jti: string } {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti }, secret, { expiresIn: '7d' } as SignOptions);
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return jwt.verify(token, secret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
  return jwt.verify(token, secret) as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}