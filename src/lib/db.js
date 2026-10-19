import pg from 'pg';

const { Pool } = pg;

const globalForDb = globalThis;

export const pool =
  globalForDb.__ftPool ||
  (globalForDb.__ftPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  }));

export const q = (text, params) => pool.query(text, params);
