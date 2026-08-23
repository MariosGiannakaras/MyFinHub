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

const asArray=<T>(value:unknown):T[]=>Array.isArray(value)?value as T[]:[];
const cleanString=(value:unknown)=>typeof value==='string'?value.trim():'';
const cleanDate=(value:unknown)=>{const date=cleanString(value);return /^\d{4}-\d{2}-\d{2}$/.test(date)?date:''};
const finiteNumber=(value:unknown)=>{const number=Number(value);return Number.isFinite(number)?number:0};

export function lendingRows(data: FinanceData): LendingRow[] {
  const people = new Map<string, LendingRow>();
  for (const legacy of asArray<Record<string,unknown>>(data.seed.lending)) {
    const person=cleanString(legacy.person);
    if(!person)continue;
    const entries=asArray<unknown>(legacy.entries);
    const row = people.get(person) ?? { person, outstanding: 0, events: 0 };
    row.outstanding += finiteNumber(legacy.outstanding);
    row.events += entries.length;
    people.set(person, row);
  }
  for (const event of asArray<Record<string,unknown>>(data.state.events)) {
    const person=cleanString(event.person);
    const receivableDelta=finiteNumber(event.receivableDelta);
    if (!person || receivableDelta===0) continue;
    const row = people.get(person) ?? { person, outstanding: 0, events: 0 };
    row.outstanding += receivableDelta;
    row.events += 1;
    people.set(person, row);
  }
  return [...people.values()].sort((a, b) => b.outstanding - a.outstanding || a.person.localeCompare(b.person,'el'));
}

export function lendingHistory(data:FinanceData):LendingHistoryRow[]{
  const raw:Array<Omit<LendingHistoryRow,'runningOutstanding'>>=[];
  for(const legacy of asArray<Record<string,unknown>>(data.seed.lending)){
    const person=cleanString(legacy.person);
    if(!person)continue;
    for(const [index,entry] of asArray<Record<string,unknown>>(legacy.entries).entries()){
      const date=cleanDate(entry.date);
      if(!date)continue;
      const lent=finiteNumber(entry.lent);
      const repaid=finiteNumber(entry.repaid);
      const haircut=finiteNumber(entry.haircut);
      if(lent>0)raw.push({id:`legacy-${person}-${date}-${index}-lent`,person,date,action:'lent',amount:lent,note:'Ιστορικό δανεικών',origin:'legacy'});
      if(repaid>0)raw.push({id:`legacy-${person}-${date}-${index}-repaid`,person,date,action:'repaid',amount:repaid,note:'Ιστορικό επιστροφής',origin:'legacy'});
      if(haircut>0)raw.push({id:`legacy-${person}-${date}-${index}-forgiven`,person,date,action:'forgiven',amount:haircut,note:'Χάρισμα / διαγραφή οφειλής',origin:'legacy'});
    }
  }
  for(const event of asArray<Record<string,unknown>>(data.state.events)){
    const person=cleanString(event.person);
    const date=cleanDate(event.date);
    const amount=finiteNumber(event.amount);
    const kind=cleanString(event.kind);
    if(!person||!date||amount<=0)continue;
    const id=cleanString(event.id)||`event-${person}-${date}-${raw.length}`;
    const note=cleanString(event.note)||(kind==='repayment'?'Επιστροφή δανεικών':'Πλήρωσα για άλλον');
    const accountId=cleanString(event.accountId)||cleanString(kind==='repayment'?event.toAccountId:event.fromAccountId)||undefined;
    if(kind==='lending')raw.push({id,person,date,action:'lent',amount,note,accountId,origin:'event'});
    if(kind==='repayment')raw.push({id,person,date,action:'repaid',amount,note,accountId,origin:'event'});
  }
  const running=new Map<string,number>();
  const chronological=[...raw].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const withRunning=chronological.map(row=>{const current=running.get(row.person)??0;const next=row.action==='lent'?current+row.amount:Math.max(0,current-row.amount);running.set(row.person,next);return {...row,runningOutstanding:next}});
  return withRunning.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}

export function lendingOutstandingFor(data:FinanceData,person:string){const target=cleanString(person);return target?lendingRows(data).find(row=>row.person===target)?.outstanding??0:0}
