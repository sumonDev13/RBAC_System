import { Router } from 'express';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { login, logout, refresh, me, exchange, verifyEmail, resendVerification } from '../controllers/auth.controller';
import { listUsers, createUser, getUser, updateUser, deleteUser } from '../controllers/users.controller';
import { listPermissions, getUserPermissions, setUserPermissions } from '../controllers/permissions.controller';
import { listAuditLogs } from '../services/audit.service';
import { googleRedirect, googleCallback } from '../controllers/google_auth.controller';
import { facebookCallback, facebookRedirect } from '../controllers/facebook_auth.controller';
import { authRateLimiter } from '../middleware/rateLimiter';
import { chat } from '../controllers/agent.controller';
import { upload } from '../config/upload';
import { uploadPhotos, listMyPhotos, getPhoto, deletePhoto, listAllPhotos } from '../controllers/photo.controller';

const router = Router();

// ── Facebook OAuth ────────────────────────────────────────────────────────────
router.get('/auth/facebook',          authRateLimiter, facebookRedirect);
router.get('/auth/facebook/callback', facebookCallback);

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.get('/auth/google',          authRateLimiter, googleRedirect);
router.get('/auth/google/callback', googleCallback);

// ── Auth (public) ─────────────────────────────────────────────────────────────
router.post('/auth/login',   authRateLimiter, login);
router.post('/auth/refresh', refresh);
router.post('/auth/exchange', authRateLimiter, exchange);
router.get('/auth/verify-email', verifyEmail);
router.post('/auth/resend-verification', authRateLimiter, resendVerification);
router.post('/auth/logout',  authenticate, logout);
router.get('/auth/me',       authenticate, me);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users',        authenticate, requirePermission('users.view'),   listUsers);
router.post('/users',       authenticate, requirePermission('users.manage'), createUser);
router.get('/users/:id',    authenticate, requirePermission('users.view'),   getUser);
router.patch('/users/:id',  authenticate, requirePermission('users.manage'), updateUser);
router.delete('/users/:id', authenticate, requireRole('admin'),              deleteUser);

// ── Permissions ───────────────────────────────────────────────────────────────
router.get('/permissions',               authenticate, requirePermission('permissions.manage'), listPermissions);
router.get('/users/:id/permissions',     authenticate, requirePermission('permissions.manage'), getUserPermissions);
router.put('/users/:id/permissions',     authenticate, requirePermission('permissions.manage'), setUserPermissions);

// ── Audit log ─────────────────────────────────────────────────────────────────
router.get('/audit', authenticate, requirePermission('audit.view'), listAuditLogs);

// ── AI Agent (admin only) ─────────────────────────────────────────────────────
router.post('/agent/chat', authenticate, requireRole('admin'), chat);

// ── Photos (any authenticated user) ───────────────────────────────────────────
router.post('/photos/upload',  authenticate, upload.array('photos', 5), uploadPhotos);
router.get('/photos',          authenticate, listMyPhotos);
router.get('/photos/:id',      authenticate, getPhoto);
router.delete('/photos/:id',   authenticate, deletePhoto);

// ── Admin: all photos ─────────────────────────────────────────────────────────
router.get('/admin/photos',       authenticate, requireRole('admin'), listAllPhotos);

export default router;
