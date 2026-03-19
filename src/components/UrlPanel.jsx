export default function UrlPanel({ urls, setUrls, loading, onSave, onScan, onCheckpoint, onDiff, onExport, scanResult, checkpoint }) {
  return (
    <div className="card mb-4">
      <div className="flex gap-2 mb-2" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Swagger URLs</h2>
      </div>
      <textarea
        rows={4}
        placeholder={
          'Enter Swagger URLs, one per line.\n' +
          '• Swagger UI pages (e.g. https://api.example.com/docs/swagger-ui/index.html)\n' +
          '• Direct spec URLs (e.g. https://api.example.com/v3/api-docs)'
        }
        value={urls}
        onChange={e => setUrls(e.target.value)}
      />
      <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={onSave}>Save URLs</button>
        <button className="btn-primary" onClick={onScan} disabled={loading || !urls.trim()}>
          {loading ? <><span className="spinner" />Scanning...</> : 'Scan Endpoints'}
        </button>
        {scanResult && (
          <button className="btn-secondary" onClick={onCheckpoint}>💾 Save as Checkpoint</button>
        )}
        {scanResult && (
          <button className="btn-blue" onClick={onExport}>Convert to Postman Import File</button>
        )}
      </div>
    </div>
  );
}
