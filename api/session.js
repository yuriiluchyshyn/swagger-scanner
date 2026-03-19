import { getDb, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const db = await getDb();
  const kv = db.collection('kv');

  if (req.method === 'GET') {
    const doc = await kv.findOne({ _id: 'session' });
    return json(res, doc?.value ?? {});
  }

  if (req.method === 'POST') {
    // Merge with existing session
    const doc = await kv.findOne({ _id: 'session' });
    const merged = { ...(doc?.value ?? {}), ...req.body };
    await kv.updateOne({ _id: 'session' }, { $set: { value: merged } }, { upsert: true });
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
