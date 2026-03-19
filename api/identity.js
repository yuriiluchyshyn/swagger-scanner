import { getDb, json, getEmail } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  const email = getEmail(req);

  if (req.method === 'DELETE' && email) {
    const db = await getDb();
    await Promise.all([
      db.collection('kv').deleteMany({ email }),
      db.collection('scans').deleteMany({ email }),
      db.collection('checkpoints').deleteMany({ email }),
      db.collection('requests').deleteMany({ email }),
      db.collection('diffs').deleteMany({ email }),
    ]);
    return json(res, { ok: true });
  }

  json(res, { error: 'Method not allowed' }, 405);
}
