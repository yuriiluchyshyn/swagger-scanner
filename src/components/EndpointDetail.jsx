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
  globalParams, globalValues, availableParams, hasBody, definitions,
  onExecute, onGeneratePayload, onGeneratePathParams, onSaveRequest,
  onPayloadChange, onPathOverride, onPathOverrideReset, onClearResponse,
  onUpdateGlobalParam, onParamOverride, onParamOverrideReset, epParamOverrides,
}) {
  const key = `${ep.method}:${ep.path}`;
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'pinned'
  const [payloadTab, setPayloadTab] = useState('editor'); // 'editor' | 'example'
  const [showResponseModal, setShowResponseModal] = useState(false);

  // Helper function to get suggestions from available params
  const getSuggestions = useCallback((paramName) => {
    if (!availableParams) return [];
    
    const suggestions = [];
    const lowerParamName = paramName.toLowerCase();
    
    // Exact match
    if (availableParams[paramName]) {
      suggestions.push({ key: paramName, value: availableParams[paramName], type: 'exact' });
    }
    
    // Partial matches
    Object.entries(availableParams).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (key !== paramName && (
        lowerKey.includes(lowerParamName) || 
        lowerParamName.includes(lowerKey) ||
        lowerKey.endsWith('_' + lowerParamName) ||
        lowerKey.startsWith(lowerParamName + '_')
      )) {
        suggestions.push({ key, value, type: 'partial' });
      }
    });
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }, [availableParams]);

  // Suggestions component
  const ParamSuggestions = ({ paramName, onSelect }) => {
    const suggestions = getSuggestions(paramName);
    if (suggestions.length === 0) return null;

    return (
      <div style={{ 
        marginTop: 4, 
        fontSize: 11, 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border)', 
        borderRadius: 4, 
        padding: 6 
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>💡 Available:</div>
        {suggestions.map(({ key, value, type }) => (
          <button
            key={key}
            onClick={() => onSelect(String(value))}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              padding: '2px 4px',
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: 11,
              marginBottom: 2,
              color: type === 'exact' ? '#28a745' : 'var(--text-primary)'
            }}
            onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.target.style.background = 'none'}
            title={`Click to use: ${String(value)}`}
          >
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{key}</span>
            {type === 'exact' && <span style={{ color: '#28a745' }}> ✓</span>}
            <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
              {String(value).length > 30 ? `${String(value).substring(0, 30)}...` : String(value)}
            </div>
          </button>
        ))}
      </div>
    );
  };

  // Helper function to convert response data to plain text
  const getResponseText = useCallback(() => {
    if (!epResponse || epResponse.loading) return '';
    if (epResponse.error) return epResponse.error;
    if (typeof epResponse.data === 'object') {
      return JSON.stringify(epResponse.data, null, 2);
    }
    return String(epResponse.data);
  }, [epResponse]);

  // Copy response to clipboard
  const copyResponse = useCallback(async () => {
    const text = getResponseText();
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    }
  }, [getResponseText]);

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
                    <ParamSuggestions 
                      paramName={p.name} 
                      onSelect={(value) => onPathOverride(p.name, value)} 
                    />
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
            {ep.parameters?.filter(p => p.in !== 'path').map((p, j) => {
              const globalCfg = globalParams[p.name];
              const globalVal = globalCfg ? (typeof globalCfg === 'object' ? globalCfg.value : globalCfg) : '';
              const displayVal = epParamOverrides?.[p.name] ?? globalVal ?? p.example ?? '';
              const fromGlobal = !epParamOverrides?.[p.name] && globalVal;
              return (
                <div key={j} className="param-row" style={{ alignItems: 'center' }}>
                  <span className={`tag ${p.required ? 'tag-required' : 'tag-optional'}`}>{p.required ? 'required' : 'optional'}</span>
                  <span className="text-sm param-in">{p.in}</span>
                  <span className="text-sm param-name">{p.name}</span>
                  <span className="text-sm text-muted" style={{ minWidth: 100 }}>{p.type || p.schema?.type || 'string'}{p.description ? ` — ${p.description}` : ''}</span>
                  <div className="flex-1" style={{ position: 'relative' }}>
                    <input
                      style={{ maxWidth: 400, borderColor: fromGlobal ? '#1f6feb55' : undefined }}
                      placeholder={p.description || p.example || p.name}
                      value={displayVal}
                      onChange={e => onParamOverride?.(p.name, e.target.value)}
                    />
                    {fromGlobal && (
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#1f6feb', pointerEvents: 'none' }}>global</span>
                    )}
                    <ParamSuggestions 
                      paramName={p.name} 
                      onSelect={(value) => onParamOverride?.(p.name, value)} 
                    />
                  </div>
                  {epParamOverrides?.[p.name] !== undefined && (
                    <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => onParamOverrideReset?.(p.name)}>↺</button>
                  )}
                </div>
              );
            })}
            {higherLevelParams.map((p, j) => (
              <div key={`global-${j}`} className="param-row" style={{ alignItems: 'center' }}>
                <span className="tag tag-optional">global</span>
                <span className="text-sm param-in">{p.in}</span>
                <span className="text-sm param-name">{p.name}</span>
                <span className="text-sm text-muted" style={{ minWidth: 60 }}>{p.label !== p.name ? p.label : ''}</span>
                <div className="flex-1" style={{ position: 'relative' }}>
                  <input
                    style={{ maxWidth: 400, borderColor: '#1f6feb55' }}
                    placeholder={p.name}
                    value={p.value || ''}
                    onChange={e => {
                      // Update the global parameter value
                      const newGlobalParams = { ...globalParams };
                      if (typeof newGlobalParams[p.name] === 'object') {
                        newGlobalParams[p.name] = { ...newGlobalParams[p.name], value: e.target.value };
                      } else {
                        newGlobalParams[p.name] = e.target.value;
                      }
                      // Call a callback to update global params (we'll need to add this)
                      onUpdateGlobalParam?.(p.name, e.target.value);
                    }}
                  />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#1f6feb', pointerEvents: 'none' }}>global</span>
                  <ParamSuggestions 
                    paramName={p.name} 
                    onSelect={(value) => onUpdateGlobalParam?.(p.name, value)} 
                  />
                </div>
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
            <div className="flex gap-2">
              <button 
                className="btn-secondary" 
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={copyResponse}
                title="Copy response (Ctrl+C)"
              >
                📋 Copy
              </button>
              <button 
                className="btn-secondary" 
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setShowResponseModal(true)}
                title="Open in modal"
              >
                🔍 Expand
              </button>
              <button className="btn-secondary" onClick={onClearResponse}>Clear</button>
            </div>
          </div>
          <div
            className="response-container"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c') {
                  e.preventDefault();
                  copyResponse();
                } else if (e.key === 'a') {
                  e.preventDefault();
                  // Select all text in the response container
                  const selection = window.getSelection();
                  const range = document.createRange();
                  range.selectNodeContents(e.currentTarget);
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
              }
            }}
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
              outline: 'none',
              cursor: 'text',
            }}
          >
            {epResponse.error
              ? <span style={{ color: '#f85149' }}>{epResponse.error}</span>
              : typeof epResponse.data === 'object'
                ? <JsonNode data={epResponse.data} depth={0} />
                : <span style={{ color: '#a5d6ff' }}>{String(epResponse.data)}</span>
            }
          </div>
          <p className="text-sm text-muted mt-1" style={{ fontSize: 11 }}>
            💡 Ctrl+C to copy, Ctrl+A to select all, or click Expand for full view
          </p>
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && epResponse && (
        <div 
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResponseModal(false);
          }}
        >
          <div 
            className="modal-content"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              width: '90vw',
              height: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div 
              className="modal-header"
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>
                  Response
                  {epResponse.status && (
                    <span className={`status-code ${epResponse.status < 300 ? 'status-ok' : epResponse.status < 400 ? 'status-warn' : 'status-err'}`}>
                      {epResponse.status} {epResponse.statusText}
                    </span>
                  )}
                </h3>
                <SourceIndicator source={epResponse.source} type="request" />
              </div>
              <div className="flex gap-2">
                <button 
                  className="btn-secondary" 
                  onClick={copyResponse}
                  title="Copy response (Ctrl+C)"
                >
                  📋 Copy
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowResponseModal(false)}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div 
              className="modal-body"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  if (e.key === 'c') {
                    e.preventDefault();
                    copyResponse();
                  } else if (e.key === 'a') {
                    e.preventDefault();
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(e.currentTarget);
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }
                }
                if (e.key === 'Escape') {
                  setShowResponseModal(false);
                }
              }}
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '20px',
                fontFamily: 'monospace',
                fontSize: 14,
                lineHeight: 1.6,
                background: 'var(--bg-secondary)',
                outline: 'none',
                cursor: 'text',
              }}
            >
              {epResponse.error
                ? <span style={{ color: '#f85149' }}>{epResponse.error}</span>
                : typeof epResponse.data === 'object'
                  ? <JsonNode data={epResponse.data} depth={0} />
                  : <span style={{ color: '#a5d6ff' }}>{String(epResponse.data)}</span>
              }
            </div>
            <div 
              className="modal-footer"
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              💡 Ctrl+C to copy, Ctrl+A to select all, Esc to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
