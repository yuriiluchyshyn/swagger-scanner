export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Email');
    return res.status(200).end();
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Email');
  
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    mongoUri: process.env.MONGODB_URI ? 'configured' : 'missing',
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-user-email': req.headers['x-user-email']
    }
  });
}