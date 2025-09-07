import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const TIMEZONE = 'America/New_York';

export function getCurrentPeriodWeek(): string {
  throw new Error('Not implemented');
}

export function getPeriodBoundaries(periodWeek: string): { start: Date; end: Date } {
  throw new Error('Not implemented');
}

export function isValidPeriodWeek(periodWeek: string): boolean {
  throw new Error('Not implemented');
}

export function periodWeekToDate(periodWeek: string): Date {
  throw new Error('Not implemented');
}

export function dateToPeriodWeek(date: Date): string {
  throw new Error('Not implemented');
}