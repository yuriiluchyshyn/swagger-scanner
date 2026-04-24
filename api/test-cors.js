import { json } from './_db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return json(res, { message: 'CORS preflight successful' });
  }
  
  return json(res, { 
    message: 'CORS test successful',
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
}