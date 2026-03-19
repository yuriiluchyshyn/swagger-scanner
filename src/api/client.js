const BASE = '/api';

export async function fetchUrls() {
  const r = await fetch(`${BASE}/urls`);
  return r.json();
}

export async function saveUrls(list) {
  await fetch(`${BASE}/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  });
}

export async function fetchScans() {
  const r = await fetch(`${BASE}/scans`);
  return r.json();
}

export async function saveScan(scan) {
  await fetch(`${BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scan),
  });
}

export async function fetchGlobalParams() {
  const r = await fetch(`${BASE}/global-params`);
  return r.json();
}

export async function saveGlobalParamsApi(params) {
  await fetch(`${BASE}/global-params`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function fetchSwaggerParams() {
  const r = await fetch(`${BASE}/swagger-params`);
  return r.json();
}

export async function saveSwaggerParamsApi(params) {
  await fetch(`${BASE}/swagger-params`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function fetchSession() {
  const r = await fetch(`${BASE}/session`);
  return r.json();
}

export async function saveSession(session) {
  await fetch(`${BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
}

export async function fetchSpec(url) {
  const r = await fetch(`${BASE}/fetch-spec?url=${encodeURIComponent(url.split('#')[0])}`);
  return r.json();
}

export async function executeRequest({ url, method, headers, body }) {
  const r = await fetch(`${BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method, headers, body }),
  });
  return r.json();
}

export async function exportPostmanApi(name, scan) {
  const r = await fetch(`${BASE}/export-postman`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, scan }),
  });
  return r.json();
}

export async function fetchDiffs() {
  const r = await fetch(`${BASE}/diffs`);
  return r.json();
}

export async function saveDiff(diff) {
  await fetch(`${BASE}/diffs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(diff),
  });
}

export async function fetchRequests(key, pinnedOnly = false) {
  const params = new URLSearchParams();
  if (key) params.set('key', key);
  if (pinnedOnly) params.set('pinned', 'true');
  const r = await fetch(`${BASE}/requests?${params}`);
  return r.json();
}

export async function saveRequest(entry) {
  const r = await fetch(`${BASE}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  return r.json();
}

export async function patchRequest(id, patch) {
  await fetch(`${BASE}/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteRequest(id) {
  await fetch(`${BASE}/requests/${id}`, { method: 'DELETE' });
}

export async function fetchCheckpoints() {
  const r = await fetch(`${BASE}/checkpoints`);
  return r.json();
}

export async function fetchCheckpoint(index) {
  const r = await fetch(`${BASE}/checkpoints/${index}`);
  return r.json();
}

export async function saveCheckpoint(checkpoint) {
  const r = await fetch(`${BASE}/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkpoint),
  });
  return r.json();
}

export async function deleteCheckpoint(index) {
  await fetch(`${BASE}/checkpoints/${index}`, { method: 'DELETE' });
}

export async function fetchIdentity() {
  const r = await fetch(`${BASE}/identity`);
  return r.json();
}

export async function saveIdentity(email) {
  await fetch(`${BASE}/identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function clearAccount() {
  await fetch(`${BASE}/identity`, { method: 'DELETE' });
}
