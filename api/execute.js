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

  console.log('Fetch options:', JSON.stringify({
    method: opts.method,
    headers: opts.headers,
    bodyLength: opts.body ? opts.body.length : 0
  }, null, 2));

  // Add additional headers that might help with corporate APIs
  const enhancedOpts = {
    ...opts,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; OpenAPIScanner/1.0)',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      ...opts.headers
    }
  };

  console.log('Enhanced fetch options:', JSON.stringify(enhancedOpts, null, 2));

  try {
    console.log(`Executing request: ${method.toUpperCase()} ${url}`);
    console.log('Request will be made with options:', JSON.stringify({
      method: opts.method,
      headers: opts.headers,
      bodyLength: opts.body ? opts.body.length : 0
    }, null, 2));
    
    const resp = await fetch(url, enhancedOpts);
    console.log(`Response received - status: ${resp.status} ${resp.statusText}`);
    console.log('Response headers:', JSON.stringify(Object.fromEntries(resp.headers.entries()), null, 2));
    
    const contentType = resp.headers.get('content-type') || '';
    console.log('Response content-type:', contentType);
    
    let data;
    if (contentType.includes('json')) {
      console.log('Parsing JSON response...');
      data = await resp.json();
      console.log('JSON response parsed successfully');
    } else {
      console.log('Reading text response...');
      data = await resp.text();
      console.log(`Text response length: ${data.length} characters`);
    }
    
    const result = { 
      status: resp.status, 
      statusText: resp.statusText, 
      headers: Object.fromEntries(resp.headers.entries()),
      data 
    };
    
    console.log(`=== EXECUTE SUCCESS ===`);
    console.log('Response data type:', typeof data);
    return json(res, result);
  } catch (e) {
    console.error(`=== EXECUTE ERROR ===`);
    console.error('Error name:', e.name);
    console.error('Error message:', e.message);
    console.error('Error code:', e.code);
    console.error('Error cause:', e.cause);
    console.error('Full error object:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    console.error('Error stack:', e.stack);
    
    // Provide more specific error messages based on error type
    let errorMessage = e.message;
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
      errorMessage = `Network error: Unable to connect to ${url}. This could be due to network restrictions, DNS issues, or the server being unreachable from Vercel's infrastructure.`;
    } else if (e.code === 'ENOTFOUND') {
      errorMessage = `DNS resolution failed for ${url}. The domain may not exist or be unreachable.`;
    } else if (e.code === 'ECONNREFUSED') {
      errorMessage = `Connection refused by ${url}. The server may be down or blocking connections.`;
    } else if (e.code === 'ETIMEDOUT') {
      errorMessage = `Request timeout to ${url}. The server is taking too long to respond.`;
    }
    
    return json(res, { 
      error: errorMessage,
      originalError: e.message,
      errorType: e.name,
      errorCode: e.code,
      url: url
    }, 500);
  }
}
