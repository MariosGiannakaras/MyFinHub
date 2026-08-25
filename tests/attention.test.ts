import { describe, expect, it } from 'vitest';
import { qaFinanceData } from '../src/qaFixture.js';
import { allAttentionItems, attentionDismissDecision, attentionSnoozeDecision, visibleAttentionItems } from '../src/lib/attention.js';
import { createEvent } from '../src/lib/domain.js';
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
