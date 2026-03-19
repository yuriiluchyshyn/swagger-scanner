import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return null; }
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/swagger-scanner';
  const email = process.env.USER_EMAIL;
  if (!email) { console.error('ERROR: Set USER_EMAIL env var (e.g. USER_EMAIL=you@example.com)'); process.exit(1); }

  console.log(`Connecting to: ${uri.replace(/\/\/[^@]+@/, '//***@')}`);
  console.log(`Migrating data for: ${email}`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log('Migrating KV data...');
  const kv = db.collection('kv');
  const kvFiles = {
    'urls': path.join(DATA_DIR, 'swagger-urls.json'),
    'global-params': path.join(DATA_DIR, 'global-params.json'),
    'swagger-params': path.join(DATA_DIR, 'swagger-params.json'),
    'session': path.join(DATA_DIR, 'session.json'),
  };
  for (const [key, file] of Object.entries(kvFiles)) {
    const data = readJson(file);
    if (data !== null) {
      await kv.updateOne({ email, key }, { $set: { value: data } }, { upsert: true });
      console.log(`  ✓ ${key}`);
    }
  }

  console.log('Migrating scans...');
  const scansCol = db.collection('scans');
  const scans = readJson(path.join(DATA_DIR, 'scans.json'));
  if (Array.isArray(scans) && scans.length) {
    for (const scan of scans) {
      await scansCol.insertOne({ ...scan, email, createdAt: new Date(scan.timestamp || Date.now()) });
    }
    console.log(`  ✓ ${scans.length} scans`);
  }

  console.log('Migrating checkpoints...');
  const cpCol = db.collection('checkpoints');
  const checkpoints = readJson(path.join(DATA_DIR, 'checkpoints.json'));
  if (Array.isArray(checkpoints) && checkpoints.length) {
    for (const cp of checkpoints) {
      await cpCol.insertOne({ ...cp, email, createdAt: new Date(cp.timestamp || Date.now()) });
    }
    console.log(`  ✓ ${checkpoints.length} checkpoints`);
  }

  console.log('Migrating requests...');
  const reqCol = db.collection('requests');
  const reqData = readJson(path.join(DATA_DIR, 'requests.json'));
  const requests = reqData?.requests || (Array.isArray(reqData) ? reqData : []);
  if (requests.length) {
    for (const r of requests) {
      await reqCol.insertOne({ ...r, email });
    }
    console.log(`  ✓ ${requests.length} requests`);
  }

  console.log('Migrating diffs...');
  const diffsCol = db.collection('diffs');
  const diffsDir = path.join(DATA_DIR, 'diffs');
  if (fs.existsSync(diffsDir)) {
    const files = fs.readdirSync(diffsDir).filter(f => f.endsWith('.json')).sort();
    let count = 0;
    for (const f of files) {
      const data = readJson(path.join(diffsDir, f));
      if (data) {
        await diffsCol.insertOne({ ...data, email, createdAt: new Date(data.timestamp || Date.now()) });
        count++;
      }
    }
    console.log(`  ✓ ${count} diffs`);
  }

  console.log('\nMigration complete!');
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
