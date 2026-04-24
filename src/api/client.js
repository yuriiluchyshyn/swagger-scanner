const BASE = '/api';

// Email is stored in localStorage and sent with every request
export function getStoredEmail() {
  return localStorage.getItem('open-api-scanner-email') || '';
}

export function setStoredEmail(email) {
  localStorage.setItem('open-api-scanner-email', email);
}

export function clearStoredEmail() {
  localStorage.removeItem('open-api-scanner-email');
}

function authHeaders(extra = {}) {
  const email = getStoredEmail();
  return { 'Content-Type': 'application/json', ...(email ? { 'X-User-Email': email } : {}), ...extra };
}

function authGet() {
  const email = getStoredEmail();
  return email ? { headers: { 'X-User-Email': email } } : {};
}

// --- Settings (combined: urls, global-params, swagger-params, session, identity) ---

export async function fetchUrls() {
  const r = await fetch(`${BASE}/settings?type=urls`, authGet());
  return r.json();
}

export async function saveUrls(list) {
  await fetch(`${BASE}/settings?type=urls`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(list) });
}

export async function fetchGlobalParams() {
  const r = await fetch(`${BASE}/settings?type=global-params`, authGet());
  return r.json();
}

export async function saveGlobalParamsApi(params) {
  await fetch(`${BASE}/settings?type=global-params`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(params) });
}

export async function fetchSwaggerParams() {
  const r = await fetch(`${BASE}/settings?type=swagger-params`, authGet());
  return r.json();
}

export async function saveSwaggerParamsApi(params) {
  await fetch(`${BASE}/settings?type=swagger-params`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(params) });
}

export async function fetchCorsSettings() {
  const r = await fetch(`${BASE}/settings?type=cors-settings`, authGet());
  return r.json();
}

export async function saveCorsSettings(settings) {
  await fetch(`${BASE}/settings?type=cors-settings`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(settings) });
}

export async function fetchSession() {
  const r = await fetch(`${BASE}/settings?type=session`, authGet());
  return r.json();
}

export async function saveSession(session) {
  await fetch(`${BASE}/settings?type=session`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(session) });
}

export async function fetchIdentity() {
  return { email: getStoredEmail() };
}

export async function saveIdentity(email) {
  setStoredEmail(email);
}

export async function clearAccount() {
  const email = getStoredEmail();
  if (email) {
    await fetch(`${BASE}/settings?type=identity`, { method: 'DELETE', headers: { 'X-User-Email': email } });
  }
  clearStoredEmail();
}

// --- Data (combined: scans, diffs) ---

export async function fetchScans() {
  const r = await fetch(`${BASE}/data?type=scans`, authGet());
  return r.json();
}

export async function saveScan(scan) {
  await fetch(`${BASE}/data?type=scans`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(scan) });
}

export async function fetchDiffs() {
  const r = await fetch(`${BASE}/data?type=diffs`, authGet());
  return r.json();
}

export async function saveDiff(diff) {
  await fetch(`${BASE}/data?type=diffs`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(diff) });
}

// --- Utils (combined: execute, fetch-spec, export-postman) ---

