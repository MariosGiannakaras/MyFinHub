import { describe, expect, it } from 'vitest';
import { createEvent, monthlyFlow } from '../src/lib/domain.js';
import { qaFinanceData } from '../src/qaFixture.js';
import { allRecurringItems, preserveRecurringPaymentLink, recurringPayments } from '../src/lib/recurring.js';

const expense=(note:string)=>createEvent({kind:'expense',date:'2026-10-21',amount:29.99,note,category:'Διάφορα',accountId:'cash'});

describe('owner recurring payments originate in Recurring',()=>{
  it('retains a real explicit recurring payment identity on a transaction edit',()=>{
    const original=expense('Πάγιο internet');original.recurringId='rec-283';
    const edit=expense('Διορθωμένο ποσό / σημείωση');
    const saved=preserveRecurringPaymentLink(edit,original);
    expect(saved.recurringId).toBe('rec-283');
    expect(original.note).toBe('Πάγιο internet');
  });
  it('does not invent a recurring payment for same-looking ordinary expense',()=>{
    const previous=expense('Πάγιο internet');
    const changed=expense('Πάγιο internet');
    expect(preserveRecurringPaymentLink(changed,previous).recurringId).toBeUndefined();
  });
  it('does not reclassify a same-name or same-amount historical purchase as a recurring payment (#649 I11.06)',()=>{
    const data=structuredClone(qaFinanceData());
    const item={
      id:'legacy-explicit-only',
      name:'Same merchant',
      amount:29.99,
      day:12,
      accountId:'piraeus-payroll',
      category:'Λογαριασμοί',
      active:true,
    };
    data.seed.recurring=[item];
    data.state.recurringCustom=[];
    data.state.recurringOverrides={};
    const originalSeed=structuredClone(data.seed);
    const beforeExpense=monthlyFlow(data,'2026-10').expense;
    const unlinked=createEvent({kind:'expense',date:'2026-10-12',amount:29.99,note:'Same merchant',category:'Λογαριασμοί',accountId:'piraeus-payroll'});
    const linked=createEvent({kind:'expense',date:'2026-10-12',amount:29.99,note:'Same merchant',category:'Λογαριασμοί',accountId:'piraeus-payroll'});
    linked.recurringId=item.id;
    data.state.events=[...(data.state.events??[]),unlinked,linked];
    expect(allRecurringItems(data).map(row=>row.id)).toEqual([item.id]);
    expect(recurringPayments(data,item.id).map(row=>row.id)).toEqual([linked.id]);
    expect(unlinked.recurringId).toBeUndefined();
    // Both purchases remain ordinary booked expenses; neither is a synthetic
    // recurring forecast entry or a silent rewrite of seed financial history.
    expect(monthlyFlow(data,'2026-10').expense).toBeCloseTo(beforeExpense+59.98,2);
    expect(data.seed).toEqual(originalSeed);
  });

  it('does not attach recurring identity to another economic kind',()=>{
    const previous=expense('Πάγιο internet');previous.recurringId='rec-283';
    const next=createEvent({kind:'income',date:'2026-10-21',amount:29.99,note:'Επιστροφή',category:'Άλλο',accountId:'cash'});
    expect(preserveRecurringPaymentLink(next,previous).recurringId).toBeUndefined();
  });
});
