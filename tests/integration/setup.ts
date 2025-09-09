// Integration test setup
import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import { resetTestDatabase } from '../utils/testHelpers.js';

// Setup test database connection
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Use TEST_DATABASE_URL if available
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
});

// Reset database before each test with proper sequencing
beforeEach(async () => {
  await resetTestDatabase();
});

// Cleanup after tests
afterAll(async () => {
  try {
    const { client } = await import('../../src/db/connection.js');
    await client.end();
  } catch (error) {
    // Ignore connection closing errors
  }
});