import { getDb, json, getEmail } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const email = getEmail(req);
  if (!email) return json(res, { error: 'Missing X-User-Email' }, 401);
  const db = await getDb();
  const kv = db.collection('kv');

  if (req.method === 'GET') {
    const doc = await kv.findOne({ email, key: 'swagger-params' });
    return json(res, doc?.value ?? {});
  }
  if (req.method === 'POST') {
    await kv.updateOne({ email, key: 'swagger-params' }, { $set: { value: req.body } }, { upsert: true });
    return json(res, { ok: true });
  }
  json(res, { error: 'Method not allowed' }, 405);
}
