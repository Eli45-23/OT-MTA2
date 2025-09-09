import { eq, and, sql } from 'drizzle-orm';
import { db } from '../connection.js';
import { assignments, employees, overtimeEntries } from '../schema.js';
import { mapAssignmentRow } from '../mappers.js';
import { getPeriodBoundaries } from '../../lib/period.js';
import type { Assignment, EmployeeSummary, Candidate } from '../../../contracts/schemas.js';

export async function createAssignment(data: Omit<Assignment, 'id' | 'created_at'>): Promise<Assignment> {
  const result = await db.insert(assignments).values({
    ...data,
    hours_charged: data.hours_charged.toString(),
    decided_at: data.decided_at ? new Date(data.decided_at) : null
  }).returning();
  return mapAssignmentRow(result[0]);
}

export async function getAssignmentsByPeriod(period: string): Promise<Assignment[]> {
  const rows = await db.select().from(assignments).where(eq(assignments.period_week, period));
  return rows.map(mapAssignmentRow);
}

export async function getAssignmentByEmployeePeriod(employeeId: string, period: string): Promise<Assignment | null> {
  const result = await db.select().from(assignments)
    .where(and(eq(assignments.employee_id, employeeId), eq(assignments.period_week, period)));
  return result[0] ? mapAssignmentRow(result[0]) : null;
}

export async function getOvertimeSummaryByPeriod(period: string, tx?: any): Promise<EmployeeSummary[]> {
  const { start, end } = getPeriodBoundaries(period);
  const dbConnection = tx || db;
  const result = await dbConnection.select({
    employee_id: employees.id,
    name: employees.name,
    badge: employees.badge,
    overtime_hours: sql<string>`COALESCE(SUM(${overtimeEntries.hours}), 0)`,
    assignment_hours: sql<string>`COALESCE(SUM(${assignments.hours_charged}), 0)`,
    last_assigned_at: sql<Date | null>`MAX(${assignments.created_at})`
  }).from(employees)
  .leftJoin(overtimeEntries, and(
    eq(overtimeEntries.employee_id, employees.id),
    sql`${overtimeEntries.occurred_at} >= ${start} AND ${overtimeEntries.occurred_at} <= ${end}`
  ))
  .leftJoin(assignments, and(
    eq(assignments.employee_id, employees.id),
    eq(assignments.period_week, period)
  ))
  .where(eq(employees.active, true))
  .groupBy(employees.id, employees.name, employees.badge);

  return result.map((row: any) => ({
    employee_id: row.employee_id,
    name: row.name,
    badge: row.badge,
    total_hours: Number(row.overtime_hours) + Number(row.assignment_hours),
    last_assigned_at: row.last_assigned_at?.toISOString() || null
  }));
}

export async function getCandidatesByPeriod(period: string, tx?: any): Promise<Candidate[]> {
  const summaries = await getOvertimeSummaryByPeriod(period, tx);
  return summaries.map(summary => ({
    ...summary,
    tie_break_rank: 0
  }));
}