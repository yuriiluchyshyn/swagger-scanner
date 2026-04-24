import { MongoClient } from 'mongodb';

let client = null;
let db = null;

export async function getDb() {
  console.log('getDb() called');
  if (db) {
    console.log('Returning existing DB connection');
    return db;
  }
  
  const mongoUri = process.env.MONGODB_URI;
  console.log('MongoDB URI status:', mongoUri ? 'present' : 'missing');
  
  if (!mongoUri) {
    console.error('MONGODB_URI environment variable is not set');
    throw new Error('MONGODB_URI environment variable is not set. Please configure it in Vercel dashboard.');
  }
  
  try {
    console.log('Creating new MongoDB client...');
    client = new MongoClient(mongoUri);
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('MongoDB connection established');
    db = client.db();
    console.log('Database instance created successfully');
    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Full error:', error);
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
