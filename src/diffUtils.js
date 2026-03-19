// All possible diff states for an endpoint
export const DIFF_STATE = {
  NEW_API:    'new_api',      // entire swagger doc is new
  REMOVED_API:'removed_api', // entire swagger doc was removed
  NEW:        'new',         // endpoint added
  REMOVED:    'removed',     // endpoint removed
  UPDATED:    'updated',     // params/summary/description changed
  BREAKING:   'breaking',    // required param added, param removed, type changed
  DEPRECATED: 'deprecated',  // deprecated flag added
};

// Compare two scans and return differences
export function compareScanResults(oldScan, newScan) {
  const oldEndpoints = oldScan.endpoints || [];
  const newEndpoints = newScan.endpoints || [];

  // API-level: detect new/removed swagger docs by _apiTitle
  const oldTitles = new Set(oldEndpoints.map(e => e._apiTitle).filter(Boolean));
  const newTitles = new Set(newEndpoints.map(e => e._apiTitle).filter(Boolean));
  const newApis = [...newTitles].filter(t => !oldTitles.has(t));
  const removedApis = [...oldTitles].filter(t => !newTitles.has(t));

  // Use apiTitle+method+path as key to avoid collisions across different APIs
  const epKey = e => `${e._apiTitle || ''}::${e.method}:${e.path}`;
  const oldMap = new Map(oldEndpoints.map(e => [epKey(e), e]));
  const newMap = new Map(newEndpoints.map(e => [epKey(e), e]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, ep] of newMap) {
    if (!oldMap.has(key)) {
      added.push({ ...ep, _diffState: newApis.includes(ep._apiTitle) ? DIFF_STATE.NEW_API : DIFF_STATE.NEW });
    } else {
      const oldEp = oldMap.get(key);
      const diffs = diffEndpoint(oldEp, ep);
      if (diffs.length) {
        const isBreaking = diffs.some(d =>
          d.type === 'param_removed' ||
          d.type === 'param_type_changed' ||
          (d.type === 'param_required_changed' && d.to === true)
        );
        const isDeprecated = diffs.some(d => d.type === 'deprecated_added');
        const state = isBreaking ? DIFF_STATE.BREAKING : isDeprecated ? DIFF_STATE.DEPRECATED : DIFF_STATE.UPDATED;
        changed.push({ endpoint: ep, oldEndpoint: oldEp, diffs, state });
      }
    }
  }

  for (const [key, ep] of oldMap) {
    if (!newMap.has(key)) {
      removed.push({ ...ep, _diffState: removedApis.includes(ep._apiTitle) ? DIFF_STATE.REMOVED_API : DIFF_STATE.REMOVED });
    }
  }

  return { added, removed, changed, newApis, removedApis };
}

function diffEndpoint(oldEp, newEp) {
  const diffs = [];
  const oldParams = new Map((oldEp.parameters || []).map(p => [p.name, p]));
  const newParams = new Map((newEp.parameters || []).map(p => [p.name, p]));

  for (const [name, p] of newParams) {
    if (!oldParams.has(name)) {
      diffs.push({ type: 'param_added', name, detail: p });
    } else {
      const op = oldParams.get(name);
      if (op.required !== p.required) diffs.push({ type: 'param_required_changed', name, from: op.required, to: p.required });
      if ((op.type || op.schema?.type) !== (p.type || p.schema?.type)) {
        diffs.push({ type: 'param_type_changed', name, from: op.type || op.schema?.type, to: p.type || p.schema?.type });
      }
      if ((op.in) !== (p.in)) {
        diffs.push({ type: 'param_location_changed', name, from: op.in, to: p.in });
      }
    }
  }
  for (const [name] of oldParams) {
    if (!newParams.has(name)) diffs.push({ type: 'param_removed', name });
  }

  if (oldEp.summary !== newEp.summary) diffs.push({ type: 'summary_changed', from: oldEp.summary, to: newEp.summary });
  if (oldEp.description !== newEp.description) diffs.push({ type: 'description_changed', from: oldEp.description, to: newEp.description });
  if (oldEp.operationId !== newEp.operationId) diffs.push({ type: 'operation_id_changed', from: oldEp.operationId, to: newEp.operationId });

  // Deprecated flag
  if (!oldEp.deprecated && newEp.deprecated) diffs.push({ type: 'deprecated_added' });
  if (oldEp.deprecated && !newEp.deprecated) diffs.push({ type: 'deprecated_removed' });

  // Response codes
  const oldCodes = new Set(Object.keys(oldEp.responses || {}));
  const newCodes = new Set(Object.keys(newEp.responses || {}));
  for (const code of newCodes) if (!oldCodes.has(code)) diffs.push({ type: 'response_added', code });
  for (const code of oldCodes) if (!newCodes.has(code)) diffs.push({ type: 'response_removed', code });

  // Request body presence changed
  const hadBody = !!(oldEp.requestBody || (oldEp.parameters || []).find(p => p.in === 'body'));
  const hasBody = !!(newEp.requestBody || (newEp.parameters || []).find(p => p.in === 'body'));
  if (hadBody && !hasBody) diffs.push({ type: 'request_body_removed' });
  if (!hadBody && hasBody) diffs.push({ type: 'request_body_added' });

  return diffs;
}

// Build a human-readable snapshot of an endpoint for side-by-side display
export function endpointSnapshot(ep) {
  if (!ep) return [];
  const lines = [];
  lines.push({ text: `${ep.method.toUpperCase()} ${ep.path}`, type: 'header' });
  if (ep.summary) lines.push({ text: `Summary: ${ep.summary}`, type: 'summary' });
  if (ep.description) lines.push({ text: `Description: ${ep.description}`, type: 'description' });
  if (ep.deprecated) lines.push({ text: `⚠ Deprecated`, type: 'deprecated' });
  for (const p of ep.parameters || []) {
    lines.push({ text: `[${p.in}] ${p.name}: ${p.type || p.schema?.type || '?'}${p.required ? ' (required)' : ''}`, type: 'param', name: p.name });
  }
  const codes = Object.keys(ep.responses || {});
  if (codes.length) lines.push({ text: `Responses: ${codes.join(', ')}`, type: 'responses' });
  return lines;
}
