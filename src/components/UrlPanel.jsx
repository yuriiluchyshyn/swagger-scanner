import { useRef } from 'react';

export default function UrlPanel({ urls, setUrls, loading, onSave, onScan, onUploadSpecs, onCheckpoint, onDiff, onExport, scanResult, checkpoint }) {
  const fileRef = useRef(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const readers = files.map(f => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve({ name: f.name, spec: JSON.parse(reader.result) }); }
        catch { reject(new Error(`${f.name} is not valid JSON`)); }
      };
      reader.onerror = reject;
      reader.readAsText(f);
    }));
    Promise.all(readers)
      .then(specs => onUploadSpecs(specs))
      .catch(err => alert(err.message));
    // Reset so the same file can be re-uploaded
    e.target.value = '';
  };

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
        <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={loading}>
          📁 Upload Swagger JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          multiple
          style={{ display: 'none' }}
          onChange={handleFiles}
        />
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
