import { getDb, ensureTables, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  await ensureTables();
  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`SELECT data FROM diffs ORDER BY created_at DESC`;
    return json(res, rows.map(r => r.data));
  }

  if (req.method === 'POST') {
    const body = req.body;
    await sql`INSERT INTO diffs (data) VALUES (${JSON.stringify(body)}::jsonb)`;
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
