import { getDb, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const db = await getDb();
  const col = db.collection('diffs');

  if (req.method === 'GET') {
    const docs = await col.find({}, { sort: { createdAt: -1 } }).toArray();
    return json(res, docs.map(({ _id, createdAt, ...rest }) => rest));
  }

  if (req.method === 'POST') {
    await col.insertOne({ ...req.body, createdAt: new Date() });
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
