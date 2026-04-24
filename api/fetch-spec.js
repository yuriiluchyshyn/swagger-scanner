import { json } from './_db.js';

async function resolveSpecUrl(inputUrl) {
  const url = inputUrl.split('#')[0].split('%23')[0];

  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (resp.ok) {
      const text = await resp.text();
      try {
        const j = JSON.parse(text);
        if (j.openapi || j.swagger || j.paths) return url;
      } catch {}
    }
  } catch {}

  const parsed = new URL(url);
  const base = `${parsed.protocol}//${parsed.host}`;
  const pathStr = parsed.pathname.replace(/\/$/, '');
  const candidates = [];

  if (pathStr.includes('swagger-ui')) {
    const idx = pathStr.indexOf('/swagger-ui');
    const parent = pathStr.substring(0, idx);
    if (parent) {
      candidates.push(`${base}${parent}`, `${base}${parent}/api-docs`, `${base}${parent}/openapi.json`, `${base}${parent}/swagger.json`);
    }
  }
  candidates.push(`${base}/v3/api-docs`, `${base}/v2/api-docs`, `${base}/swagger.json`, `${base}/openapi.json`, `${base}/api-docs`, `${base}/docs`);

  for (const candidate of candidates) {
    try {
      const resp = await fetch(candidate, { headers: { Accept: 'application/json' } });
      if (!resp.ok) continue;
      const j = await resp.json();
      if (j.openapi || j.swagger || j.paths) return candidate;
    } catch {}
  }
  return url;
}

export default async function handler(req, res) {
  console.log(`=== FETCH-SPEC REQUEST START ===`);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      return json(res, {});
    }
    
    console.log('Parsing URL parameters...');
    const { searchParams } = new URL(req.url, 'http://localhost');
    const inputUrl = searchParams.get('url');
    console.log('Input URL:', inputUrl);
    
    if (!inputUrl) {
      console.log('Missing URL parameter');
      return json(res, { error: 'Missing url param' }, 400);
    }

    console.log(`Starting spec resolution for: ${inputUrl}`);
    
    const specUrl = await resolveSpecUrl(inputUrl);
    console.log(`Resolved spec URL: ${specUrl}`);
    
    // Add timeout to prevent hanging requests
    console.log('Creating abort controller with 10s timeout');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('Request timeout triggered');
      controller.abort();
    }, 10000);
    
    try {
      console.log(`Fetching from resolved URL: ${specUrl}`);
      const resp = await fetch(specUrl, { 
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log(`Fetch response status: ${resp.status} ${resp.statusText}`);
      
      if (!resp.ok) {
        console.log(`HTTP error: ${resp.status} ${resp.statusText}`);
        return json(res, { error: `HTTP ${resp.status}: ${resp.statusText}` }, 400);
      }
      
      console.log('Reading response text...');
      const text = await resp.text();
      console.log(`Response text length: ${text.length} characters`);
      console.log(`Response preview: ${text.substring(0, 200)}...`);
      
      let data;
      try { 
        console.log('Parsing JSON...');
        data = JSON.parse(text); 
        console.log('JSON parsed successfully');
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
        return json(res, { error: `URL did not return valid JSON. Resolved: ${specUrl}` }, 400);
      }
      
      console.log('Validating OpenAPI/Swagger spec...');
      if (!data.openapi && !data.swagger && !data.paths) {
        console.log('Not a valid OpenAPI/Swagger spec');
        return json(res, { error: `Response doesn't appear to be an OpenAPI/Swagger spec. Resolved: ${specUrl}` }, 400);
      }
      
      const pathCount = Object.keys(data.paths || {}).length;
      console.log(`Valid spec found with ${pathCount} paths`);
      console.log(`=== FETCH-SPEC SUCCESS ===`);
      return json(res, data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', fetchError.message);
      console.error('Fetch error type:', fetchError.name);
      if (fetchError.name === 'AbortError') {
        console.log('Request aborted due to timeout');
        return json(res, { error: 'Request timeout after 10 seconds' }, 408);
      }
      throw fetchError;
    }
  } catch (e) {
    console.error(`=== FETCH-SPEC ERROR ===`);
    console.error('Error message:', e.message);
    console.error('Error stack:', e.stack);
    return json(res, { error: e.message }, 500);
  }
}
