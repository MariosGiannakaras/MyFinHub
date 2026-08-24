import { describe, expect, it } from 'vitest';
import { canAdvanceReportingMonth, localMonthKey, shiftReportingMonth } from '../src/lib/reportingPeriod.js';

describe('reporting period boundaries',()=>{
  it('uses the local calendar month rather than UTC month',()=>{
    expect(localMonthKey(new Date(2026,7,24,23,55))).toBe('2026-08');
    expect(localMonthKey(new Date(2027,0,1,0,5))).toBe('2027-01');
  });

  it('shifts safely across year boundaries',()=>{
    expect(shiftReportingMonth('2026-12',1)).toBe('2027-01');
    expect(shiftReportingMonth('2027-01',-1)).toBe('2026-12');
    expect(shiftReportingMonth('2026-08',-7)).toBe('2026-01');
  });

  it('allows returning from historical months but never advancing beyond the current reporting month',()=>{
    expect(canAdvanceReportingMonth('2026-07','2026-08')).toBe(true);
    expect(canAdvanceReportingMonth('2026-08','2026-08')).toBe(false);
    expect(canAdvanceReportingMonth('2026-09','2026-08')).toBe(false);
  });

  it('fails closed for malformed month keys',()=>{
    expect(canAdvanceReportingMonth('2026-13','2026-08')).toBe(false);
    expect(canAdvanceReportingMonth('August 2026','2026-08')).toBe(false);
    expect(()=>shiftReportingMonth('2026-13',1)).toThrow('Invalid reporting month');
  });
});
