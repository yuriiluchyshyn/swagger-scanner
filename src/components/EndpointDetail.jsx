import { useState, useCallback } from 'react';
import { fetchRequests, patchRequest, deleteRequest } from '../api/client.js';
import { generateValue } from '../helpers.js';
import SourceIndicator from './SourceIndicator.jsx';

// Collapsible JSON node
function JsonNode({ data, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(depth > 1);
  const indent = depth * 14;

  if (data === null) return <span style={{ color: '#79c0ff' }}>null</span>;
  if (typeof data === 'boolean') return <span style={{ color: '#79c0ff' }}>{String(data)}</span>;
  if (typeof data === 'number') return <span style={{ color: '#79c0ff' }}>{data}</span>;
  if (typeof data === 'string') return <span style={{ color: '#a5d6ff' }}>"{data}"</span>;

  const isArray = Array.isArray(data);
  const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data);
  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';
  const label = isArray ? `Array(${entries.length})` : `{${entries.length}}`;

  if (entries.length === 0) return <span style={{ color: '#8b949e' }}>{open}{close}</span>;

  return (
    <span>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: '#8b949e', fontSize: 11, lineHeight: 1 }}
      >{collapsed ? '▶' : '▼'}</button>
      <span style={{ color: '#8b949e' }}>{open}</span>
      {collapsed ? (
        <span
          style={{ color: '#8b949e', cursor: 'pointer', fontSize: 11 }}
          onClick={() => setCollapsed(false)}
        > {label} </span>
      ) : (
        <div style={{ marginLeft: indent + 14 }}>
          {entries.map(([k, v], i) => (
            <div key={k}>
              {!isArray && <span style={{ color: '#ff7b72' }}>"{k}"</span>}
              {!isArray && <span style={{ color: '#8b949e' }}>: </span>}
              <JsonNode data={v} depth={depth + 1} />
              {i < entries.length - 1 && <span style={{ color: '#8b949e' }}>,</span>}
            </div>
          ))}
        </div>
      )}
      {!collapsed && <span style={{ color: '#8b949e' }}>{close}</span>}
    </span>
  );
}

// Build a schema-based example object (like Swagger UI "Example Value")
function buildSchemaExample(schema, definitions) {
  if (!schema) return null;
  return generateValue(schema, definitions);
}

