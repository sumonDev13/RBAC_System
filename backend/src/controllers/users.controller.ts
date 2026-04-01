import { Request, Response } from 'express';
import * as userService from '../services/user.service';

// ── GET /api/users ────────────────────────────────────────────────────────────
export async function listUsers(req: Request, res: Response) {
  try {
    const result = await userService.listUsers(req.user!, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      role: req.query.role as string | undefined,
      status: req.query.status as string | undefined,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── POST /api/users ───────────────────────────────────────────────────────────
export async function createUser(req: Request, res: Response) {
  try {
    const user = await userService.createUser(req.user!, req.body, req);
    return res.status(201).json({ user });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message, errors: err.errors });
  }
}

// ── GET /api/users/:id ────────────────────────────────────────────────────────
export async function getUser(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const user = await userService.getUser(req.user!, id);
    return res.json({ user });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
export async function updateUser(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const user = await userService.updateUser(req.user!, id, req.body, req);
    return res.json({ user });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── DELETE /api/users/:id (soft-delete via ban) ───────────────────────────────
export async function deleteUser(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    await userService.deleteUser(req.user!, id, req);
    return res.json({ message: 'User banned' });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}
