import { getDb, json, getEmail } from './_db.js';

export default async function handler(req, res) {
  console.log(`=== SCANS API REQUEST ===`);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', req.body ? JSON.stringify(req.body, null, 2) : 'No body');
  
  try {
    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      return json(res, {});
    }
    
    console.log('Getting email from headers...');
    const email = getEmail(req);
    console.log('Email:', email);
    
    if (!email) {
      console.log('Missing X-User-Email header');
      return json(res, { error: 'Missing X-User-Email' }, 401);
    }
    
    console.log('Connecting to database...');
    const db = await getDb();
    console.log('Database connection successful');
    
    const col = db.collection('scans');
    console.log('Got scans collection');

    if (req.method === 'GET') {
      console.log('Processing GET request...');
      const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
      console.log(`Found ${docs.length} scans for user`);
      const result = docs.map(({ _id, createdAt, email: e, ...rest }) => rest);
      console.log('=== SCANS GET SUCCESS ===');
      return json(res, result);
    }
    
    if (req.method === 'POST') {
      console.log('Processing POST request...');
      const body = req.body || {};
      console.log('Request body keys:', Object.keys(body));
      
      const count = await col.countDocuments({ email });
      console.log(`Current scan count for user: ${count}`);
      
      if (count >= 20) { 
        console.log('Removing oldest scan (limit reached)');
        const oldest = await col.findOne({ email }, { sort: { createdAt: 1 } }); 
        if (oldest) {
          await col.deleteOne({ _id: oldest._id });
          console.log('Oldest scan removed');
        }
      }
      
      const scanData = { ...body, email, createdAt: new Date() };
      console.log('Inserting scan data...');
      await col.insertOne(scanData);
      console.log('=== SCANS POST SUCCESS ===');
      return json(res, { ok: true });
    }
    
    console.log('Method not allowed:', req.method);
    json(res, { error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('=== SCANS API ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return json(res, { error: error.message }, 500);
  }
}
