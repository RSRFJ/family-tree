import { readFileSync } from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const sql = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('[migrate] schema applied');
} catch (e) {
  console.error('[migrate] failed:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
