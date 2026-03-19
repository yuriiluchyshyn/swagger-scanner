import { useState, useEffect, useCallback, useRef } from 'react';
import { parseSwaggerSpec, generateValue } from './helpers.js';
import { compareScanResults } from './diffUtils.js';
import {
  fetchUrls, saveUrls as saveUrlsApi,
  fetchScans, saveScan,
  fetchGlobalParams, saveGlobalParamsApi,
  fetchSwaggerParams, saveSwaggerParamsApi,
  fetchSession, saveSession,
  fetchCheckpoints, fetchCheckpoint, saveCheckpoint, deleteCheckpoint,
  fetchSpec, executeRequest, exportPostmanApi,
  saveDiff, saveRequest,
  fetchIdentity, saveIdentity, clearAccount,
} from './api/client.js';
import UrlPanel from './components/UrlPanel.jsx';
import GlobalParams from './components/GlobalParams.jsx';
import EndpointList from './components/EndpointList.jsx';
import DiffView from './components/DiffView.jsx';
import ScanHistory from './components/ScanHistory.jsx';

const DEFAULT_GLOBAL_PARAMS = {
  Authorization:   { value: '', in: 'header', label: 'Auth Token' },
  tenant_id:       { value: '', in: 'body',   label: 'Tenant ID' },
  tenant_code:     { value: '', in: 'body',   label: 'Tenant Code (= Customer Number)' },
  subscription_id: { value: '', in: 'body',   label: 'Subscription ID' },
  principal_id:    { value: '', in: 'body',   label: 'Principal ID' },
};

