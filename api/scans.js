import { getDb, ensureTables, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  await ensureTables();
  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`SELECT data FROM scans ORDER BY created_at ASC`;
    return json(res, rows.map(r => r.data));
  }

  if (req.method === 'POST') {
    const body = req.body;
    // Keep only last 20
    const count = await sql`SELECT COUNT(*) FROM scans`;
    if (parseInt(count[0].count) >= 20) {
      await sql`DELETE FROM scans WHERE id = (SELECT id FROM scans ORDER BY created_at ASC LIMIT 1)`;
    }
    await sql`INSERT INTO scans (data) VALUES (${JSON.stringify(body)}::jsonb)`;
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
