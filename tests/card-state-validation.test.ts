import { describe, expect, it } from 'vitest';
import { validateCardStateExtensions } from '../server/cardStateValidation.js';
import type { FinanceData, FinanceEvent, PaymentCard } from '../src/types.js';

function state():FinanceData['state']{return {customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'},cards:[],events:[]}}
function card(id:string,active=true):PaymentCard{return {id,bankId:'piraeus',nickname:id,kind:'credit',network:'visa',active,createdAt:'2026-08-19T00:00:00Z',updatedAt:'2026-08-19T00:00:00Z',...(active?{}:{archivedAt:'2026-08-19T01:00:00Z'})}}
function event(cardId:string):FinanceEvent{return {id:`event-${cardId}`,date:'2026-08-19',kind:'card_purchase',amount:10,note:'Test',cardId,legs:[{accountId:'credit-card',amount:-10}],source:'user',createdAt:'2026-08-19T00:00:00Z',updatedAt:'2026-08-19T00:00:00Z'}}

describe('shared card state validation',()=>{
  it('accepts history linked to an archived card record',()=>{const s=state();s.cards=[card('archived',false)];s.events=[event('archived')];expect(()=>validateCardStateExtensions(s)).not.toThrow()});
  it('rejects orphan cardId links',()=>{const s=state();s.events=[event('missing')];expect(()=>validateCardStateExtensions(s)).toThrow()});
  it('rejects multiple active credit identities for the singular credit liability',()=>{const s=state();s.cards=[card('one'),card('two')];expect(()=>validateCardStateExtensions(s)).toThrow()});
});
