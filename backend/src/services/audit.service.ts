// ── Audit Log Service ─────────────────────────────────────────────────────────
import { Request } from 'express';
import { query } from '../db/pool';

interface AuditOptions {
  actorId: string | null;
  targetId: string | null;
  action: string;
  metadata?: Record<string, any>;
  req?: Request;
}

export async function auditLog({ actorId, targetId, action, metadata, req }: AuditOptions) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, target_id, action, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        targetId,
        action,
        metadata ? JSON.stringify(metadata) : null,
        req?.ip ?? null,
        req?.headers['user-agent'] ?? null,
      ]
    );
  } catch (err) {
    // Never let audit failures crash the request
    console.error('Audit log write failed:', err);
  }
}

// ── GET /api/audit ─────────────────────────────────────────────────────────────
import { Response } from 'express';

export async function listAuditLogs(req: Request, res: Response) {
  const { page = '1', limit = '50', action, actor_id } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const params: any[] = [];
  let sql = `
    SELECT al.id, al.action, al.metadata, al.ip_address, al.created_at,
           actor.first_name AS actor_first, actor.last_name AS actor_last, actor.email AS actor_email,
           target.first_name AS target_first, target.last_name AS target_last
    FROM audit_logs al
    LEFT JOIN users actor ON actor.id = al.actor_id
    LEFT JOIN users target ON target.id = al.target_id
    WHERE 1=1
  `;
  if (action) { params.push(action); sql += ` AND al.action = $${params.length}`; }
  if (actor_id) { params.push(actor_id); sql += ` AND al.actor_id = $${params.length}`; }

  sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ logs: result.rows, page: Number(page), limit: Number(limit) });
}