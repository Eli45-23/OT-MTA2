import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { 
  getCurrentPeriodWeek,
  getPeriodBoundaries,
  isValidPeriodWeek,
  periodWeekToDate,
  dateToPeriodWeek
} from '../../src/lib/period.js';

describe('Period utilities', () => {
  beforeAll(() => {
    // Mock current date for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T15:30:00.000Z')); // Monday, Week 3
  });

  describe('getCurrentPeriodWeek', () => {
    it('should return current week in YYYY-WW format for America/New_York timezone', () => {
      const result = getCurrentPeriodWeek();
      expect(result).toMatch(/^\d{4}-W\d{2}$/);
      // Should be 2024-W03 for January 15, 2024
      expect(result).toBe('2024-W03');
    });
  });

  describe('getPeriodBoundaries', () => {
    it('should return correct week boundaries for valid period', () => {
      const { start, end } = getPeriodBoundaries('2024-W01');
      
      // Week 1 2024: Sunday Dec 31, 2023 00:00 to Saturday Jan 6, 2024 23:59:59
      expect(start.toISOString()).toBe('2023-12-31T05:00:00.000Z'); // EST offset
      expect(end.getDay()).toBe(6); // Saturday
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });

    it('should handle week boundaries correctly across year boundary', () => {
      const { start, end } = getPeriodBoundaries('2024-W01');
      expect(start.getFullYear()).toBe(2023); // Starts in previous year
      expect(end.getFullYear()).toBe(2024); // Ends in current year
    });

    it('should handle mid-year weeks correctly', () => {
      const { start, end } = getPeriodBoundaries('2024-W26');
      expect(start.getDay()).toBe(0); // Sunday
      expect(end.getDay()).toBe(6); // Saturday
      
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(7);
    });
  });

  describe('isValidPeriodWeek', () => {
    it('should validate correct YYYY-WW format', () => {
      expect(isValidPeriodWeek('2024-W01')).toBe(true);
      expect(isValidPeriodWeek('2024-W52')).toBe(true);
      expect(isValidPeriodWeek('2023-W53')).toBe(true); // 2023 has 53 weeks
    });

    it('should reject invalid formats', () => {
      expect(isValidPeriodWeek('2024-W')).toBe(false);
      expect(isValidPeriodWeek('2024-W1')).toBe(false); // Should be W01
      expect(isValidPeriodWeek('24-W01')).toBe(false); // Year too short
      expect(isValidPeriodWeek('2024-01')).toBe(false); // Missing W
      expect(isValidPeriodWeek('2024-W00')).toBe(false); // Week 0 doesn't exist
      expect(isValidPeriodWeek('2024-W54')).toBe(false); // Week 54 doesn't exist
    });

    it('should validate week numbers within valid ranges', () => {
      expect(isValidPeriodWeek('2024-W53')).toBe(false); // 2024 has only 52 weeks
      expect(isValidPeriodWeek('2020-W53')).toBe(true); // 2020 has 53 weeks
    });
  });

  describe('periodWeekToDate', () => {
    it('should convert period week to Monday of that week', () => {
      const date = periodWeekToDate('2024-W01');
      expect(date.getDay()).toBe(1); // Monday
      expect(date.getMonth()).toBe(0); // January (0-indexed)
      expect(date.getDate()).toBe(1); // January 1st, 2024 was a Monday
    });

    it('should handle year boundaries correctly', () => {
      const date = periodWeekToDate('2024-W01');
      // 2024-W01 starts on Monday, Jan 1, 2024
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(1);
    });

    it('should throw error for invalid period week', () => {
      expect(() => periodWeekToDate('invalid')).toThrow();
      expect(() => periodWeekToDate('2024-W54')).toThrow();
    });
  });

  describe('dateToPeriodWeek', () => {
    it('should convert date to correct period week', () => {
      const date = new Date('2024-01-15'); // Monday of week 3
      const result = dateToPeriodWeek(date);
      expect(result).toBe('2024-W03');
    });

    it('should handle dates at week boundaries correctly', () => {
      // Sunday should be start of new week
      const sunday = new Date('2024-01-07'); // Sunday, should be W02
      expect(dateToPeriodWeek(sunday)).toBe('2024-W02');
      
      // Saturday should be end of current week  
      const saturday = new Date('2024-01-06'); // Saturday, should be W01
      expect(dateToPeriodWeek(saturday)).toBe('2024-W01');
    });

    it('should handle year boundary correctly', () => {
      const newYearsEve = new Date('2023-12-31'); // Sunday, should be 2024-W01
      expect(dateToPeriodWeek(newYearsEve)).toBe('2024-W01');
      
      const newYearsDay = new Date('2024-01-01'); // Monday, should be 2024-W01
      expect(dateToPeriodWeek(newYearsDay)).toBe('2024-W01');
    });

    it('should handle timezone conversion for America/New_York', () => {
      // Test edge case where UTC date might be different day
      const date = new Date('2024-01-07T04:00:00.000Z'); // Still Saturday in EST
      const result = dateToPeriodWeek(date);
      expect(result).toBe('2024-W01'); // Should be week 1, not 2
    });
  });
});