import { connectMongo } from './dist-electron/mongoSync-DVRWFvif.js';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'nursery-management-system', 'nursery.db');
const db = new DatabaseSync(dbPath);
const uriRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_mongo_uri'").get();
const mongoUri = uriRow?.value;
console.log('URI:', mongoUri ? 'found' : 'missing');
if (mongoUri) {
  try {
    await connectMongo(mongoUri);
    console.log('CONNECTED SUCCESS');
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}
