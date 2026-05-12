import http from 'http';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/open-api-scanner';

let db;

async function getDb() {
  if (db) return db;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db();
  console.log(`Connected to MongoDB`);
  return db;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { resolve(null); } });
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Email',
  });
  res.end(body);
}

function getQuery(url) { return Object.fromEntries(new URL(url, 'http://localhost').searchParams); }
function getEmail(req) { return (req.headers['x-user-email'] || '').trim().toLowerCase(); }

async function resolveSpecUrl(inputUrl) {
  const url = inputUrl.split('#')[0].split('%23')[0];
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (resp.ok) { const text = await resp.text(); try { const j = JSON.parse(text); if (j.openapi || j.swagger || j.paths) return url; } catch {} }
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
  if (pathStr.includes('/docs/swagger-ui')) {
    const idx = pathStr.indexOf('/docs/swagger-ui');
    const parent = pathStr.substring(0, idx);
    candidates.push(`${base}${parent}/docs`, `${base}${parent}/docs/api-docs`, `${base}${parent}/docs/openapi.json`, `${base}${parent}/docs/swagger.json`);
  }
  candidates.push(`${base}/v3/api-docs`, `${base}/v2/api-docs`, `${base}/swagger.json`, `${base}/openapi.json`, `${base}/api-docs`, `${base}/docs`);
  for (const c of candidates) { try { const resp = await fetch(c, { headers: { Accept: 'application/json' } }); if (!resp.ok) continue; const j = await resp.json(); if (j.openapi || j.swagger || j.paths) return c; } catch {} }
  return url;
}

