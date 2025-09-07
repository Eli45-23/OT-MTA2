import type { Candidate } from '../../contracts/schemas.js';

export async function orderCandidates(period: string): Promise<Candidate[]> {
  throw new Error('Not implemented');
}

export async function getNextEmployee(period: string): Promise<Candidate | null> {
  throw new Error('Not implemented');
}

export function calculateTieBreakRank(
  totalHours: number,
  lastAssignedAt: Date | null,
  employeeId: string,
  allCandidates: Candidate[]
): number {
  throw new Error('Not implemented');
}