import type { FinanceData, PersonAction, SettlementMethod } from '../types.js';
import { personBalanceDelta } from './personSettlements.js';

export interface LendingRow {
  person: string;
  outstanding: number;
  events: number;
}

export type LendingAction='lent'|'repaid'|'forgiven'|'paid_by_other'|'shared_purchase'|'settlement_sent'|'settlement_received';
export interface LendingHistoryRow {
  id:string;
  person:string;
  date:string;
  action:LendingAction;
  amount:number;
  note:string;
  accountId?:string;
  settlementMethod?:SettlementMethod;
  origin:'legacy'|'event';
  balanceDelta:number;
  runningOutstanding:number;
}

export function lendingRows(data: FinanceData): LendingRow[] {
  const people = new Map<string, LendingRow>();
  for (const legacy of data.seed.lending ?? []) {
    const row = people.get(legacy.person) ?? { person: legacy.person, outstanding: 0, events: 0 };
    row.outstanding += Number(legacy.outstanding || 0);
    row.events += legacy.entries?.length || 0;
    people.set(legacy.person, row);
  }
  for (const event of data.state.events ?? []) {
    const delta=personBalanceDelta(event);
    if (!event.person || Math.abs(delta)<.000001) continue;
    const row = people.get(event.person) ?? { person: event.person, outstanding: 0, events: 0 };
    row.outstanding += delta;
    row.events += 1;
    people.set(event.person, row);
  }
  return [...people.values()].sort((a, b) => Math.abs(b.outstanding)-Math.abs(a.outstanding) || a.person.localeCompare(b.person,'el'));
}

function actionFor(personAction:PersonAction|undefined,kind:string):LendingAction|null{
  if(personAction==='paid_for_other')return 'lent';
  if(personAction==='paid_by_other')return 'paid_by_other';
  if(personAction==='shared_purchase')return 'shared_purchase';
  if(personAction==='settlement_received')return 'settlement_received';
  if(personAction==='settlement_sent')return 'settlement_sent';
  if(personAction==='forgiven')return 'forgiven';
  if(kind==='lending')return 'lent';
  if(kind==='repayment')return 'repaid';
  return null;
}

export function lendingHistory(data:FinanceData):LendingHistoryRow[]{
  const raw:Array<Omit<LendingHistoryRow,'runningOutstanding'>>=[];
  for(const legacy of data.seed.lending??[]){
    for(const [index,entry] of (legacy.entries??[]).entries()){
      if(Number(entry.lent)>0)raw.push({id:`legacy-${legacy.person}-${entry.date}-${index}-lent`,person:legacy.person,date:entry.date,action:'lent',amount:Number(entry.lent),note:'Ιστορικό δανεικών',origin:'legacy',balanceDelta:Number(entry.lent)});
      if(Number(entry.repaid)>0)raw.push({id:`legacy-${legacy.person}-${entry.date}-${index}-repaid`,person:legacy.person,date:entry.date,action:'repaid',amount:Number(entry.repaid),note:'Ιστορικό επιστροφής',origin:'legacy',balanceDelta:-Number(entry.repaid)});
      if(Number(entry.haircut)>0)raw.push({id:`legacy-${legacy.person}-${entry.date}-${index}-forgiven`,person:legacy.person,date:entry.date,action:'forgiven',amount:Number(entry.haircut),note:'Χάρισμα / διαγραφή οφειλής',origin:'legacy',balanceDelta:-Number(entry.haircut)});
    }
  }
  for(const event of data.state.events??[]){
    if(!event.person)continue;
    const delta=personBalanceDelta(event);
    if(Math.abs(delta)<.000001)continue;
    const action=actionFor(event.personAction,event.kind);if(!action)continue;
    raw.push({id:event.id,person:event.person,date:event.date,action,amount:event.personAction==='shared_purchase'?Math.abs(delta):event.amount,note:event.note,accountId:event.accountId??event.fromAccountId??event.toAccountId??event.legs[0]?.accountId,settlementMethod:event.settlementMethod,origin:'event',balanceDelta:delta});
  }
  const running=new Map<string,number>();
  const chronological=[...raw].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const withRunning=chronological.map(row=>{const next=Number(((running.get(row.person)??0)+row.balanceDelta).toFixed(2));running.set(row.person,next);return {...row,runningOutstanding:next}});
  return withRunning.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}

export function lendingOutstandingFor(data:FinanceData,person:string){return lendingRows(data).find(row=>row.person===person)?.outstanding??0}

export function personBalanceLabel(balance:number){
  if(balance>.009)return 'Μου χρωστά';
  if(balance<-.009)return 'Χρωστάω';
  return 'Τακτοποιημένο';
}
