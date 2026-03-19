import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const SWAGGER_DIR = path.join(DATA_DIR, 'swagger');
const DIFFS_DIR = path.join(DATA_DIR, 'diffs');
const URLS_FILE = path.join(DATA_DIR, 'swagger-urls.json');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');
const PARAMS_FILE = path.join(DATA_DIR, 'global-params.json');
const SWAGGER_PARAMS_FILE = path.join(DATA_DIR, 'swagger-params.json');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');

const CHECKPOINTS_FILE = path.join(DATA_DIR, 'checkpoints.json');
const IDENTITY_FILE = path.join(DATA_DIR, 'identity.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SWAGGER_DIR)) fs.mkdirSync(SWAGGER_DIR, { recursive: true });
if (!fs.existsSync(DIFFS_DIR)) fs.mkdirSync(DIFFS_DIR, { recursive: true });
if (!fs.existsSync(URLS_FILE)) fs.writeFileSync(URLS_FILE, '[]');
if (!fs.existsSync(SCANS_FILE)) fs.writeFileSync(SCANS_FILE, '[]');
if (!fs.existsSync(CHECKPOINTS_FILE)) fs.writeFileSync(CHECKPOINTS_FILE, '[]');
if (!fs.existsSync(PARAMS_FILE)) fs.writeFileSync(PARAMS_FILE, '{}');
if (!fs.existsSync(SWAGGER_PARAMS_FILE)) fs.writeFileSync(SWAGGER_PARAMS_FILE, '{}');
if (!fs.existsSync(SESSION_FILE)) fs.writeFileSync(SESSION_FILE, '{}');
if (!fs.existsSync(IDENTITY_FILE)) fs.writeFileSync(IDENTITY_FILE, '{}');

// LowDB for request history
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
if (!fs.existsSync(REQUESTS_FILE)) fs.writeFileSync(REQUESTS_FILE, JSON.stringify({ requests: [] }, null, 2));
const requestsDb = new Low(new JSONFile(REQUESTS_FILE), { requests: [] });
await requestsDb.read();
if (!requestsDb.data) requestsDb.data = { requests: [] };

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve(null); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function getQuery(url) {
  return Object.fromEntries(new URL(url, 'http://localhost').searchParams);
}

// Resolve a Swagger UI URL to the actual spec JSON URL
async function resolveSpecUrl(inputUrl) {
  // Strip any fragment (e.g. #/Admin... or %23/Admin... when URL-encoded)
  const url = inputUrl.split('#')[0].split('%23')[0];

  // If it doesn't look like a Swagger UI page, return as-is
  if (!url.includes('swagger-ui') && !url.endsWith('.html')) {
    // Still try to verify it returns JSON
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (resp.ok) {
        const text = await resp.text();
        try {
          const json = JSON.parse(text);
          if (json.openapi || json.swagger || json.paths) return url;
        } catch {}
      }
    } catch {}
  }

  // Build base URL and candidate spec URLs
  const parsed = new URL(url);
  const base = `${parsed.protocol}//${parsed.host}`;
  const pathStr = parsed.pathname.replace(/\/$/, '');

  const candidates = [];

  // SpringDoc pattern: /docs/swagger-ui/index.html → /docs
  if (pathStr.includes('swagger-ui')) {
    const swaggerUiIdx = pathStr.indexOf('/swagger-ui');
    const parentPath = pathStr.substring(0, swaggerUiIdx);
    if (parentPath) {
      candidates.push(`${base}${parentPath}`);
      candidates.push(`${base}${parentPath}/api-docs`);
      candidates.push(`${base}${parentPath}/openapi.json`);
      candidates.push(`${base}${parentPath}/swagger.json`);
    }
  }

  // Generic well-known spec paths
  candidates.push(
    `${base}/v3/api-docs`,
    `${base}/v2/api-docs`,
    `${base}/swagger.json`,
    `${base}/openapi.json`,
    `${base}/api-docs`,
    `${base}/docs`,
  );

  // Try each candidate — fetch body and verify it's a valid spec
  for (const candidate of candidates) {
    try {
      console.log(`[resolveSpecUrl] Trying: ${candidate}`);
      const resp = await fetch(candidate, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) continue;
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        if (json.openapi || json.swagger || json.paths) {
          console.log(`[resolveSpecUrl] Found spec at: ${candidate}`);
          return candidate;
        }
      } catch {}
    } catch {}
  }

  // Last resort: fetch the HTML page and look for config
  try {
    console.log(`[resolveSpecUrl] Trying HTML parse of: ${url}`);
    const resp = await fetch(url);
    const html = await resp.text();
    // SwaggerUIBundle({ url: "..." }) or configUrl
    const urlMatch = html.match(/url\s*[:=]\s*["']([^"']+)["']/);
    if (urlMatch) {
      const specPath = urlMatch[1];
      const resolved = specPath.startsWith('http') ? specPath : `${base}${specPath.startsWith('/') ? '' : '/'}${specPath}`;
      console.log(`[resolveSpecUrl] Found URL in HTML: ${resolved}`);
      return resolved;
    }
    const configMatch = html.match(/configUrl\s*[:=]\s*["']([^"']+)["']/);
    if (configMatch) {
      const configPath = configMatch[1];
      const configUrl = configPath.startsWith('http') ? configPath : `${base}${configPath.startsWith('/') ? '' : '/'}${configPath}`;
      const configResp = await fetch(configUrl);
      const config = await configResp.json();
      if (config.url) return config.url.startsWith('http') ? config.url : `${base}${config.url}`;
      if (config.urls?.length) {
        const first = config.urls[0];
        const u = first.url || first;
        return u.startsWith('http') ? u : `${base}${u}`;
      }
    }
  } catch {}

  console.log(`[resolveSpecUrl] Could not resolve, returning original: ${url}`);
  return url;
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const { pathname } = new URL(req.url, 'http://localhost');

  try {
    // GET /api/urls
    if (req.method === 'GET' && pathname === '/api/urls') {
      const urls = JSON.parse(fs.readFileSync(URLS_FILE, 'utf-8'));
      return sendJson(res, urls);
    }

    // POST /api/urls
    if (req.method === 'POST' && pathname === '/api/urls') {
      const body = await parseBody(req);
      fs.writeFileSync(URLS_FILE, JSON.stringify(body, null, 2));
      return sendJson(res, { ok: true });
    }

    // GET /api/global-params
    if (req.method === 'GET' && pathname === '/api/global-params') {
      const params = JSON.parse(fs.readFileSync(PARAMS_FILE, 'utf-8'));
      return sendJson(res, params);
    }

    // POST /api/global-params
    if (req.method === 'POST' && pathname === '/api/global-params') {
      const body = await parseBody(req);
      fs.writeFileSync(PARAMS_FILE, JSON.stringify(body, null, 2));
      return sendJson(res, { ok: true });
    }

    // GET /api/swagger-params
    if (req.method === 'GET' && pathname === '/api/swagger-params') {
      const data = JSON.parse(fs.readFileSync(SWAGGER_PARAMS_FILE, 'utf-8'));
      return sendJson(res, data);
    }

    // POST /api/swagger-params
    if (req.method === 'POST' && pathname === '/api/swagger-params') {
      const body = await parseBody(req);
      fs.writeFileSync(SWAGGER_PARAMS_FILE, JSON.stringify(body, null, 2));
      return sendJson(res, { ok: true });
    }

    // GET /api/session
    if (req.method === 'GET' && pathname === '/api/session') {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      return sendJson(res, data);
    }

    // POST /api/session
    if (req.method === 'POST' && pathname === '/api/session') {
      const body = await parseBody(req);
      // Merge with existing session so checkpoint isn't wiped by payload-only saves
      let existing = {};
      try { existing = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8')); } catch {}
      fs.writeFileSync(SESSION_FILE, JSON.stringify({ ...existing, ...body }, null, 2));
      return sendJson(res, { ok: true });
    }

    // GET /api/checkpoints
    if (req.method === 'GET' && pathname === '/api/checkpoints') {
      const checkpoints = JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf-8'));
      return sendJson(res, checkpoints.map(({ endpoints, definitions, ...meta }, i) => ({
        ...meta,
        index: i,
        endpointCount: (endpoints || []).length,
      })));
    }

    // GET /api/checkpoints/:index — full checkpoint data
    if (req.method === 'GET' && pathname.startsWith('/api/checkpoints/')) {
      const idx = parseInt(pathname.split('/').pop(), 10);
      const checkpoints = JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf-8'));
      if (isNaN(idx) || idx < 0 || idx >= checkpoints.length) return sendJson(res, { error: 'Not found' }, 404);
      return sendJson(res, checkpoints[idx]);
    }

    // POST /api/checkpoints
    if (req.method === 'POST' && pathname === '/api/checkpoints') {
      const body = await parseBody(req);
      const checkpoints = JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf-8'));
      checkpoints.push(body);
      fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(checkpoints, null, 2));
      return sendJson(res, { ok: true, index: checkpoints.length - 1 });
    }

    // DELETE /api/checkpoints/:index
    if (req.method === 'DELETE' && pathname.startsWith('/api/checkpoints/')) {
      const idx = parseInt(pathname.split('/').pop(), 10);
      const checkpoints = JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf-8'));
      if (!isNaN(idx) && idx >= 0 && idx < checkpoints.length) {
        checkpoints.splice(idx, 1);
        fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(checkpoints, null, 2));
      }
      return sendJson(res, { ok: true });
    }

    // POST /api/checkpoint (legacy — keep for compat, just delegates)
    if (req.method === 'POST' && pathname === '/api/checkpoint') {
      const body = await parseBody(req);
      let existing = {};
      try { existing = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8')); } catch {}
      fs.writeFileSync(SESSION_FILE, JSON.stringify({ ...existing, checkpoint: body }, null, 2));
      return sendJson(res, { ok: true });
    }

    // GET /api/fetch-spec
    if (req.method === 'GET' && pathname === '/api/fetch-spec') {
      const query = getQuery(req.url);
      console.log(`[fetch-spec] Input URL: ${query.url}`);
      const specUrl = await resolveSpecUrl(query.url);
      console.log(`[fetch-spec] Resolved to: ${specUrl}`);
      const resp = await fetch(specUrl, { headers: { 'Accept': 'application/json' } });
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.log(`[fetch-spec] Response is not JSON. First 200 chars: ${text.substring(0, 200)}`);
        return sendJson(res, { error: `URL did not return valid JSON. Resolved URL: ${specUrl}` }, 400);
      }
      if (!data.openapi && !data.swagger && !data.paths) {
        console.log(`[fetch-spec] Response JSON doesn't look like a spec`);
        return sendJson(res, { error: `Response doesn't appear to be an OpenAPI/Swagger spec. Resolved URL: ${specUrl}` }, 400);
      }
      // Save snapshot to data/swagger/{hostname}.json
      try {
        const hostname = new URL(specUrl).hostname.replace(/[^a-z0-9.-]/gi, '_');
        fs.writeFileSync(path.join(SWAGGER_DIR, `${hostname}.json`), JSON.stringify(data, null, 2));
      } catch {}
      return sendJson(res, data);
    }

    // POST /api/execute
    if (req.method === 'POST' && pathname === '/api/execute') {
      const { url, method, headers, body } = await parseBody(req);
      const opts = { method: method.toUpperCase(), headers: headers || {} };
      if (body && method.toUpperCase() !== 'GET') {
        opts.body = JSON.stringify(body);
        opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
      }
      const resp = await fetch(url, opts);
      const contentType = resp.headers.get('content-type') || '';
      let data;
      if (contentType.includes('json')) {
        data = await resp.json();
      } else {
        data = await resp.text();
      }
      return sendJson(res, { status: resp.status, statusText: resp.statusText, data });
    }

    // GET /api/scans
    if (req.method === 'GET' && pathname === '/api/scans') {
      const scans = JSON.parse(fs.readFileSync(SCANS_FILE, 'utf-8'));
      return sendJson(res, scans);
    }

    // POST /api/scans
    if (req.method === 'POST' && pathname === '/api/scans') {
      const body = await parseBody(req);
      const scans = JSON.parse(fs.readFileSync(SCANS_FILE, 'utf-8'));
      scans.push(body);
      // Keep only the last 20 scans to avoid unbounded growth
      if (scans.length > 20) scans.splice(0, scans.length - 20);
      fs.writeFileSync(SCANS_FILE, JSON.stringify(scans, null, 2));
      return sendJson(res, { ok: true });
    }

    // POST /api/export-postman
    if (req.method === 'POST' && pathname === '/api/export-postman') {
      const { name, scan } = await parseBody(req);
      const collection = convertToPostman(name, scan);
      const filePath = path.join(DATA_DIR, `postman-${Date.now()}.json`);
      fs.writeFileSync(filePath, JSON.stringify(collection, null, 2));
      return sendJson(res, collection);
    }

    // GET /api/diffs
    if (req.method === 'GET' && pathname === '/api/diffs') {
      const files = fs.readdirSync(DIFFS_DIR).filter(f => f.endsWith('.json')).sort().reverse();
      const diffs = files.map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(DIFFS_DIR, f), 'utf-8')); } catch { return null; }
      }).filter(Boolean);
      return sendJson(res, diffs);
    }

    // POST /api/diffs
    if (req.method === 'POST' && pathname === '/api/diffs') {
      const body = await parseBody(req);
      const ts = (body.timestamp || new Date().toISOString()).replace(/[:.]/g, '-');
      const filePath = path.join(DIFFS_DIR, `diff-${ts}.json`);
      fs.writeFileSync(filePath, JSON.stringify(body, null, 2));
      return sendJson(res, { ok: true, file: `diff-${ts}.json` });
    }

    // GET /api/requests?key=METHOD:path&pinned=true&limit=N
    if (req.method === 'GET' && pathname === '/api/requests') {
      const { key, pinned, limit } = getQuery(req.url);
      await requestsDb.read();
      if (!requestsDb.data) requestsDb.data = { requests: [] };
      let results = requestsDb.data.requests;
      if (key) results = results.filter(r => r.key === key);
      if (pinned === 'true') results = results.filter(r => r.pinned);
      results = [...results].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      if (limit) results = results.slice(0, Number(limit));
      return sendJson(res, results);
    }

    // POST /api/requests  { key, label, payload, pathOverrides, response, pinned? }
    if (req.method === 'POST' && pathname === '/api/requests') {
      const body = await parseBody(req);
      await requestsDb.read();
      if (!requestsDb.data) requestsDb.data = { requests: [] };
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        key: body.key,
        label: body.label || '',
        apiTitle: body.apiTitle || '',
        method: body.method,
        path: body.path,
        fullUrl: body.fullUrl,
        payload: body.payload || null,
        pathOverrides: body.pathOverrides || {},
        response: body.response || null,
        pinned: body.pinned || false,
        savedAt: new Date().toISOString(),
      };
      requestsDb.data.requests.unshift(entry);
      await requestsDb.write();
      return sendJson(res, { ok: true, id: entry.id });
    }

    // PATCH /api/requests/:id  { pinned?, label? }
    if (req.method === 'PATCH' && pathname.startsWith('/api/requests/')) {
      const id = pathname.split('/').pop();
      const body = await parseBody(req);
      await requestsDb.read();
      if (!requestsDb.data) requestsDb.data = { requests: [] };
      const entry = requestsDb.data.requests.find(r => r.id === id);
      if (!entry) return sendJson(res, { error: 'Not found' }, 404);
      if (body.pinned !== undefined) entry.pinned = body.pinned;
      if (body.label !== undefined) entry.label = body.label;
      await requestsDb.write();
      return sendJson(res, { ok: true });
    }

    // DELETE /api/requests/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/requests/')) {
      const id = pathname.split('/').pop();
      await requestsDb.read();
      if (!requestsDb.data) requestsDb.data = { requests: [] };
      requestsDb.data.requests = requestsDb.data.requests.filter(r => r.id !== id);
      await requestsDb.write();
      return sendJson(res, { ok: true });
    }

    // GET /api/identity
    if (req.method === 'GET' && pathname === '/api/identity') {
      const data = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf-8'));
      return sendJson(res, data);
    }

    // POST /api/identity  { email }
    if (req.method === 'POST' && pathname === '/api/identity') {
      const body = await parseBody(req);
      fs.writeFileSync(IDENTITY_FILE, JSON.stringify({ email: body.email || '' }, null, 2));
      return sendJson(res, { ok: true });
    }

    // DELETE /api/identity — wipe all user data
    if (req.method === 'DELETE' && pathname === '/api/identity') {
      const wipe = (file, empty) => fs.writeFileSync(file, JSON.stringify(empty, null, 2));
      wipe(IDENTITY_FILE, {});
      wipe(URLS_FILE, []);
      wipe(SCANS_FILE, []);
      wipe(CHECKPOINTS_FILE, []);
      wipe(PARAMS_FILE, {});
      wipe(SWAGGER_PARAMS_FILE, {});
      wipe(SESSION_FILE, {});
      // wipe requests db
      requestsDb.data = { requests: [] };
      await requestsDb.write();
      // wipe diffs
      try {
        fs.readdirSync(DIFFS_DIR).forEach(f => fs.unlinkSync(path.join(DIFFS_DIR, f)));
      } catch {}
      return sendJson(res, { ok: true });
    }

    sendJson(res, { error: 'Not found' }, 404);
  } catch (e) {
    sendJson(res, { error: e.message }, 500);
  }
});

