import { json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  const { url, method, headers, body } = req.body;
  const opts = { method: method.toUpperCase(), headers: headers || {} };
  if (body && method.toUpperCase() !== 'GET') {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
  }

  try {
    const resp = await fetch(url, opts);
    const contentType = resp.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await resp.json() : await resp.text();
    return json(res, { status: resp.status, statusText: resp.statusText, data });
  } catch (e) {
    return json(res, { error: e.message }, 500);
  }
}
