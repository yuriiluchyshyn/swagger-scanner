export default function SourceIndicator({ source, type = 'request' }) {
  if (!source) return null;
  
  const isBrowser = source === 'browser-direct';
  const label = type === 'spec' ? 'Spec fetch' : 'API request';
  
  return (
    <div style={{ 
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px',
      borderRadius: '3px',
      fontSize: '10px',
      fontWeight: '500',
      backgroundColor: isBrowser ? '#1a4d1a' : '#1a3d5c',
      color: isBrowser ? '#4CAF50' : '#2196F3',
      border: `1px solid ${isBrowser ? '#4CAF50' : '#2196F3'}`,
      marginLeft: '8px'
    }}>
      <span style={{ 
        width: '6px', 
        height: '6px', 
        borderRadius: '50%', 
        backgroundColor: isBrowser ? '#4CAF50' : '#2196F3' 
      }} />
      {label}: {isBrowser ? 'Browser' : 'Server'}
    </div>
  );
}