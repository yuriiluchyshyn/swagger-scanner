export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Email');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.status(200).json({ 
    message: 'pong',
    timestamp: new Date().toISOString()
  });
}