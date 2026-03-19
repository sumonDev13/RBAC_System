// import { Pool } from 'pg';
// import dotenv from 'dotenv';

// dotenv.config();

// export const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 2000,
// });

// pool.on('error', (err) => {
//   console.error('Unexpected error on idle client', err);
//   process.exit(-1);
// });

// export const query = async <T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> => {
//   const result = await pool.query(text, params);
//   return {
//     rows: result.rows as T[],
//     rowCount: result.rowCount ?? null,
//   };
// };

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
});

// Define the query function
export const query = async <T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> => {
  const result = await pool.query(text, params);
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? null,
  };
};

// Test connection with retry logic
const connectWithRetry = async () => {
  let retries = 5;
  while (retries) {
    try {
      const client = await pool.connect();
      console.log('✅ Connected to the database successfully!');
      client.release();
      return;
    } catch (err) {
      console.log(`❌ Database connection failed. Retries left: ${retries - 1}`);
      console.error('Error:', err);
      retries -= 1;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  throw new Error('Unable to connect to database');
};

connectWithRetry().catch(console.error);

export default pool;