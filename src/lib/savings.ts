import { effectiveLegacyTransactions, flowImpactLegacy, monthlyFlow, reviewDecision } from './domain.js';
import type { FinanceData, FinanceEvent, LegacyTransaction, SavingSource } from '../types.js';

export type SavingsHistoryRow = {
  id:string;
  date:string;
  amount:number;
  source:SavingSource;
  note:string;
  fromAccountId?:string;
  toAccountId?:string;
  origin:'legacy'|'event';
};

const payAndSavePattern=/\bpay\s*&?\s*save\b/i;

export function isLegacyPayAndSave(tx:LegacyTransaction){
  return payAndSavePattern.test(`${tx.note||''} ${tx.category||''}`);
}

export function savingSourceForEvent(event:FinanceEvent):SavingSource{
  if(event.savingSource)return event.savingSource;
  if(payAndSavePattern.test(event.note||''))return 'pay_and_save';
  if(/μεταφορ/i.test(event.note||''))return 'manual_transfer';
  return 'cash_offset';
}

export function savingsHistory(data:FinanceData,month?:string):SavingsHistoryRow[]{
  const prefix=month?`${month}-`:'';
  const legacy=effectiveLegacyTransactions(data).filter(tx=>(!month||tx.date.startsWith(prefix))&&isLegacyPayAndSave(tx)).map(tx=>({id:tx.id,date:tx.date,amount:tx.amount,source:'pay_and_save' as const,note:tx.note||'Pay & Save',fromAccountId:tx.fromAccountId,toAccountId:tx.toAccountId,origin:'legacy' as const}));
  const events=(data.state.events??[]).filter(event=>event.kind==='saving_cash_offset'&&(!month||event.date.startsWith(prefix))).map(event=>({id:event.id,date:event.date,amount:event.savingAmount??event.amount,source:savingSourceForEvent(event),note:event.note,fromAccountId:event.fromAccountId,toAccountId:event.toAccountId,origin:'event' as const}));
  return [...legacy,...events].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}

export function savingsBreakdown(data:FinanceData,month:string){
  const rows=savingsHistory(data,month);
  const bySource:Record<SavingSource,number>={pay_and_save:0,manual_transfer:0,cash_offset:0};
  for(const row of rows)bySource[row.source]+=row.amount;
  return {rows,bySource,total:Object.values(bySource).reduce((sum,value)=>sum+value,0)};
}

export function operationalMonthlyFlow(data:FinanceData,month:string){
  const base=monthlyFlow(data,month);
  let income=base.income,expense=base.expense,saving=base.saving,refunds=base.refunds;
  for(const tx of effectiveLegacyTransactions(data)){
    if(!tx.date.startsWith(`${month}-`)||!isLegacyPayAndSave(tx))continue;
    const decision=reviewDecision(data,tx.id);
    if(decision?.status==='confirmed'&&decision.semanticKind==='saving_cash_offset')continue;
    const original=flowImpactLegacy(data,tx);
    income-=original.income;
    expense-=original.expense;
    saving+=tx.amount;
  }
  return {income:Math.max(0,income),expense:Math.max(0,expense),saving,refunds,net:income-expense};
}

export const SAVING_SOURCE_LABELS:Record<SavingSource,string>={
  pay_and_save:'Pay & Save',
  manual_transfer:'Μεταφορά στην αποταμίευση',
  cash_offset:'Σύνθετη αποταμίευση με μετρητά',
};
