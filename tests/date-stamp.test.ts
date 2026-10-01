import { describe, expect, it } from 'vitest';
import { isValidDateOnly, isValidDateStamp, isValidIsoTimestamp } from '../src/lib/dateOnly.js';

describe('persisted date and timestamp contracts',()=>{
  it.each([
    '2026-10-01T00:00:00Z',
    '2026-10-01T00:00:00.000Z',
    '2026-10-01T22:15:59.123456789+03:00',
    '2028-02-29T12:30:00-05:30',
  ])('accepts RFC3339 timestamp %s',(value)=>{
    expect(isValidIsoTimestamp(value)).toBe(true);
    expect(isValidDateStamp(value)).toBe(true);
  });

  it.each([
    '2026-02-30T00:00:00Z',
    '2027-02-29T00:00:00Z',
    '2026-10-01T24:00:00Z',
    '2026-10-01T23:60:00Z',
    '2026-10-01T23:59:60Z',
    '2026-10-01T00:00:00',
    '2026-10-01 00:00:00Z',
    'garbage',
  ])('rejects invalid timestamp %s',(value)=>{
    expect(isValidIsoTimestamp(value)).toBe(false);
  });

  it('preserves legacy valid date-only audit stamps without treating malformed dates as valid',()=>{
    expect(isValidDateOnly('2026-07-01')).toBe(true);
    expect(isValidDateStamp('2026-07-01')).toBe(true);
    expect(isValidDateStamp('2026-02-31')).toBe(false);
  });
});
