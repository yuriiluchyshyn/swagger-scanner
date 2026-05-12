import { useState } from 'react';

export default function CorsSettings({ corsSettings, onSave }) {
  const [newDomain, setNewDomain] = useState('');

  const addDomain = () => {
    if (!newDomain.trim()) return;
    const domain = newDomain.trim();
    onSave({
      ...corsSettings,
      blockedDomains: [...(corsSettings.blockedDomains || []), domain]
    });
    setNewDomain('');
  };

  const addQuickDomain = (domain) => {
    if (corsSettings.blockedDomains?.includes(domain)) return; // Already exists
    onSave({
      ...corsSettings,
      blockedDomains: [...(corsSettings.blockedDomains || []), domain]
    });
  };

  const removeDomain = (domain) => {
    onSave({
      ...corsSettings,
      blockedDomains: (corsSettings.blockedDomains || []).filter(d => d !== domain)
    });
  };

  const updateGlobalMode = (mode) => {
    onSave({
      ...corsSettings,
      globalMode: mode
    });
  };

  const blockedDomains = corsSettings.blockedDomains || [];
  const globalMode = corsSettings.globalMode || 'browser-first';

  return (
    <div className="card mb-4">
      <h2 className="mb-2">🌐 CORS Settings</h2>
      <p className="text-sm text-muted mb-4">
        Configure how to handle CORS issues when fetching Swagger specs and executing API requests.
      </p>

      {/* Global Mode */}
      <div className="mb-4">
        <h3 className="mb-2">Global Mode</h3>
        <div className="flex gap-2">
          <button
            className={`method-filter-btn ${globalMode === 'browser-first' ? 'active' : ''}`}
            onClick={() => updateGlobalMode('browser-first')}
          >
            🌐 Browser First
          </button>
          <button
            className={`method-filter-btn ${globalMode === 'server-only' ? 'active' : ''}`}
            onClick={() => updateGlobalMode('server-only')}
          >
            🖥️ Server Only
          </button>
        </div>
        <p className="text-sm text-muted mt-2">
          {globalMode === 'browser-first' 
            ? 'Try browser requests first, fallback to server proxy (like Postman Web)'
            : 'Always use server proxy for all requests (bypasses CORS completely)'
          }
        </p>
      </div>

      {/* Blocked Domains */}
      <div className="mb-4">
        <h3 className="mb-2">Blocked Domains</h3>
        <p className="text-sm text-muted mb-2">
          Domains that should always use server proxy due to CORS restrictions.
        </p>
        
        {blockedDomains.length > 0 && (
          <div className="param-table mb-3">
            {blockedDomains.map((domain, index) => (
              <div key={index} className="param-row" style={{ alignItems: 'center' }}>
                <span className="text-sm flex-1" style={{ fontFamily: 'monospace' }}>{domain}</span>
                <button 
                  className="btn-danger" 
                  style={{ padding: '4px 10px', fontSize: 12, minWidth: 32 }} 
                  onClick={() => removeDomain(domain)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <input 
            className="flex-1"
            placeholder="e.g., api.inventory.usw2.dev.ccsi.la" 
            value={newDomain} 
            onChange={e => setNewDomain(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && addDomain()}
          />
          <button 
            className="btn-primary" 
            disabled={!newDomain.trim()} 
            onClick={addDomain}
          >
            Add Domain
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-2">
        <h3 className="mb-2">Quick Actions</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
            onClick={() => addQuickDomain('*.usw2.dev.ccsi.la')}
            disabled={corsSettings.blockedDomains?.includes('*.usw2.dev.ccsi.la')}
          >
            + Block *.usw2.dev.ccsi.la
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
            onClick={() => addQuickDomain('api.inventory.usw2.dev.ccsi.la')}
            disabled={corsSettings.blockedDomains?.includes('api.inventory.usw2.dev.ccsi.la')}
          >
            + Block api.inventory
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
            onClick={() => onSave({ ...corsSettings, blockedDomains: [] })}
            disabled={!corsSettings.blockedDomains?.length}
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}