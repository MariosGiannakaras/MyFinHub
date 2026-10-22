import {describe,expect,it} from 'vitest';
import {counterpartyKindForEvent,counterpartyNameKey,findCounterpartySuggestion,withCounterparty,withEventCounterparty} from '../src/lib/counterparties.js';
import {describeFinanceChange} from '../src/lib/changeHistory.js';
import type {FinanceData,FinanceEvent,CounterpartyRecord} from '../src/types.js';
const now='2026-10-22T11:00:00.000Z';
const merchant:CounterpartyRecord={id:'cp-market-1',kind:'merchant',displayName:'Αγορά Νέας Αρτάκης',aliases:['MARKET'],createdAt:now,updatedAt:now};
const purchase={id:'event-1',kind:'expense',date:'2026-10-21',amount:12,note:'Παλιό σχόλιο αγοράς',legs:[],createdAt:now,updatedAt:now} as FinanceEvent;
const base=()=>({state:{counterparties:[],events:[purchase]}} as unknown as FinanceData);
describe('optional canonical counterparty identity / finance history',()=>{
  it('creates a stable immutable ID and leaves all historical events and free-form notes unchanged',()=>{
    const original=base();
    const next=withCounterparty(original,merchant);
    expect(next.state.counterparties).toEqual([merchant]);
    expect(next.state.events).toBe(original.state.events);
    expect(original.state.counterparties).toEqual([]);
    expect(describeFinanceChange(original,next)).not.toContain(merchant.displayName);
  });
  it('supports renamed display names, preserving ID and createdAt',()=>{
    const first=withCounterparty(base(),merchant);
    const renamed=withCounterparty(first,{...merchant,displayName:'Νέο Όνομα',updatedAt:'2026-10-23T12:00:00.000Z'});
    expect(renamed.state.counterparties?.[0].id).toBe(merchant.id);
    expect(renamed.state.counterparties?.[0].createdAt).toBe(now);
    expect(renamed.state.events?.[0].note).toBe('Παλιό σχόλιο αγοράς');
    expect(()=>withCounterparty(first,{...merchant,kind:'beneficiary'})).toThrow();
    expect(()=>withCounterparty(first,{...merchant,createdAt:'2026-10-23T00:00:00.000Z'})).toThrow();
  });
  it('does not silently associate based on OCR; only exact suggestion and explicit reviewed linkage',()=>{
    const data=withCounterparty(base(),merchant);
    expect(findCounterpartySuggestion(data,'MARKET','merchant')?.id).toBe(merchant.id);
    expect(findCounterpartySuggestion(data,'Αγορά','merchant')).toBeNull();
    expect(findCounterpartySuggestion(data,'MARKET','beneficiary')).toBeNull();
    expect(data.state.events?.[0].counterpartyId).toBeUndefined();
    const linked=withEventCounterparty(data,purchase.id,merchant.id,'2026-10-22T12:00:00.000Z');
    expect(linked.state.events?.[0].counterpartyId).toBe(merchant.id);
    expect(linked.state.events?.[0].note).toBe(purchase.note);
    expect(data.state.events?.[0].counterpartyId).toBeUndefined();
    expect(withEventCounterparty(linked,purchase.id,undefined,now).state.events?.[0].counterpartyId).toBeUndefined();
  });
  it('rejects duplicate owner name, unsafe IDs and incompatible event directions',()=>{
    const data=withCounterparty(base(),merchant);
    expect(()=>withCounterparty(data,{...merchant,id:'cp-market-2',displayName:'ΑΓΟΡΑ ΝΕΑΣ ΑΡΤΑΚΗΣ'})).toThrow();
    expect(()=>withCounterparty(data,{...merchant,id:'bad id'})).toThrow();
    const beneficiary:CounterpartyRecord={...merchant,id:'cp-person-1',kind:'beneficiary',displayName:'Κώστας'};
    const pair=withCounterparty(data,beneficiary);
    expect(()=>withEventCounterparty(pair,purchase.id,beneficiary.id,now)).toThrow();
    expect(counterpartyKindForEvent('transfer')).toBeNull();
    expect(counterpartyNameKey('Καφέ')).toBe('καφε');
  });
});
