import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../connection.js';
import { overtimeEntries } from '../schema.js';
import { mapOvertimeEntryRow } from '../mappers.js';
import { getPeriodBoundaries } from '../../lib/period.js';
import type { OvertimeEntry, CreateOvertimeEntry } from '../../../contracts/schemas.js';

export async function createOvertimeEntry(data: CreateOvertimeEntry): Promise<OvertimeEntry> {
  const result = await db.insert(overtimeEntries).values({
    ...data,
    hours: data.hours.toString(),
    occurred_at: new Date(data.occurred_at)
  }).returning();
  return mapOvertimeEntryRow(result[0]);
}

export async function getOvertimeEntriesByPeriod(period: string): Promise<OvertimeEntry[]> {
  const { start, end } = getPeriodBoundaries(period);
  const rows = await db.select().from(overtimeEntries)
    .where(and(gte(overtimeEntries.occurred_at, start), lte(overtimeEntries.occurred_at, end)));
  return rows.map(mapOvertimeEntryRow);
}

export async function getOvertimeEntriesByEmployee(employeeId: string, period?: string): Promise<OvertimeEntry[]> {
  if (period) {
    const { start, end } = getPeriodBoundaries(period);
    const rows = await db.select().from(overtimeEntries)
      .where(and(
        eq(overtimeEntries.employee_id, employeeId),
        gte(overtimeEntries.occurred_at, start),
        lte(overtimeEntries.occurred_at, end)
      ));
    return rows.map(mapOvertimeEntryRow);
  }
  const rows = await db.select().from(overtimeEntries).where(eq(overtimeEntries.employee_id, employeeId));
  return rows.map(mapOvertimeEntryRow);
}