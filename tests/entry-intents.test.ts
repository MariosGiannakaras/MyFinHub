import { describe, expect, it } from 'vitest';
import { ENTRY_INTENTS, entryIntentForKind, entryKindForIntent, structuredPresetFromFrequent } from '../src/lib/entryIntents.js';

describe('Quick Entry user intents',()=>{
  it('maps every approved user intent deterministically to one canonical event kind',()=>{
    expect(ENTRY_INTENTS.map(item=>[item.label,item.kind])).toEqual([
      ['Έξοδο','expense'],
      ['Έσοδο','income'],
      ['Μεταφορά','transfer'],
      ['Ανάληψη','withdrawal'],
      ['Αποταμίευση','saving_cash_offset'],
      ['Επιστροφή','refund'],
      ['Διόρθωση','reconciliation'],
      ['Σύνθετη αγορά','split'],
    ]);
    for(const item of ENTRY_INTENTS){
      expect(entryKindForIntent(item.intent)).toBe(item.kind);
      expect(entryIntentForKind(item.kind)).toBe(item.intent);
    }
  });

  it('does not pretend specialized finance-event kinds are generic entry intents',()=>{
    expect(entryIntentForKind('card_purchase')).toBeNull();
    expect(entryIntentForKind('card_payment')).toBeNull();
    expect(entryIntentForKind('lending')).toBeNull();
    expect(entryIntentForKind('repayment')).toBeNull();
  });

  it('turns frequent suggestions into structured fields without manufacturing a user comment',()=>{
    const preset=structuredPresetFromFrequent({lastAmount:12.4,category:'Φαγητό',subcategory:'Καφές',accountId:'cash'});
    expect(preset).toEqual({amount:12.4,category:'Φαγητό',subcategory:'Καφές',accountId:'cash'});
    expect('note' in preset).toBe(false);
  });
});
