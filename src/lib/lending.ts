import type { FinanceData } from '../types.js';

export interface LendingRow {
  person: string;
  outstanding: number;
  events: number;
}

export type LendingAction='lent'|'repaid'|'forgiven';
export interface LendingHistoryRow {
  id:string;
  person:string;
  date:string;
  action:LendingAction;
  amount:number;
  note:string;
  accountId?:string;
  origin:'legacy'|'event';
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
    if (!event.person || !event.receivableDelta) continue;
    const row = people.get(event.person) ?? { person: event.person, outstanding: 0, events: 0 };
    row.outstanding += event.receivableDelta;
    row.events += 1;
    people.set(event.person, row);
  }
  return [...people.values()].sort((a, b) => b.outstanding - a.outstanding || a.person.localeCompare(b.person,'el'));
}

export function lendingHistory(data:FinanceData):LendingHistoryRow[]{
  const raw:Array<Omit<LendingHistoryRow,'runningOutstanding'>>=[];
  for(const legacy of data.seed.lending??[]){
    for(const [index,entry] of (legacy.entries??[]).entries()){
      if(Number(entry.lent)>0)raw.push({id:`legacy-${legacy.person}-${entry.date}-${index}-lent`,person:legacy.person,date:entry.date,action:'lent',amount:Number(entry.lent),note:'Ιστορικό δανεικών',origin:'legacy'});
      if(Number(entry.repaid)>0)raw.push({id:`legacy-${legacy.person}-${entry.date}-${index}-repaid`,person:legacy.person,date:entry.date,action:'repaid',amount:Number(entry.repaid),note:'Ιστορικό επιστροφής',origin:'legacy'});
      if(Number(entry.haircut)>0)raw.push({id:`legacy-${legacy.person}-${entry.date}-${index}-forgiven`,person:legacy.person,date:entry.date,action:'forgiven',amount:Number(entry.haircut),note:'Χάρισμα / διαγραφή οφειλής',origin:'legacy'});
    }
  }
  for(const event of data.state.events??[]){
    if(!event.person)continue;
    if(event.kind==='lending')raw.push({id:event.id,person:event.person,date:event.date,action:'lent',amount:event.amount,note:event.note,accountId:event.accountId??event.fromAccountId,origin:'event'});
    if(event.kind==='repayment')raw.push({id:event.id,person:event.person,date:event.date,action:'repaid',amount:event.amount,note:event.note,accountId:event.accountId??event.toAccountId,origin:'event'});
  }
  const running=new Map<string,number>();
  const chronological=[...raw].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const withRunning=chronological.map(row=>{const current=running.get(row.person)??0;const next=row.action==='lent'?current+row.amount:Math.max(0,current-row.amount);running.set(row.person,next);return {...row,runningOutstanding:next}});
  return withRunning.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}

export function lendingOutstandingFor(data:FinanceData,person:string){return lendingRows(data).find(row=>row.person===person)?.outstanding??0}