function convertToPostman(name, scan) {
  const items = [];
  for (const ep of scan.endpoints) {
    const urlParts = ep.fullUrl.split('?')[0].split('/').filter(Boolean);
    const item = { name: `${ep.method.toUpperCase()} ${ep.path}`, request: { method: ep.method.toUpperCase(), header: [], url: { raw: ep.fullUrl, protocol: ep.fullUrl.startsWith('https') ? 'https' : 'http', host: [new URL(ep.fullUrl).host], path: urlParts.slice(1) } } };
    if (ep.parameters) {
      const qp = ep.parameters.filter(p => p.in === 'query');
      if (qp.length) item.request.url.query = qp.map(p => ({ key: p.name, value: '', description: p.description || '' }));
      const bp = ep.parameters.find(p => p.in === 'body');
      if (bp) item.request.body = { mode: 'raw', raw: JSON.stringify(bp.schema || {}, null, 2), options: { raw: { language: 'json' } } };
    }
    if (ep.requestBody) { const jc = ep.requestBody.content?.['application/json']; if (jc) { item.request.body = { mode: 'raw', raw: JSON.stringify(jc.schema || {}, null, 2), options: { raw: { language: 'json' } } }; item.request.header.push({ key: 'Content-Type', value: 'application/json' }); } }
    items.push(item);
  }
  return { info: { name: name || 'Open API Scanner Export', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: items };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Email' });
    return res.end();
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams);
  const db = await getDb();
  const email = getEmail(req);

  try {
    // --- Settings (combined: urls, global-params, swagger-params, session, identity, cors-settings) ---
    if (pathname === '/api/settings') {
      const type = query.type;
      if (!type) return sendJson(res, { error: 'Missing ?type= param' }, 400);

      // Identity DELETE
      if (type === 'identity') {
        if (req.method === 'DELETE' && email) {
          await Promise.all([
            db.collection('kv').deleteMany({ email }),
            db.collection('scans').deleteMany({ email }),
            db.collection('checkpoints').deleteMany({ email }),
            db.collection('requests').deleteMany({ email }),
            db.collection('diffs').deleteMany({ email }),
          ]);
          return sendJson(res, { ok: true });
        }
        return sendJson(res, { error: 'Method not allowed' }, 405);
      }

      if (!email) return sendJson(res, { error: 'Missing X-User-Email' }, 401);

      const validTypes = ['global-params', 'swagger-params', 'session', 'urls', 'cors-settings'];
      if (!validTypes.includes(type)) return sendJson(res, { error: `Invalid type: ${type}` }, 400);

      const kv = db.collection('kv');

      if (req.method === 'GET') {
        const doc = await kv.findOne({ email, key: type });
        const fallback = type === 'urls' ? [] : {};
        return sendJson(res, doc?.value ?? fallback);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (type === 'session') {
          const doc = await kv.findOne({ email, key: 'session' });
          const merged = { ...(doc?.value ?? {}), ...body };
          await kv.updateOne({ email, key: 'session' }, { $set: { value: merged } }, { upsert: true });
        } else {
          await kv.updateOne({ email, key: type }, { $set: { value: body } }, { upsert: true });
        }
        return sendJson(res, { ok: true });
      }
    }

    // --- Data (combined: scans, diffs) ---
    if (pathname === '/api/data') {
      const type = query.type;
      if (!type) return sendJson(res, { error: 'Missing ?type= param' }, 400);
      if (!email) return sendJson(res, { error: 'Missing X-User-Email' }, 401);

      if (type === 'scans') {
        const col = db.collection('scans');
        if (req.method === 'GET') {
          const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
          return sendJson(res, docs.map(({ _id, createdAt, email: e, ...rest }) => rest));
        }
        if (req.method === 'POST') {
          const body = await parseBody(req);
          const count = await col.countDocuments({ email });
          if (count >= 20) { const oldest = await col.findOne({ email }, { sort: { createdAt: 1 } }); if (oldest) await col.deleteOne({ _id: oldest._id }); }
          await col.insertOne({ ...body, email, createdAt: new Date() });
          return sendJson(res, { ok: true });
        }
      }

      if (type === 'diffs') {
        const col = db.collection('diffs');
        if (req.method === 'GET') {
          const docs = await col.find({ email }, { sort: { createdAt: -1 } }).toArray();
          return sendJson(res, docs.map(({ _id, createdAt, email: e, ...rest }) => rest));
        }
        if (req.method === 'POST') {
          const body = await parseBody(req);
          await col.insertOne({ ...body, email, createdAt: new Date() });
          return sendJson(res, { ok: true });
        }
      }

      return sendJson(res, { error: `Invalid type: ${type}` }, 400);
    }

    // --- Utils (combined: execute, fetch-spec, export-postman) ---
    if (pathname === '/api/utils') {
      const action = query.action;
      if (!action) return sendJson(res, { error: 'Missing ?action= param' }, 400);

      if (action === 'fetch-spec') {
        const specUrl = await resolveSpecUrl(query.url);
        try {
          const resp = await fetch(specUrl, { headers: { Accept: 'application/json' } });
          if (!resp.ok) return sendJson(res, { error: `HTTP ${resp.status}: ${resp.statusText}` }, 400);
          const text = await resp.text();
          let data; try { data = JSON.parse(text); } catch { return sendJson(res, { error: `URL did not return valid JSON. Resolved: ${specUrl}` }, 400); }
          if (!data.openapi && !data.swagger && !data.paths) return sendJson(res, { error: `Not an OpenAPI/Swagger spec. Resolved: ${specUrl}` }, 400);
          return sendJson(res, data);
        } catch (e) {
          return sendJson(res, { error: e.message }, 500);
        }
      }

      if (action === 'execute') {
        const { url, method, headers, body } = await parseBody(req);
        const opts = { method: method.toUpperCase(), headers: headers || {} };
        if (body && method.toUpperCase() !== 'GET') { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json'; }
        const resp = await fetch(url, opts);
        const ct = resp.headers.get('content-type') || '';
        const data = ct.includes('json') ? await resp.json() : await resp.text();
        return sendJson(res, { status: resp.status, statusText: resp.statusText, headers: Object.fromEntries(resp.headers.entries()), data, source: 'server-proxy' });
      }

      if (action === 'export-postman') {
        const { name, scan } = await parseBody(req);
        return sendJson(res, convertToPostman(name, scan));
      }

      return sendJson(res, { error: `Unknown action: ${action}` }, 400);
    }

    // --- Debug ---
    if (pathname === '/api/debug') {
      const action = query.action || 'health';
      if (action === 'health') return sendJson(res, { status: 'ok', timestamp: new Date().toISOString() });
      if (action === 'ping') return sendJson(res, { message: 'pong', timestamp: new Date().toISOString() });
      if (action === 'db-lookup') {
        const lookupEmail = (query.email || '').trim().toLowerCase();
        if (!lookupEmail) return sendJson(res, { error: 'Missing ?email= param' }, 400);
        const kv = db.collection('kv');
        const docs = await kv.find({ email: lookupEmail }).toArray();
        const allEmails = await kv.distinct('email');
        return sendJson(res, { email: lookupEmail, entriesFound: docs.length, keys: docs.map(d => ({ key: d.key, valueType: Array.isArray(d.value) ? 'array' : typeof d.value })), allEmailsInDb: allEmails });
      }
      return sendJson(res, { error: `Unknown action: ${action}` }, 400);
    }

    // --- Checkpoints ---
    if (pathname === '/api/checkpoints' || pathname.startsWith('/api/checkpoints/')) {
      if (!email) return sendJson(res, { error: 'Missing X-User-Email' }, 401);
      const col = db.collection('checkpoints');
      const idx = parseInt(pathname.split('/').pop(), 10);

      if (req.method === 'GET' && !isNaN(idx) && pathname !== '/api/checkpoints') {
        const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
        const doc = docs[idx];
        if (!doc) return sendJson(res, { error: 'Not found' }, 404);
        const { _id, createdAt, email: e, ...data } = doc;
        return sendJson(res, data);
      }
      if (req.method === 'GET') {
        const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
        return sendJson(res, docs.map(({ _id, createdAt, email: e, endpoints, definitions, ...meta }, i) => ({ ...meta, index: i, endpointCount: (endpoints || []).length })));
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const count = await col.countDocuments({ email });
        await col.insertOne({ ...body, email, createdAt: new Date() });
        return sendJson(res, { ok: true, index: count });
      }
      if (req.method === 'DELETE' && !isNaN(idx)) {
        const docs = await col.find({ email }, { sort: { createdAt: 1 } }).toArray();
        const doc = docs[idx];
        if (doc) await col.deleteOne({ _id: doc._id });
        return sendJson(res, { ok: true });
      }
    }

    // --- Requests ---
    if (pathname === '/api/requests' || pathname.startsWith('/api/requests/')) {
      if (!email) return sendJson(res, { error: 'Missing X-User-Email' }, 401);
      const col = db.collection('requests');
      const lastPart = pathname.split('/').pop();
      const isById = lastPart !== 'requests';

      if (req.method === 'GET' && !isById) {
        const filter = { email };
        if (query.key) filter.key = query.key;
        if (query.pinned === 'true') filter.pinned = true;
        let cursor = col.find(filter, { sort: { savedAt: -1 } });
        if (query.limit) cursor = cursor.limit(Number(query.limit));
        const docs = await cursor.toArray();
        return sendJson(res, docs.map(({ _id, email: e, ...rest }) => rest));
      }
      if (req.method === 'POST' && !isById) {
        const body = await parseBody(req);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const entry = { id, email, key: body.key, label: body.label || '', apiTitle: body.apiTitle || '', method: body.method, path: body.path, fullUrl: body.fullUrl, payload: body.payload || null, pathOverrides: body.pathOverrides || {}, swaggerParams: body.swaggerParams || {}, response: body.response || null, pinned: body.pinned || false, savedAt: new Date().toISOString() };
        await col.insertOne(entry);
        return sendJson(res, { ok: true, id });
      }
      if (req.method === 'PATCH' && isById) {
        const body = await parseBody(req);
        const update = {};
        if (body.pinned !== undefined) update.pinned = body.pinned;
        if (body.label !== undefined) update.label = body.label;
        await col.updateOne({ id: lastPart, email }, { $set: update });
        return sendJson(res, { ok: true });
      }
      if (req.method === 'DELETE' && isById) {
        await col.deleteOne({ id: lastPart, email });
        return sendJson(res, { ok: true });
      }
    }

    sendJson(res, { error: 'Not found' }, 404);
  } catch (e) {
    console.error('Server error:', e);
    sendJson(res, { error: e.message }, 500);
  }
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
