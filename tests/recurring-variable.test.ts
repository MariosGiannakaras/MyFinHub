import {describe,expect,it} from 'vitest';
import {createEvent} from '../src/lib/domain.js';
import {recurringExpectedAmount,recurringVariableAmountError,recurringActualPayments} from '../src/lib/recurringVariable.js';
import {validateCompleteFinanceData} from '../server/financeDataValidation.js';
import type {FinanceData,RecurringItem} from '../src/types.js';
const item:RecurringItem={id:'power',name:'Power',amount:80,amountMode:'variable',
 estimateMin:60,estimateMax:100,accountId:'bank',category:'Πάγια',active:true,
 recurrenceUnit:'month',recurrenceInterval:1,firstExpectedDate:'2026-09-10'};
const data=():FinanceData=>({
 app:'RheomIQ',schemaVersion:3,updatedAt:'2026-10-01T00:00:00.000Z',
 seed:{accounts:[{id:'bank',name:'Bank',kind:'bank'}],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
 state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[item],recurringOverrides:{},
 loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],
 settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Πάγια'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},reviewDecisions:{}}
} as FinanceData);
describe('variable recurring estimates vs booked actual expenses (#588 #8)',()=>{
 it('labels an owner-entered range without generating any finance event',()=>{
  const d=data();expect(recurringExpectedAmount(item)).toMatchObject({amount:80,confidence:'estimated',min:60,max:100});
  expect(d.state.events).toEqual([]);
  expect(()=>validateCompleteFinanceData(d)).not.toThrow();
 });
 it('distinguishes each actual linked payment from estimated or unrelated expenses',()=>{
  const d=data();d.state.events=[
   {...createEvent({kind:'expense',date:'2026-09-05',amount:62.25,note:'Real',accountId:'bank'}),recurringId:item.id},
   {...createEvent({kind:'expense',date:'2026-10-08',amount:95.03,note:'Real',accountId:'bank'}),recurringId:item.id},
   createEvent({kind:'expense',date:'2026-10-02',amount:100,note:'Other',accountId:'bank'})
  ];
  expect(recurringActualPayments(d,item.id,'2026-09-01','2026-09-30').amount).toBe(62.25);
  expect(recurringActualPayments(d,item.id,'2026-10-01','2026-10-31').amount).toBe(95.03);
  expect(recurringActualPayments(d,item.id,'2026-11-01','2026-11-30')).toEqual({events:[],amount:0});
  expect(recurringExpectedAmount(item).amount).toBe(80);
 });
 it('rejects invalid/incomplete estimate ranges and sub-cent amounts',()=>{
  for(const changed of [
   {...item,estimateMin:90},{...item,estimateMax:70},
   {...item,estimateMin:undefined},{...item,estimateMin:20.001},
   {...item,amount:80.001},{...item,amountMode:'fixed' as const}
  ]){expect(recurringVariableAmountError(changed)).not.toBeNull();
     const d=data();d.state.recurringCustom=[changed];
     expect(()=>validateCompleteFinanceData(d)).toThrow();
  }
 });
 it('keeps historical fixed items and multimonth/yearly schedule metadata',()=>{
  const original={...item,amountMode:undefined,estimateMin:undefined,estimateMax:undefined};
  expect(recurringExpectedAmount(original)).toMatchObject({confidence:'fixed',amount:80});
  const d=data();d.state.recurringCustom=[
   {...item,id:'annual',recurrenceUnit:'year',firstExpectedDate:'2026-12-15'},
   {...item,id:'two-month',recurrenceInterval:2,firstExpectedDate:'2026-11-15'}
  ];expect(()=>validateCompleteFinanceData(d)).not.toThrow();
 });
});
