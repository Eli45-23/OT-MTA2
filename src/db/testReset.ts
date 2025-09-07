import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export async function resetDb(db: NodePgDatabase<any>) {
  // Disable foreign key checks, truncate tables, re-enable
  await db.execute(sql`SET session_replication_role = replica`);
  await db.execute(sql`TRUNCATE TABLE assignments, overtime_entries, employees RESTART IDENTITY CASCADE`);
  await db.execute(sql`SET session_replication_role = DEFAULT`);
}