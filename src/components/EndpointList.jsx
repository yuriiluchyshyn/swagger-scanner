import { useState, useEffect, useRef } from 'react';
import EndpointDetail from './EndpointDetail.jsx';
import SwaggerParams from './SwaggerParams.jsx';
import SourceIndicator from './SourceIndicator.jsx';

const METHODS = ['all', 'get', 'post', 'put', 'patch', 'delete'];

function EndpointRow({
  ep, epPayloads, epPathParams, epPathOverrides, epResponses,
  globalParams, mergedValues,
  onExecute, onGeneratePayload, onGeneratePathParams, onSaveRequest,
  onPayloadChange, onPathOverride, onPathOverrideReset, onClearResponse,
  definitions,
}) {
  const key = `${ep.method}:${ep.path}`;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasBody = ['post', 'put', 'patch'].includes(ep.method);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ep.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="endpoint-row" style={{ cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <span className={`method-badge method-${ep.method}`}>{ep.method}</span>
        <span className="flex-1">{ep.path}</span>
        <span className="text-sm text-muted">{ep.summary}</span>
        <button
          className={`btn-secondary ${copied ? 'save-ok' : ''}`}
          style={{ fontSize: 11, padding: '2px 7px', flexShrink: 0, minWidth: 28 }}
          title="Copy path"
          onClick={handleCopy}
        >{copied ? '✓' : '⎘'}</button>
        <span style={{ fontSize: 12, transition: 'transform .2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      <div className={`ep-collapse ${expanded ? 'ep-collapse-open' : ''}`}>
        <div>
          <EndpointDetail
            ep={ep}
            epKey={key}
            epResponse={epResponses[key]}
            epPayload={epPayloads[key]}
            epPathParams={epPathParams[key]}
            epPathOverrides={epPathOverrides[key]}
            globalParams={globalParams}
            globalValues={mergedValues}
            hasBody={hasBody}
            definitions={definitions}
            onExecute={onExecute}
            onGeneratePayload={onGeneratePayload}
            onGeneratePathParams={onGeneratePathParams}
            onSaveRequest={onSaveRequest}
            onPayloadChange={val => onPayloadChange(key, val)}
            onPathOverride={(name, val) => onPathOverride(key, name, val)}
            onPathOverrideReset={name => onPathOverrideReset(key, name)}
            onClearResponse={() => onClearResponse(key)}
          />
        </div>
      </div>
    </div>
  );
}

function ApiGroup({
  title, endpoints, collapsedGroups, onToggleGroup,
  swaggerParams, onSaveSwaggerParams, getMergedValues,
  globalParams,
  ...rowProps
}) {
  const [showSwaggerParams, setShowSwaggerParams] = useState(false);
  const isOpen = !collapsedGroups.has(title);
  const apiSwaggerParams = swaggerParams[title] || {};
  const mergedValues = getMergedValues(title);
  const swaggerOverrideCount = Object.keys(apiSwaggerParams).length;
  
  // Get the spec source from the first endpoint in this group
  const specSource = endpoints[0]?._specSource;

  return (
    <div className="api-group mb-4">
      <div className="api-group-header" onClick={() => onToggleGroup(title)}>
        <span className="api-group-chevron" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span className="api-group-title">{title}</span>
        <SourceIndicator source={specSource} type="spec" />
        <span className="api-group-count">{endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}</span>
        <button
          className="btn-secondary"
          style={{ fontSize: 11, padding: '3px 10px', marginLeft: 8 }}
          onClick={e => { e.stopPropagation(); setShowSwaggerParams(v => !v); }}
        >
          ⚙️ Params{swaggerOverrideCount > 0 ? ` (${swaggerOverrideCount})` : ''}
        </button>
      </div>

      {/* Swagger-level params panel — outside the collapse so it's always accessible */}
      <div className={`ep-collapse ${showSwaggerParams ? 'ep-collapse-open' : ''}`}>
        <div>
          <SwaggerParams
            title={title}
            globalParams={globalParams}
            swaggerParams={apiSwaggerParams}
            onSave={params => onSaveSwaggerParams(title, params)}
          />
        </div>
      </div>

      <div className={`ep-collapse ${isOpen ? 'ep-collapse-open' : ''}`}>
        <div>
          {endpoints.map(ep => (
            <EndpointRow
              key={`${ep.method}:${ep.path}`}
              ep={ep}
              mergedValues={mergedValues}
              globalParams={globalParams}
              {...rowProps}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EndpointList({
  scanResult, epPayloads, epPathParams, epPathOverrides, epResponses,
  globalParams, globalValues,
  swaggerParams, getMergedValues, onSaveSwaggerParams,
  onExecute, onGeneratePayload, onGeneratePathParams, onSaveRequest,
  onPayloadChange, onPathOverride, onPathOverrideReset, onClearResponse,
}) {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  // Start with all groups collapsed
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    if (!scanResult) return new Set();
    const titles = [...new Set(scanResult.endpoints.map(ep => ep._apiTitle || 'Unknown API'))];
    return new Set(titles);
  });

  // When scanResult changes, collapse any newly seen groups
  const prevScanRef = useRef(scanResult);
  useEffect(() => {
    if (scanResult !== prevScanRef.current) {
      prevScanRef.current = scanResult;
      const titles = [...new Set((scanResult?.endpoints || []).map(ep => ep._apiTitle || 'Unknown API'))];
      setCollapsedGroups(new Set(titles));
    }
  }, [scanResult]);

  if (!scanResult) {
    return <div className="card"><p className="text-muted">No scan results yet. Add Swagger URLs above and click "Scan Endpoints".</p></div>;
  }

  const toggleGroup = (title) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  };

  const q = search.toLowerCase().trim();
  const filtered = scanResult.endpoints.filter(ep => {
    if (methodFilter !== 'all' && ep.method !== methodFilter) return false;
    if (!q) return true;
    if (ep.path.toLowerCase().includes(q)) return true;
    if (ep.method.toLowerCase().includes(q)) return true;
    if (ep.summary?.toLowerCase().includes(q)) return true;
    if (ep.description?.toLowerCase().includes(q)) return true;
    if ((ep.parameters || []).some(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))) return true;
    const resp = epResponses[`${ep.method}:${ep.path}`];
    if (resp?.data) {
      try {
        const s = typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data);
        if (s.toLowerCase().includes(q)) return true;
      } catch {}
    }
    return false;
  });

  // Group by _apiTitle — preserve insertion order
  const groups = [];
  const groupMap = new Map();
  for (const ep of filtered) {
    const title = ep._apiTitle || 'Unknown API';
    if (!groupMap.has(title)) { groupMap.set(title, []); groups.push(title); }
    groupMap.get(title).push(ep);
  }

  const multiGroup = groups.length > 1;
  const allCollapsed = groups.every(t => collapsedGroups.has(t));
  const allExpanded = groups.every(t => !collapsedGroups.has(t));

  const rowProps = {
    epPayloads, epPathParams, epPathOverrides, epResponses,
    onExecute, onGeneratePayload, onGeneratePathParams, onSaveRequest,
    onPayloadChange, onPathOverride, onPathOverrideReset, onClearResponse,
    definitions: scanResult?.definitions,
  };

  return (
    <div className="card">
      <div className="flex gap-2 mb-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: '0 0 auto' }}>
          {multiGroup ? `${scanResult.endpoints.length} Endpoints` : (groups[0] || 'Endpoints')}
        </h2>
        <div className="search-bar flex-1">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search by path, method, summary, parameters, response..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        {multiGroup && (
          <div className="flex gap-2" style={{ flexShrink: 0 }}>
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px' }}
              disabled={allExpanded}
              onClick={() => setCollapsedGroups(new Set())}
            >
              Expand all
            </button>
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px' }}
              disabled={allCollapsed}
              onClick={() => setCollapsedGroups(new Set(groups))}
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      <div className="method-filters mb-4">
        {METHODS.map(m => (
          <button
            key={m}
            className={`method-filter-btn ${methodFilter === m ? 'active' : ''} ${m !== 'all' ? `method-filter-${m}` : ''}`}
            onClick={() => setMethodFilter(m)}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-muted text-sm">No endpoints match "{search}"</p>
      )}

      {multiGroup
        ? groups.map(title => (
            <ApiGroup
              key={title}
              title={title}
              endpoints={groupMap.get(title)}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              swaggerParams={swaggerParams}
              onSaveSwaggerParams={onSaveSwaggerParams}
              getMergedValues={getMergedValues}
              globalParams={globalParams}
              {...rowProps}
            />
          ))
        : (groupMap.get(groups[0]) || []).map(ep => (
            <EndpointRow
              key={`${ep.method}:${ep.path}`}
              ep={ep}
              mergedValues={globalValues}
              globalParams={globalParams}
              {...rowProps}
            />
          ))
      }
    </div>
  );
}
