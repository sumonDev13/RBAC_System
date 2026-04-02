import { query } from '../db/pool';
import { auditLog } from './audit.service';
import cloudinary from '../config/cloudinary';
import { Request } from 'express';
import { User } from '../interfaces';
import stream from 'stream';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PhotoRecord {
  id: string;
  user_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  cloudinary_url: string;
  cloudinary_public_id: string;
  created_at: Date;
  owner_email?: string;
  owner_first_name?: string;
  owner_last_name?: string;
}

// ── Upload to Cloudinary ──────────────────────────────────────────────────────

function uploadToCloudinary(buffer: Buffer, filename: string): Promise<{ url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'rbac-photos',
        public_id: filename,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Upload failed'));
        resolve({ url: result.secure_url, public_id: result.public_id });
      },
    );
    const readable = new stream.PassThrough();
    readable.end(buffer);
    readable.pipe(uploadStream);
  });
}

// ── Save photo metadata ───────────────────────────────────────────────────────

export async function savePhoto(
  userId: string,
  file: Express.Multer.File,
  req: Request,
): Promise<PhotoRecord> {
  const safeName = file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueName = `${userId}_${safeName}_${Date.now()}`;

  const { url, public_id } = await uploadToCloudinary(file.buffer, uniqueName);

  const result = await query<PhotoRecord>(
    `INSERT INTO user_photos (user_id, original_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, original_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, created_at`,
    [userId, file.originalname, file.mimetype, file.size, url, public_id],
  );

  const photo = result.rows[0];
  await auditLog({
    actorId: userId,
    targetId: userId,
    action: 'photo.uploaded',
    metadata: { filename: file.originalname, size: file.size, cloudinary_url: url },
    req,
  });

  return photo;
}

// ── List photos for a specific user ───────────────────────────────────────────

export async function listUserPhotos(userId: string): Promise<PhotoRecord[]> {
  const result = await query<PhotoRecord>(
    `SELECT id, user_id, original_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, created_at
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

  const result = await query<PhotoRecord>(
    `SELECT p.id, p.user_id, p.original_name, p.mime_type, p.size_bytes, p.cloudinary_url, p.cloudinary_public_id, p.created_at,
            u.email AS owner_email, u.first_name AS owner_first_name, u.last_name AS owner_last_name
     FROM user_photos p
     JOIN users u ON u.id = p.user_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

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

// ── Get single photo ──────────────────────────────────────────────────────────

export async function getPhoto(photoId: string): Promise<PhotoRecord | null> {
  const result = await query<PhotoRecord>(
    `SELECT id, user_id, original_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, created_at
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

  if (photo.user_id !== user.id && user.role !== 'admin') {
    throw { status: 403, message: 'Access denied' };
  }

  // Delete from Cloudinary
  try {
    await cloudinary.uploader.destroy(photo.cloudinary_public_id);
  } catch {
    // Continue even if Cloudinary delete fails
  }

  // Delete DB record
  await query('DELETE FROM user_photos WHERE id = $1', [photoId]);

  await auditLog({
    actorId: user.id,
    targetId: photo.user_id,
    action: 'photo.deleted',
    metadata: { filename: photo.original_name, cloudinary_public_id: photo.cloudinary_public_id },
    req,
  });
}
