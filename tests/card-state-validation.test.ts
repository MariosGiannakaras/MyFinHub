import { describe, expect, it } from 'vitest';
import { validateCardStateExtensions } from '../server/cardStateValidation.js';
import type { FinanceData, FinanceEvent, PaymentCard } from '../src/types.js';

function state():FinanceData['state']{return {customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'},cards:[],deletedCards:[],events:[]}}
function card(id:string,active=true):PaymentCard{return {id,bankId:'piraeus',nickname:id,kind:'credit',network:'visa',creditLimit:1000,active,createdAt:'2026-08-19T00:00:00Z',updatedAt:'2026-08-19T00:00:00Z',...(active?{}:{archivedAt:'2026-08-19T01:00:00Z'})}}
function event(cardId:string):FinanceEvent{return {id:`event-${cardId}`,date:'2026-08-19',kind:'card_purchase',amount:10,note:'Test',cardId,legs:[{accountId:'credit-card',amount:-10}],source:'user',createdAt:'2026-08-19T00:00:00Z',updatedAt:'2026-08-19T00:00:00Z'}}

describe('shared card state validation',()=>{
  it('accepts history linked to an archived credit-card record',()=>{const s=state();s.cards=[card('archived',false)];s.events=[event('archived')];expect(()=>validateCardStateExtensions(s)).not.toThrow()});
  it('accepts history linked to a minimal deleted-credit tombstone',()=>{const s=state();s.deletedCards=[{id:'deleted',kind:'credit',createdAt:'2026-08-01T00:00:00Z',deletedAt:'2026-08-20T00:00:00Z'}];s.events=[event('deleted')];expect(()=>validateCardStateExtensions(s)).not.toThrow()});
  it('rejects orphan cardId links',()=>{const s=state();s.events=[event('missing')];expect(()=>validateCardStateExtensions(s)).toThrow()});
  it('rejects finance history linked to a debit/prepaid card',()=>{const s=state();s.cards=[{...card('debit'),kind:'debit',creditLimit:undefined}];s.events=[event('debit')];expect(()=>validateCardStateExtensions(s)).toThrow()});
  it('rejects secret or descriptive data inside deleted-card tombstones',()=>{const s=state();s.deletedCards=[{id:'deleted',kind:'credit',createdAt:'2026-08-01T00:00:00Z',deletedAt:'2026-08-20T00:00:00Z',last4:'4242'} as never];expect(()=>validateCardStateExtensions(s)).toThrow()});
  it('accepts multiple active credit identities',()=>{const s=state();s.cards=[card('one'),card('two'),card('three')];expect(()=>validateCardStateExtensions(s)).not.toThrow()});
  it('rejects invalid per-card credit limits',()=>{const s=state();s.cards=[{...card('bad'),creditLimit:-1}];expect(()=>validateCardStateExtensions(s)).toThrow()});
});
