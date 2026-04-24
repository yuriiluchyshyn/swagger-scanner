// Combines: health, ping, network-test
// Route via query param: /api/debug?action=health|ping|network-test

export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Email'
  };
  
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(200).end();
  }
  
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  
  const { searchParams } = new URL(req.url, 'http://localhost');
  const action = searchParams.get('action') || 'health';
  
  try {
    // --- PING ---
    if (action === 'ping') {
      return res.status(200).json({ 
        message: 'pong',
        timestamp: new Date().toISOString()
      });
    }
    
    // --- HEALTH ---
    if (action === 'health') {
      return res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        mongoUri: process.env.MONGODB_URI ? 'configured' : 'missing',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        headers: {
          'user-agent': req.headers['user-agent'],
          'x-user-email': req.headers['x-user-email']
        }
      });
    }
    
    // --- NETWORK-TEST ---
    if (action === 'network-test') {
      const testUrls = [
        'https://httpbin.org/get',
        'https://jsonplaceholder.typicode.com/posts/1',
        'https://ocs.billing.usw2.dev.ccsi.la',
        'https://ocs.billing.usw2.dev.ccsi.la/billing-orders/offers'
      ];
      
      const results = [];
      
      for (const url of testUrls) {
        console.log(`Testing connectivity to: ${url}`);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const start = Date.now();
          const resp = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Vercel-Function-Test' },
            signal: controller.signal
          });
          const duration = Date.now() - start;
          clearTimeout(timeoutId);
          
          results.push({
            url,
            success: true,
            status: resp.status,
            statusText: resp.statusText,
            duration: `${duration}ms`,
            headers: Object.fromEntries(resp.headers.entries())
          });
          
          console.log(`✓ ${url} - ${resp.status} (${duration}ms)`);
        } catch (error) {
          clearTimeout(timeoutId);
          results.push({
            url,
            success: false,
            error: error.message,
            errorType: error.name,
            errorCode: error.code
          });
          
          console.log(`✗ ${url} - ${error.message}`);
        }
      }
      
      return res.status(200).json({
        timestamp: new Date().toISOString(),
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        results
      });
    }
    
    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('Debug API error:', error);
    return res.status(500).json({ error: error.message });
  }
}