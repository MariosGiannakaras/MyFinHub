import { describe, expect, it } from 'vitest';
import { qaFinanceData } from '../src/qaFixture.js';
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

  it('keeps the empty-query surface command-first while allowing recent entities without leaking amounts',()=>{
    const data=clone();
    data.state.events=[...(data.state.events??[]),{id:'evt-search',date:'2026-08-17',kind:'expense',amount:987654.32,note:'QA Market Search',category:'Τρόφιμα',accountId:'piraeus-payroll',legs:[{accountId:'piraeus-payroll',amount:-987654.32}],source:'user',createdAt:stamp,updatedAt:stamp}];
    expect(searchCommandItems(data,'')[0]?.id).toBe('command:quick-expense');
    const recent=searchCommandItems(data,'',{recentIds:['event:evt-search']});
    expect(recent.some(row=>row.id==='event:evt-search')).toBe(true);
    expect(JSON.stringify(recent)).not.toContain('987654.32');
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

  it('uses stable ranking across repeated calls and gives recent results a bounded boost',()=>{
    const data=clone();
    const baseline=searchCommandItems(data,'ρυθμισεις').map(row=>row.id);
    expect(searchCommandItems(data,'ρυθμισεις').map(row=>row.id)).toEqual(baseline);
    const recent=searchCommandItems(data,'',{recentIds:['navigate:reports','navigate:settings']}).map(row=>row.id);
    expect(recent.indexOf('navigate:settings')).toBeLessThan(recent.indexOf('navigate:dashboard'));
    expect(recent[0]).toBe('command:quick-expense');
  });
});