export async function fetchSpec(url, corsSettings = {}) {
  const globalMode = corsSettings.globalMode || 'browser-first';
  const blockedDomains = corsSettings.blockedDomains || [];
  
  console.log('=== FETCHSPEC DEBUG ===');
  console.log('URL:', url);
  console.log('Global mode:', globalMode);
  console.log('Blocked domains:', blockedDomains);
  
  // Check if domain is blocked or global mode is server-only
  const shouldSkipBrowser = globalMode === 'server-only' || 
    blockedDomains.some(domain => {
      if (domain.startsWith('*.')) {
        const pattern = domain.substring(2);
        const matches = url.includes(pattern);
        console.log(`Checking wildcard "${domain}" (pattern: "${pattern}") against URL: ${matches}`);
        return matches;
      }
      const matches = url.includes(domain);
      console.log(`Checking domain "${domain}" against URL: ${matches}`);
      return matches;
    });

  console.log('Should skip browser:', shouldSkipBrowser);

  if (shouldSkipBrowser) {
    console.log('Skipping browser fetch due to CORS settings, using server proxy...');
    try {
      const r = await fetch(`${BASE}/utils?action=fetch-spec&url=${encodeURIComponent(url.split('#')[0])}`, authGet());
      const result = await r.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return { ...result, _source: 'server-proxy' };
    } catch (serverError) {
      throw new Error(`Server proxy failed: ${serverError.message}`);
    }
  }

  // Helper function to resolve spec URL from Swagger UI pages
  async function resolveSpecUrlBrowser(inputUrl) {
    const cleanUrl = inputUrl.split('#')[0].split('%23')[0];
    
    // First try the URL directly
    try {
      const resp = await fetch(cleanUrl, { 
        headers: { 'Accept': 'application/json' }
        // Removed mode: 'cors' to avoid preflight requests
      });
      if (resp.ok) {
        const text = await resp.text();
        try { 
          const j = JSON.parse(text); 
          if (j.openapi || j.swagger || j.paths) return cleanUrl; 
        } catch {}
      }
    } catch {}
    
    // If direct fetch failed, generate candidates
    const parsed = new URL(cleanUrl);
    const base = `${parsed.protocol}//${parsed.host}`;
    const pathStr = parsed.pathname.replace(/\/$/, '');
    const candidates = [];
    
    // Handle Swagger UI URLs
    if (pathStr.includes('swagger-ui')) {
      const idx = pathStr.indexOf('/swagger-ui');
      const parent = pathStr.substring(0, idx);
      console.log(`Detected Swagger UI URL. Parent path: "${parent}"`);
      if (parent) {
        candidates.push(
          `${base}${parent}`,
          `${base}${parent}/api-docs`,
          `${base}${parent}/openapi.json`,
          `${base}${parent}/swagger.json`
        );
      }
    }
    
    // Handle /docs/swagger-ui URLs (like api.inventory)
    if (pathStr.includes('/docs/swagger-ui')) {
      const idx = pathStr.indexOf('/docs/swagger-ui');
      const parent = pathStr.substring(0, idx);
      console.log(`Detected /docs/swagger-ui URL. Parent path: "${parent}"`);
      candidates.push(
        `${base}${parent}/docs`,
        `${base}${parent}/docs/api-docs`,
        `${base}${parent}/docs/openapi.json`,
        `${base}${parent}/docs/swagger.json`
      );
    }
    
    // Common API spec endpoints
    candidates.push(
      `${base}/v3/api-docs`,
      `${base}/v2/api-docs`, 
      `${base}/swagger.json`,
      `${base}/openapi.json`,
      `${base}/api-docs`,
      `${base}/docs`
    );
    
    // Try each candidate
    console.log(`Trying ${candidates.length} candidate URLs:`, candidates);
    for (const candidate of candidates) {
      try {
        console.log(`Trying candidate: ${candidate}`);
        const resp = await fetch(candidate, { 
          headers: { 'Accept': 'application/json' }
          // Removed mode: 'cors' to avoid preflight requests
        });
        console.log(`Candidate ${candidate} - Status: ${resp.status}`);
        if (!resp.ok) continue;
        const j = await resp.json();
        if (j.openapi || j.swagger || j.paths) {
          console.log(`✓ Found valid spec at: ${candidate}`);
          return candidate;
        }
      } catch (err) {
        console.log(`Candidate ${candidate} failed:`, err.message);
      }
    }
    
    return cleanUrl; // Return original if no candidates work
  }

  // Try direct browser request first (like Postman web)
  try {
    console.log('Attempting direct browser spec fetch...');
    const resolvedUrl = await resolveSpecUrlBrowser(url);
    console.log(`Original URL: ${url}`);
    console.log(`Resolved URL: ${resolvedUrl}`);
    
    const resp = await fetch(resolvedUrl, { 
      method: 'GET',
      headers: { 
        'Accept': 'application/json'
      }
      // Removed mode: 'cors' and Cache-Control to avoid preflight requests
    });
    
    console.log(`Response status: ${resp.status} ${resp.statusText}`);
    console.log(`Response headers:`, Object.fromEntries(resp.headers.entries()));
    
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    
    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Response is not valid JSON');
    }
    
    // Validate it's an OpenAPI/Swagger spec
    if (!data.openapi && !data.swagger && !data.paths) {
      throw new Error('Response is not an OpenAPI/Swagger spec');
    }
    
    console.log('✓ Direct browser spec fetch successful');
    return { ...data, _source: 'browser-direct' };
    
  } catch (directError) {
    console.log('Direct browser spec fetch failed:', directError.message);
    
    // Fallback to server proxy
    console.log('Falling back to server proxy for spec fetch...');
    try {
      const r = await fetch(`${BASE}/utils?action=fetch-spec&url=${encodeURIComponent(url.split('#')[0])}`, authGet());
      const result = await r.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return { ...result, _source: 'server-proxy' };
    } catch (serverError) {
      // If both methods fail, throw a comprehensive error
      throw new Error(`Both browser and server fetch failed. Browser: ${directError.message}. Server: ${serverError.message}`);
    }
  }
}

