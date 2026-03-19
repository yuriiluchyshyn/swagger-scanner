import { getDb, json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const db = await getDb();
  const kv = db.collection('kv');

  if (req.method === 'GET') {
    const doc = await kv.findOne({ _id: 'identity' });
    return json(res, doc?.value ?? {});
  }

  if (req.method === 'POST') {
    const { email } = req.body;
    await kv.updateOne({ _id: 'identity' }, { $set: { value: { email } } }, { upsert: true });
    return json(res, { ok: true });
  }

  // DELETE — wipe all user data
  if (req.method === 'DELETE') {
    await Promise.all([
      db.collection('kv').deleteMany({}),
      db.collection('scans').deleteMany({}),
      db.collection('checkpoints').deleteMany({}),
      db.collection('requests').deleteMany({}),
      db.collection('diffs').deleteMany({}),
    ]);
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
