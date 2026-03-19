import { getDb, json, getEmail } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const email = getEmail(req);
  if (!email) return json(res, { error: 'Missing X-User-Email' }, 401);
  const db = await getDb();
  const col = db.collection('requests');

  const parts = req.url.split('?')[0].split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isById = lastPart !== 'requests';

  if (req.method === 'GET' && !isById) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const filter = { email };
    if (searchParams.get('key')) filter.key = searchParams.get('key');
    if (searchParams.get('pinned') === 'true') filter.pinned = true;
    const limit = parseInt(searchParams.get('limit') || '0');
    let cursor = col.find(filter, { sort: { savedAt: -1 } });
    if (limit > 0) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return json(res, docs.map(({ _id, email: e, ...rest }) => rest));
  }
  if (req.method === 'POST' && !isById) {
    const body = req.body;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = { id, email, key: body.key, label: body.label || '', apiTitle: body.apiTitle || '', method: body.method, path: body.path, fullUrl: body.fullUrl, payload: body.payload || null, pathOverrides: body.pathOverrides || {}, swaggerParams: body.swaggerParams || {}, response: body.response || null, pinned: body.pinned || false, savedAt: new Date().toISOString() };
    await col.insertOne(entry);
    return json(res, { ok: true, id });
  }
  if (req.method === 'PATCH' && isById) {
    const update = {};
    if (req.body.pinned !== undefined) update.pinned = req.body.pinned;
    if (req.body.label !== undefined) update.label = req.body.label;
    await col.updateOne({ id: lastPart, email }, { $set: update });
    return json(res, { ok: true });
  }
  if (req.method === 'DELETE' && isById) {
    await col.deleteOne({ id: lastPart, email });
    return json(res, { ok: true });
  }
  json(res, { error: 'Method not allowed' }, 405);
}
