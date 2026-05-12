import { useState } from 'react';

export default function ExecutionModeToggle({ onModeChange }) {
  const [mode, setMode] = useState('browser'); // 'browser' or 'server'
  
  const handleModeChange = (newMode) => {
    setMode(newMode);
    onModeChange(newMode);
  };
  
  return (
    <div style={{ 
      padding: '8px', 
      backgroundColor: '#2a2a2a', 
      borderRadius: '4px', 
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}>
      <span style={{ color: '#ccc', fontSize: '12px' }}>Execution Mode:</span>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
        <input
          type="radio"
          name="executionMode"
          value="browser"
          checked={mode === 'browser'}
          onChange={() => handleModeChange('browser')}
        />
        <span style={{ color: '#4CAF50', fontSize: '12px' }}>
          Browser (like Postman Web)
        </span>
      </label>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
        <input
          type="radio"
          name="executionMode"
          value="server"
          checked={mode === 'server'}
          onChange={() => handleModeChange('server')}
        />
        <span style={{ color: '#2196F3', fontSize: '12px' }}>
          Server Proxy
        </span>
      </label>
      
      <div style={{ fontSize: '11px', color: '#888', marginLeft: '10px' }}>
        {mode === 'browser' 
          ? '✓ Uses your network (VPN, auth cookies)' 
          : '⚠ Uses Vercel servers (may be blocked)'
        }
      </div>
    </div>
  );
}