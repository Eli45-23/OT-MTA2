import 'dotenv/config';

export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgres://overtime_user:overtime_pass@localhost:5432/overtime_tracker',
    testUrl: process.env.TEST_DATABASE_URL || 'postgres://overtime_test:overtime_test_pass@localhost:5433/overtime_tracker_test',
  },
  
  // Server
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  // Application
  app: {
    defaultRefusalHours: parseFloat(process.env.DEFAULT_REFUSAL_HOURS || '8'),
    timezone: process.env.TIMEZONE || 'America/New_York',
  },
  
  // Helper functions
  isDevelopment: () => config.server.env === 'development',
  isProduction: () => config.server.env === 'production',
  isTest: () => config.server.env === 'test',
};