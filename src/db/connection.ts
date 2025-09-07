import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import { config } from '../config.js';

const connectionString = config.isTest() 
  ? (process.env.TEST_DATABASE_URL || config.database.testUrl)
  : (process.env.DATABASE_URL || config.database.url);

// Create postgres client
const client = postgres(connectionString);

// Create drizzle database instance
export const db = drizzle(client, { schema });

// Export client for manual queries if needed
export { client };