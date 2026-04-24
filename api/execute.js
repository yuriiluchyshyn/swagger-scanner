import { json, cors } from './_db.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  // Check if request body exists
  if (!req.body) {
    return json(res, { error: 'Request body is missing' }, 400);
  }

  const { url, method, headers, body } = req.body;
  
  // Validate required fields
  if (!url || !method) {
    return json(res, { error: 'Missing required fields: url and method' }, 400);
  }

  const opts = { method: method.toUpperCase(), headers: headers || {} };
  if (body && method.toUpperCase() !== 'GET') {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
  }

  try {
    console.log(`Executing request: ${method.toUpperCase()} ${url}`);
    const resp = await fetch(url, opts);
    const contentType = resp.headers.get('content-type') || '';
    
    let data;
    if (contentType.includes('json')) {
      data = await resp.json();
    } else {
      data = await resp.text();
    }
    
    const result = { 
      status: resp.status, 
      statusText: resp.statusText, 
      headers: Object.fromEntries(resp.headers.entries()),
      data 
    };
    
    console.log(`Request completed with status: ${resp.status}`);
    return json(res, result);
  } catch (e) {
    console.error(`Request failed: ${e.message}`);
    return json(res, { error: e.message, details: e.stack }, 500);
  }
}
