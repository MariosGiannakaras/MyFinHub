import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/lib/domain.js';
import { SAVING_SOURCE_LABELS, operationalMonthlyFlow, savingsBreakdown, savingsHistoryPresentation } from '../src/lib/savings.js';
import type { FinanceData } from '../src/types.js';

function fixture():FinanceData{return {app:'RheomIQ',schemaVersion:3,updatedAt:'2026-08-17T00:00:00.000Z',seed:{accounts:[{id:'piraeus-payroll',name:'Payroll',kind:'bank'},{id:'piraeus-savings',name:'Savings',kind:'savings'}],months:['2026-08'],transactions:[{id:'pay-save-1',date:'2026-08-04',type:'expense',accountId:'piraeus-payroll',amount:0.75,note:'Pay & Save',category:'Pay & Save'}],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],reviewDecisions:{},settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'piraeus-payroll',defaultIncomeAccount:'piraeus-payroll',defaultLoanAccount:'piraeus-payroll',motion:'full'}}} as FinanceData}

describe('savings semantics',()=>{
  it('classifies legacy Pay & Save as saving instead of spending',()=>{
    const data=fixture();
    expect(operationalMonthlyFlow(data,'2026-08')).toMatchObject({expense:0,saving:0.75});
    expect(savingsBreakdown(data,'2026-08').bySource.pay_and_save).toBe(0.75);
  });

  it('keeps dedicated savings sources separate while all count as savings',()=>{
    const data=fixture();
    const manual=createEvent({kind:'saving_cash_offset',date:'2026-08-05',amount:50,note:'Μεταφορά στην αποταμίευση',fromAccountId:'piraeus-payroll',toAccountId:'piraeus-savings'});manual.savingSource='manual_transfer';
    const cash=createEvent({kind:'saving_cash_offset',date:'2026-08-06',amount:20,note:'Σύνθετη αποταμίευση',fromAccountId:'piraeus-payroll',toAccountId:'piraeus-savings'});cash.savingSource='cash_offset';
    data.state.events=[manual,cash];
    const breakdown=savingsBreakdown(data,'2026-08');
    expect(breakdown.bySource.manual_transfer).toBe(50);
    expect(breakdown.bySource.cash_offset).toBe(20);
    expect(breakdown.total).toBeCloseTo(70.75);
    expect(operationalMonthlyFlow(data,'2026-08').saving).toBeCloseTo(70.75);
    expect(SAVING_SOURCE_LABELS.cash_offset).toBe('Σύνθετη αποταμίευση');
  });

  it('treats a user reason as primary description and the mechanism as secondary metadata',()=>{
    expect(savingsHistoryPresentation({source:'cash_offset',note:'Ταξίδι Ιαπωνία'})).toEqual({
      primary:'Ταξίδι Ιαπωνία',
      sourceLabel:'Σύνθετη αποταμίευση',
      hasUserNote:true,
    });
  });

  it.each([
    ['pay_and_save','Pay & Save'],
    ['manual_transfer','Μεταφορά στην άκρη'],
    ['manual_transfer','Μεταφορά στην αποταμίευση'],
    ['cash_offset','Σύνθετη αποταμίευση'],
    ['cash_offset','Σύνθετη αποταμίευση με μετρητά'],
  ] as const)('does not misrepresent legacy mechanism note %s / %s as a user comment',(source,note)=>{
    const presentation=savingsHistoryPresentation({source,note});
    expect(presentation.hasUserNote).toBe(false);
    expect(presentation.primary).toBe(SAVING_SOURCE_LABELS[source]);
  });
});
