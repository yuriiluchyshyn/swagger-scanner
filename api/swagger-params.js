import { getDb, ensureTables, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  await ensureTables();
  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`SELECT value FROM kv WHERE key = 'swagger-params'`;
    return json(res, rows[0]?.value ?? {});
  }

  if (req.method === 'POST') {
    const body = req.body;
    await sql`
      INSERT INTO kv (key, value) VALUES ('swagger-params', ${JSON.stringify(body)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