export default function EndpointDetail({
  ep, epResponse, epPayload, epPathParams, epPathOverrides,
  globalParams, globalValues, hasBody, definitions,
  onExecute, onGeneratePayload, onGeneratePathParams, onSaveRequest,
  onPayloadChange, onPathOverride, onPathOverrideReset, onClearResponse,
}) {
  const key = `${ep.method}:${ep.path}`;
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'pinned'
  const [payloadTab, setPayloadTab] = useState('editor'); // 'editor' | 'example'

  // Build payload example from schema (like Swagger UI)
  const payloadExample = (() => {
    if (!hasBody) return null;
    let schema = null;
    if (ep.requestBody) {
      schema = ep.requestBody.content?.['application/json']?.schema || null;
    }
    if (!schema) {
      const bodyParam = (ep.parameters || []).find(p => p.in === 'body');
      schema = bodyParam?.schema || null;
    }
    if (!schema) return null;
    try { return JSON.stringify(buildSchemaExample(schema, definitions), null, 2); } catch { return null; }
  })();

  // Collect all param names declared in the swagger spec for this endpoint
  const epParamNames = new Set((ep.parameters || []).map(p => p.name));
  const pathParamNames = new Set((ep.parameters || []).filter(p => p.in === 'path').map(p => p.name));

  // Collect body field names from request body schema
  const bodyFieldNames = new Set();
  const bodySchema = ep.requestBody?.content?.['application/json']?.schema
    || (ep.parameters || []).find(p => p.in === 'body')?.schema;
  if (bodySchema?.properties) {
    Object.keys(bodySchema.properties).forEach(k => bodyFieldNames.add(k));
  }

  // Only show global params that are relevant to this endpoint:
  // - declared as a parameter in the swagger spec, OR
  // - match a body field name in the request schema
  const higherLevelParams = Object.entries(globalValues || {})
    .filter(([name]) => {
      if (pathParamNames.has(name)) return false; // already shown in Path Parameters
      return epParamNames.has(name) || bodyFieldNames.has(name);
    })
    .map(([name, val]) => {
      const cfg = globalParams[name];
      return { name, value: val, in: typeof cfg === 'object' ? cfg.in : 'body', label: typeof cfg === 'object' ? cfg.label : name };
    });

  const loadHistory = useCallback(async (filter = historyFilter) => {
    const entries = await fetchRequests(key, filter === 'pinned');
    setHistory(Array.isArray(entries) ? entries : []);
  }, [key, historyFilter]);

  const handleToggleHistory = async () => {
    if (!showHistory) await loadHistory();
    setShowHistory(v => !v);
  };

  const handleFilterChange = async (f) => {
    setHistoryFilter(f);
    await loadHistory(f);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSaveRequest(ep);
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 1500);
    if (showHistory) await loadHistory();
  };

  const handlePin = async (entry) => {
    await patchRequest(entry.id, { pinned: !entry.pinned });
    await loadHistory();
  };

  const handleDelete = async (entry) => {
    await deleteRequest(entry.id);
    await loadHistory();
  };

  const handleRestore = (entry) => {
    if (entry.payload) onPayloadChange(entry.payload);
    if (entry.pathOverrides) {
      for (const [name, val] of Object.entries(entry.pathOverrides)) {
        onPathOverride(name, val);
      }
    }
  };

  const pinnedCount = history.filter(e => e.pinned).length;

  return (
    <div className="ep-detail">
      {ep.description && <p className="text-sm text-muted mb-2">{ep.description}</p>}
      <p className="text-sm mb-2">URL: <code>{ep.fullUrl}</code></p>

      {/* Path Parameters */}
      {ep.parameters?.filter(p => p.in === 'path').length > 0 && (
        <div className="mb-2">
          <div className="flex gap-2 mb-2" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <h3>Path Parameters</h3>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onGeneratePathParams(ep)}>
              Generate Path Params
            </button>
          </div>
          <div className="param-table">
            {ep.parameters.filter(p => p.in === 'path').map((p, j) => {
              const globalCfg = globalParams[p.name];
              const globalVal = globalCfg ? (typeof globalCfg === 'object' ? globalCfg.value : globalCfg) : '';
              const displayVal = epPathOverrides?.[p.name] ?? globalVal ?? epPathParams?.[p.name] ?? '';
              const fromGlobal = !epPathOverrides?.[p.name] && globalVal;
              return (
                <div key={j} className="param-row" style={{ alignItems: 'center' }}>
                  <span className={`tag ${p.required ? 'tag-required' : 'tag-optional'}`}>{p.required ? 'required' : 'optional'}</span>
                  <span className="text-sm param-name">{p.name}</span>
                  <span className="text-sm text-muted" style={{ minWidth: 60 }}>{p.type || p.schema?.type || 'string'}</span>
                  <div className="flex-1" style={{ position: 'relative' }}>
                    <input
                      style={{ maxWidth: 400, borderColor: fromGlobal ? '#1f6feb55' : undefined }}
                      placeholder={p.description || p.name}
                      value={displayVal}
                      onChange={e => onPathOverride(p.name, e.target.value)}
                    />
                    {fromGlobal && (
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#1f6feb', pointerEvents: 'none' }}>global</span>
                    )}
                  </div>
                  {epPathOverrides?.[p.name] !== undefined && (
                    <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => onPathOverrideReset(p.name)}>↺</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Parameters */}
      {(ep.parameters?.filter(p => p.in !== 'path').length > 0 || higherLevelParams.length > 0) && (
        <div className="mb-2">
          <h3 className="mb-2">Parameters</h3>
          <div className="param-table">
            {ep.parameters?.filter(p => p.in !== 'path').map((p, j) => (
              <div key={j} className="param-row">
                <span className={`tag ${p.required ? 'tag-required' : 'tag-optional'}`}>{p.required ? 'required' : 'optional'}</span>
                <span className="text-sm param-in">{p.in}</span>
                <span className="text-sm param-name">{p.name}</span>
                <span className="text-sm text-muted flex-1">{p.type}{p.description ? ` — ${p.description}` : ''}</span>
              </div>
            ))}
            {higherLevelParams.map((p, j) => (
              <div key={`global-${j}`} className="param-row" style={{ opacity: 0.75 }}>
                <span className="tag tag-optional">global</span>
                <span className="text-sm param-in">{p.in}</span>
                <span className="text-sm param-name">{p.name}</span>
                <span className="text-sm text-muted flex-1">{p.label !== p.name ? p.label : ''}</span>
                <span className="text-sm" style={{ color: p.value ? '#3fb950' : '#8b949e', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.value || '(not set)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Payload */}
      {hasBody && (
        <div className="mb-2">
          <div className="flex gap-2 mb-2" style={{ alignItems: 'center' }}>
            <h3 style={{ flex: 1 }}>Request Payload</h3>
            <div className="flex gap-1">
              <button
                className={`method-filter-btn ${payloadTab === 'editor' ? 'active' : ''}`}
                style={{ fontSize: 11, padding: '3px 10px' }}
                onClick={() => setPayloadTab('editor')}
              >Editor</button>
              {payloadExample && (
                <button
                  className={`method-filter-btn ${payloadTab === 'example' ? 'active' : ''}`}
                  style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => setPayloadTab('example')}
                >Example</button>
              )}
            </div>
            <button className="btn-blue" onClick={() => onGeneratePayload(ep)}>Generate</button>
          </div>
          {payloadTab === 'editor' ? (
            <textarea
              className="payload-editor"
              rows={10}
              placeholder="Click 'Generate' or type your JSON here..."
              value={epPayload || ''}
              onChange={e => onPayloadChange(e.target.value)}
            />
          ) : (
            <div style={{ position: 'relative' }}>
              <pre className="payload-editor" style={{ margin: 0, overflowY: 'auto', maxHeight: 300, cursor: 'default' }}>{payloadExample}</pre>
              <button
                className="btn-secondary"
                style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, padding: '3px 8px' }}
                onClick={() => { onPayloadChange(payloadExample); setPayloadTab('editor'); }}
              >Use this</button>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-2 mt-2" style={{ alignItems: 'center' }}>
        <button className="btn-primary" onClick={() => onExecute(ep)}>
          {epResponse?.loading ? <><span className="spinner" />Executing...</> : 'Execute'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="btn-secondary"
          style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={handleToggleHistory}
        >
          📋 History{history.length > 0 ? ` (${history.length})` : ''}
        </button>
        <button
          className={`btn-secondary ${savedOk ? 'save-ok' : ''}`}
          style={{ fontSize: 12, padding: '5px 12px', minWidth: 70 }}
          disabled={saving}
          onClick={handleSave}
        >
          {savedOk ? '✓ Saved' : saving ? '...' : '💾 Save'}
        </button>
      </div>

      {/* History panel */}
      <div className={`ep-collapse ${showHistory ? 'ep-collapse-open' : ''}`}>
        <div>
          <div className="req-history">
            <div className="req-history-header">
              <span className="text-sm" style={{ fontWeight: 600 }}>Request History</span>
              <div className="flex gap-2">
                <button
                  className={`method-filter-btn ${historyFilter === 'all' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('all')}
                >All</button>
                <button
                  className={`method-filter-btn ${historyFilter === 'pinned' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('pinned')}
                >
                  📌 Pinned{pinnedCount > 0 ? ` (${pinnedCount})` : ''}
                </button>
              </div>
            </div>

            {history.length === 0 && (
              <p className="text-sm text-muted" style={{ padding: '10px 12px' }}>
                {historyFilter === 'pinned' ? 'No pinned requests.' : 'No saved requests yet — click 💾 Save to add one.'}
              </p>
            )}

            {history.map((entry) => (
              <div key={entry.id} className={`req-history-item ${entry.pinned ? 'req-history-pinned' : ''}`}>
                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                  <span className="text-sm" style={{ flex: 1, fontWeight: 500 }}>
                    {entry.label || new Date(entry.savedAt).toLocaleString()}
                  </span>
                  {!entry.label && <span className="text-sm text-muted">{new Date(entry.savedAt).toLocaleString()}</span>}
                  {entry.response?.status && (
                    <span className={`status-code ${entry.response.status < 300 ? 'status-ok' : entry.response.status < 400 ? 'status-warn' : 'status-err'}`}>
                      {entry.response.status}
                    </span>
                  )}
                  <button
                    title={entry.pinned ? 'Unpin' : 'Pin'}
                    className="btn-secondary"
                    style={{ fontSize: 12, padding: '2px 7px', opacity: entry.pinned ? 1 : 0.5 }}
                    onClick={() => handlePin(entry)}
                  >📌</button>
                  <button className="btn-secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleRestore(entry)}>↩ Restore</button>
                  <button className="btn-danger" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleDelete(entry)}>✕</button>
                </div>
                {entry.payload && (
                  <pre className="req-history-payload">{entry.payload}</pre>
                )}
                {Object.keys(entry.pathOverrides || {}).length > 0 && (
                  <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                    Path: {Object.entries(entry.pathOverrides).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Response */}
      {epResponse && !epResponse.loading && (
        <div className="ep-response mt-2">
          <div className="flex gap-2 mb-2" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3>
                Response
                {epResponse.status && (
                  <span className={`status-code ${epResponse.status < 300 ? 'status-ok' : epResponse.status < 400 ? 'status-warn' : 'status-err'}`}>
                    {epResponse.status} {epResponse.statusText}
                  </span>
                )}
              </h3>
              <SourceIndicator source={epResponse.source} type="request" />
            </div>
            <button className="btn-secondary" onClick={onClearResponse}>Clear</button>
          </div>
          <div
            style={{
              resize: 'vertical',
              overflow: 'auto',
              minHeight: 80,
              maxHeight: 600,
              height: 220,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '10px 14px',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {epResponse.error
              ? <span style={{ color: '#f85149' }}>{epResponse.error}</span>
              : typeof epResponse.data === 'object'
                ? <JsonNode data={epResponse.data} depth={0} />
                : <span style={{ color: '#a5d6ff' }}>{String(epResponse.data)}</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}
