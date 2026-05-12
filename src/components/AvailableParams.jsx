import { useState } from 'react';

export default function AvailableParams({ availableParams, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredParams = Object.entries(availableParams).filter(([key, value]) =>
    key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(value).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyToClipboard = (key, value) => {
    navigator.clipboard.writeText(String(value)).then(() => {
      // Could add a toast notification here
    });
  };

  return (
    <div className="card mb-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>📋 Available Parameters ({Object.keys(availableParams).length})</h3>
        <button className="btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: '4px 8px' }}>
          ✕ Close
        </button>
      </div>
      
      <p style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
        These parameters from portal_profile are available for auto-population in endpoints:
      </p>

      <input
        type="text"
        className="input"
        placeholder="Search parameters..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginBottom: 12, fontSize: 13 }}
      />

      <div style={{ 
        maxHeight: 300, 
        overflowY: 'auto', 
        border: '1px solid var(--border)', 
        borderRadius: 6, 
        background: 'var(--bg-secondary)' 
      }}>
        {filteredParams.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>
            {searchTerm ? 'No parameters match your search' : 'No parameters available'}
          </div>
        ) : (
          filteredParams.map(([key, value]) => (
            <div 
              key={key}
              style={{ 
                padding: '8px 12px', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)',
                  marginBottom: 2
                }}>
                  {key}
                </div>
                <div style={{ 
                  color: 'var(--text-secondary)', 
                  wordBreak: 'break-all',
                  fontSize: 12
                }}>
                  {String(value).length > 60 ? `${String(value).substring(0, 60)}...` : String(value)}
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={() => copyToClipboard(key, value)}
                style={{ 
                  fontSize: 11, 
                  padding: '2px 6px', 
                  marginLeft: 8,
                  flexShrink: 0
                }}
                title="Copy value"
              >
                📋
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ 
        marginTop: 12, 
        padding: 8, 
        background: 'var(--bg-info)', 
        borderRadius: 4, 
        fontSize: 12,
        color: 'var(--text-secondary)'
      }}>
        💡 These parameters will be automatically suggested when you use endpoints that need them
      </div>
    </div>
  );
}