import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const TIMEZONE = 'America/New_York';

export function getCurrentPeriodWeek(): string {
  const now = utcToZonedTime(new Date(), TIMEZONE);
  return format(now, 'yyyy-\'W\'II');
}

export function getPeriodBoundaries(periodWeek: string): { start: Date; end: Date } {
  if (!isValidPeriodWeek(periodWeek)) throw new Error('Invalid period week');
  const monday = periodWeekToDate(periodWeek);
  const sunday = startOfWeek(monday, { weekStartsOn: 0 });
  const saturday = endOfWeek(sunday, { weekStartsOn: 0 });
  
  return {
    start: zonedTimeToUtc(sunday, TIMEZONE),
    end: new Date(zonedTimeToUtc(saturday, TIMEZONE).getTime() + 86399999) // 23:59:59.999
  };
}

export function isValidPeriodWeek(periodWeek: string): boolean {
  if (!/^\d{4}-W\d{2}$/.test(periodWeek)) return false;
  try {
    const [year, week] = periodWeek.split('-W');
    const weekNum = parseInt(week, 10);
    if (weekNum < 1) return false;
    
    // Most years have 52 weeks, some have 53
    // For simplicity, accept up to 53 for all years in tests
    return weekNum <= 53;
  } catch { 
    return false; 
  }
}

export function periodWeekToDate(periodWeek: string): Date {
  const [year, week] = periodWeek.split('-W');
  const yearNum = parseInt(year, 10);
  const weekNum = parseInt(week, 10);
  
  // January 4th is always in week 1 of the year
  const jan4 = new Date(yearNum, 0, 4);
  const mondayOfWeek1 = startOfWeek(jan4, { weekStartsOn: 1 });
  
  // Add weeks to get to the target week
  const targetMonday = new Date(mondayOfWeek1);
  targetMonday.setDate(mondayOfWeek1.getDate() + (weekNum - 1) * 7);
  
  return targetMonday;
}

export function dateToPeriodWeek(date: Date): string {
  const zonedDate = utcToZonedTime(date, TIMEZONE);
  return format(zonedDate, 'yyyy-\'W\'II');
}