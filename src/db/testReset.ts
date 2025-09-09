import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Deadlock retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 100;

// Utility function to sleep for a given number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Improved database reset with transaction isolation and deadlock retry
export async function resetDb(db: PostgresJsDatabase<any>, maxRetries: number = MAX_RETRIES): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wrap entire reset operation in a single transaction for atomicity
      await db.transaction(async (tx) => {
        // Set session to allow truncation without foreign key constraints
        await tx.execute(sql`SET session_replication_role = replica`);
        
        // Truncate all tables in single atomic operation
        // Use a single statement to avoid timing issues
        await tx.execute(sql`
          TRUNCATE TABLE assignments, overtime_entries, employees, config 
          RESTART IDENTITY CASCADE
        `);
        
        // Reset config table to default state (single row with id=1)
        await tx.execute(sql`
          INSERT INTO config (id, default_refusal_hours) 
          VALUES (1, 8) 
          ON CONFLICT (id) DO UPDATE SET default_refusal_hours = 8
        `);
        
        // Reset session back to default
        await tx.execute(sql`SET session_replication_role = DEFAULT`);
      });
      
      // If we got here, the reset was successful
      return;
      
    } catch (error: any) {
      lastError = error;
      
      // Check if this is a deadlock or serialization failure
      const isRetryableError = 
        error.code === '40P01' || // deadlock_detected
        error.code === '40001' || // serialization_failure  
        error.code === '55P03' || // lock_not_available
        error.message?.includes('deadlock') ||
        error.message?.includes('serialization');
      
      if (!isRetryableError || attempt === maxRetries) {
        // Either not retryable or we've exhausted retries
        throw error;
      }
      
      // Log retry attempt for debugging
      console.warn(`Database reset attempt ${attempt} failed with retryable error (${error.code}), retrying in ${RETRY_DELAY_MS * attempt}ms...`);
      
      // Wait before retrying, with exponential backoff
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  
  // This shouldn't be reached, but just in case
  throw lastError || new Error('Database reset failed after all retries');
}