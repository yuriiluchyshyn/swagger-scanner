const BASE = '/api';

// Email is stored in localStorage and sent with every request
export function getStoredEmail() {
  return localStorage.getItem('swagger-scanner-email') || '';
}

export function setStoredEmail(email) {
  localStorage.setItem('swagger-scanner-email', email);
}

export function clearStoredEmail() {
  localStorage.removeItem('swagger-scanner-email');
}

function authHeaders(extra = {}) {
  const email = getStoredEmail();
  return { 'Content-Type': 'application/json', ...(email ? { 'X-User-Email': email } : {}), ...extra };
}

function authGet() {
  const email = getStoredEmail();
  return email ? { headers: { 'X-User-Email': email } } : {};
}

export async function fetchUrls() {
  const r = await fetch(`${BASE}/urls`, authGet());
  return r.json();
}

export async function saveUrls(list) {
  await fetch(`${BASE}/urls`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(list) });
}

export async function fetchScans() {
  const r = await fetch(`${BASE}/scans`, authGet());
  return r.json();
}

export async function saveScan(scan) {
  await fetch(`${BASE}/scans`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(scan) });
}

export async function fetchGlobalParams() {
  const r = await fetch(`${BASE}/global-params`, authGet());
  return r.json();
}

export async function saveGlobalParamsApi(params) {
  await fetch(`${BASE}/global-params`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(params) });
}

export async function fetchSwaggerParams() {
  const r = await fetch(`${BASE}/swagger-params`, authGet());
  return r.json();
}

export async function saveSwaggerParamsApi(params) {
  await fetch(`${BASE}/swagger-params`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(params) });
}

export async function fetchSession() {
  const r = await fetch(`${BASE}/session`, authGet());
  return r.json();
}

export async function saveSession(session) {
  await fetch(`${BASE}/session`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(session) });
}

export async function fetchSpec(url) {
  const r = await fetch(`${BASE}/fetch-spec?url=${encodeURIComponent(url.split('#')[0])}`, authGet());
  return r.json();
}

export async function executeRequest({ url, method, headers, body }) {
  const r = await fetch(`${BASE}/execute`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url, method, headers, body }) });
  return r.json();
}

export async function exportPostmanApi(name, scan) {
  const r = await fetch(`${BASE}/export-postman`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, scan }) });
  return r.json();
}

export async function fetchDiffs() {
  const r = await fetch(`${BASE}/diffs`, authGet());
  return r.json();
}

export async function saveDiff(diff) {
  await fetch(`${BASE}/diffs`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(diff) });
}

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

// Identity doesn't need email header — it manages the email itself
export async function fetchIdentity() {
  return { email: getStoredEmail() };
}

export async function saveIdentity(email) {
  setStoredEmail(email);
}

export async function clearAccount() {
  const email = getStoredEmail();
  if (email) {
    await fetch(`${BASE}/identity`, { method: 'DELETE', headers: { 'X-User-Email': email } });
  }
  clearStoredEmail();
}
