// Global test setup
import 'dotenv/config';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console.log to reduce test noise
if (process.env.TEST_QUIET) {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
}