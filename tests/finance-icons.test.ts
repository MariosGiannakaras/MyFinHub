import { describe, expect, it } from 'vitest';
import { financeIconKey } from '../src/lib/financeIcons.js';

describe('semantic finance icons',()=>{
  it('uses concrete description before a broad food category',()=>{
    expect(financeIconKey({kind:'expense',category:'Τρόφιμα',note:'Freddo espresso'})).toBe('coffee');
    expect(financeIconKey({kind:'expense',category:'Τρόφιμα',note:'Wolt burger'})).toBe('dining');
    expect(financeIconKey({kind:'expense',category:'Τρόφιμα',note:'Lidl'})).toBe('supermarket');
  });

  it('distinguishes common shopping and vehicle cases',()=>{
    expect(financeIconKey({kind:'expense',category:'Αγορές',note:'Zara μπουφάν'})).toBe('clothing');
    expect(financeIconKey({kind:'expense',category:'Αγορές',note:'iPhone'})).toBe('electronics');
    expect(financeIconKey({kind:'expense',category:'Όχημα',subcategory:'Βενζίνη',note:'Αγορά'})).toBe('fuel');
    expect(financeIconKey({kind:'expense',category:'Όχημα',subcategory:'Parking'})).toBe('parking');
    expect(financeIconKey({kind:'expense',category:'Όχημα',subcategory:'Service'})).toBe('service');
  });

  it('distinguishes health cases',()=>{
    expect(financeIconKey({kind:'expense',category:'Υγεία',note:'Φαρμακείο'})).toBe('pharmacy');
    expect(financeIconKey({kind:'expense',category:'Υγεία',note:'Οδοντίατρος'})).toBe('doctor');
  });

  it('keeps accounting movements semantic and stable',()=>{
    expect(financeIconKey({kind:'transfer',note:'Βενζίνη'})).toBe('transfer');
    expect(financeIconKey({kind:'saving_cash_offset',note:'Pay & Save'})).toBe('saving');
    expect(financeIconKey({kind:'refund',note:'Zara'})).toBe('refund');
    expect(financeIconKey({kind:'reconciliation'})).toBe('reconciliation');
  });

  it('falls back safely when there is not enough information',()=>{
    expect(financeIconKey({kind:'expense',category:'Άλλο',note:'Κάτι'})).toBe('expense');
    expect(financeIconKey({kind:'unknown'})).toBe('fallback');
  });
});
