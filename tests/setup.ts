// Global test setup
import 'dotenv/config';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console.log to reduce test noise
if (process.env.TEST_QUIET) {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
}

// Set up test database environment variables
if (process.env.NODE_ENV === 'test') {
  // Ensure TEST_DATABASE_URL is used for tests
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
}

// Generate unique test run identifier to avoid cross-test contamination
export const TEST_RUN_ID = Date.now().toString() + Math.random().toString(36).substr(2, 9);