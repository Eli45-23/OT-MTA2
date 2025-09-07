import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export async function resetDb(db: NodePgDatabase<any>) {
  await db.execute(sql`TRUNCATE TABLE assignments, overtime_entries, employees RESTART IDENTITY CASCADE`);
}