function convertToPostman(name, scan) {
  const items = [];
  for (const ep of scan.endpoints) {
    const urlParts = ep.fullUrl.split('?')[0].split('/').filter(Boolean);
    const item = {
      name: `${ep.method.toUpperCase()} ${ep.path}`,
      request: {
        method: ep.method.toUpperCase(),
        header: [],
        url: {
          raw: ep.fullUrl,
          protocol: ep.fullUrl.startsWith('https') ? 'https' : 'http',
          host: [new URL(ep.fullUrl).host],
          path: urlParts.slice(1),
        },
      },
    };
    if (ep.parameters) {
      const queryParams = ep.parameters.filter(p => p.in === 'query');
      if (queryParams.length) {
        item.request.url.query = queryParams.map(p => ({
          key: p.name,
          value: '',
          description: p.description || '',
        }));
      }
      const bodyParam = ep.parameters.find(p => p.in === 'body');
      if (bodyParam) {
        item.request.body = {
          mode: 'raw',
          raw: JSON.stringify(bodyParam.schema || {}, null, 2),
          options: { raw: { language: 'json' } },
        };
      }
    }
    if (ep.requestBody) {
      const content = ep.requestBody.content || {};
      const jsonContent = content['application/json'];
      if (jsonContent) {
        item.request.body = {
          mode: 'raw',
          raw: JSON.stringify(jsonContent.schema || {}, null, 2),
          options: { raw: { language: 'json' } },
        };
        item.request.header.push({ key: 'Content-Type', value: 'application/json' });
      }
    }
    items.push(item);
  }
  return {
    info: {
      name: name || 'Swagger Scanner Export',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
  };
}

server.listen(3001, () => console.log('Server running on http://localhost:3001'));
