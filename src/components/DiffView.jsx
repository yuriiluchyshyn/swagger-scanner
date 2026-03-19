import { useState } from 'react';
import { DIFF_STATE, endpointSnapshot } from '../diffUtils.js';

const STATE_META = {
  [DIFF_STATE.NEW_API]:     { label: 'New API',    cls: 'diff-state-new-api' },
  [DIFF_STATE.REMOVED_API]: { label: 'Removed API',cls: 'diff-state-removed-api' },
  [DIFF_STATE.NEW]:         { label: 'New',        cls: 'diff-state-new' },
  [DIFF_STATE.REMOVED]:     { label: 'Removed',    cls: 'diff-state-removed' },
  [DIFF_STATE.BREAKING]:    { label: 'Breaking',   cls: 'diff-state-breaking' },
  [DIFF_STATE.DEPRECATED]:  { label: 'Deprecated', cls: 'diff-state-deprecated' },
  [DIFF_STATE.UPDATED]:     { label: 'Updated',    cls: 'diff-state-updated' },
};

function StateBadge({ state }) {
  const meta = STATE_META[state];
  if (!meta) return null;
  return <span className={`diff-state-badge ${meta.cls}`}>{meta.label}</span>;
}

function DiffTagLine({ d }) {
  if (d.type === 'param_added')            return <span className="diff-tag diff-tag-added">+ param added: {d.name}</span>;
  if (d.type === 'param_removed')          return <span className="diff-tag diff-tag-removed">- param removed: {d.name}</span>;
  if (d.type === 'param_required_changed') return <span className="diff-tag diff-tag-changed">~ {d.name}: required {String(d.from)} to {String(d.to)}</span>;
  if (d.type === 'param_type_changed')     return <span className="diff-tag diff-tag-breaking">~ {d.name}: type {d.from} to {d.to}</span>;
  if (d.type === 'param_location_changed') return <span className="diff-tag diff-tag-breaking">~ {d.name}: location {d.from} to {d.to}</span>;
  if (d.type === 'summary_changed')        return <span className="diff-tag diff-tag-changed">~ summary changed</span>;
  if (d.type === 'description_changed')    return <span className="diff-tag diff-tag-changed">~ description changed</span>;
  if (d.type === 'operation_id_changed')   return <span className="diff-tag diff-tag-changed">~ operationId: {d.from} to {d.to}</span>;
  if (d.type === 'deprecated_added')       return <span className="diff-tag diff-tag-deprecated">deprecated added</span>;
  if (d.type === 'deprecated_removed')     return <span className="diff-tag diff-tag-changed">~ deprecated removed</span>;
  if (d.type === 'response_added')         return <span className="diff-tag diff-tag-added">+ response {d.code} added</span>;
  if (d.type === 'response_removed')       return <span className="diff-tag diff-tag-removed">- response {d.code} removed</span>;
  if (d.type === 'request_body_added')     return <span className="diff-tag diff-tag-added">+ request body added</span>;
  if (d.type === 'request_body_removed')   return <span className="diff-tag diff-tag-removed">- request body removed</span>;
  return <span className="diff-tag diff-tag-changed">{d.type}</span>;
}

function EpRow({ ep, diffKey, expandedDiff, setExpandedDiff, state, children }) {
  const isOpen = expandedDiff === diffKey;
  return (
    <div className="diff-changed-block">
      <div className={`diff-ep-row diff-ep-${state}`} onClick={() => setExpandedDiff(isOpen ? null : diffKey)}>
        <span className={`method-badge method-${ep.method}`}>{ep.method}</span>
        <span className="flex-1">{ep.path}</span>
        {ep.summary && <span className="text-sm text-muted">{ep.summary}</span>}
        <StateBadge state={state} />
        <span className="diff-chevron">{isOpen ? '▼' : '▶'}</span>
      </div>
      <div className={`diff-body ${isOpen ? 'diff-body-open' : ''}`}>
        <div>{children}</div>
      </div>
    </div>
  );
}

