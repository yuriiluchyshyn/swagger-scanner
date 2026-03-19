import { neon } from '@neondatabase/serverless';

let _sql = null;

export function getDb() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// Run once on cold start to ensure tables exist
export async function ensureTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS kv (
      key   TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS scans (
      id         SERIAL PRIMARY KEY,
      data       JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS checkpoints (
      id         SERIAL PRIMARY KEY,
      data       JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS requests (
      id         TEXT PRIMARY KEY,
      key        TEXT,
      data       JSONB NOT NULL,
      pinned     BOOLEAN DEFAULT FALSE,
      saved_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS diffs (
      id         SERIAL PRIMARY KEY,
      data       JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function json(res, data, status = 200) {
  cors(res);
  res.status(status).json(data);
}
