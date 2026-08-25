import { describe, expect, it } from 'vitest';
import { validateRecurringCadenceData, validateRecurringCadenceState } from '../server/recurringCadenceValidation.js';
import type { FinanceData, RecurringItem } from '../src/types.js';

type CadencedRecurring=RecurringItem&{recurrenceUnit?:'month'|'year';recurrenceInterval?:number};

const item=(extra:Partial<CadencedRecurring>={}):CadencedRecurring=>({id:'rec',name:'Plan',amount:10,day:5,accountId:'bank',category:'Συνδρομές',active:true,status:'active',...extra});
const state=(items:CadencedRecurring[]):FinanceData['state']=>({
  customTransactions:[],
  overrides:{},
  deleted:[],
  recurringCustom:items,
  recurringOverrides:{},
  loanExtra:{},
  loanOverrides:{},
  customLoans:[],
  lendingCustom:[],
  settings:{
    excludedFromAvailable:[],
    accountNames:{},
    expenseCategories:['Συνδρομές'],
    incomeCategories:['Μισθός'],
    customPresets:[],
    pinnedPresets:[],
    defaultExpenseAccount:'bank',
    defaultIncomeAccount:'bank',
    defaultLoanAccount:'bank',
  },
} as FinanceData['state']);

describe('recurring cadence validation',()=>{
  it('accepts legacy monthly items without new fields',()=>{expect(()=>validateRecurringCadenceState(state([item()]))).not.toThrow()});
  it('accepts anchored annual and multi-month items',()=>{expect(()=>validateRecurringCadenceState(state([item({recurrenceUnit:'year',recurrenceInterval:1,firstExpectedDate:'2026-09-03'}),item({id:'six',recurrenceUnit:'month',recurrenceInterval:6,firstExpectedDate:'2026-08-03'})]))).not.toThrow()});
  it('rejects invalid cadence intervals and missing active anchors',()=>{expect(()=>validateRecurringCadenceState(state([item({recurrenceUnit:'month',recurrenceInterval:0})]))).toThrow();expect(()=>validateRecurringCadenceState(state([item({recurrenceUnit:'year',recurrenceInterval:1,firstExpectedDate:null})]))).toThrow()});
  it('allows a stopped historical non-monthly item without an anchor',()=>{expect(()=>validateRecurringCadenceState(state([item({active:false,status:'stopped',recurrenceUnit:'year',recurrenceInterval:1,firstExpectedDate:null})]))).not.toThrow()});
  it('checks cadence fields in seed data too',()=>{const data={app:'RheomIQ',schemaVersion:3,updatedAt:'2026-08-25',seed:{accounts:[],months:[],transactions:[],snapshots:[],recurring:[item({recurrenceUnit:'year',recurrenceInterval:1,firstExpectedDate:'2026-09-03'})],subscriptions:[],loans:[],lending:[],stats:{}},state:state([])} as FinanceData;expect(()=>validateRecurringCadenceData(data)).not.toThrow()});
});
