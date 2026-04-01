import { query } from '../db/pool';
import crypto from 'crypto';
import { sendMail } from './email.service';

export async function createVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `UPDATE users SET email_verification_token = $1, email_verification_expires_at = $2 WHERE id = $3`,
    [token, expiresAt, userId]
  );

  return token;
}

export function getVerificationUrl(token: string): string {
  const baseUrl = (process.env.API_URL ?? 'http://localhost:5001').replace(/\/$/, '');
  return `${baseUrl}/api/auth/verify-email?token=${token}`;
}

export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = await createVerificationToken(userId);
  const url = getVerificationUrl(token);

  await sendMail({
    to: email,
    subject: 'Verify your email - RBAC System',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin-bottom: 16px;">Verify your email</h2>
        <p style="color: #555; margin-bottom: 24px;">
          Click the button below to verify your email address. This link expires in 24 hours.
        </p>
        <a href="${url}"
           style="display: inline-block; background: #18181b; color: #fff; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 500;">
          Verify Email
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  });
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
