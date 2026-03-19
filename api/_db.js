import { MongoClient } from 'mongodb';

let client = null;
let db = null;

export async function getDb() {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'swagger-scanner');
  return db;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Email');
}

export function json(res, data, status = 200) {
  cors(res);
  res.status(status).json(data);
}

export function getEmail(req) {
  return (req.headers['x-user-email'] || '').trim().toLowerCase();
}
