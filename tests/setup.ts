// Global test setup
import 'dotenv/config';
import { beforeEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console.log to reduce test noise
if (process.env.TEST_QUIET) {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
}

// Add database reset for integration and e2e tests
beforeEach(async () => {
  // Only run for integration/e2e tests, not unit tests
  if (process.env.NODE_ENV === 'test' && (expect.getState().testPath?.includes('/integration/') || expect.getState().testPath?.includes('/e2e/'))) {
    try {
      const { db } = await import('../src/db/connection.js');
      const { resetDb } = await import('../src/db/testReset.js');
      await resetDb(db);
    } catch (error) {
      // Silently ignore if database is not available
    }
  }
});