export async function executeRequest({ url, method, headers, body }) {
  // Try direct browser request first (like Postman web)
  try {
    console.log('Attempting direct browser request...');
    const opts = { 
      method: method.toUpperCase(), 
      headers: headers || {},
      mode: 'cors' // Enable CORS
    };
    
    if (body && method.toUpperCase() !== 'GET') {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
    }
    
    const resp = await fetch(url, opts);
    const contentType = resp.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await resp.json() : await resp.text();
    
    return {
      status: resp.status,
      statusText: resp.statusText,
      headers: Object.fromEntries(resp.headers.entries()),
      data,
      source: 'browser-direct'
    };
  } catch (directError) {
    console.log('Direct browser request failed:', directError.message);
    
    // Fallback to server proxy
    console.log('Falling back to server proxy...');
    const r = await fetch(`${BASE}/utils?action=execute`, { 
      method: 'POST', 
      headers: authHeaders(), 
      body: JSON.stringify({ url, method, headers, body }) 
    });
    const result = await r.json();
    return { ...result, source: 'server-proxy' };
  }
}

export async function exportPostmanApi(name, scan) {
  const r = await fetch(`${BASE}/utils?action=export-postman`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, scan }) });
  return r.json();
}

// --- Requests (unchanged - has sub-routes) ---

export async function fetchRequests(key, pinnedOnly = false) {
  const params = new URLSearchParams();
  if (key) params.set('key', key);
  if (pinnedOnly) params.set('pinned', 'true');
  const r = await fetch(`${BASE}/requests?${params}`, authGet());
  return r.json();
}

export async function saveRequest(entry) {
  const r = await fetch(`${BASE}/requests`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(entry) });
  return r.json();
}

export async function patchRequest(id, patch) {
  await fetch(`${BASE}/requests/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch) });
}

export async function deleteRequest(id) {
  await fetch(`${BASE}/requests/${id}`, { method: 'DELETE', headers: authHeaders() });
}

// --- Checkpoints (unchanged - has sub-routes) ---

export async function fetchCheckpoints() {
  const r = await fetch(`${BASE}/checkpoints`, authGet());
  return r.json();
}

export async function fetchCheckpoint(index) {
  const r = await fetch(`${BASE}/checkpoints/${index}`, authGet());
  return r.json();
}

export async function saveCheckpoint(checkpoint) {
  const r = await fetch(`${BASE}/checkpoints`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(checkpoint) });
  return r.json();
}

export async function deleteCheckpoint(index) {
  await fetch(`${BASE}/checkpoints/${index}`, { method: 'DELETE', headers: authHeaders() });
}