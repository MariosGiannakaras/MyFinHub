import { describe, expect, it } from 'vitest';
import { allAttentionItems } from '../src/lib/attention.js';
import { nextRecurringDate } from '../src/lib/recurring.js';
import { createEvent } from '../src/lib/domain.js';
import { qaFinanceData } from '../src/qaFixture.js';
import type { RecurringItem } from '../src/types.js';

describe('#649 I11.01 separate overdue reminders from future recurring forecast',()=>{
  it('keeps a missed quarterly cycle actionable while the forecast advances to the next actual cycle',()=>{
    const data=structuredClone(qaFinanceData());
    const item:RecurringItem={
      id:'quarterly-separation',name:'Quarterly service',amount:90,
      day:10,firstExpectedDate:'2026-01-10',
      recurrenceUnit:'month',recurrenceInterval:3,
      accountId:'piraeus-payroll',category:'Τηλεπικοινωνίες',active:true,
    };
    data.seed.recurring=[];
    data.state.recurringCustom=[item];
    const january=createEvent({
      kind:'expense',date:'2026-01-10',amount:90,
      note:'Quarterly service',accountId:'piraeus-payroll',
    });
    data.state.events=[{...january,recurringId:item.id}];

    const dueAt=(asOf:string)=>allAttentionItems(data,asOf).find(row=>row.id===`recurring:${item.id}`);
    expect(dueAt('2026-04-11')).toMatchObject({
      severity:'danger',dueDate:'2026-04-10',
    });
    // The future forecast must not quietly convert the missed April cycle
    // into a new April cash transaction or suppress the overdue advisory.
    expect(nextRecurringDate(data,item,'2026-04-11')).toBe('2026-07-10');

    const paidApril=createEvent({
      kind:'expense',date:'2026-04-12',amount:90,
      note:'Quarterly service paid',accountId:'piraeus-payroll',
    });
    data.state.events.push({...paidApril,recurringId:item.id});
    expect(dueAt('2026-04-13')).toBeUndefined();
    expect(nextRecurringDate(data,item,'2026-04-13')).toBe('2026-07-10');
  });
});
