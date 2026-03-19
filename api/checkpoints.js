import { getDb, ensureTables, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  await ensureTables();
  const sql = getDb();

  const parts = req.url.split('?')[0].split('/').filter(Boolean);
  // parts: ['api', 'checkpoints'] or ['api', 'checkpoints', ':id']
  const idStr = parts[parts.length - 1];
  const id = idStr !== 'checkpoints' ? parseInt(idStr, 10) : NaN;

  // GET /api/checkpoints/:id
  if (req.method === 'GET' && !isNaN(id)) {
    const rows = await sql`SELECT id, data FROM checkpoints ORDER BY created_at ASC`;
    const row = rows[id];
    if (!row) return json(res, { error: 'Not found' }, 404);
    return json(res, row.data);
  }

  // GET /api/checkpoints
  if (req.method === 'GET') {
    const rows = await sql`SELECT id, data, created_at FROM checkpoints ORDER BY created_at ASC`;
    return json(res, rows.map((r, i) => ({
      timestamp: r.data.timestamp,
      sourceUrls: r.data.sourceUrls,
      index: i,
      endpointCount: (r.data.endpoints || []).length,
      _dbId: r.id,
    })));
  }

  // POST /api/checkpoints
  if (req.method === 'POST') {
    const body = req.body;
    const rows = await sql`SELECT COUNT(*) FROM checkpoints`;
    const index = parseInt(rows[0].count);
    await sql`INSERT INTO checkpoints (data) VALUES (${JSON.stringify(body)}::jsonb)`;
    return json(res, { ok: true, index });
  }

  // DELETE /api/checkpoints/:id
  if (req.method === 'DELETE' && !isNaN(id)) {
    const rows = await sql`SELECT id FROM checkpoints ORDER BY created_at ASC`;
    const row = rows[id];
    if (row) await sql`DELETE FROM checkpoints WHERE id = ${row.id}`;
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
