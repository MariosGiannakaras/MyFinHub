import { describe, expect, it } from 'vitest';
import { localDateString, millisecondsUntilNextLocalDay, reportingMonthForDate } from '../src/hooks/useLocalDate.js';

describe('reactive local finance date', () => {
  it('formats the local calendar date without relying on locale output', () => {
    expect(localDateString(new Date(2026, 7, 17, 23, 59, 30))).toBe('2026-08-17');
    expect(localDateString(new Date(2027, 0, 2, 0, 0, 1))).toBe('2027-01-02');
  });

  it('schedules the next refresh immediately after local midnight', () => {
    const remaining = millisecondsUntilNextLocalDay(new Date(2026, 7, 17, 23, 59, 30, 0));
    expect(remaining).toBe(30_025);
  });

  it('advances the reporting month only while it remains automatic', () => {
    expect(reportingMonthForDate('2026-08', '2026-09-01', false)).toBe('2026-09');
    expect(reportingMonthForDate('2026-07', '2026-09-01', true)).toBe('2026-07');
  });
});
