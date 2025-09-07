import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../connection.js';
import { overtimeEntries } from '../schema.js';
import { getPeriodBoundaries } from '../../lib/period.js';
import type { OvertimeEntry, CreateOvertimeEntry } from '../../../contracts/schemas.js';

export async function createOvertimeEntry(data: CreateOvertimeEntry): Promise<OvertimeEntry> {
  const result = await db.insert(overtimeEntries).values(data).returning();
  return result[0];
}

export async function getOvertimeEntriesByPeriod(period: string): Promise<OvertimeEntry[]> {
  const { start, end } = getPeriodBoundaries(period);
  return await db.select().from(overtimeEntries)
    .where(and(gte(overtimeEntries.occurred_at, start), lte(overtimeEntries.occurred_at, end)));
}

export async function getOvertimeEntriesByEmployee(employeeId: string, period?: string): Promise<OvertimeEntry[]> {
  if (period) {
    const { start, end } = getPeriodBoundaries(period);
    return await db.select().from(overtimeEntries)
      .where(and(
        eq(overtimeEntries.employee_id, employeeId),
        gte(overtimeEntries.occurred_at, start),
        lte(overtimeEntries.occurred_at, end)
      ));
  }
  return await db.select().from(overtimeEntries).where(eq(overtimeEntries.employee_id, employeeId));
}