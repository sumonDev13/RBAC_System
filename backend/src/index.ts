import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
dotenv.config();

import router from './routes';

const app = express();
const PORT = process.env.PORT || 5001;

//security
app.use(helmet());
app.set('trust proxy', 1);

const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',') 
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS Error: Origin ${origin} not allowed`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


// Global rate limit
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true }));

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', router);
 
// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
 
// 404
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
 
// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});
 
app.listen(PORT, () => {
  console.log(`🚀 RBAC backend running on port ${PORT}`);
});
 
export default app;