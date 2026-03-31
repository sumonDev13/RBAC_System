import crypto from 'crypto';

interface PendingAuth {
  accessToken: string;
  expiresAt: number;
}

// In production, use Redis. This is fine for single-server deployments.
const pendingAuths = new Map<string, PendingAuth>();

const TOKEN_TTL_MS = 30_000; // 30 seconds

export function createPendingAuth(accessToken: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  pendingAuths.set(token, {
    accessToken,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  // Auto-cleanup
  setTimeout(() => pendingAuths.delete(token), TOKEN_TTL_MS);
  return token;
}

export function consumePendingAuth(token: string): string | null {
  const entry = pendingAuths.get(token);
  if (!entry) return null;
  pendingAuths.delete(token);
  if (Date.now() > entry.expiresAt) return null;
  return entry.accessToken;
}
