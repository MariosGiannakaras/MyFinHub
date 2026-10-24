import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/lib/domain.js';
import { preserveRecurringPaymentLink } from '../src/lib/recurring.js';

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
  it('does not attach recurring identity to another economic kind',()=>{
    const previous=expense('Πάγιο internet');previous.recurringId='rec-283';
    const next=createEvent({kind:'income',date:'2026-10-21',amount:29.99,note:'Επιστροφή',category:'Άλλο',accountId:'cash'});
    expect(preserveRecurringPaymentLink(next,previous).recurringId).toBeUndefined();
  });
});
