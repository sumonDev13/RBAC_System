import { query } from '../db/pool';
import { auditLog } from './audit.service';
import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '../config/upload';
import { Request } from 'express';
import { User } from '../interfaces';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PhotoRecord {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
  owner_email?: string;
  owner_first_name?: string;
  owner_last_name?: string;
}

// ── Save photo metadata ───────────────────────────────────────────────────────

export async function savePhoto(
  userId: string,
  file: Express.Multer.File,
  req: Request,
): Promise<PhotoRecord> {
  const result = await query<PhotoRecord>(
    `INSERT INTO user_photos (user_id, filename, original_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, filename, original_name, mime_type, size_bytes, created_at`,
    [userId, file.filename, file.originalname, file.mimetype, file.size],
  );

  const photo = result.rows[0];
  await auditLog({
    actorId: userId,
    targetId: userId,
    action: 'photo.uploaded',
    metadata: { filename: file.originalname, size: file.size },
    req,
  });

  return photo;
}

// ── List photos for a specific user ───────────────────────────────────────────

export async function listUserPhotos(userId: string): Promise<PhotoRecord[]> {
  const result = await query<PhotoRecord>(
    `SELECT id, user_id, filename, original_name, mime_type, size_bytes, created_at
     FROM user_photos
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
}

// ── List ALL photos (admin) ───────────────────────────────────────────────────

export async function listAllPhotos(
  page: number = 1,
  limit: number = 50,
  filterUserId?: string,
): Promise<{ photos: PhotoRecord[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;
  const params: any[] = [];
  let where = '';

  if (filterUserId) {
    params.push(filterUserId);
    where = `WHERE p.user_id = $${params.length}`;
  }

  params.push(limit);
  params.push(offset);

  const result = await query<PhotoRecord & { owner_email: string; owner_first_name: string; owner_last_name: string }>(
    `SELECT p.id, p.user_id, p.filename, p.original_name, p.mime_type, p.size_bytes, p.created_at,
            u.email AS owner_email, u.first_name AS owner_first_name, u.last_name AS owner_last_name
     FROM user_photos p
     JOIN users u ON u.id = p.user_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  // Count total
  const countParams: any[] = [];
  let countWhere = '';
  if (filterUserId) {
    countParams.push(filterUserId);
    countWhere = `WHERE user_id = $1`;
  }
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM user_photos ${countWhere}`,
    countParams,
  );

  return {
    photos: result.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    limit,
  };
}

// ── Get single photo (with ownership check) ───────────────────────────────────

export async function getPhoto(photoId: string): Promise<PhotoRecord | null> {
  const result = await query<PhotoRecord>(
    `SELECT id, user_id, filename, original_name, mime_type, size_bytes, created_at
     FROM user_photos WHERE id = $1`,
    [photoId],
  );
  return result.rows[0] || null;
}

// ── Check if user can access photo ────────────────────────────────────────────

export function canAccessPhoto(user: User, photo: PhotoRecord): boolean {
  return user.role === 'admin' || photo.user_id === user.id;
}

// ── Delete photo ──────────────────────────────────────────────────────────────

export async function deletePhoto(
  user: User,
  photoId: string,
  req: Request,
): Promise<void> {
  const photo = await getPhoto(photoId);
  if (!photo) {
    throw { status: 404, message: 'Photo not found' };
  }

  // Only owner or admin can delete
  if (photo.user_id !== user.id && user.role !== 'admin') {
    throw { status: 403, message: 'Access denied' };
  }

  // Delete file from disk
  const filePath = path.join(UPLOAD_DIR, photo.filename);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File may already be deleted, continue
  }

  // Delete DB record
  await query('DELETE FROM user_photos WHERE id = $1', [photoId]);

  await auditLog({
    actorId: user.id,
    targetId: photo.user_id,
    action: 'photo.deleted',
    metadata: { filename: photo.original_name },
    req,
  });
}

// ── Get file path on disk ─────────────────────────────────────────────────────

export function getFilePath(filename: string): string {
  return path.join(UPLOAD_DIR, filename);
}
