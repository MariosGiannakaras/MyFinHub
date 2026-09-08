import { describe, expect, it } from 'vitest';
import { qaFinanceData } from '../src/qaFixture.js';
import { allAttentionItems, attentionDismissDecision, attentionSnoozeDecision, visibleAttentionItems } from '../src/lib/attention.js';
import { accountBalances, createEvent } from '../src/lib/domain.js';
import { migrateProductData } from '../src/lib/productMigration.js';

const clone=()=>structuredClone(qaFinanceData());

describe('Needs Attention deterministic engine',()=>{
  it('surfaces due/upcoming obligations with stable source identities',()=>{
    const items=allAttentionItems(clone(),'2026-08-17');
    expect(items.some(item=>item.id==='recurring:rec-1'&&item.severity==='danger'&&item.recurringId==='rec-1')).toBe(true);
    expect(items.some(item=>item.id==='recurring:rec-2'&&item.severity==='warning')).toBe(true);
    expect(items.some(item=>item.id==='loan:loan-long'&&item.severity==='danger'&&item.loanId==='loan-long')).toBe(true);
    expect(items.some(item=>item.id==='scheduled:qa-scheduled-transfer'&&item.scheduledId==='qa-scheduled-transfer')).toBe(true);
  });

  it('uses statement due data and carries the exact statement payment target',()=>{
    const upcoming=allAttentionItems(clone(),'2026-08-17').find(row=>row.id==='credit-statement:qa-card:2026-08-12');
    expect(upcoming?.cardId).toBe('qa-card');
    expect(upcoming?.statementId).toBe('qa-card:2026-08-12');
    expect(upcoming?.dueDate).toBe('2026-08-20');
    expect(upcoming?.amount).toBe(90);
    expect(upcoming?.severity).toBe('info');
    const due=allAttentionItems(clone(),'2026-08-20').find(row=>row.id==='credit-statement:qa-card:2026-08-12');
    expect(due?.severity).toBe('danger');
  });

  it('keeps exact card utilization fallback when there is no payable persisted statement',()=>{
    const data=clone();data.state.creditStatements=[];data.state.events=(data.state.events??[]).map(event=>({...event,statementId:undefined}));data.state.cards=(data.state.cards??[]).map(card=>card.id==='qa-card'?{...card,creditLimit:100}:card);
    const item=allAttentionItems(data,'2026-08-17').find(row=>row.id==='credit:qa-card');
    expect(item?.severity).toBe('danger');expect(item?.cardId).toBe('qa-card');expect(item?.reason).toContain('135%');
  });

  it('only marks lending overdue when an explicit expected return date exists and deduplicates by person',()=>{
    const data=clone();
    const first=createEvent({kind:'lending',date:'2026-08-01',amount:20,note:'QA loan',accountId:'piraeus-payroll',person:'Μαρία',expectedReturnDate:'2026-08-10'});
    const second=createEvent({kind:'lending',date:'2026-08-02',amount:10,note:'QA loan 2',accountId:'piraeus-payroll',person:'Μαρία',expectedReturnDate:'2026-08-12'});
    const noDue=createEvent({kind:'lending',date:'2026-08-01',amount:15,note:'No due',accountId:'piraeus-payroll',person:'Άννα'});
    data.state.events=[...(data.state.events??[]),first,second,noDue];
    const lending=allAttentionItems(data,'2026-08-17').filter(item=>item.kind==='lending');
    expect(lending.filter(item=>item.person==='Μαρία')).toHaveLength(1);expect(lending.some(item=>item.person==='Άννα')).toBe(false);
  });

  it('restores concept-backed low balance, categorization, duplicate review and recurring expiry signals from real data',()=>{
    const data=clone();
    data.seed.snapshots=[{date:'2026-08-17',balances:{'piraeus-payroll':48.2,'piraeus-savings':2875,cash:235,'alpha-main':2008.28,'revolut-main':810.2,'national-main':100,'eurobank-main':1450,'viva-main':510,'payzy-main':280,'emergency-savings':950,'holiday-savings':575}}];
    data.state.customTransactions=[
      {id:'qa-uncategorized',date:'2026-08-17',type:'expense',accountId:'piraeus-payroll',amount:18.9,note:'Χωρίς κατηγορία',category:'Άλλο'},
      {id:'qa-duplicate-a',date:'2026-08-17',type:'expense',accountId:'alpha-main',amount:12.34,note:'QA Duplicate Merchant',category:'Αγορές'},
      {id:'qa-duplicate-b',date:'2026-08-17',type:'expense',accountId:'alpha-main',amount:12.34,note:'QA Duplicate Merchant',category:'Αγορές'},
    ];
    data.state.recurringCustom=(data.state.recurringCustom??[]).map(item=>item.id==='rec-2'?Object.assign(item,{endDate:'2026-08-22'}):item);
    const currentPayrollBalance=accountBalances(data,'2026-08-17')['piraeus-payroll'];
    const items=allAttentionItems(data,'2026-08-17');
    expect(items).toContainEqual(expect.objectContaining({id:'current-balance:piraeus-payroll',kind:'account_balance',severity:'danger',action:'open_dashboard',amount:currentPayrollBalance}));
    expect(items).toContainEqual(expect.objectContaining({id:'uncategorized:legacy:qa-uncategorized',kind:'transaction',action:'categorize_transaction',transactionId:'qa-uncategorized',transactionSource:'legacy'}));
    expect(items.some(item=>item.kind==='duplicate'&&item.action==='review_duplicate'&&item.title.includes('QA Duplicate Merchant'))).toBe(true);
    expect(items).toContainEqual(expect.objectContaining({id:'recurring-expiry:rec-2',kind:'recurring_expiry',severity:'warning',action:'open_recurring',dueDate:'2026-08-22'}));
    expect(items.some(item=>item.title.toLocaleLowerCase('el-GR').includes('συγχρονισ'))).toBe(false);
  });

  it('snoozes danger temporarily but does not allow permanent dismissal',()=>{
    const item=allAttentionItems(clone(),'2026-08-17').find(row=>row.severity==='danger')!;
    expect(attentionSnoozeDecision(item,'2026-08-17').snoozedUntil).toBe('2026-08-18');
    expect(()=>attentionDismissDecision(item)).toThrow(/δεν μπορεί να κρυφτεί μόνιμα/);
  });

  it('dismisses non-danger only while its fingerprint remains unchanged',()=>{
    const data=clone();const item=allAttentionItems(data,'2026-08-17').find(row=>row.severity==='warning')!;
    data.state.attentionDecisions={[item.id]:attentionDismissDecision(item)};
    expect(visibleAttentionItems(data,'2026-08-17').some(row=>row.id===item.id)).toBe(false);
    const changed=structuredClone(data);const scheduled=changed.state.scheduled?.find(row=>`scheduled:${row.id}`===item.id);if(scheduled)scheduled.amount+=1;
    if(scheduled)expect(visibleAttentionItems(changed,'2026-08-17').some(row=>row.id===item.id)).toBe(true);
  });

  it('preserves attention decisions through migration and defaults legacy state safely',()=>{
    const data=clone();
    const item=allAttentionItems(data,'2026-08-17').find(row=>row.severity==='warning')!;
    data.state.attentionDecisions={[item.id]:attentionDismissDecision(item)};
    expect(migrateProductData(data).state.attentionDecisions?.[item.id]).toEqual(data.state.attentionDecisions[item.id]);
    const legacy=clone();delete legacy.state.attentionDecisions;
    expect(migrateProductData(legacy).state.attentionDecisions).toEqual({});
  });
});
