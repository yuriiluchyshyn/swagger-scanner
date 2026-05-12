import { getDb, json, getEmail } from './_db.js';

// Combines: global-params, swagger-params, session, urls, identity, cors-settings
// Route via query param: /api/settings?type=global-params|swagger-params|session|urls|identity|cors-settings

export default async function handler(req, res) {
  console.log(`=== SETTINGS API REQUEST ===`);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  try {
    if (req.method === 'OPTIONS') return json(res, {});

    const { searchParams } = new URL(req.url, 'http://localhost');
    const type = searchParams.get('type');
    console.log('Settings type:', type);

    if (!type) return json(res, { error: 'Missing ?type= param (global-params|swagger-params|session|urls|identity|cors-settings)' }, 400);

    const email = getEmail(req);
    console.log('Email:', email);

    // --- Identity (DELETE only, no email required for other methods) ---
    if (type === 'identity') {
      if (req.method === 'DELETE' && email) {
        console.log('Deleting all user data...');
        const db = await getDb();
        await Promise.all([
          db.collection('kv').deleteMany({ email }),
          db.collection('scans').deleteMany({ email }),
          db.collection('checkpoints').deleteMany({ email }),
          db.collection('requests').deleteMany({ email }),
          db.collection('diffs').deleteMany({ email }),
        ]);
        console.log('User data deleted successfully');
        return json(res, { ok: true });
      }
      return json(res, { error: 'Method not allowed' }, 405);
    }

    // All other types require email
    if (!email) return json(res, { error: 'Missing X-User-Email' }, 401);

    const validTypes = ['global-params', 'swagger-params', 'session', 'urls', 'cors-settings'];
    if (!validTypes.includes(type)) return json(res, { error: `Invalid type: ${type}` }, 400);

    const db = await getDb();
    const kv = db.collection('kv');

    if (req.method === 'GET') {
      console.log(`Getting ${type} for user...`);
      const doc = await kv.findOne({ email, key: type });
      const fallback = type === 'urls' ? [] : {};
      const result = doc?.value ?? fallback;
      console.log(`Found ${type}:`, Object.keys(result).length, 'items');
      return json(res, result);
    }

    if (req.method === 'POST') {
      console.log(`Saving ${type} for user...`);
      const body = req.body || {};
      
      if (type === 'session') {
        // Session merges instead of replacing
        const doc = await kv.findOne({ email, key: 'session' });
        const merged = { ...(doc?.value ?? {}), ...body };
        await kv.updateOne({ email, key: 'session' }, { $set: { value: merged } }, { upsert: true });
        console.log('Session merged successfully');
      } else {
        await kv.updateOne({ email, key: type }, { $set: { value: body } }, { upsert: true });
        console.log(`${type} saved successfully`);
      }
      return json(res, { ok: true });
    }

    json(res, { error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('=== SETTINGS API ERROR ===');
    console.error('Error:', error.message);
    return json(res, { error: error.message }, 500);
  }
}