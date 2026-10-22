import {describe,expect,it} from 'vitest';
import {counterpartyKindForEvent,counterpartyNameKey,findCounterpartySuggestion,withCounterparty,withEventCounterparty} from '../src/lib/counterparties.js';
import {describeFinanceChange} from '../src/lib/changeHistory.js';
import {validateFinanceData} from '../server/validation.js';
import type {FinanceData,FinanceEvent,CounterpartyRecord} from '../src/types.js';
const now='2026-10-22T11:00:00.000Z';
const merchant:CounterpartyRecord={id:'cp-market-1',kind:'merchant',displayName:'Αγορά Νέας Αρτάκης',aliases:['MARKET'],createdAt:now,updatedAt:now};
const purchase={id:'event-1',kind:'expense',date:'2026-10-21',amount:12,note:'Παλιό σχόλιο αγοράς',legs:[],createdAt:now,updatedAt:now} as FinanceEvent;
const base=()=>({
  app:'RheomIQ',schemaVersion:3,updatedAt:now,
  seed:{accounts:[],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
  state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],counterparties:[],events:[purchase],
  settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:[],incomeCategories:[],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'',defaultIncomeAccount:'',defaultLoanAccount:''}}
} as FinanceData);
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
    expect(()=>withCounterparty(data,{...merchant,id:'cp-market-2',displayName:'Άλλο',aliases:['MARKET']})).toThrow();
    const beneficiary:CounterpartyRecord={...merchant,id:'cp-person-1',kind:'beneficiary',displayName:'Κώστας'};
    const pair=withCounterparty(data,beneficiary);
    expect(()=>withEventCounterparty(pair,purchase.id,beneficiary.id,now)).toThrow();
    expect(counterpartyKindForEvent('transfer')).toBeNull();
    expect(counterpartyNameKey('Καφέ')).toBe('καφε');
  });
  it('accepts valid server registry references but rejects mismatched and dangling IDs and aliases',()=>{
    const good=withEventCounterparty(withCounterparty(base(),merchant),purchase.id,merchant.id,now);
    expect(()=>validateFinanceData(good)).not.toThrow();
    const badLink={...good,state:{...good.state,events:[{...purchase,counterpartyId:'other'}]}};
    expect(()=>validateFinanceData(badLink)).toThrow();
    const wrongKind={...good,state:{...good.state,counterparties:[{...merchant,kind:'beneficiary'}]}};
    expect(()=>validateFinanceData(wrongKind)).toThrow();
    const duplicateAlias={...good,state:{...good.state,counterparties:[merchant,{...merchant,id:'cp-market-2',displayName:'Other',aliases:['MARKET']}]}};
    expect(()=>validateFinanceData(duplicateAlias)).toThrow();
    const badId={...good,state:{...good.state,counterparties:[{...merchant,id:'bad id'}]}};
    expect(()=>validateFinanceData(badId)).toThrow();
  });
});
