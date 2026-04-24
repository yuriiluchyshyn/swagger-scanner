import { getDb, json, getEmail } from './_db.js';

// Combines: scans, diffs
// Route via query param: /api/data?type=scans|diffs

export default async function handler(req, res) {
  console.log(`=== DATA API REQUEST ===`);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  try {
    if (req.method === 'OPTIONS') return json(res, {});
    
    const email = getEmail(req);
    if (!email) return json(res, { error: 'Missing X-User-Email' }, 401);

    const { searchParams } = new URL(req.url, 'http://localhost');
    const type = searchParams.get('type');
    console.log('Data type:', type);
    
    if (!type || !['scans', 'diffs'].includes(type)) {
      return json(res, { error: 'Missing or invalid ?type= (scans|diffs)' }, 400);
    }

    const db = await getDb();
    const col = db.collection(type);

    if (type === 'scans') {
      if (req.method === 'GET') {
        console.log('Getting scans for user...');
        const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
        console.log(`Found ${docs.length} scans`);
        return json(res, docs.map(({ _id, createdAt, email: e, ...rest }) => rest));
      }
      if (req.method === 'POST') {
        console.log('Saving new scan...');
        const body = req.body || {};
        const count = await col.countDocuments({ email });
        console.log(`Current scan count: ${count}`);
        
        if (count >= 20) { 
          console.log('Removing oldest scan (limit reached)');
          const oldest = await col.findOne({ email }, { sort: { createdAt: 1 } }); 
          if (oldest) await col.deleteOne({ _id: oldest._id }); 
        }
        await col.insertOne({ ...body, email, createdAt: new Date() });
        console.log('Scan saved successfully');
        return json(res, { ok: true });
      }
    }

    if (type === 'diffs') {
      if (req.method === 'GET') {
        console.log('Getting diffs for user...');
        const docs = await col.find({ email }, { sort: { createdAt: -1 } }).toArray();
        console.log(`Found ${docs.length} diffs`);
        return json(res, docs.map(({ _id, createdAt, email: e, ...rest }) => rest));
      }
      if (req.method === 'POST') {
        console.log('Saving new diff...');
        const body = req.body || {};
        await col.insertOne({ ...body, email, createdAt: new Date() });
        console.log('Diff saved successfully');
        return json(res, { ok: true });
      }
    }

    json(res, { error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('=== DATA API ERROR ===');
    console.error('Error:', error.message);
    return json(res, { error: error.message }, 500);
  }
}