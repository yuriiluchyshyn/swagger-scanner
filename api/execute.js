import { json, cors } from './_db.js';

export default async function handler(req, res) {
  console.log(`=== EXECUTE API REQUEST ===`);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    cors(res);
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return json(res, { error: 'Method not allowed' }, 405);
  }

  console.log('Request body:', req.body ? JSON.stringify(req.body, null, 2) : 'No body');

  // Check if request body exists
  if (!req.body) {
    console.log('Request body is missing');
    return json(res, { error: 'Request body is missing' }, 400);
  }

  const { url, method, headers, body } = req.body;
  console.log('Extracted params:', { url, method, headers: headers ? 'present' : 'missing', body: body ? 'present' : 'missing' });
  
  // Validate required fields
  if (!url || !method) {
    console.log('Missing required fields - url:', !!url, 'method:', !!method);
    return json(res, { error: 'Missing required fields: url and method' }, 400);
  }

  const opts = { method: method.toUpperCase(), headers: headers || {} };
  if (body && method.toUpperCase() !== 'GET') {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
  }

  console.log('Fetch options:', JSON.stringify(opts, null, 2));

  try {
    console.log(`Executing request: ${method.toUpperCase()} ${url}`);
    const resp = await fetch(url, opts);
    console.log(`Response status: ${resp.status} ${resp.statusText}`);
    
    const contentType = resp.headers.get('content-type') || '';
    console.log('Response content-type:', contentType);
    
    let data;
    if (contentType.includes('json')) {
      console.log('Parsing JSON response...');
      data = await resp.json();
    } else {
      console.log('Reading text response...');
      data = await resp.text();
    }
    
    const result = { 
      status: resp.status, 
      statusText: resp.statusText, 
      headers: Object.fromEntries(resp.headers.entries()),
      data 
    };
    
    console.log(`=== EXECUTE SUCCESS ===`);
    console.log('Response data length:', typeof data === 'string' ? data.length : JSON.stringify(data).length);
    return json(res, result);
  } catch (e) {
    console.error(`=== EXECUTE ERROR ===`);
    console.error('Error message:', e.message);
    console.error('Error stack:', e.stack);
    return json(res, { error: e.message, details: e.stack }, 500);
  }
}
