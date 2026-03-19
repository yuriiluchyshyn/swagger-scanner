import { getDb, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const db = await getDb();
  const col = db.collection('requests');

  const parts = req.url.split('?')[0].split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isById = lastPart !== 'requests';

  // GET /api/requests
  if (req.method === 'GET' && !isById) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const key = searchParams.get('key');
    const pinned = searchParams.get('pinned') === 'true';
    const limit = parseInt(searchParams.get('limit') || '0');

    const filter = {};
    if (key) filter.key = key;
    if (pinned) filter.pinned = true;

    let cursor = col.find(filter, { sort: { savedAt: -1 } });
    if (limit > 0) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return json(res, docs.map(({ _id, ...rest }) => rest));
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
    await col.insertOne(entry);
    return json(res, { ok: true, id });
  }

  // PATCH /api/requests/:id
  if (req.method === 'PATCH' && isById) {
    const body = req.body;
    const update = {};
    if (body.pinned !== undefined) update.pinned = body.pinned;
    if (body.label !== undefined) update.label = body.label;
    await col.updateOne({ id: lastPart }, { $set: update });
    return json(res, { ok: true });
  }

  // DELETE /api/requests/:id
  if (req.method === 'DELETE' && isById) {
    await col.deleteOne({ id: lastPart });
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
