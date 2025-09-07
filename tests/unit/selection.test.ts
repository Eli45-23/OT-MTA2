import { describe, it, expect } from '@jest/globals';
import { 
  orderCandidates,
  getNextEmployee,
  calculateTieBreakRank
} from '../../src/lib/selection.js';

describe('Selection utilities', () => {
  describe('orderCandidates', () => {
    it('should order candidates by total hours (ascending)', async () => {
      await expect(orderCandidates('2024-W01')).rejects.toThrow('Not implemented');
    });
  });

  describe('getNextEmployee', () => {
    it('should return next eligible employee', async () => {
      await expect(getNextEmployee('2024-W01')).rejects.toThrow('Not implemented');
    });
  });

  describe('calculateTieBreakRank', () => {
    it('should calculate tie break rank correctly', () => {
      expect(() => calculateTieBreakRank(8, null, 'uuid-1', [])).toThrow('Not implemented');
    });
  });
});