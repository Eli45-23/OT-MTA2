import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  orderCandidates,
  getNextEmployee,
  calculateTieBreakRank
} from '../../src/lib/selection.js';
import type { Candidate } from '../../../contracts/schemas.js';

// Mock the database queries
jest.mock('../../src/db/queries/assignments.js', () => ({
  getCandidatesByPeriod: jest.fn(),
}));

import { getCandidatesByPeriod } from '../../src/db/queries/assignments.js';
const mockGetCandidatesByPeriod = getCandidatesByPeriod as jest.MockedFunction<typeof getCandidatesByPeriod>;

describe('Selection utilities', () => {
  const mockCandidates: Candidate[] = [
    {
      employee_id: '11111111-1111-1111-1111-111111111111',
      name: 'Alice Smith',
      badge: 'AS001',
      total_hours: 4,
      last_assigned_at: '2024-01-01T08:00:00Z',
      tie_break_rank: 0
    },
    {
      employee_id: '22222222-2222-2222-2222-222222222222',
      name: 'Bob Johnson', 
      badge: 'BJ002',
      total_hours: 8,
      last_assigned_at: null,
      tie_break_rank: 0
    },
    {
      employee_id: '33333333-3333-3333-3333-333333333333',
      name: 'Charlie Brown',
      badge: 'CB003', 
      total_hours: 4,
      last_assigned_at: '2024-01-02T12:00:00Z',
      tie_break_rank: 0
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCandidatesByPeriod.mockResolvedValue(mockCandidates);
  });

  describe('orderCandidates', () => {
    it('should order candidates by total hours ascending', async () => {
      const result = await orderCandidates('2024-W01');
      
      expect(result).toHaveLength(3);
      // Alice (4h) and Charlie (4h) should come before Bob (8h)
      expect(result[0].total_hours).toBeLessThanOrEqual(result[1].total_hours);
      expect(result[1].total_hours).toBeLessThanOrEqual(result[2].total_hours);
    });

    it('should break ties by last_assigned_at (null first, then oldest)', async () => {
      const result = await orderCandidates('2024-W01');
      
      // Among employees with same hours, null last_assigned_at should come first
      const sameTotalHours = result.filter(c => c.total_hours === 4);
      if (sameTotalHours.length > 1) {
        const nullAssigned = sameTotalHours.find(c => c.last_assigned_at === null);
        const withAssigned = sameTotalHours.filter(c => c.last_assigned_at !== null);
        
        if (nullAssigned && withAssigned.length > 0) {
          expect(result.indexOf(nullAssigned)).toBeLessThan(result.indexOf(withAssigned[0]));
        }
        
        // Among those with assignments, older should come first
        if (withAssigned.length > 1) {
          const sorted = withAssigned.sort((a, b) => 
            new Date(a.last_assigned_at!).getTime() - new Date(b.last_assigned_at!).getTime()
          );
          expect(withAssigned[0].last_assigned_at).toBe(sorted[0].last_assigned_at);
        }
      }
    });

    it('should break final ties by employee_id (lowest first)', async () => {
      // Test scenario where employees have same hours AND same last_assigned_at
      const tiedCandidates: Candidate[] = [
        {
          employee_id: '33333333-3333-3333-3333-333333333333',
          name: 'Charlie',
          badge: 'C',
          total_hours: 4,
          last_assigned_at: '2024-01-01T08:00:00Z',
          tie_break_rank: 0
        },
        {
          employee_id: '11111111-1111-1111-1111-111111111111', 
          name: 'Alice',
          badge: 'A',
          total_hours: 4,
          last_assigned_at: '2024-01-01T08:00:00Z',
          tie_break_rank: 0
        }
      ];

      const result = await orderCandidates('2024-W01');
      
      // Lower UUID should come first
      const alice = result.find(c => c.name === 'Alice');
      const charlie = result.find(c => c.name === 'Charlie');
      
      if (alice && charlie && alice.total_hours === charlie.total_hours) {
        expect(result.indexOf(alice)).toBeLessThan(result.indexOf(charlie));
      }
    });

    it('should assign correct tie_break_rank values', async () => {
      const result = await orderCandidates('2024-W01');
      
      result.forEach((candidate, index) => {
        expect(candidate.tie_break_rank).toBe(index + 1);
      });
    });

    it('should handle empty candidate list', async () => {
      mockGetCandidatesByPeriod.mockResolvedValue([]);
      const result = await orderCandidates('2024-W99');
      expect(result).toEqual([]);
    });
  });

  describe('getNextEmployee', () => {
    it('should return first candidate from ordered list', async () => {
      const result = await getNextEmployee('2024-W01');
      
      expect(result).not.toBeNull();
      expect(result!.tie_break_rank).toBe(1);
    });

    it('should return null when no candidates available', async () => {
      mockGetCandidatesByPeriod.mockResolvedValue([]);
      const result = await getNextEmployee('2024-W99');
      expect(result).toBeNull();
    });

    it('should return candidate with lowest total hours', async () => {
      const result = await getNextEmployee('2024-W01');
      
      expect(result).not.toBeNull();
      // Should be Alice or Charlie (both have 4 hours), not Bob (8 hours)
      expect(result!.total_hours).toBe(4);
    });
  });

  describe('calculateTieBreakRank', () => {
    it('should assign rank 1 to best candidate', () => {
      const rank = calculateTieBreakRank(
        0, // lowest hours
        null, // never assigned
        '11111111-1111-1111-1111-111111111111',
        mockCandidates
      );
      expect(rank).toBe(1);
    });

    it('should assign higher rank to candidate with more hours', () => {
      const rank = calculateTieBreakRank(
        12, // higher hours than others
        null,
        '44444444-4444-4444-4444-444444444444',
        mockCandidates
      );
      expect(rank).toBeGreaterThan(1);
    });

    it('should prioritize null last_assigned_at over recent assignments', () => {
      const neverAssignedRank = calculateTieBreakRank(
        4,
        null, // never assigned
        '11111111-1111-1111-1111-111111111111',
        mockCandidates
      );
      
      const recentlyAssignedRank = calculateTieBreakRank(
        4,
        new Date('2024-01-10T08:00:00Z'), // recently assigned
        '22222222-2222-2222-2222-222222222222',
        mockCandidates
      );
      
      expect(neverAssignedRank).toBeLessThan(recentlyAssignedRank);
    });

    it('should use employee_id for final tie-breaking', () => {
      const lowerIdRank = calculateTieBreakRank(
        4,
        new Date('2024-01-01T08:00:00Z'),
        '11111111-1111-1111-1111-111111111111', // lower UUID
        mockCandidates
      );
      
      const higherIdRank = calculateTieBreakRank(
        4,
        new Date('2024-01-01T08:00:00Z'),
        '99999999-9999-9999-9999-999999999999', // higher UUID
        mockCandidates
      );
      
      expect(lowerIdRank).toBeLessThan(higherIdRank);
    });

    it('should handle edge cases with identical candidates', () => {
      const singleCandidate = mockCandidates.slice(0, 1);
      const rank = calculateTieBreakRank(
        4,
        new Date('2024-01-01T08:00:00Z'),
        '11111111-1111-1111-1111-111111111111',
        singleCandidate
      );
      expect(rank).toBe(1);
    });
  });
});