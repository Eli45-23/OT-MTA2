import type { Employee, OvertimeEntry, Assignment, EmployeeSummary, Candidate } from '../../contracts/schemas.js';

// DB row types (snake_case with Date objects and numeric strings)
interface EmployeeRow {
  id: string;
  name: string;
  badge: string;
  active: boolean;
  created_at: Date;
}

interface OvertimeEntryRow {
  id: string;
  employee_id: string;
  hours: string;
  occurred_at: Date;
  source: string;
  note: string | null;
  created_at: Date;
}

interface AssignmentRow {
  id: string;
  employee_id: string;
  period_week: string;
  hours_charged: string;
  status: string;
  decided_at: Date | null;
  tie_break_rank: number;
  created_at: Date;
}

// Row to domain mappers
export function mapEmployeeRow(row: EmployeeRow): Employee {
  if (!row || !row.id) {
    throw new Error('Invalid employee row: missing required fields');
  }
  return {
    id: row.id,
    name: row.name || '',
    badge: row.badge || '',
    active: row.active ?? true,
    created_at: row.created_at?.toISOString() || new Date().toISOString(),
  };
}

export function mapOvertimeEntryRow(row: OvertimeEntryRow): OvertimeEntry {
  return {
    id: row.id || '',
    employee_id: row.employee_id || '',
    hours: Number(row.hours || 0),
    occurred_at: row.occurred_at?.toISOString() || new Date().toISOString(),
    source: (row.source as 'manual' | 'import') || 'manual',
    note: row.note || undefined,
    created_at: row.created_at?.toISOString() || new Date().toISOString(),
  };
}

export function mapAssignmentRow(row: AssignmentRow): Assignment {
  if (!row || !row.id || !row.employee_id) {
    throw new Error('Invalid assignment row: missing required fields');
  }
  return {
    id: row.id,
    employee_id: row.employee_id,
    period_week: row.period_week || '',
    hours_charged: Number(row.hours_charged || 0),
    status: (row.status as 'assigned' | 'refused' | 'completed') || 'assigned',
    decided_at: row.decided_at?.toISOString() || null,
    tie_break_rank: row.tie_break_rank || 0,
    created_at: row.created_at?.toISOString() || new Date().toISOString(),
  };
}