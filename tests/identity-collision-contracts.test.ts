import { describe, expect, it } from 'vitest';
import { allAccounts } from '../src/lib/domain.js';
import { categoryKey } from '../src/lib/categories.js';
import { parseFinancialProviderWrite } from '../server/accountMetadataHandler.js';
import { validateCategoryIdentityState } from '../server/categoryIdentityValidation.js';
import type { FinanceData } from '../src/types.js';

function dataWithDuplicateAccountLabels():FinanceData{
  return {
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-10-01T00:00:00.000Z',
    seed:{
      accounts:[{id:'seed-bank',name:'Κοινό όνομα',kind:'bank'}],
      months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{},
    },
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
      settings:{
        excludedFromAvailable:[],accountNames:{},expenseCategories:[],incomeCategories:[],customPresets:[],pinnedPresets:[],
        defaultExpenseAccount:'seed-bank',defaultIncomeAccount:'seed-bank',defaultLoanAccount:'seed-bank',
        customAccounts:[{id:'custom-bank',name:'Κοινό όνομα',kind:'bank',custom:true}],
      },
      events:[],
    },
  } as FinanceData;
}

describe('persistent identity and duplicate-label semantics',()=>{
  it('keeps duplicate account display labels distinct because account identity is id-based',()=>{
    const accounts=allAccounts(dataWithDuplicateAccountLabels()).filter(account=>account.name==='Κοινό όνομα');
    expect(accounts.map(account=>account.id).sort()).toEqual(['custom-bank','seed-bank']);
  });

  it('allows provider display-label reuse without overwriting because provider identity is the stable id',()=>{
    const first=parseFinancialProviderWrite({id:'provider-a',displayName:'Κοινός πάροχος',shortName:'A',providerKind:'bank',countryCode:'GR',sortOrder:10});
    const second=parseFinancialProviderWrite({id:'provider-b',displayName:'Κοινός πάροχος',shortName:'B',providerKind:'bank',countryCode:'GR',sortOrder:20});
    expect(first.id).toBe('provider-a');
    expect(second.id).toBe('provider-b');
    expect(first.displayName).toBe(second.displayName);
  });

  it('normalizes taxonomy labels and rejects ambiguous current/historical aliases',()=>{
    expect(categoryKey('  Φαρμακείο ')).toBe(categoryKey('φαρμακειο'));
    expect(()=>validateCategoryIdentityState({settings:{categoryIdentities:{
      one:{id:'one',kind:'expense',label:'Φαρμακείο',aliases:[]},
      two:{id:'two',kind:'expense',label:'φαρμακειο',aliases:[]},
    }}})).toThrow(/ambiguous category identity alias\/path/i);
  });
});
