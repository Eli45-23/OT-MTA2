#!/usr/bin/env tsx

import { db, client } from '../src/db/connection.js';
import { resetDb } from '../src/db/testReset.js';

async function resetTestDb() {
  try {
    console.log('Resetting test database...');
    await resetDb(db);
    console.log('Test database reset complete');
  } catch (error) {
    console.error('Error resetting test database:', error);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

resetTestDb();