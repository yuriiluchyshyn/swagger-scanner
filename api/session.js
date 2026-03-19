import { getDb, json, getEmail } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const email = getEmail(req);
  if (!email) return json(res, { error: 'Missing X-User-Email' }, 401);
  const db = await getDb();
  const kv = db.collection('kv');

  if (req.method === 'GET') {
    const doc = await kv.findOne({ email, key: 'session' });
    return json(res, doc?.value ?? {});
  }
  if (req.method === 'POST') {
    const doc = await kv.findOne({ email, key: 'session' });
    const merged = { ...(doc?.value ?? {}), ...req.body };
    await kv.updateOne({ email, key: 'session' }, { $set: { value: merged } }, { upsert: true });
    return json(res, { ok: true });
  }
  json(res, { error: 'Method not allowed' }, 405);
}
