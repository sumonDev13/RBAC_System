import { Request, Response } from 'express';
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
    console.error('Audit log write failed:', err);
  }
}

// ── GET /api/audit ─────────────────────────────────────────────────────────────

export async function listAuditLogs(req: Request, res: Response) {
  const { page = '1', limit = '20', action, actor_id } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const params: any[] = [];
  let where = 'WHERE 1=1';

  if (action) { params.push(action); where += ` AND al.action = $${params.length}`; }
  if (actor_id) { params.push(actor_id); where += ` AND al.actor_id = $${params.length}`; }

  // Fetch rows
  const dataSql = `
    SELECT al.id, al.action, al.metadata, al.ip_address, al.created_at,
           actor.first_name AS actor_first, actor.last_name AS actor_last, actor.email AS actor_email,
           target.first_name AS target_first, target.last_name AS target_last
    FROM audit_logs al
    LEFT JOIN users actor ON actor.id = al.actor_id
    LEFT JOIN users target ON target.id = al.target_id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  // Count total
  const countSql = `SELECT COUNT(*) as total FROM audit_logs al ${where}`;

  const [dataResult, countResult] = await Promise.all([
    query(dataSql, [...params, limitNum, offset]),
    query(countSql, params),
  ]);

  return res.json({
    logs: dataResult.rows,
    total: parseInt(countResult.rows[0].total),
    page: pageNum,
    limit: limitNum,
  });
}
