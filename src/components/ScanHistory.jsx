import { useState, useEffect } from 'react';
import { fetchRequests, patchRequest, deleteRequest } from '../api/client.js';

export default function ScanHistory({ scans, onRestoreScan, onRestoreRequest }) {
  const [section, setSection] = useState('scans'); // 'scans' | 'requests'
  const [requests, setRequests] = useState([]);
  const [reqFilter, setReqFilter] = useState('all'); // 'all' | 'pinned'
  const [loadingReqs, setLoadingReqs] = useState(false);

  const loadRequests = async (filter = reqFilter) => {
    setLoadingReqs(true);
    const data = await fetchRequests(null, filter === 'pinned');
    setRequests(Array.isArray(data) ? data : []);
    setLoadingReqs(false);
  };

  useEffect(() => {
    if (section === 'requests') loadRequests();
  }, [section]);

  const handleFilterChange = async (f) => {
    setReqFilter(f);
    await loadRequests(f);
  };

  const handlePin = async (entry) => {
    await patchRequest(entry.id, { pinned: !entry.pinned });
    await loadRequests();
  };

  const handleDelete = async (entry) => {
    await deleteRequest(entry.id);
    await loadRequests();
  };

  const pinnedCount = requests.filter(r => r.pinned).length;

  return (
    <div className="card">
      {/* Section tabs */}
      <div className="flex gap-2 mb-4" style={{ borderBottom: '1px solid #30363d', paddingBottom: 8 }}>
        <button
          className={`tab ${section === 'scans' ? 'active' : ''}`}
          onClick={() => setSection('scans')}
        >
          Scan Sessions ({scans.length})
        </button>
        <button
          className={`tab ${section === 'requests' ? 'active' : ''}`}
          onClick={() => setSection('requests')}
        >
          Request History {requests.length > 0 ? `(${requests.length})` : ''}
        </button>
      </div>

      {/* Scan sessions */}
      {section === 'scans' && (
        <>
          {scans.length === 0 && <p className="text-muted text-sm">No scan sessions yet.</p>}
          {[...scans].reverse().map((s, i) => {
            const apiTitles = [...new Set(s.endpoints?.map(e => e._apiTitle).filter(Boolean))];
            return (
              <div key={i} className="history-session-row" onClick={() => onRestoreScan(s)}>
                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                  <span className="text-sm" style={{ fontWeight: 600 }}>
                    {new Date(s.timestamp).toLocaleString()}
                  </span>
                  <span className="tag tag-optional">{s.endpoints?.length ?? 0} endpoints</span>
                  {s.sourceUrls?.map((u, j) => (
                    <span key={j} className="text-sm text-muted history-url">{u}</span>
                  ))}
                </div>
                {apiTitles.length > 0 && (
                  <div className="flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                    {apiTitles.map(t => (
                      <span key={t} className="tag" style={{ background: '#1f6feb22', color: '#58a6ff', fontSize: 11 }}>{t}</span>
                    ))}
                  </div>
                )}
                <div className="history-restore-hint">Click to restore →</div>
              </div>
            );
          })}
        </>
      )}

      {/* Request execution history */}
      {section === 'requests' && (
        <>
          <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
            <button className={`method-filter-btn ${reqFilter === 'all' ? 'active' : ''}`} onClick={() => handleFilterChange('all')}>All</button>
            <button className={`method-filter-btn ${reqFilter === 'pinned' ? 'active' : ''}`} onClick={() => handleFilterChange('pinned')}>
              📌 Pinned{pinnedCount > 0 ? ` (${pinnedCount})` : ''}
            </button>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px', marginLeft: 'auto' }} onClick={() => loadRequests()}>↻ Refresh</button>
          </div>

          {loadingReqs && <p className="text-sm text-muted">Loading...</p>}

          {!loadingReqs && requests.length === 0 && (
            <p className="text-muted text-sm">
              {reqFilter === 'pinned' ? 'No pinned requests.' : 'No saved requests yet — open an endpoint and click 💾 Save.'}
            </p>
          )}

          {requests.map(entry => (
            <div key={entry.id} className={`req-history-item ${entry.pinned ? 'req-history-pinned' : ''}`} style={{ borderRadius: 6, marginBottom: 4 }}>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <span className={`method-badge method-${entry.method}`}>{entry.method}</span>
                <span className="text-sm flex-1" style={{ fontWeight: 500 }}>{entry.path}</span>
                {entry.response?.status && (
                  <span className={`status-code ${entry.response.status < 300 ? 'status-ok' : entry.response.status < 400 ? 'status-warn' : 'status-err'}`}>
                    {entry.response.status}
                  </span>
                )}
                <span className="text-sm text-muted">{new Date(entry.savedAt).toLocaleString()}</span>
                <button
                  title={entry.pinned ? 'Unpin' : 'Pin'}
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '2px 7px', opacity: entry.pinned ? 1 : 0.5 }}
                  onClick={e => { e.stopPropagation(); handlePin(entry); }}
                >📌</button>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={e => { e.stopPropagation(); onRestoreRequest(entry); }}
                >↩ Restore</button>
                <button
                  className="btn-danger"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={e => { e.stopPropagation(); handleDelete(entry); }}
                >✕</button>
              </div>
              {entry.label && entry.label !== `${entry.method?.toUpperCase()} ${entry.path}` && (
                <p className="text-sm text-muted" style={{ marginTop: 3 }}>{entry.label}</p>
              )}
              {entry.apiTitle && (
                <span className="tag" style={{ background: '#1f6feb22', color: '#58a6ff', fontSize: 10, marginTop: 3, display: 'inline-block' }}>{entry.apiTitle}</span>
              )}
              {entry.payload && (
                <pre className="req-history-payload">{entry.payload}</pre>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
