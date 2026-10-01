import { describe, expect, it } from 'vitest';
import { addCalendarDays, calendarMonthRange, isValidDateOnly, isValidMonthOnly } from '../src/lib/dateOnly.js';
import { createEvent, monthRange } from '../src/lib/domain.js';
import { addDays } from '../src/lib/forecast.js';
import { entryDraftError, loanDraftError, recurringDraftError } from '../src/lib/inputSemantics.js';
import { centsToMoney, isSafeMoneyValue, moneyToCents } from '../src/lib/money.js';
import { validRecurringAnchor } from '../src/lib/recurringCadence.js';
import { monthEnd } from '../src/lib/reports.js';
import { shiftReportingMonth } from '../src/lib/reportingPeriod.js';
import { createScheduledTransaction } from '../src/lib/scheduled.js';
import { qaFinanceData } from '../src/qaFixture.js';

describe('strict calendar boundaries',()=>{
  it('accepts real leap days and rejects impossible calendar dates',()=>{
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2000-02-29')).toBe(true);
    expect(isValidDateOnly('1900-02-29')).toBe(false);
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2026-04-31')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly('0000-01-01')).toBe(false);
  });

  it('rolls dates across leap, month and year boundaries without local-time drift',()=>{
    expect(addCalendarDays('2024-02-28',1)).toBe('2024-02-29');
    expect(addCalendarDays('2024-02-28',2)).toBe('2024-03-01');
    expect(addCalendarDays('2026-12-31',1)).toBe('2027-01-01');
    expect(addDays('2026-01-31',30)).toBe('2026-03-02');
  });

  it('validates report months and exact month ends',()=>{
    expect(isValidMonthOnly('2024-02')).toBe(true);
    expect(isValidMonthOnly('2026-13')).toBe(false);
    expect(calendarMonthRange('2024-02')).toEqual({start:'2024-02-01',end:'2024-02-29'});
    expect(monthRange('2026-04')).toEqual({start:'2026-04-01',end:'2026-04-30'});
    expect(monthEnd('2024-02')).toBe('2024-02-29');
    expect(()=>monthRange('2026-13')).toThrow(/μήνας/i);
    expect(()=>monthEnd('not-a-month')).toThrow(/μήνας/i);
    expect(shiftReportingMonth('2026-12',1)).toBe('2027-01');
    expect(shiftReportingMonth('2027-01',-1)).toBe('2026-12');
    expect(()=>shiftReportingMonth('2026-13',1)).toThrow(/invalid reporting month/i);
  });

  it('rejects impossible user event, scheduled and recurring dates at domain boundaries',()=>{
    expect(()=>createEvent({kind:'expense',date:'2026-02-31',amount:10,note:'bad',accountId:'cash'})).toThrow(/ημερομηνία/i);
    expect(()=>createEvent({kind:'lending',date:'2026-02-28',amount:10,note:'loan',accountId:'cash',person:'A',expectedReturnDate:'2026-02-31'})).toThrow(/ημερομηνία/i);
    expect(validRecurringAnchor('2026-02-31')).toBeNull();
    expect(validRecurringAnchor('2024-02-29')).toBe('2024-02-29');
    const data=qaFinanceData();
    expect(()=>createScheduledTransaction(data,{kind:'expense',dueDate:'2026-02-31',amount:10,accountId:'cash'})).toThrow(/ημερομηνία/i);
  });
});

describe('safe monetary boundaries',()=>{
  it('keeps decimal money in integer cents without binary floating-point drift',()=>{
    expect(moneyToCents(0.1+0.2)).toBe(30);
    expect(centsToMoney(30)).toBe(0.3);
    expect(moneyToCents(12.345)).toBe(1235);
    expect(centsToMoney(1235)).toBe(12.35);
  });

  it('rejects non-finite and values that cannot be represented as safe integer cents',()=>{
    expect(isSafeMoneyValue(123456789.12)).toBe(true);
    expect(isSafeMoneyValue(Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(Number.isNaN(moneyToCents(Number.MAX_SAFE_INTEGER))).toBe(true);
    expect(Number.isNaN(centsToMoney(Number.MAX_SAFE_INTEGER+1))).toBe(true);
  });

  it('enforces safe money at event and input semantic boundaries',()=>{
    expect(()=>createEvent({kind:'expense',date:'2026-10-01',amount:Number.MAX_SAFE_INTEGER,note:'too large',accountId:'cash'})).toThrow(/ποσό/i);
    expect(entryDraftError('expense',{amount:String(Number.MAX_SAFE_INTEGER),person:'',actualBalance:'',parts:[]})).toMatch(/εύρους/i);
    expect(entryDraftError('reconciliation',{amount:'',person:'',actualBalance:String(Number.MAX_SAFE_INTEGER),parts:[]})).toMatch(/εύρους/i);

    const loan={id:'l',name:'Loan',total:Number.MAX_SAFE_INTEGER,installment:10,installments:2,paidCount:0} as any;
    expect(loanDraftError(loan)).toMatch(/εύρους/i);

    const recurring={id:'r',name:'Recurring',amount:10,day:1,accountId:'cash',active:true,recurrenceUnit:'year',recurrenceInterval:1,firstExpectedDate:'2026-02-31'} as any;
    expect(recurringDraftError(recurring)).toMatch(/ημερομηνία/i);
  });
});
