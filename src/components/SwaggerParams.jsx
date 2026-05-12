import { useState } from 'react';

const LOCATION_OPTIONS = ['header', 'body', 'query', 'path'];

export default function SwaggerParams({ title, globalParams, swaggerParams, onSave }) {
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIn, setNewIn] = useState('body');

  const update = (name, patch) => {
    const existing = swaggerParams[name];
    const globalCfg = globalParams[name];
    const base = existing
      ? (typeof existing === 'object' ? existing : { in: 'body', label: name, value: existing })
      : { in: typeof globalCfg === 'object' ? globalCfg.in : 'body', label: name, value: '' };
    onSave({ ...swaggerParams, [name]: { ...base, ...patch } });
  };

  const remove = (name) => {
    const updated = { ...swaggerParams };
    delete updated[name];
    onSave(updated);
  };

  const add = () => {
    if (!newName.trim()) return;
    onSave({ ...swaggerParams, [newName.trim()]: { value: newValue, in: newIn, label: newName.trim() } });
    setNewName(''); setNewValue(''); setNewIn('body');
  };

  // Show all global params as overrideable rows, plus any swagger-only additions
  const allNames = [
    ...Object.keys(globalParams),
    ...Object.keys(swaggerParams).filter(k => !(k in globalParams)),
  ];

  return (
    <div style={{ background: '#0d1117', borderTop: '1px solid #1f6feb33', padding: '12px 16px' }}>
      <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
        <span className="text-sm" style={{ color: '#1f6feb', fontWeight: 600 }}>
          ⚙️ Swagger-level params for "{title}"
        </span>
        <span className="text-sm text-muted">— overrides global params for this API only</span>
      </div>

      <div className="param-table mb-3">
        <div className="param-row" style={{ background: '#0d1117', fontWeight: 600, fontSize: 11, color: '#8b949e' }}>
          <span style={{ minWidth: 160 }}>Name</span>
          <span style={{ minWidth: 70 }}>Location</span>
          <span className="flex-1">Override value <span style={{ fontWeight: 400 }}>(blank = use global)</span></span>
          <span style={{ width: 32 }} />
        </div>
        {allNames.map(name => {
          const globalCfg = globalParams[name];
          const swaggerCfg = swaggerParams[name];
          const globalVal = globalCfg ? (typeof globalCfg === 'object' ? globalCfg.value : globalCfg) : '';
          const overrideVal = swaggerCfg ? (typeof swaggerCfg === 'object' ? swaggerCfg.value : swaggerCfg) : '';
          const paramIn = swaggerCfg
            ? (typeof swaggerCfg === 'object' ? swaggerCfg.in : 'body')
            : (globalCfg ? (typeof globalCfg === 'object' ? globalCfg.in : 'body') : 'body');
          const isOverridden = !!swaggerCfg && overrideVal !== '';
          const isSwaggerOnly = !(name in globalParams);

          return (
            <div key={name} className="param-row" style={{ alignItems: 'center' }}>
              <div style={{ minWidth: 160 }}>
                <span className="text-sm" style={{ fontWeight: 600, color: isOverridden ? '#d29922' : '#c9d1d9' }}>{name}</span>
                {isSwaggerOnly && <span style={{ marginLeft: 6, fontSize: 10, color: '#3fb950' }}>swagger-only</span>}
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
                placeholder={globalVal ? `global: ${globalVal}` : `Enter value...`}
                value={overrideVal}
                style={{ borderColor: isOverridden ? '#d2992255' : undefined }}
                onChange={e => update(name, { value: e.target.value })}
              />
              {isOverridden || isSwaggerOnly
                ? <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12, minWidth: 32 }} onClick={() => remove(name)}>✕</button>
                : <span style={{ width: 32 }} />
              }
            </div>
          );
        })}
      </div>

      <div className="flex gap-2" style={{ alignItems: 'center' }}>
        <input style={{ maxWidth: 140 }} placeholder="New param name" value={newName} onChange={e => setNewName(e.target.value)} />
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
