import { query } from '../db/pool';
import crypto from 'crypto';

// In production, use an email service (SendGrid, SES, etc.)
// For now, this just generates tokens and provides verification logic.

export async function createVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `UPDATE users SET email_verification_token = $1, email_verification_expires_at = $2 WHERE id = $3`,
    [token, expiresAt, userId]
  );

  return token;
}

export async function verifyEmailToken(token: string): Promise<string | null> {
  const result = await query(
    `SELECT id FROM users
     WHERE email_verification_token = $1
       AND email_verification_expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) return null;

  const userId = result.rows[0].id;
  await query(
    `UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = $1`,
    [userId]
  );

  return userId;
}
