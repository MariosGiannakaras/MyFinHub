import { describe, expect, it } from 'vitest';
import { addCreditRate, creditRateAt, estimateCreditPayoff } from '../src/lib/creditRates.js';
import type { PaymentCard } from '../src/types.js';

const card:PaymentCard={id:'rate-card',bankId:'piraeus',nickname:'Test',kind:'credit',network:'visa',active:true,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};

describe('effective-dated credit interest (advisory, never posted)',()=>{
  it('keeps legacy rates unknown and appends non-retroactive versions',()=>{
    expect(creditRateAt(card,'2026-10-20')).toBeNull();
    const first=addCreditRate(card,15,'2026-10-20','2026-10-20');
    const second=addCreditRate(first,17.25,'2026-12-01','2026-10-20');
    expect(card.creditRateHistory).toBeUndefined();
    expect(creditRateAt(second,'2026-10-19')).toBeNull();
    expect(creditRateAt(second,'2026-11-30')?.annualPercent).toBe(15);
    expect(creditRateAt(second,'2026-12-01')?.annualPercent).toBe(17.25);
    const inserted=addCreditRate(second,16.75,'2026-11-01','2026-10-20');
    expect(inserted.creditRateHistory?.map(version=>version.effectiveFrom)).toEqual(['2026-10-20','2026-11-01','2026-12-01']);
    expect(creditRateAt(inserted,'2026-11-15')?.annualPercent).toBe(16.75);
    expect(creditRateAt(inserted,'2026-12-01')?.annualPercent).toBe(17.25);
    expect(creditRateAt(second,'2026-11-15')?.annualPercent).toBe(15);
    expect(()=>addCreditRate(inserted,18,'2026-11-01','2026-10-20')).toThrow();
    expect(()=>addCreditRate(first,18,'2026-10-19','2026-10-20')).toThrow();
  });
  it('uses exact cents for optional projections without financial events',()=>{
    expect(estimateCreditPayoff(120,0,50)).toMatchObject({feasible:true,months:3,totalInterest:0,totalPaid:120,remaining:0});
    expect(estimateCreditPayoff(100,12,1)).toMatchObject({feasible:false,months:0,remaining:100});
    expect(estimateCreditPayoff(100,12,30)).toMatchObject({feasible:true,months:4,totalInterest:2.25,totalPaid:102.25,remaining:0});
    expect(estimateCreditPayoff(100,12,0)).toBeNull();
  });
});
