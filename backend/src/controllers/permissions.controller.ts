import { Request, Response } from 'express';
import * as permissionService from '../services/permission.service';

// ── GET /api/permissions ── all available atoms ───────────────────────────────
export async function listPermissions(_req: Request, res: Response) {
  try {
    const permissions = await permissionService.listPermissions();
    return res.json({ permissions });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── GET /api/users/:id/permissions ── resolved permissions for a user ─────────
export async function getUserPermissions(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const permissions = await permissionService.getUserPermissions(req.user!, id);
    return res.json({ permissions });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

// ── PUT /api/users/:id/permissions ── grant/revoke with ceiling check ─────────
export async function setUserPermissions(req: Request, res: Response) {
  const targetUserId = String(req.params.id);

  try {
    await permissionService.setUserPermissions(
      req.user!,
      targetUserId,
      req.body.permissions,
      req,
    );
    return res.json({ message: 'Permissions updated' });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      message: err.message,
      forbidden: err.forbidden,
    });
  }
}
