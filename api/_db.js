import { MongoClient } from 'mongodb';

let client = null;
let db = null;

export async function getDb() {
  if (db) return db;
  
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set. Please configure it in Vercel dashboard.');
  }
  
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db();
    console.log('Connected to MongoDB successfully');
    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Email, Authorization, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
}

export function json(res, data, status = 200) {
  cors(res);
  res.status(status).json(data);
}

export function getEmail(req) {
  return (req.headers['x-user-email'] || '').trim().toLowerCase();
}