function SummaryBar({ diff }) {
  const counts = {};
  for (const ep of diff.added)   counts[ep._diffState] = (counts[ep._diffState] || 0) + 1;
  for (const ep of diff.removed) counts[ep._diffState] = (counts[ep._diffState] || 0) + 1;
  for (const c  of diff.changed) counts[c.state]       = (counts[c.state]       || 0) + 1;
  const order = [DIFF_STATE.NEW_API, DIFF_STATE.REMOVED_API, DIFF_STATE.BREAKING, DIFF_STATE.NEW, DIFF_STATE.REMOVED, DIFF_STATE.DEPRECATED, DIFF_STATE.UPDATED];
  const entries = order.filter(s => counts[s]);
  if (!entries.length) return null;
  return (
    <div className="diff-summary-bar">
      {entries.map(s => (
        <span key={s} className={`diff-state-badge ${STATE_META[s].cls}`}>
          {STATE_META[s].label}: {counts[s]}
        </span>
      ))}
    </div>
  );
}

function CheckpointSidebar({ checkpoints, checkpoint, scanResult, onSelect, onDelete, onRunDiff }) {
  return (
    <div className="diff-checkpoint-sidebar">
      <div className="diff-checkpoint-sidebar-header">
        <span style={{ fontWeight: 600, fontSize: 13 }}>Checkpoints</span>
      </div>
      <div className="diff-checkpoint-list">
        {checkpoints.length === 0 && (
          <div className="text-muted text-sm" style={{ padding: '12px' }}>
            No checkpoints yet. Use &quot;Save Checkpoint&quot; to create one.
          </div>
        )}
        {[...checkpoints].reverse().map((meta) => {
          const isActive = checkpoint && checkpoint.timestamp === meta.timestamp;
          return (
            <div
              key={meta.index}
              className={`diff-checkpoint-item${isActive ? ' diff-checkpoint-item-active' : ''}`}
              onClick={() => onSelect(meta)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm" style={{ color: isActive ? '#58a6ff' : '#c9d1d9', fontWeight: isActive ? 600 : 400 }}>
                  {new Date(meta.timestamp).toLocaleString()}
                </div>
                <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                  {meta.endpointCount} endpoints
                  {meta.sourceUrls && meta.sourceUrls.length > 0
                    ? ` · ${meta.sourceUrls.length} API${meta.sourceUrls.length !== 1 ? 's' : ''}`
                    : ''}
                </div>
              </div>
              <button
                className="btn-secondary"
                style={{ padding: '2px 7px', fontSize: 11, flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); onDelete(meta); }}
                title="Delete checkpoint"
              >✕</button>
            </div>
          );
        })}
      </div>
      {checkpoint && scanResult && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid #21262d' }}>
          <button className="btn-blue" style={{ width: '100%' }} onClick={onRunDiff}>Run Diff</button>
          <div className="text-sm text-muted" style={{ marginTop: 6, textAlign: 'center' }}>
            vs current scan ({scanResult.endpoints ? scanResult.endpoints.length : 0} endpoints)
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiffView({ diff, checkpoint, checkpoints, scanResult, onSelectCheckpoint, onDeleteCheckpoint, onRunDiff }) {
  const [expandedDiff, setExpandedDiff] = useState(null);
  const cpList = checkpoints || [];

  const newApiGroups = {};
  const removedApiGroups = {};
  const plainAdded = [];
  const plainRemoved = [];

  if (diff) {
    for (const ep of diff.added) {
      if (ep._diffState === DIFF_STATE.NEW_API) {
        if (!newApiGroups[ep._apiTitle]) newApiGroups[ep._apiTitle] = [];
        newApiGroups[ep._apiTitle].push(ep);
      } else {
        plainAdded.push(ep);
      }
    }
    for (const ep of diff.removed) {
      if (ep._diffState === DIFF_STATE.REMOVED_API) {
        if (!removedApiGroups[ep._apiTitle]) removedApiGroups[ep._apiTitle] = [];
        removedApiGroups[ep._apiTitle].push(ep);
      } else {
        plainRemoved.push(ep);
      }
    }
  }

  return (
    <div className="diff-layout">
      <CheckpointSidebar
        checkpoints={cpList}
        checkpoint={checkpoint}
        scanResult={scanResult}
        onSelect={onSelectCheckpoint}
        onDelete={onDeleteCheckpoint}
        onRunDiff={onRunDiff}
      />
      <div className="diff-main card">
        {checkpoint && (
          <div className="text-sm text-muted mb-4">
            Comparing checkpoint from{' '}
            <span style={{ color: '#c9d1d9' }}>{new Date(checkpoint.timestamp).toLocaleString()}</span>
            {checkpoint.endpoints && ` (${checkpoint.endpoints.length} endpoints)`}
            {' '}against current scan
          </div>
        )}
        {!diff && !checkpoint && (
          <p className="text-muted text-sm">Select a checkpoint from the left to compare against the current scan.</p>
        )}
        {!diff && checkpoint && !scanResult && (
          <p className="text-muted text-sm">Scan endpoints first, then click Run Diff.</p>
        )}
        {!diff && checkpoint && scanResult && (
          <p className="text-muted text-sm">Click Run Diff to compare the selected checkpoint against the current scan.</p>
        )}
        {diff && renderDiff(diff, newApiGroups, removedApiGroups, plainAdded, plainRemoved, expandedDiff, setExpandedDiff)}
      </div>
    </div>
  );
}

function renderDiff(diff, newApiGroups, removedApiGroups, plainAdded, plainRemoved, expandedDiff, setExpandedDiff) {
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    return <p className="text-sm" style={{ color: '#3fb950' }}>No differences found — endpoints are identical.</p>;
  }
  return (
    <>
      <SummaryBar diff={diff} />

      {Object.entries(newApiGroups).map(([title, eps]) => (
        <div key={title} className="diff-api-section diff-api-section-new mb-4">
          <div className="diff-api-section-header">
            <StateBadge state={DIFF_STATE.NEW_API} />
            <span className="diff-api-section-title">{title}</span>
            <span className="text-sm text-muted">{eps.length} endpoint{eps.length !== 1 ? 's' : ''}</span>
          </div>
          {eps.map((ep, i) => (
            <EpRow key={i} ep={ep} diffKey={`new-api:${title}:${i}`} expandedDiff={expandedDiff} setExpandedDiff={setExpandedDiff} state={DIFF_STATE.NEW_API}>
              <div className="diff-side-by-side">
                <div className="diff-side diff-side-new" style={{ gridColumn: '1 / -1' }}>
                  <div className="diff-side-label">New endpoint</div>
                  {endpointSnapshot(ep).map((line, j) => (
                    <div key={j} className="diff-line diff-line-added">{line.text}</div>
                  ))}
                </div>
              </div>
            </EpRow>
          ))}
        </div>
      ))}

      {Object.entries(removedApiGroups).map(([title, eps]) => (
        <div key={title} className="diff-api-section diff-api-section-removed mb-4">
          <div className="diff-api-section-header">
            <StateBadge state={DIFF_STATE.REMOVED_API} />
            <span className="diff-api-section-title">{title}</span>
            <span className="text-sm text-muted">{eps.length} endpoint{eps.length !== 1 ? 's' : ''}</span>
          </div>
          {eps.map((ep, i) => (
            <EpRow key={i} ep={ep} diffKey={`rem-api:${title}:${i}`} expandedDiff={expandedDiff} setExpandedDiff={setExpandedDiff} state={DIFF_STATE.REMOVED_API}>
              <div className="diff-side-by-side">
                <div className="diff-side diff-side-old" style={{ gridColumn: '1 / -1' }}>
                  <div className="diff-side-label">Removed endpoint</div>
                  {endpointSnapshot(ep).map((line, j) => (
                    <div key={j} className="diff-line diff-line-removed">{line.text}</div>
                  ))}
                </div>
              </div>
            </EpRow>
          ))}
        </div>
      ))}

      {plainAdded.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2" style={{ color: '#3fb950' }}>Added ({plainAdded.length})</h3>
          {plainAdded.map((ep, i) => (
            <EpRow key={i} ep={ep} diffKey={`add:${i}`} expandedDiff={expandedDiff} setExpandedDiff={setExpandedDiff} state={DIFF_STATE.NEW}>
              <div className="diff-side-by-side">
                <div className="diff-side diff-side-new" style={{ gridColumn: '1 / -1' }}>
                  <div className="diff-side-label">New endpoint</div>
                  {endpointSnapshot(ep).map((line, j) => (
                    <div key={j} className="diff-line diff-line-added">{line.text}</div>
                  ))}
                </div>
              </div>
            </EpRow>
          ))}
        </div>
      )}

      {plainRemoved.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2" style={{ color: '#f85149' }}>Removed ({plainRemoved.length})</h3>
          {plainRemoved.map((ep, i) => (
            <EpRow key={i} ep={ep} diffKey={`rem:${i}`} expandedDiff={expandedDiff} setExpandedDiff={setExpandedDiff} state={DIFF_STATE.REMOVED}>
              <div className="diff-side-by-side">
                <div className="diff-side diff-side-old" style={{ gridColumn: '1 / -1' }}>
                  <div className="diff-side-label">Removed endpoint</div>
                  {endpointSnapshot(ep).map((line, j) => (
                    <div key={j} className="diff-line diff-line-removed">{line.text}</div>
                  ))}
                </div>
              </div>
            </EpRow>
          ))}
        </div>
      )}

      {diff.changed.length > 0 && (
        <div>
          <h3 className="mb-2" style={{ color: '#d29922' }}>Changed ({diff.changed.length})</h3>
          {diff.changed.map((c, i) => {
            const diffKey = `chg:${i}`;
            const oldLines = endpointSnapshot(c.oldEndpoint);
            const newLines = endpointSnapshot(c.endpoint);
            const changedNames = new Set(c.diffs.map(d => d.name).filter(Boolean));
            const changedTypes = new Set(c.diffs.map(d => d.type));
            return (
              <EpRow key={i} ep={c.endpoint} diffKey={diffKey} expandedDiff={expandedDiff} setExpandedDiff={setExpandedDiff} state={c.state}>
                <div className="diff-side-by-side">
                  <div className="diff-side diff-side-old">
                    <div className="diff-side-label">Previous (checkpoint)</div>
                    {oldLines.map((line, j) => {
                      const isChanged = changedNames.has(line.name)
                        || (line.type === 'summary' && changedTypes.has('summary_changed'))
                        || (line.type === 'description' && changedTypes.has('description_changed'));
                      const isRemoved = line.type === 'param' && c.diffs.some(d => d.type === 'param_removed' && d.name === line.name);
                      return (
                        <div key={j} className={`diff-line ${isRemoved ? 'diff-line-removed' : isChanged ? 'diff-line-changed' : ''}`}>
                          {line.text}
                        </div>
                      );
                    })}
                  </div>
                  <div className="diff-side diff-side-new">
                    <div className="diff-side-label">Current (latest scan)</div>
                    {newLines.map((line, j) => {
                      const isChanged = changedNames.has(line.name)
                        || (line.type === 'summary' && changedTypes.has('summary_changed'))
                        || (line.type === 'description' && changedTypes.has('description_changed'));
                      const isAdded = line.type === 'param' && c.diffs.some(d => d.type === 'param_added' && d.name === line.name);
                      return (
                        <div key={j} className={`diff-line ${isAdded ? 'diff-line-added' : isChanged ? 'diff-line-changed' : ''}`}>
                          {line.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="diff-summary">
                  {c.diffs.map((d, j) => (
                    <div key={j} className="diff-summary-item"><DiffTagLine d={d} /></div>
                  ))}
                </div>
              </EpRow>
            );
          })}
        </div>
      )}
    </>
  );
}
