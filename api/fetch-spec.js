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
  if (req.method === 'OPTIONS') return json(res, {});
  const { searchParams } = new URL(req.url, 'http://localhost');
  const inputUrl = searchParams.get('url');
  if (!inputUrl) return json(res, { error: 'Missing url param' }, 400);

  const specUrl = await resolveSpecUrl(inputUrl);
  try {
    const resp = await fetch(specUrl, { headers: { Accept: 'application/json' } });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return json(res, { error: `URL did not return valid JSON. Resolved: ${specUrl}` }, 400);
    }
    if (!data.openapi && !data.swagger && !data.paths) {
      return json(res, { error: `Response doesn't appear to be an OpenAPI/Swagger spec. Resolved: ${specUrl}` }, 400);
    }
    return json(res, data);
  } catch (e) {
    return json(res, { error: e.message }, 500);
  }
}
