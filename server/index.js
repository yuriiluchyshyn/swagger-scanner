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
  candidates.push(`${base}/v3/api-docs`, `${base}/v2/api-docs`, `${base}/swagger.json`, `${base}/openapi.json`, `${base}/api-docs`, `${base}/docs`);
  for (const c of candidates) { try { const resp = await fetch(c, { headers: { Accept: 'application/json' } }); if (!resp.ok) continue; const j = await resp.json(); if (j.openapi || j.swagger || j.paths) return c; } catch {} }
  try { const resp = await fetch(url); const html = await resp.text(); const m = html.match(/url\s*[:=]\s*["']([^"']+)["']/); if (m) { const s = m[1]; return s.startsWith('http') ? s : `${base}${s.startsWith('/') ? '' : '/'}${s}`; } } catch {}
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

  const { pathname } = new URL(req.url, 'http://localhost');
  const db = await getDb();
  const email = getEmail(req);

  try {
    // --- Identity (DELETE wipes all user data) ---
    if (pathname === '/api/identity') {
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

    // All other routes require email
    if (!email) return sendJson(res, { error: 'Missing X-User-Email header' }, 401);

    const kv = db.collection('kv');

    // --- URLs ---
    if (pathname === '/api/urls') {
      if (req.method === 'GET') {
        const doc = await kv.findOne({ email, key: 'urls' });
        return sendJson(res, doc?.value ?? []);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        await kv.updateOne({ email, key: 'urls' }, { $set: { value: body } }, { upsert: true });
        return sendJson(res, { ok: true });
      }
    }

    // --- Global Params ---
    if (pathname === '/api/global-params') {
      if (req.method === 'GET') {
        const doc = await kv.findOne({ email, key: 'global-params' });
        return sendJson(res, doc?.value ?? {});
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        await kv.updateOne({ email, key: 'global-params' }, { $set: { value: body } }, { upsert: true });
        return sendJson(res, { ok: true });
      }
    }

    // --- Swagger Params ---
    if (pathname === '/api/swagger-params') {
      if (req.method === 'GET') {
        const doc = await kv.findOne({ email, key: 'swagger-params' });
        return sendJson(res, doc?.value ?? {});
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        await kv.updateOne({ email, key: 'swagger-params' }, { $set: { value: body } }, { upsert: true });
        return sendJson(res, { ok: true });
      }
    }

    // --- Session ---
    if (pathname === '/api/session') {
      if (req.method === 'GET') {
        const doc = await kv.findOne({ email, key: 'session' });
        return sendJson(res, doc?.value ?? {});
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const doc = await kv.findOne({ email, key: 'session' });
        const merged = { ...(doc?.value ?? {}), ...body };
        await kv.updateOne({ email, key: 'session' }, { $set: { value: merged } }, { upsert: true });
        return sendJson(res, { ok: true });
      }
    }

    // --- Scans ---
    if (pathname === '/api/scans') {
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

    // --- Checkpoints ---
    if (pathname === '/api/checkpoints' || pathname.startsWith('/api/checkpoints/')) {
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

    // --- Diffs ---
    if (pathname === '/api/diffs') {
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

    // --- Requests ---
    if (pathname === '/api/requests' || pathname.startsWith('/api/requests/')) {
      const col = db.collection('requests');
      const lastPart = pathname.split('/').pop();
      const isById = lastPart !== 'requests';

      if (req.method === 'GET' && !isById) {
        const query = getQuery(req.url);
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

    // --- Fetch Spec (no email scoping needed) ---
    if (req.method === 'GET' && pathname === '/api/fetch-spec') {
      const query = getQuery(req.url);
      const specUrl = await resolveSpecUrl(query.url);
      const resp = await fetch(specUrl, { headers: { Accept: 'application/json' } });
      const text = await resp.text();
      let data; try { data = JSON.parse(text); } catch { return sendJson(res, { error: `URL did not return valid JSON. Resolved: ${specUrl}` }, 400); }
      if (!data.openapi && !data.swagger && !data.paths) return sendJson(res, { error: `Not an OpenAPI/Swagger spec. Resolved: ${specUrl}` }, 400);
      return sendJson(res, data);
    }

    // --- Execute (no email scoping needed) ---
    if (req.method === 'POST' && pathname === '/api/execute') {
      const { url, method, headers, body } = await parseBody(req);
      const opts = { method: method.toUpperCase(), headers: headers || {} };
      if (body && method.toUpperCase() !== 'GET') { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json'; }
      const resp = await fetch(url, opts);
      const ct = resp.headers.get('content-type') || '';
      const data = ct.includes('json') ? await resp.json() : await resp.text();
      return sendJson(res, { status: resp.status, statusText: resp.statusText, data });
    }

    // --- Export Postman (no email scoping needed) ---
    if (req.method === 'POST' && pathname === '/api/export-postman') {
      const { name, scan } = await parseBody(req);
      return sendJson(res, convertToPostman(name, scan));
    }

    sendJson(res, { error: 'Not found' }, 404);
  } catch (e) {
    sendJson(res, { error: e.message }, 500);
  }
});

server.listen(3002, () => console.log('Server running on http://localhost:3002'));
