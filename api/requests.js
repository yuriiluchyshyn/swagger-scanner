import { getDb, ensureTables, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  await ensureTables();
  const sql = getDb();

  const parts = req.url.split('?')[0].split('/').filter(Boolean);
  const idStr = parts[parts.length - 1];
  const isById = idStr !== 'requests';

  // GET /api/requests
  if (req.method === 'GET' && !isById) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const key = searchParams.get('key');
    const pinned = searchParams.get('pinned') === 'true';
    const limit = parseInt(searchParams.get('limit') || '0');

    let rows;
    if (key && pinned) {
      rows = await sql`SELECT data FROM requests WHERE key = ${key} AND pinned = TRUE ORDER BY saved_at DESC`;
    } else if (key) {
      rows = await sql`SELECT data FROM requests WHERE key = ${key} ORDER BY saved_at DESC`;
    } else if (pinned) {
      rows = await sql`SELECT data FROM requests WHERE pinned = TRUE ORDER BY saved_at DESC`;
    } else {
      rows = await sql`SELECT data FROM requests ORDER BY saved_at DESC`;
    }

    let results = rows.map(r => r.data);
    if (limit > 0) results = results.slice(0, limit);
    return json(res, results);
  }

  // POST /api/requests
  if (req.method === 'POST' && !isById) {
    const body = req.body;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      key: body.key,
      label: body.label || '',
      apiTitle: body.apiTitle || '',
      method: body.method,
      path: body.path,
      fullUrl: body.fullUrl,
      payload: body.payload || null,
      pathOverrides: body.pathOverrides || {},
      swaggerParams: body.swaggerParams || {},
      response: body.response || null,
      pinned: body.pinned || false,
      savedAt: new Date().toISOString(),
    };
    await sql`
      INSERT INTO requests (id, key, data, pinned, saved_at)
      VALUES (${id}, ${entry.key}, ${JSON.stringify(entry)}::jsonb, ${entry.pinned}, NOW())
    `;
    return json(res, { ok: true, id });
  }

  // PATCH /api/requests/:id
  if (req.method === 'PATCH' && isById) {
    const body = req.body;
    const rows = await sql`SELECT data FROM requests WHERE id = ${idStr}`;
    if (!rows[0]) return json(res, { error: 'Not found' }, 404);
    const entry = { ...rows[0].data };
    if (body.pinned !== undefined) entry.pinned = body.pinned;
    if (body.label !== undefined) entry.label = body.label;
    await sql`UPDATE requests SET data = ${JSON.stringify(entry)}::jsonb, pinned = ${entry.pinned} WHERE id = ${idStr}`;
    return json(res, { ok: true });
  }

  // DELETE /api/requests/:id
  if (req.method === 'DELETE' && isById) {
    await sql`DELETE FROM requests WHERE id = ${idStr}`;
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
