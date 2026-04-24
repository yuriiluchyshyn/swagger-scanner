import { json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  
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
  
  return json(res, {
    timestamp: new Date().toISOString(),
    vercelRegion: process.env.VERCEL_REGION || 'unknown',
    results
  });
}