import { Request, Response } from 'express';
import * as photoService from '../services/photo.service';
import path from 'path';

// ── POST /api/photos/upload ───────────────────────────────────────────────────
export async function uploadPhotos(req: Request, res: Response) {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  try {
    const photos = await Promise.all(
      files.map((file) => photoService.savePhoto(req.user!.id, file, req)),
    );
    return res.status(201).json({ photos });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── GET /api/photos ── current user's photos ──────────────────────────────────
export async function listMyPhotos(req: Request, res: Response) {
  try {
    const photos = await photoService.listUserPhotos(req.user!.id);
    return res.json({ photos });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── GET /api/photos/:id ── preview/download a photo ───────────────────────────
export async function getPhoto(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const photo = await photoService.getPhoto(id);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    if (!photoService.canAccessPhoto(req.user!, photo)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filePath = photoService.getFilePath(photo.filename);
    return res.sendFile(filePath);
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── GET /api/photos/:id/download ── force download ────────────────────────────
export async function downloadPhoto(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const photo = await photoService.getPhoto(id);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    if (!photoService.canAccessPhoto(req.user!, photo)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filePath = photoService.getFilePath(photo.filename);
    return res.download(filePath, photo.original_name);
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── DELETE /api/photos/:id ────────────────────────────────────────────────────
export async function deletePhoto(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    await photoService.deletePhoto(req.user!, id, req);
    return res.json({ message: 'Photo deleted' });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── GET /api/admin/photos ── all users' photos (admin only) ──────────────────
export async function listAllPhotos(req: Request, res: Response) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const userId = req.query.user_id as string | undefined;
    const result = await photoService.listAllPhotos(page, limit, userId);
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}