export default function App() {
  const [urls, setUrls] = useState('');
  const [tab, setTab] = useState('scan');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scans, setScans] = useState([]);
  const [epPayloads, setEpPayloads] = useState({});
  const [epPathParams, setEpPathParams] = useState({});
  const [epPathOverrides, setEpPathOverrides] = useState({});
  const [epResponses, setEpResponses] = useState({});
  const [checkpoint, setCheckpoint] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]); // list of checkpoint metadata
  const [diff, setDiff] = useState(null);
  const [status, setStatus] = useState('');
  const [globalParams, setGlobalParams] = useState(DEFAULT_GLOBAL_PARAMS);
  const [swaggerParams, setSwaggerParams] = useState({}); // apiTitle → params object
  const [showSettings, setShowSettings] = useState(false);

  // Identity
  const [email, setEmail] = useState(null); // null = not loaded yet, '' = no email set
  const [emailInput, setEmailInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Flat value map: param name → value string (global level)
  const globalValues = Object.fromEntries(
    Object.entries(globalParams).map(([k, v]) => [k, typeof v === 'object' ? v.value : v])
  );

  // Merged values for a given apiTitle: global → swagger-level override
  const getMergedValues = useCallback((apiTitle) => {
    const swaggerLevel = swaggerParams[apiTitle] || {};
    const swaggerValues = Object.fromEntries(
      Object.entries(swaggerLevel).map(([k, v]) => [k, typeof v === 'object' ? v.value : v])
    );
    return { ...globalValues, ...swaggerValues };
  }, [globalValues, swaggerParams]);

  const handleSaveSwaggerParams = useCallback((apiTitle, params) => {
    setSwaggerParams(prev => {
      const next = { ...prev, [apiTitle]: params };
      saveSwaggerParamsApi(next).catch(() => {});
      return next;
    });
  }, []);

  // Debounced session save — fires 800ms after last change to payloads/overrides
  const sessionSaveTimer = useRef(null);
  const saveSessionDebounced = useCallback((payloads, overrides) => {
    clearTimeout(sessionSaveTimer.current);
    sessionSaveTimer.current = setTimeout(() => {
      saveSession({ epPayloads: payloads, epPathOverrides: overrides }).catch(() => {});
    }, 800);
  }, []);

  useEffect(() => {
    fetchIdentity().then(data => {
      setEmail(data?.email || '');
      setEmailInput(data?.email || '');
    }).catch(() => setEmail(''));
    fetchUrls().then(data => { if (Array.isArray(data) && data.length) setUrls(data.join('\n')); }).catch(() => {});
    fetchGlobalParams().then(data => {
      if (data && typeof data === 'object' && !data.error && Object.keys(data).length > 0) {
        // Merge saved params with defaults so new default keys always appear
        setGlobalParams(prev => ({ ...prev, ...data }));
      }
    }).catch(() => {});
    fetchSwaggerParams().then(data => {
      if (data && typeof data === 'object' && !data.error) setSwaggerParams(data);
    }).catch(() => {});
    fetchSession().then(data => {
      if (data?.epPayloads) setEpPayloads(data.epPayloads);
      if (data?.epPathOverrides) setEpPathOverrides(data.epPathOverrides);
    }).catch(() => {});
    // Load checkpoint list — auto-select the most recent one
    fetchCheckpoints().then(async data => {
      if (!Array.isArray(data) || data.length === 0) return;
      setCheckpoints(data);
      // Auto-select the last checkpoint
      const last = data[data.length - 1];
      const full = await fetchCheckpoint(last.index);
      setCheckpoint(full);
    }).catch(() => {});
    // Load scans and auto-restore the last one
    fetchScans().then(data => {
      if (!Array.isArray(data)) return;
      setScans(data);
      if (data.length > 0) {
        const last = data[data.length - 1];
        setScanResult(last);
        // Don't restore URLs from scan — fetchUrls is the source of truth for the URL list
      }
    }).catch(() => {});
  }, []);

  const flash = (msg) => { setStatus(msg); setTimeout(() => setStatus(''), 2500); };

  const handleSetEmail = useCallback(async () => {
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    await saveIdentity(trimmed);
    setEmail(trimmed);
    flash('Email saved');
  }, [emailInput]);

  const handleClearAccount = useCallback(async () => {
    await clearAccount();
    setEmail('');
    setEmailInput('');
    setUrls('');
    setScanResult(null);
    setScans([]);
    setEpPayloads({});
    setEpPathParams({});
    setEpPathOverrides({});
    setEpResponses({});
    setCheckpoint(null);
    setCheckpoints([]);
    setDiff(null);
    setGlobalParams(DEFAULT_GLOBAL_PARAMS);
    setSwaggerParams({});
    setConfirmClear(false);
    flash('Account cleared');
  }, []);

  const handleSaveUrls = useCallback(async () => {
    const list = urls.split('\n').map(s => s.trim()).filter(Boolean);
    await saveUrlsApi(list);
    flash('URLs saved');
  }, [urls]);

  const handleSaveGlobalParams = useCallback(async (params) => {
    setGlobalParams(params);
    await saveGlobalParamsApi(params);
  }, []);

  const handleScan = useCallback(async () => {
    setLoading(true);
    setStatus('Scanning...');
    const list = urls.split('\n').map(s => s.trim()).filter(Boolean);
    const allEndpoints = [];
    let definitions = {};
    let info = {};
    let baseUrl = '';

    for (const url of list) {
      try {
        const spec = await fetchSpec(url);
        if (spec.error) { setStatus(`Error: ${spec.error}`); continue; }
        const parsed = parseSwaggerSpec(spec, url);
        const apiTitle = parsed.info?.title || url;
        allEndpoints.push(...parsed.endpoints.map(ep => ({ ...ep, _apiTitle: apiTitle })));
        definitions = { ...definitions, ...parsed.definitions };
        info = parsed.info;
        baseUrl = parsed.baseUrl;
      } catch (e) {
        setStatus(`Error fetching ${url}: ${e.message}`);
      }
    }

    const scan = { timestamp: new Date().toISOString(), sourceUrls: list, endpoints: allEndpoints, definitions, info, baseUrl };
    setScanResult(scan);
    setDiff(null); // clear stale diff when a new scan runs
    setScans(prev => [...prev, scan]);
    saveScan(scan).catch(() => {}); // persist so it survives refresh
    setLoading(false);
    flash(`Scanned ${allEndpoints.length} endpoints`);
  }, [urls]);

  const handleSaveCheckpoint = useCallback(async () => {
    if (!scanResult) return;
    const result = await saveCheckpoint(scanResult);
    const newIndex = result?.index ?? 0;
    // Reload checkpoint list metadata
    const list = await fetchCheckpoints();
    setCheckpoints(list);
    // Load the full checkpoint we just saved and set as active
    const full = await fetchCheckpoint(newIndex);
    setCheckpoint(full);
    setDiff(null);
    flash('Checkpoint saved');
  }, [scanResult]);

  const handleSelectCheckpoint = useCallback(async (meta) => {
    const full = await fetchCheckpoint(meta.index);
    setCheckpoint(full);
    setDiff(null);
  }, []);

  const handleDeleteCheckpoint = useCallback(async (meta) => {
    await deleteCheckpoint(meta.index);
    const list = await fetchCheckpoints();
    setCheckpoints(list);
    if (checkpoint?.timestamp === meta.timestamp) {
      setCheckpoint(null);
      setDiff(null);
    }
  }, [checkpoint]);

  const handleRunDiff = useCallback(() => {
    if (!checkpoint || !scanResult) return;
    const result = compareScanResults(checkpoint, scanResult);
    setDiff(result);
    setTab('diff');
    saveDiff({
      timestamp: new Date().toISOString(),
      checkpointTimestamp: checkpoint.timestamp,
      scanTimestamp: scanResult.timestamp,
      ...result,
    }).catch(() => {});
  }, [checkpoint, scanResult]);

  const injectGlobalParams = useCallback((obj, mergedValues) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => injectGlobalParams(item, mergedValues));
    const result = { ...obj };
    for (const [key, val] of Object.entries(result)) {
      if (key in mergedValues && mergedValues[key]) result[key] = mergedValues[key];
      else if (typeof val === 'object') result[key] = injectGlobalParams(val, mergedValues);
    }
    return result;
  }, []);

  const handleGeneratePayload = useCallback((ep) => {
    const key = `${ep.method}:${ep.path}`;
    const merged = getMergedValues(ep._apiTitle);
    let payload = {};
    if (ep.requestBody) {
      const jsonContent = ep.requestBody.content?.['application/json'];
      if (jsonContent?.schema) payload = generateValue(jsonContent.schema, scanResult?.definitions);
    }
    const bodyParam = (ep.parameters || []).find(p => p.in === 'body');
    if (bodyParam?.schema) payload = generateValue(bodyParam.schema, scanResult?.definitions);
    payload = injectGlobalParams(payload, merged);
    setEpPayloads(prev => ({ ...prev, [key]: JSON.stringify(payload, null, 2) }));
  }, [scanResult, injectGlobalParams, getMergedValues]);

  const handleGeneratePathParams = useCallback((ep) => {
    const key = `${ep.method}:${ep.path}`;
    const merged = getMergedValues(ep._apiTitle);
    const pathParams = (ep.parameters || []).filter(p => p.in === 'path');
    if (!pathParams.length) return;
    const generated = {};
    for (const p of pathParams) {
      generated[p.name] = merged[p.name]
        || String(generateValue({ type: p.type || p.schema?.type || 'string', format: p.schema?.format }, scanResult?.definitions));
    }
    setEpPathParams(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...generated } }));
  }, [getMergedValues, scanResult]);

  const handleExecute = useCallback(async (ep) => {
    const key = `${ep.method}:${ep.path}`;
    const merged = getMergedValues(ep._apiTitle);
    // Merged params object (for header location check)
    const mergedParamsCfg = { ...globalParams, ...(swaggerParams[ep._apiTitle] || {}) };
    setEpResponses(prev => ({ ...prev, [key]: { loading: true } }));

    let url = ep.fullUrl;
    let body;
    const payload = epPayloads[key];
    if (payload) { try { body = JSON.parse(payload); } catch { body = payload; } }

    // Path params — priority: endpoint override → merged (global+swagger) → generated → example → name
    const pathParamRegex = /\{(\w+)\}/g;
    let m;
    while ((m = pathParamRegex.exec(ep.fullUrl)) !== null) {
      const pName = m[1];
      const val = epPathOverrides[key]?.[pName]
        ?? merged[pName]
        ?? epPathParams[key]?.[pName]
        ?? ep.parameters?.find(p => p.in === 'path' && p.name === pName)?.example
        ?? pName;
      url = url.replace(`{${pName}}`, val);
    }

    // Query params
    const queryParams = (ep.parameters || []).filter(p => p.in === 'query').map(p => {
      const val = merged[p.name] || p.example || '';
      return val ? `${p.name}=${encodeURIComponent(val)}` : null;
    }).filter(Boolean);
    if (queryParams.length) url += '?' + queryParams.join('&');

    // Headers — from merged params cfg
    const headers = {};
    for (const [name, cfg] of Object.entries(mergedParamsCfg)) {
      const loc = typeof cfg === 'object' ? cfg.in : 'body';
      const val = typeof cfg === 'object' ? cfg.value : cfg;
      if (loc === 'header' && val) headers[name] = val;
    }
    for (const p of ep.parameters || []) {
      if (p.in === 'header' && !headers[p.name]) {
        const val = merged[p.name] || p.example;
        if (val) headers[p.name] = val;
      }
    }

    const hasBody = ['post', 'put', 'patch', 'delete'].includes(ep.method);
    try {
      const data = await executeRequest({ url, method: ep.method, headers, body: hasBody ? body : undefined });
      setEpResponses(prev => ({ ...prev, [key]: data }));
    } catch (e) {
      setEpResponses(prev => ({ ...prev, [key]: { error: e.message } }));
    }
  }, [epPayloads, epPathParams, epPathOverrides, globalParams, swaggerParams, getMergedValues]);

  const handleSaveRequest = useCallback(async (ep, label) => {
    const key = `${ep.method}:${ep.path}`;
    await saveRequest({
      key,
      label: label || `${ep.method.toUpperCase()} ${ep.path}`,
      apiTitle: ep._apiTitle || '',
      method: ep.method,
      path: ep.path,
      fullUrl: ep.fullUrl,
      payload: epPayloads[key] || null,
      pathOverrides: epPathOverrides[key] || {},
      swaggerParams: swaggerParams[ep._apiTitle] || {},
      response: epResponses[key] || null,
    });
  }, [epPayloads, epPathOverrides, epResponses, swaggerParams]);

  const handleExportPostman = useCallback(async () => {
    if (!scanResult) return;
    const collection = await exportPostmanApi(scanResult.info?.title || 'Swagger Export', scanResult);
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `postman-collection-${Date.now()}.json`;
    a.click();
    flash('Postman collection downloaded');
  }, [scanResult]);

  // Still loading identity
  if (email === null) return <div className="container"><span className="spinner" /> Loading...</div>;

  // No email set — show gate
  if (!email) return (
    <div className="container" style={{ maxWidth: 420, marginTop: 80 }}>
      <h1>🔍 Swagger Scanner</h1>
      <div className="card" style={{ marginTop: 24 }}>
        <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>Enter your email to get started. No password needed.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            className="input"
            style={{ flex: 1 }}
            placeholder="you@example.com"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSetEmail()}
            autoFocus
          />
          <button className="btn-primary" onClick={handleSetEmail}>Continue</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>🔍 Swagger Scanner</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>👤 {email}</span>
          {!confirmClear
            ? <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px', color: '#f85149' }} onClick={() => setConfirmClear(true)}>Clear account</button>
            : <>
                <span style={{ fontSize: 12, color: '#f85149' }}>Are you sure?</span>
                <button className="btn-primary" style={{ fontSize: 12, padding: '3px 10px', background: '#f85149', borderColor: '#f85149' }} onClick={handleClearAccount}>Yes, delete all</button>
                <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setConfirmClear(false)}>Cancel</button>
              </>
          }
        </div>
      </div>

      {status && (
        <div className="card mb-4" style={{ borderColor: '#1f6feb' }}>
          <span className="text-sm">{loading && <span className="spinner" />}{status}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <UrlPanel
            urls={urls}
            setUrls={setUrls}
            loading={loading}
            onSave={handleSaveUrls}
            onScan={handleScan}
            onCheckpoint={handleSaveCheckpoint}
            onDiff={handleRunDiff}
            onExport={handleExportPostman}
            scanResult={scanResult}
            checkpoint={checkpoint}
          />
        </div>
        <button
          className="btn-secondary"
          style={{ marginTop: 12, whiteSpace: 'nowrap' }}
          onClick={() => setShowSettings(s => !s)}
        >
          ⚙️ Global Params {Object.keys(globalParams).length > 0 && `(${Object.keys(globalParams).length})`}
        </button>
      </div>

      {showSettings && (
        <GlobalParams globalParams={globalParams} onSave={handleSaveGlobalParams} />
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'scan' ? 'active' : ''}`} onClick={() => setTab('scan')}>
          Endpoints {scanResult && `(${scanResult.endpoints.length})`}
        </button>
        <button className={`tab ${tab === 'diff' ? 'active' : ''}`} onClick={() => setTab('diff')}>
          Diff {diff && `(${diff.added.length + diff.removed.length + diff.changed.length} changes)`}
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          Scan History ({scans.length})
        </button>
      </div>

      {tab === 'scan' && (
        <EndpointList
          scanResult={scanResult}
          epPayloads={epPayloads}
          epPathParams={epPathParams}
          epPathOverrides={epPathOverrides}
          epResponses={epResponses}
          globalParams={globalParams}
          globalValues={globalValues}
          swaggerParams={swaggerParams}
          getMergedValues={getMergedValues}
          onSaveSwaggerParams={handleSaveSwaggerParams}
          onExecute={handleExecute}
          onGeneratePayload={handleGeneratePayload}
          onGeneratePathParams={handleGeneratePathParams}
          onSaveRequest={handleSaveRequest}
          onPayloadChange={(key, val) => setEpPayloads(prev => {
            const next = { ...prev, [key]: val };
            saveSessionDebounced(next, epPathOverrides);
            return next;
          })}
          onPathOverride={(key, name, val) => setEpPathOverrides(prev => {
            const next = { ...prev, [key]: { ...(prev[key] || {}), [name]: val } };
            saveSessionDebounced(epPayloads, next);
            return next;
          })}
          onPathOverrideReset={(key, name) => setEpPathOverrides(prev => {
            const n = { ...prev, [key]: { ...(prev[key] || {}) } };
            delete n[key][name];
            saveSessionDebounced(epPayloads, n);
            return n;
          })}
          onClearResponse={key => setEpResponses(prev => { const n = { ...prev }; delete n[key]; return n; })}
        />
      )}

      {tab === 'diff' && (
        <DiffView
          diff={diff}
          checkpoint={checkpoint}
          checkpoints={checkpoints}
          scanResult={scanResult}
          onSelectCheckpoint={handleSelectCheckpoint}
          onDeleteCheckpoint={handleDeleteCheckpoint}
          onRunDiff={handleRunDiff}
        />
      )}

      {tab === 'history' && (
        <ScanHistory
          scans={scans}
          onRestoreScan={s => { setScanResult(s); if (s.sourceUrls?.length) setUrls(s.sourceUrls.join('\n')); setTab('scan'); flash('Scan session restored'); }}
          onRestoreRequest={entry => {
            if (entry.payload) setEpPayloads(prev => ({ ...prev, [entry.key]: entry.payload }));
            if (entry.pathOverrides && Object.keys(entry.pathOverrides).length) {
              setEpPathOverrides(prev => ({ ...prev, [entry.key]: entry.pathOverrides }));
            }
            if (entry.swaggerParams && entry.apiTitle) {
              setSwaggerParams(prev => ({ ...prev, [entry.apiTitle]: entry.swaggerParams }));
            }
            if (entry.response) setEpResponses(prev => ({ ...prev, [entry.key]: entry.response }));
            setTab('scan');
            flash(`Restored: ${entry.method?.toUpperCase()} ${entry.path}`);
          }}
        />
      )}
    </div>
  );
}
