import { getDb, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const db = await getDb();
  const kv = db.collection('kv');

  if (req.method === 'GET') {
    const doc = await kv.findOne({ _id: 'global-params' });
    return json(res, doc?.value ?? {});
  }

  if (req.method === 'POST') {
    await kv.updateOne({ _id: 'global-params' }, { $set: { value: req.body } }, { upsert: true });
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
