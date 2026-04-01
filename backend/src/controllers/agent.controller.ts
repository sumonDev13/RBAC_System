import { Request, Response } from 'express';
import { runAgent } from '../agent/agent.service';

// ── POST /api/agent/chat ──────────────────────────────────────────────────────
export async function chat(req: Request, res: Response) {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'message (string) is required' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ message: 'Message too long (max 2000 chars)' });
  }

  try {
    const result = await runAgent(message);
    return res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || 'Agent error' });
  }
}
