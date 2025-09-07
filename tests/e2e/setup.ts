// E2E test setup
import { beforeAll, afterAll, beforeEach } from '@jest/globals';

let server: any;

// Start test server
beforeAll(async () => {
  // TODO: Start Express server for E2E tests
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 
    'postgres://overtime_test:overtime_test_pass@localhost:5433/overtime_tracker_test';
});

// Stop test server
afterAll(async () => {
  // TODO: Stop Express server
  if (server) {
    server.close();
  }
});

// Clean database before each test
beforeEach(async () => {
  const { db } = await import('../../src/db/connection.js');
  const { resetDb } = await import('../../src/db/testReset.js');
  try {
    await resetDb(db);
  } catch (error) {
    console.warn('Failed to reset database:', error);
  }
});