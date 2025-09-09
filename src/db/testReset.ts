import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export async function resetDb(db: NodePgDatabase<any>) {
  // Disable foreign key checks, truncate all tables in reverse dependency order, re-enable
  await db.execute(sql`SET session_replication_role = replica`);
  
  // Truncate tables in correct order (children first, then parents)
  // assignments and overtime_entries reference employees, so they go first
  await db.execute(sql`TRUNCATE TABLE assignments RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE overtime_entries RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE employees RESTART IDENTITY CASCADE`);
  
  // Reset config table to default state (single row with id=1)
  await db.execute(sql`TRUNCATE TABLE config RESTART IDENTITY CASCADE`);
  await db.execute(sql`INSERT INTO config (id, default_refusal_hours) VALUES (1, 8) ON CONFLICT (id) DO UPDATE SET default_refusal_hours = 8`);
  
  await db.execute(sql`SET session_replication_role = DEFAULT`);
}