import { getDb, json, getEmail } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const email = getEmail(req);
  if (!email) return json(res, { error: 'Missing X-User-Email' }, 401);
  const db = await getDb();
  const col = db.collection('checkpoints');

  const parts = req.url.split('?')[0].split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const index = lastPart !== 'checkpoints' ? parseInt(lastPart, 10) : NaN;

  if (req.method === 'GET' && !isNaN(index)) {
    const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
    const doc = docs[index];
    if (!doc) return json(res, { error: 'Not found' }, 404);
    const { _id, createdAt, email: e, ...data } = doc;
    return json(res, data);
  }
  if (req.method === 'GET') {
    const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
    return json(res, docs.map(({ _id, createdAt, email: e, endpoints, definitions, ...meta }, i) => ({ ...meta, index: i, endpointCount: (endpoints || []).length })));
  }
  if (req.method === 'POST') {
    const count = await col.countDocuments({ email });
    await col.insertOne({ ...req.body, email, createdAt: new Date() });
    return json(res, { ok: true, index: count });
  }
  if (req.method === 'DELETE' && !isNaN(index)) {
    const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
    const doc = docs[index];
    if (doc) await col.deleteOne({ _id: doc._id });
    return json(res, { ok: true });
  }
  json(res, { error: 'Method not allowed' }, 405);
}
