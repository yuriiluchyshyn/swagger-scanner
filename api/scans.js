import { getDb, json, getEmail } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const email = getEmail(req);
  if (!email) return json(res, { error: 'Missing X-User-Email' }, 401);
  const db = await getDb();
  const col = db.collection('scans');

  if (req.method === 'GET') {
    const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
    return json(res, docs.map(({ _id, createdAt, email: e, ...rest }) => rest));
  }
  if (req.method === 'POST') {
    const count = await col.countDocuments({ email });
    if (count >= 20) { const oldest = await col.findOne({ email }, { sort: { createdAt: 1 } }); if (oldest) await col.deleteOne({ _id: oldest._id }); }
    await col.insertOne({ ...req.body, email, createdAt: new Date() });
    return json(res, { ok: true });
  }
  json(res, { error: 'Method not allowed' }, 405);
}
