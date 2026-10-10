import { describe, expect, it } from 'vitest';
import { qaFinanceData } from '../src/qaFixture.js';
import { createEvent } from '../src/lib/domain.js';
import { buildCommandSearchIndex, normalizeCommandText, searchCommandItems } from '../src/lib/commandSearch.js';
import type { FinanceData, Loan, PaymentCard } from '../src/types.js';

const clone=()=>structuredClone(qaFinanceData()) as FinanceData;
const stamp='2026-08-17T12:00:00.000Z';

describe('unified command search',()=>{
  it('normalizes Greek accents and ranks deterministic exact/prefix matches before fuzzy matches',()=>{
    const data=clone();
    expect(normalizeCommandText('Μεταφορά')).toBe('μεταφορα');
    const first=searchCommandItems(data,'μεταφορα').map(row=>row.id);
    const second=searchCommandItems(data,'μεταφορά').map(row=>row.id);
    expect(first).toEqual(second);
    expect(first[0]).toBe('command:quick-transfer');
  });

  it('routes budget searches to Reports rather than the relocated Settings controls',()=>{
    const index=buildCommandSearchIndex(clone());
    const reports=index.find(row=>row.id==='navigate:reports');
    const settings=index.find(row=>row.id==='navigate:settings');
    expect(reports?.subtitle).toContain('budgets');
    expect(settings?.subtitle).not.toMatch(/budget/i);
    expect(settings?.subtitle).toContain('Κανόνες');
    expect(settings?.subtitle).toContain('λογαριασμοί');
    expect(settings?.keywords).not.toContain('budgets');
  });

  it('opens the matching budget month in Reports management instead of a generic route',()=>{
    const data=clone();
    data.state.budgets=[{id:'qa-budget-2026-07',month:'2026-07',scope:'category',category:'Σταθερά έξοδα',amount:100,createdAt:stamp,updatedAt:stamp}];
    const budget=buildCommandSearchIndex(data).find(row=>row.id==='budget:qa-budget-2026-07');
    expect(budget?.action).toEqual({type:'budget_management',month:'2026-07'});
    expect(searchCommandItems(data,'Σταθερά έξοδα').some(row=>row.id===budget?.id)).toBe(true);
  });

  it('labels account results as Quick Entry actions and recognizes savings-category bank accounts',()=>{
    const data=clone();
    data.state.settings.customAccounts=[...(data.state.settings.customAccounts??[]),{id:'bank-savings-search',name:'Reserve bank',kind:'bank',bankAccountCategory:'savings',custom:true}];
    const index=buildCommandSearchIndex(data);
    expect(index.find(row=>row.id==='account:bank-savings-search')?.subtitle).toContain('Μεταφορά προς αποταμίευση');
    expect(index.find(row=>row.id==='account:piraeus-payroll')?.subtitle).toContain('Καταχώριση εξόδου');
  });

  it('shows recent entities on the empty-query surface without leaking amounts',()=>{
    const data=clone();
    data.state.events=[...(data.state.events??[]),{id:'evt-search',date:'2026-08-17',kind:'expense',amount:987654.32,note:'QA Market Search',category:'Τρόφιμα',accountId:'piraeus-payroll',legs:[{accountId:'piraeus-payroll',amount:-987654.32}],source:'user',createdAt:stamp,updatedAt:stamp}];
    expect(searchCommandItems(data,'')[0]?.id).toBe('command:quick-expense');
    const recent=searchCommandItems(data,'',{recentIds:['event:evt-search']});
    expect(recent[0]?.id).toBe('event:evt-search');
    expect(recent.some(row=>row.id==='command:quick-expense')).toBe(true);
    expect(JSON.stringify(recent)).not.toContain('987654.32');
  });

  it('returns exact date/source identifiers for transaction result actions',()=>{
    const data=clone();
    const expense=createEvent({kind:'expense',date:'2026-07-15',amount:16,note:'Crossmonth lookup',accountId:'piraeus-payroll'});
    expense.id='crossmonth-search';
    const credit=createEvent({kind:'card_purchase',date:'2026-07-16',amount:50,note:'Credit-only lookup'});
    credit.id='credit-only-search';
    data.state.events=[...(data.state.events??[]),expense,credit];
    expect(buildCommandSearchIndex(data).find(row=>row.id==='event:crossmonth-search')?.action).toEqual({type:'transaction_focus',id:'crossmonth-search',source:'event',date:'2026-07-15'});
    expect(buildCommandSearchIndex(data).some(row=>row.id==='event:credit-only-search')).toBe(false);
    const legacy=buildCommandSearchIndex(data).find(row=>row.id.startsWith('legacy:'));
    expect(legacy?.action).toMatchObject({type:'transaction_focus',source:'legacy'});
    expect(searchCommandItems(data,'Crossmonth lookup').some(row=>row.id==='event:crossmonth-search')).toBe(true);
  });

  it('excludes archived cards and never indexes holder, last4 or vault references',()=>{
    const data=clone();
    const active:PaymentCard={id:'safe-card',bankId:'piraeus',nickname:'QA Active Card',kind:'credit',network:'visa',active:true,last4:'4321',holderName:'Private Holder',vaultRef:'vault-private-token',createdAt:stamp,updatedAt:stamp};
    const archived:PaymentCard={...active,id:'archived-card',nickname:'QA Archived Secret',active:false,archivedAt:stamp};
    data.state.cards=[active,archived];
    const index=buildCommandSearchIndex(data);const serialized=JSON.stringify(index);
    expect(index.some(row=>row.id==='card:safe-card')).toBe(true);
    expect(index.some(row=>row.id==='card:archived-card')).toBe(false);
    expect(serialized).not.toContain('Private Holder');expect(serialized).not.toContain('vault-private-token');expect(serialized).not.toContain('4321');
  });

  it('does not hide current loan and lending collection commands due to future settlements',()=>{
    const data=clone();
    data.state.customLoans=[{id:'future-paid-loan',name:'Future paid loan',total:100,installment:100,installments:1,paidCount:0,defaultAccountId:'piraeus-payroll'}];
    const loanPayment=createEvent({kind:'expense',date:'2026-08-29',amount:100,note:'Future loan payment',accountId:'piraeus-payroll'});loanPayment.loanId='future-paid-loan';
    const lending=createEvent({kind:'lending',date:'2026-08-01',amount:50,note:'Lent',accountId:'piraeus-payroll',person:'Future Repayee'});
    const repay=createEvent({kind:'repayment',date:'2026-08-29',amount:50,note:'Future repayment',accountId:'piraeus-payroll',person:'Future Repayee'});
    data.state.events=[...(data.state.events??[]),loanPayment,lending,repay];
    const now=buildCommandSearchIndex(data,'2026-08-17').map(row=>row.id);
    const after=buildCommandSearchIndex(data,'2026-08-30').map(row=>row.id);
    expect(now).toContain('action:loan-payment:future-paid-loan');
    expect(now).toContain('action:lending:Future Repayee');
    expect(after).not.toContain('action:loan-payment:future-paid-loan');
    expect(after).not.toContain('action:lending:Future Repayee');
    expect(searchCommandItems(data,'future paid',{asOf:'2026-08-17'}).some(row=>row.id==='action:loan-payment:future-paid-loan')).toBe(true);
  });
  it('preserves exact stable identifiers for eligible direct actions',()=>{
    const data=clone();
    const loan:Loan={id:'loan-search',name:'QA Laptop Loan',total:1000,installment:100,installments:10,paidCount:0,defaultAccountId:'piraeus-payroll'};
    data.state.customLoans=[loan];
    data.state.scheduled=[...(data.state.scheduled??[]),{id:'scheduled-search',dueDate:'2026-08-20',kind:'expense',amount:50,note:'QA Exact Scheduled',category:'Σταθερά έξοδα',accountId:'piraeus-payroll',status:'pending',createdAt:stamp,updatedAt:stamp}];
    const loanResult=searchCommandItems(data,'laptop πληρωμη').find(row=>row.id==='action:loan-payment:loan-search');
    const scheduled=searchCommandItems(data,'exact scheduled').find(row=>row.id==='scheduled:scheduled-search');
    expect(loanResult?.action).toEqual({type:'loan_payment',loanId:'loan-search',accountId:'piraeus-payroll'});
    expect(scheduled?.action).toEqual({type:'scheduled_complete',scheduledId:'scheduled-search'});
  });

  it('uses stable ranking and applies recency only as a bounded boost to actual typed matches',()=>{
    const data=clone();
    const baseline=searchCommandItems(data,'ρυθμισεις').map(row=>row.id);
    expect(searchCommandItems(data,'ρυθμισεις').map(row=>row.id)).toEqual(baseline);
    const recentEmpty=searchCommandItems(data,'',{recentIds:['navigate:reports','navigate:settings']}).map(row=>row.id);
    expect(recentEmpty.slice(0,2)).toEqual(['navigate:reports','navigate:settings']);
    const filtered=searchCommandItems(data,'ρυθμισεις',{recentIds:['navigate:reports']}).map(row=>row.id);
    expect(filtered).toContain('navigate:settings');
    expect(filtered).not.toContain('navigate:reports');
  });
});