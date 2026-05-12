import { json, cors } from './_db.js';

// Combines: execute, fetch-spec, export-postman
// Route via query param: /api/utils?action=execute|fetch-spec|export-postman

// --- fetch-spec helpers ---
async function resolveSpecUrl(inputUrl) {
  const url = inputUrl.split('#')[0].split('%23')[0];
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (resp.ok) {
      const text = await resp.text();
      try { const j = JSON.parse(text); if (j.openapi || j.swagger || j.paths) return url; } catch {}
    }
  } catch {}
  const parsed = new URL(url);
  const base = `${parsed.protocol}//${parsed.host}`;
  const pathStr = parsed.pathname.replace(/\/$/, '');
  const candidates = [];
  if (pathStr.includes('swagger-ui')) {
    const idx = pathStr.indexOf('/swagger-ui');
    const parent = pathStr.substring(0, idx);
    if (parent) candidates.push(`${base}${parent}`, `${base}${parent}/api-docs`, `${base}${parent}/openapi.json`, `${base}${parent}/swagger.json`);
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

// --- export-postman helpers ---
function convertToPostman(name, scan) {
  const items = [];
  for (const ep of scan.endpoints) {
    const urlParts = ep.fullUrl.split('?')[0].split('/').filter(Boolean);
    const item = {
      name: `${ep.method.toUpperCase()} ${ep.path}`,
      request: {
        method: ep.method.toUpperCase(),
        header: [],
        url: { raw: ep.fullUrl, protocol: ep.fullUrl.startsWith('https') ? 'https' : 'http', host: [new URL(ep.fullUrl).host], path: urlParts.slice(1) },
      },
    };
    if (ep.parameters) {
      const queryParams = ep.parameters.filter(p => p.in === 'query');
      if (queryParams.length) item.request.url.query = queryParams.map(p => ({ key: p.name, value: '', description: p.description || '' }));
      const bodyParam = ep.parameters.find(p => p.in === 'body');
      if (bodyParam) item.request.body = { mode: 'raw', raw: JSON.stringify(bodyParam.schema || {}, null, 2), options: { raw: { language: 'json' } } };
    }
    if (ep.requestBody) {
      const jsonContent = ep.requestBody.content?.['application/json'];
      if (jsonContent) {
        item.request.body = { mode: 'raw', raw: JSON.stringify(jsonContent.schema || {}, null, 2), options: { raw: { language: 'json' } } };
        item.request.header.push({ key: 'Content-Type', value: 'application/json' });
      }
    }
    items.push(item);
  }
  return { info: { name: name || 'Open API Scanner Export', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: items };
}

// --- Main handler ---
export default async function handler(req, res) {
  console.log(`=== UTILS API REQUEST ===`);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  try {
    if (req.method === 'OPTIONS') { cors(res); return res.status(200).end(); }
    
    const { searchParams } = new URL(req.url, 'http://localhost');
    const action = searchParams.get('action');
    console.log('Utils action:', action);
    
    if (!action) return json(res, { error: 'Missing ?action= param (execute|fetch-spec|export-postman)' }, 400);

    // --- EXECUTE ---
    if (action === 'execute') {
      if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
      if (!req.body) return json(res, { error: 'Request body is missing' }, 400);

      const { url, method, headers, body } = req.body;
      if (!url || !method) return json(res, { error: 'Missing required fields: url and method' }, 400);

      const opts = { method: method.toUpperCase(), headers: headers || {} };
      if (body && method.toUpperCase() !== 'GET') {
        opts.body = JSON.stringify(body);
        opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
      }

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

      console.log(`Executing: ${method.toUpperCase()} ${url}`);
      const resp = await fetch(url, enhancedOpts);
      const contentType = resp.headers.get('content-type') || '';
      const data = contentType.includes('json') ? await resp.json() : await resp.text();
      
      return json(res, { 
        status: resp.status, 
        statusText: resp.statusText, 
        headers: Object.fromEntries(resp.headers.entries()),
        data,
        source: 'server-proxy'
      });
    }

    // --- FETCH-SPEC ---
    if (action === 'fetch-spec') {
      const inputUrl = searchParams.get('url');
      if (!inputUrl) return json(res, { error: 'Missing url param' }, 400);

      console.log(`Fetching spec from: ${inputUrl}`);
      const specUrl = await resolveSpecUrl(inputUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const resp = await fetch(specUrl, { 
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!resp.ok) return json(res, { error: `HTTP ${resp.status}: ${resp.statusText}` }, 400);
        
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch { return json(res, { error: `URL did not return valid JSON. Resolved: ${specUrl}` }, 400); }
        if (!data.openapi && !data.swagger && !data.paths) return json(res, { error: `Response doesn't appear to be an OpenAPI/Swagger spec. Resolved: ${specUrl}` }, 400);
        
        console.log(`Spec fetched successfully with ${Object.keys(data.paths || {}).length} paths`);
        return json(res, data);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') return json(res, { error: 'Request timeout after 10 seconds' }, 408);
        throw fetchError;
      }
    }

    // --- EXPORT-POSTMAN ---
    if (action === 'export-postman') {
      if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
      const { name, scan } = req.body || {};
      console.log(`Exporting Postman collection: ${name}`);
      return json(res, convertToPostman(name, scan));
    }

    return json(res, { error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('=== UTILS API ERROR ===');
    console.error('Error:', error.message);
    return json(res, { error: error.message }, 500);
  }
}