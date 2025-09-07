// Integration test setup
import { beforeAll, afterAll, beforeEach } from '@jest/globals';

// Test database connection string
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 
  'postgres://overtime_test:overtime_test_pass@localhost:5433/overtime_tracker_test';

// Setup test database
beforeAll(async () => {
  // TODO: Initialize test database connection
  process.env.DATABASE_URL = TEST_DATABASE_URL;
});

// Cleanup after tests
afterAll(async () => {
  // TODO: Close database connections
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