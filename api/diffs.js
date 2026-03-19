import { getDb, json, getEmail } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const email = getEmail(req);
  if (!email) return json(res, { error: 'Missing X-User-Email' }, 401);
  const db = await getDb();
  const col = db.collection('diffs');

  if (req.method === 'GET') {
    const docs = await col.find({ email }, { sort: { createdAt: -1 } }).toArray();
    return json(res, docs.map(({ _id, createdAt, email: e, ...rest }) => rest));
  }
  if (req.method === 'POST') {
    await col.insertOne({ ...req.body, email, createdAt: new Date() });
    return json(res, { ok: true });
  }
  json(res, { error: 'Method not allowed' }, 405);
}
