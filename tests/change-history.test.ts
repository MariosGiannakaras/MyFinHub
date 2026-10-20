import { describe, expect, it } from 'vitest';
import { describeFinanceChange } from '../src/lib/changeHistory.js';
import { withLegacyOverride, withLegacyTombstone } from '../src/lib/legacyTransactions.js';
import { qaFinanceData } from '../src/qaFixture.js';
import type { FinanceData, FinanceEvent, PaymentCard } from '../src/types.js';

const clone=(data:FinanceData)=>structuredClone(data);
const stamp='2026-08-21T12:00:00.000Z';

function event(id='history-event'):FinanceEvent{return {id,date:'2026-08-21',kind:'expense',amount:12.34,note:'PRIVATE NOTE MUST NEVER APPEAR',category:'Σταθερά έξοδα',accountId:'piraeus-payroll',legs:[{accountId:'piraeus-payroll',amount:-12.34}],source:'user',createdAt:stamp,updatedAt:stamp}}

describe('privacy-safe user change descriptions',()=>{
  it('describes additions without retaining transaction free-text',()=>{
    const before=qaFinanceData();const after=clone(before);after.state.events=[...(after.state.events??[]),event()];
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Νέα οικονομική κίνηση');
    expect(label).toContain('12,34');
    expect(label).not.toContain('PRIVATE NOTE');
  });

  it('keeps first-add, first-delete and first-edit history precedence with many event ids',()=>{
    const before=qaFinanceData();
    const left=Array.from({length:1500},(_,index)=>event(`bulk-${index}`));
    before.state.events=left;
    const inserted=event('bulk-new');
    const added={...before,state:{...before.state,events:[...left,inserted]}};
    expect(describeFinanceChange(before,added)).toContain('Νέα οικονομική κίνηση');
    const removed={...before,state:{...before.state,events:left.slice(1)}};
    expect(describeFinanceChange(before,removed)).toContain('Διαγραφή οικονομικής κίνησης');
    const changed={...before,state:{...before.state,events:left.map((row,index)=>index===1499?{...row,amount:21.5,note:'DO NOT REVEAL SECRET'}:row)}};
    const label=describeFinanceChange(before,changed);
    expect(label).toContain('Επεξεργασία οικονομικής κίνησης');
    expect(label).not.toContain('DO NOT REVEAL');
  });

  it('bounds change-label id lookups linearly on 1500+ events',()=>{
    const before=qaFinanceData();
    let idReads=0;
    before.state.events=Array.from({length:1500},(_,index)=>{
      const row=event(`bulk-${index}`);
      Object.defineProperty(row,'id',{enumerable:true,configurable:true,get(){idReads++;return `bulk-${index}`;}});
      return row;
    });
    const after={...before,state:{...before.state,events:[...before.state.events,event('bulk-1500')]}};
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Νέα οικονομική κίνηση');
    expect(label).not.toContain('PRIVATE NOTE');
    // Quadratic find/some traversals exceed two million lookups on 1500 rows.
    // The indexed algorithm uses linear scans while preserving safe labels.
    expect(idReads).toBeLessThan(12000);
  });

  it('shows safe previous → new values for event edits and hides changed notes',()=>{
    const before=qaFinanceData();before.state.events=[...(before.state.events??[]),event()];const after=clone(before);after.state.events=after.state.events!.map((row:FinanceEvent)=>row.id==='history-event'?{...row,amount:21.5,date:'2026-08-22',note:'SECOND SECRET NOTE',legs:[{accountId:'piraeus-payroll',amount:-21.5}]}:row);
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Επεξεργασία οικονομικής κίνησης');
    expect(label).toContain('12,34');expect(label).toContain('21,50');
    expect(label).toContain('21/08/2026');expect(label).toContain('22/08/2026');
    expect(label).not.toContain('SECRET');expect(label).not.toContain('PRIVATE NOTE');
  });

  it('describes transfers without exposing arbitrary notes',()=>{
    const before=qaFinanceData();const after=clone(before);const transfer=event('transfer');transfer.kind='transfer';transfer.amount=50;transfer.note='PRIVATE TRANSFER MEMO';transfer.accountId=undefined;transfer.fromAccountId='piraeus-payroll';transfer.toAccountId='piraeus-savings';transfer.legs=[{accountId:'piraeus-payroll',amount:-50},{accountId:'piraeus-savings',amount:50}];after.state.events=[...(after.state.events??[]),transfer];
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Μεταφορά');expect(label).toContain('Τραπεζικός λογαριασμός');expect(label).toContain('Αποταμίευση');expect(label).not.toContain('PRIVATE TRANSFER');
  });

  it('describes legacy overrides without retaining imported free-text',()=>{
    const before=qaFinanceData();const original=before.seed.transactions[0]!;const after=withLegacyOverride(before,{...original,amount:99.5,date:'2026-08-20',note:'PRIVATE IMPORTED NOTE'});
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Επεξεργασία ιστορικής κίνησης');
    expect(label).toContain('99,50');
    expect(label).toContain('20/08/2026');
    expect(label).not.toContain('PRIVATE IMPORTED NOTE');
    expect(label).not.toContain(original.note);
  });

  it('describes legacy tombstones without exposing imported notes',()=>{
    const before=qaFinanceData();const original=before.seed.transactions[0]!;original.note='PRIVATE LEGACY DELETE NOTE';const after=withLegacyTombstone(before,original.id);
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Διαγραφή ιστορικής κίνησης');
    expect(label).toContain('24,50');
    expect(label).not.toContain('PRIVATE LEGACY DELETE NOTE');
  });

  it('never exposes card nickname, holder, last4 or vault references',()=>{
    const before=qaFinanceData();const after=clone(before);const card:PaymentCard={id:'safe-card',bankId:'bank-private',nickname:'PRIVATE CARD NICKNAME',kind:'credit',network:'visa',formFactor:'physical',holderName:'PRIVATE HOLDER',last4:'4242',vaultRef:'vault-secret-ref',creditLimit:900,active:true,createdAt:stamp,updatedAt:stamp};after.state.cards=[...(after.state.cards??[]),card];
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Νέα κάρτα');expect(label).toContain('900');
    for(const secret of ['PRIVATE CARD NICKNAME','PRIVATE HOLDER','4242','vault-secret-ref','bank-private'])expect(label).not.toContain(secret);
  });

  it('summarizes settings and private account-name edits without retaining the entered name',()=>{
    const before=qaFinanceData();const after=clone(before);after.state.settings.accountNames={...after.state.settings.accountNames,'piraeus-payroll':'PRIVATE ACCOUNT LABEL'};
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Ονόματα λογαριασμών ενημερώθηκαν');expect(label).not.toContain('PRIVATE ACCOUNT LABEL');
  });

  it('keeps recurring and loan names out of history while exposing safe numeric changes',()=>{
    const recurringBefore=qaFinanceData();const recurringAfter=clone(recurringBefore);const recurringSeed=recurringAfter.seed.recurring[0]!;const recurring={...recurringSeed,name:'PRIVATE RECURRING NAME',amount:recurringSeed.amount+5};recurringAfter.state.recurringOverrides={...recurringAfter.state.recurringOverrides,[recurring.id]:recurring};
    const recurringLabel=describeFinanceChange(recurringBefore,recurringAfter);expect(recurringLabel).toContain('Αλλαγή πάγιας κίνησης');expect(recurringLabel).not.toContain('PRIVATE RECURRING NAME');
    const loanBefore=qaFinanceData();const loanAfter=clone(loanBefore);const loanSeed=loanAfter.seed.loans[0]!;const loan={...loanSeed,name:'PRIVATE LOAN NAME',installment:loanSeed.installment+10};loanAfter.state.loanOverrides={...loanAfter.state.loanOverrides,[loan.id]:loan};
    const loanLabel=describeFinanceChange(loanBefore,loanAfter);expect(loanLabel).toContain('Αλλαγή');expect(loanLabel).toContain('Δόση');expect(loanLabel).not.toContain('PRIVATE LOAN NAME');
  });
  it('does not persist owner-defined categories in event and legacy history labels',()=>{
    const privateCategory='PRIVATE CATEGORY 3591';
    const before=qaFinanceData();
    const original=event('category-privacy-event');
    original.category='PRIVATE PREVIOUS CATEGORY';
    before.state.events=[...(before.state.events??[]),original];
    const after=clone(before);
    after.state.events=after.state.events!.map(row=>row.id===original.id?{...row,category:privateCategory}:row);
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Κατηγορία ενημερώθηκε');
    expect(label).not.toContain(privateCategory);
    expect(label).not.toContain('PRIVATE PREVIOUS CATEGORY');

    const legacyBefore=qaFinanceData();
    const legacy=legacyBefore.seed.transactions[0]!;
    const legacyLabel=describeFinanceChange(legacyBefore,withLegacyOverride(legacyBefore,{...legacy,category:privateCategory}));
    expect(legacyLabel).toContain('Κατηγορία ενημερώθηκε');
    expect(legacyLabel).not.toContain(privateCategory);
  });

  it('redacts free-form category changes in scheduled and recurring entries',()=>{
    const privateCategory='PRIVATE HEALTH CATEGORY 6382';
    const scheduledBefore=qaFinanceData();
    const scheduledAfter=clone(scheduledBefore);
    const item=scheduledAfter.state.scheduled![0]!;
    scheduledAfter.state.scheduled=scheduledAfter.state.scheduled!.map(row=>row.id===item.id?{...row,category:privateCategory}:row);
    const scheduledLabel=describeFinanceChange(scheduledBefore,scheduledAfter);
    expect(scheduledLabel).toContain('Κατηγορία ενημερώθηκε');
    expect(scheduledLabel).not.toContain(privateCategory);

    const recurringBefore=qaFinanceData();
    const recurringAfter=clone(recurringBefore);
    const subscription=recurringAfter.state.recurringCustom[0]!;
    recurringAfter.state.recurringCustom=recurringAfter.state.recurringCustom.map(row=>row.id===subscription.id?{...row,category:privateCategory}:row);
    const recurringLabel=describeFinanceChange(recurringBefore,recurringAfter);
    expect(recurringLabel).toContain('Κατηγορία ενημερώθηκε');
    expect(recurringLabel).not.toContain(privateCategory);
  });

  it('retains budget scope and amounts without persisting user-defined category names',()=>{
    const privateCategory='PRIVATE BUDGET CATEGORY 7131';
    const before=qaFinanceData();
    before.state.budgets=[];
    const after=clone(before);
    const budget={id:'private-budget',month:'2026-08',scope:'category' as const,category:privateCategory,amount:123.45,createdAt:stamp,updatedAt:stamp};
    after.state.budgets=[budget];
    const created=describeFinanceChange(before,after);
    expect(created).toContain('budget κατηγορίας');
    expect(created).toContain('123,45');
    expect(created).not.toContain(privateCategory);

    const changed=clone(after);
    changed.state.budgets=[{...budget,category:'PRIVATE NEXT CATEGORY',amount:200}];
    const updated=describeFinanceChange(after,changed);
    expect(updated).toContain('200,00');
    expect(updated).not.toContain(privateCategory);
    expect(updated).not.toContain('PRIVATE NEXT CATEGORY');
  });

  it('does not persist owner-defined rule action category or subcategory',()=>{
    const before=qaFinanceData();
    const existing={
      id:'privacy-rule',name:'PRIVATE RULE TITLE',enabled:true,priority:1,scopes:['manual' as const],
      match:{description:'PRIVATE MATCH'},action:{category:'PRIVATE RULE CATEGORY',subcategory:'PRIVATE RULE SUBCATEGORY'},
      createdAt:stamp,updatedAt:stamp,
    };
    before.state.transactionRules=[existing];
    const after=clone(before);
    after.state.transactionRules=[{...existing,action:{category:'PRIVATE REPLACEMENT CATEGORY',subcategory:'PRIVATE REPLACEMENT SUBCATEGORY'}}];
    const label=describeFinanceChange(before,after);
    expect(label).toContain('Κατηγορία ενημερώθηκε');
    expect(label).toContain('Υποκατηγορία ενημερώθηκε');
    for(const secret of ['PRIVATE RULE TITLE','PRIVATE MATCH','PRIVATE RULE CATEGORY','PRIVATE RULE SUBCATEGORY','PRIVATE REPLACEMENT CATEGORY','PRIVATE REPLACEMENT SUBCATEGORY'])expect(label).not.toContain(secret);
  });

});
