import type { Candidate } from '../../contracts/schemas.js';
import { getCandidatesByPeriod } from '../db/queries/assignments.js';

export async function orderCandidates(period: string, tx?: any): Promise<Candidate[]> {
  const candidates = await getCandidatesByPeriod(period, tx);
  return candidates.sort((a, b) => {
    if (a.total_hours !== b.total_hours) return a.total_hours - b.total_hours;
    if (a.last_assigned_at !== b.last_assigned_at) {
      if (!a.last_assigned_at) return -1;
      if (!b.last_assigned_at) return 1;
      return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime();
    }
    return a.employee_id.localeCompare(b.employee_id);
  }).map((candidate, index) => ({ ...candidate, tie_break_rank: index + 1 }));
}

export async function getNextEmployee(period: string): Promise<Candidate | null> {
  const candidates = await orderCandidates(period);
  return candidates[0] || null;
}

export function calculateTieBreakRank(
  totalHours: number,
  lastAssignedAt: Date | null,
  employeeId: string,
  allCandidates: Candidate[]
): number {
  const sorted = [...allCandidates, { 
    employee_id: employeeId, 
    total_hours: totalHours, 
    last_assigned_at: lastAssignedAt?.toISOString() || null,
    name: '', badge: '', tie_break_rank: 0
  }].sort((a, b) => {
    if (a.total_hours !== b.total_hours) return a.total_hours - b.total_hours;
    if (a.last_assigned_at !== b.last_assigned_at) {
      if (!a.last_assigned_at) return -1;
      if (!b.last_assigned_at) return 1;
      return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime();
    }
    return a.employee_id.localeCompare(b.employee_id);
  });
  return sorted.findIndex(c => c.employee_id === employeeId) + 1;
}