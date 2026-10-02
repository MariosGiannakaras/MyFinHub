import { describe, expect, it } from 'vitest';
import { migrateProductData } from '../src/lib/productMigration.js';
import { assertSupportedFinanceSchemaVersion } from '../src/lib/schemaVersion.js';
import type { FinanceData } from '../src/types.js';

function historical(version:1|2):FinanceData{
  return {
    app:version===1?'MBAI Finance':'MyFinHub',
    schemaVersion:version,
    updatedAt:'2025-12-31T22:00:00.000Z',
    seed:{
      accounts:[
        {id:'cash',name:'Μετρητά',kind:'cash',cashRole:'daily'},
        {id:'bank',name:'Κύριος',kind:'bank',providerId:'legacy-bank',bankAccountCategory:'current'},
      ],
      months:['2025-12'],
      transactions:[{id:'legacy-tx',date:'2025-12-31',type:'expense',accountId:'bank',amount:12.34,note:'Ιστορική κίνηση',category:'Άλλο'}],
      snapshots:[{date:'2025-12-31',balances:{cash:20,bank:100}}],
      recurring:[],subscriptions:[],loans:[],lending:[],stats:{},
    },
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
      loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
      settings:{
        accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],
        customPresets:[],pinnedPresets:[],
      },
    },
  } as unknown as FinanceData;
}

describe('historical finance schema migration',()=>{
  it.each([1,2] as const)('loads supported schema v%s without losing historical finance records',version=>{
    const input=historical(version);
    assertSupportedFinanceSchemaVersion(input.schemaVersion);
    const migrated=migrateProductData(input);
    expect(migrated.app).toBe('RheomIQ');
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.seed.accounts.map(item=>item.id)).toEqual(['cash','bank']);
    expect(migrated.seed.transactions).toEqual([expect.objectContaining({id:'legacy-tx',amount:12.34,accountId:'bank'})]);
    expect(migrated.seed.snapshots).toEqual([expect.objectContaining({date:'2025-12-31',balances:{cash:20,bank:100}})]);
    expect(migrated.state.settings.defaultExpenseAccount).toBe('bank');
    expect(migrated.state.settings.defaultIncomeAccount).toBe('bank');
    expect(migrated.state.settings.defaultLoanAccount).toBe('bank');
    expect(migrated.state.events).toEqual([]);
    expect(migrated.state.reviewDecisions).toEqual({});
  });

  it('keeps the current schema stable on repeated migration',()=>{
    const once=migrateProductData(historical(2));
    const twice=migrateProductData(once);
    expect(twice).toEqual(once);
  });
});
