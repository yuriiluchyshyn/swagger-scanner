import { useState } from 'react';

const LOCATION_OPTIONS = ['header', 'body', 'query', 'path'];

export default function GlobalParams({ globalParams, onSave }) {
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIn, setNewIn] = useState('body');

  const update = (name, patch) => {
    const cfg = globalParams[name];
    onSave({ ...globalParams, [name]: { ...(typeof cfg === 'object' ? cfg : { in: 'body', label: name }), ...patch } });
  };

  const remove = (name) => {
    const updated = { ...globalParams };
    delete updated[name];
    onSave(updated);
  };

  const add = () => {
    if (!newName.trim()) return;
    onSave({ ...globalParams, [newName.trim()]: { value: newValue, in: newIn, label: newName.trim() } });
    setNewName(''); setNewValue(''); setNewIn('body');
  };

  return (
    <div className="card mb-4 global-params-card">
      <h2 className="mb-2">⚙️ Global Parameters</h2>
      <p className="text-sm text-muted mb-4">
        Injected into matching fields across all endpoints — headers, path params, query params, and request body fields.
      </p>
      <div className="param-table mb-4">
        <div className="param-row" style={{ background: '#0d1117', fontWeight: 600, fontSize: 12, color: '#8b949e' }}>
          <span style={{ minWidth: 180 }}>Name / Label</span>
          <span style={{ minWidth: 70 }}>Location</span>
          <span className="flex-1">Value</span>
          <span style={{ width: 32 }} />
        </div>
        {Object.entries(globalParams).map(([name, cfg]) => {
          const val = typeof cfg === 'object' ? cfg.value : cfg;
          const paramIn = typeof cfg === 'object' ? cfg.in : 'body';
          const label = typeof cfg === 'object' ? cfg.label : name;
          return (
            <div key={name} className="param-row" style={{ alignItems: 'center' }}>
              <div style={{ minWidth: 180 }}>
                <div className="text-sm" style={{ fontWeight: 600 }}>{name}</div>
                {label !== name && <div className="text-sm text-muted">{label}</div>}
              </div>
              <select
                style={{ minWidth: 70, maxWidth: 80, padding: '4px 6px', fontSize: 12, background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 4 }}
                value={paramIn}
                onChange={e => update(name, { in: e.target.value })}
              >
                {LOCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                className="flex-1"
                placeholder={`Enter ${label || name}...`}
                value={val}
                onChange={e => update(name, { value: e.target.value })}
              />
              <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12, minWidth: 32 }} onClick={() => remove(name)}>✕</button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2" style={{ alignItems: 'center' }}>
        <input style={{ maxWidth: 160 }} placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} />
        <select
          style={{ maxWidth: 90, padding: '8px 6px', fontSize: 13, background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 6 }}
          value={newIn}
          onChange={e => setNewIn(e.target.value)}
        >
          {LOCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <input className="flex-1" placeholder="Value" value={newValue} onChange={e => setNewValue(e.target.value)} />
        <button className="btn-primary" disabled={!newName.trim()} onClick={add}>Add</button>
      </div>
    </div>
  );
}
