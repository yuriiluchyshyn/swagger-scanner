import { getDb, ensureTables, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  await ensureTables();
  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`SELECT value FROM kv WHERE key = 'identity'`;
    return json(res, rows[0]?.value ?? {});
  }

  if (req.method === 'POST') {
    const { email } = req.body;
    await sql`
      INSERT INTO kv (key, value) VALUES ('identity', ${JSON.stringify({ email })}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    return json(res, { ok: true });
  }

  // DELETE — wipe all user data
  if (req.method === 'DELETE') {
    await sql`DELETE FROM kv`;
    await sql`DELETE FROM scans`;
    await sql`DELETE FROM checkpoints`;
    await sql`DELETE FROM requests`;
    await sql`DELETE FROM diffs`;
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
