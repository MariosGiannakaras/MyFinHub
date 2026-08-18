import { describe, expect, it } from 'vitest';
import { cardBanks, cardsForBank } from '../src/lib/cards.js';
import type { FinanceData } from '../src/types.js';

function fixture():FinanceData{return {app:'RheomIQ',schemaVersion:3,updatedAt:'2026-08-17T00:00:00Z',seed:{accounts:[],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'},cardBanks:[{id:'custom-bank',name:'CUSTOM',order:60,custom:true}],cards:[{id:'c1',bankId:'piraeus',nickname:'Debit',kind:'debit',network:'visa',last4:'1234',active:true,createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-08-01T00:00:00Z'},{id:'c2',bankId:'piraeus',nickname:'Old',kind:'debit',network:'visa',last4:'9999',active:false,createdAt:'2026-08-02T00:00:00Z',updatedAt:'2026-08-02T00:00:00Z'}]}} as FinanceData}

describe('Cards metadata',()=>{
 it('keeps the required bank order before custom banks',()=>{expect(cardBanks(fixture()).map(bank=>bank.id)).toEqual(['piraeus','revolut','alpha','payzy','viva','custom-bank'])});
 it('shows active cards only and stores no full secret field in metadata',()=>{const cards=cardsForBank(fixture(),'piraeus');expect(cards.map(card=>card.id)).toEqual(['c1']);expect(cards[0]).not.toHaveProperty('pan');expect(cards[0]).not.toHaveProperty('cvv');expect(cards[0]).not.toHaveProperty('expiry')});
});
