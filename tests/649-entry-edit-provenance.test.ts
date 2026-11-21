import {describe,expect,it} from 'vitest';
import {createEvent} from '../src/lib/domain.js';
import {preserveEntryEditProvenance} from '../src/lib/eventEditProvenance.js';

const lending=(date='2026-08-17')=>createEvent({
  kind:'lending',date,amount:40,note:'Loan to person',accountId:'bank',
  person:'Alex',expectedReturnDate:'2026-09-12',
});
const saving=()=>createEvent({
  kind:'saving_cash_offset',date:'2026-08-17',amount:20,
  note:'Saving transfer',fromAccountId:'bank',toAccountId:'savings',
});
describe('#649 I19.01 generic edit must not erase non-editable finance provenance',()=>{
  it('preserves expected return date and original origin on note-only lending edit',()=>{
    const previous={...lending(),source:'migration' as const};
    const next=createEvent({kind:'lending',date:previous.date,amount:45,
      note:'Corrected loan',accountId:'bank',person:'Alex'});
    expect(next.expectedReturnDate).toBeUndefined();
    const edited=preserveEntryEditProvenance(next,previous);
    expect(edited.expectedReturnDate).toBe('2026-09-12');
    expect(edited.source).toBe('migration');
    expect(edited.legs).toEqual([{accountId:'bank',amount:-45}]);
    expect(edited.receivableDelta).toBe(45);
  });
  it('permits a lending date correction that remains before its confirmed return',()=>{
    const next=lending('2026-08-25');
    next.expectedReturnDate=undefined;
    expect(preserveEntryEditProvenance(next,lending()).expectedReturnDate).toBe('2026-09-12');
  });
  it('rejects a due-date-inconsistent lending date change without mutating history',()=>{
    const previous=lending();
    const unchanged=JSON.stringify(previous);
    const next=lending('2026-10-01');
    next.expectedReturnDate=undefined;
    expect(()=>preserveEntryEditProvenance(next,previous)).toThrow(/ημερομηνία δανεισμού/);
    expect(JSON.stringify(previous)).toBe(unchanged);
  });
  it.each(['pay_and_save','cash_offset','manual_transfer'] as const)(
    'preserves exact %s savings origin during same-kind edit',source=>{
      const previous={...saving(),savingSource:source,source:'review' as const};
      const next=createEvent({kind:'saving_cash_offset',date:previous.date,amount:30,
        note:'Corrected saving',fromAccountId:'bank',toAccountId:'savings'});
      const edited=preserveEntryEditProvenance(next,previous);
      expect(edited.savingSource).toBe(source);
      expect(edited.source).toBe('review');
      expect(edited.savingAmount).toBe(30);
      expect(edited.legs).toEqual([
        {accountId:'bank',amount:-30},{accountId:'savings',amount:30},
      ]);
    });
  it('preserves origin but not lending/savings metadata across explicit kind reclassification',()=>{
    const previous={...lending(),source:'review' as const};
    const refund=createEvent({kind:'refund',date:previous.date,amount:40,
      note:'Owner reclassified',accountId:'bank'});
    const edited=preserveEntryEditProvenance(refund,previous);
    expect(edited.source).toBe('review');
    expect(edited.expectedReturnDate).toBeUndefined();
    expect(edited.savingSource).toBeUndefined();
  });
  it('does not invent provenance for unlinked legacy data or fresh entries',()=>{
    const previous=lending();previous.expectedReturnDate=undefined;
    const edited=createEvent({kind:'lending',date:previous.date,amount:40,
      note:'Changed note',accountId:'bank',person:'Alex'});
    expect(preserveEntryEditProvenance(edited,previous).expectedReturnDate).toBeUndefined();
    const fresh=saving();
    expect(preserveEntryEditProvenance(fresh,null)).toBe(fresh);
  });
});
