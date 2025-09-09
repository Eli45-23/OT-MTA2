import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import { config } from '../config.js';

const connectionString = config.isTest() 
  ? (process.env.TEST_DATABASE_URL || config.database.testUrl)
  : (process.env.DATABASE_URL || config.database.url);

// Connection pool configuration optimized for test environment
const connectionOptions = config.isTest() 
  ? {
      // Test environment: very conservative pool settings for maximum stability
      max: 3,                    // Smaller pool to prevent connection exhaustion
      idle_timeout: 2,           // Short idle timeout to free connections quickly
      connect_timeout: 5,        // Fast connection timeout to fail quickly
      prepare: false,            // Disable prepared statements for better isolation
      connection: {
        application_name: 'overtime-tracker-test'
      },
      types: {
        // Disable some parsing for better performance
        bigint: {
          to: 20,
          from: [20],
          parse: (x: string) => parseInt(x),
          serialize: (x: any) => x.toString()
        }
      },
      transform: {
        undefined: null
      },
      // Add connection validation and better error handling
      onnotice: () => {}, // Suppress notices in tests
      debug: false        // Disable debug logging in tests
    }
  : {
      // Production environment: larger pool, standard timeouts
      max: 20,
      idle_timeout: 30,
      connect_timeout: 30,
      prepare: true,
      transform: {
        undefined: null
      }
    };

// Create postgres client with proper pool configuration
const client = postgres(connectionString, connectionOptions);

// Create drizzle database instance
export const db = drizzle(client, { schema });

// Export client for manual queries if needed
export { client };