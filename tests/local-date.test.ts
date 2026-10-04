import { describe, expect, it } from 'vitest';
import { localDateString, millisecondsUntilNextLocalDay, reportingMonthForDate } from '../src/lib/localDate.js';

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

  it('tracks Europe/Athens local dates and next-midnight timing across DST boundaries', () => {
    const original=process.env.TZ;
    try {
      process.env.TZ='Europe/Athens';
      expect(localDateString(new Date('2026-03-28T22:30:00.000Z'))).toBe('2026-03-29');
      expect(localDateString(new Date('2026-10-24T21:30:00.000Z'))).toBe('2026-10-25');

      const spring=new Date(2026,2,29,0,0,0,0);
      const autumn=new Date(2026,9,25,0,0,0,0);
      expect(millisecondsUntilNextLocalDay(spring)).toBe(23*60*60*1000+25);
      expect(millisecondsUntilNextLocalDay(autumn)).toBe(25*60*60*1000+25);
    } finally {
      if(original===undefined) delete process.env.TZ;
      else process.env.TZ=original;
    }
  });

});
