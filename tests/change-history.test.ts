import { describe, expect, it } from 'vitest';
import { describeFinanceChange } from '../src/lib/changeHistory';
import { qaFinanceData } from '../src/qaFixture';
import type { FinanceData, FinanceEvent, PaymentCard } from '../src/types';

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

  it('shows safe previous → new values for event edits and hides changed notes',()=>{
    const before=qaFinanceData();before.state.events=[...(before.state.events??[]),event()];const after=clone(before);after.state.events=after.state.events!.map(row=>row.id==='history-event'?{...row,amount:21.5,date:'2026-08-22',note:'SECOND SECRET NOTE',legs:[{accountId:'piraeus-payroll',amount:-21.5}]}:row);
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
});
