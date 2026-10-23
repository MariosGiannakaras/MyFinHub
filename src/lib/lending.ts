import type { FinanceData } from '../types.js';
import { isValidDateOnly } from './dateOnly.js';
import { centsToMoney, moneyToCents } from './money.js';

interface LendingRow {
  person: string;
  outstanding: number;
  events: number;
}

type LendingAction='lent'|'repaid'|'forgiven';
interface LendingHistoryRow {
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

type LegacyLendingSnapshot={outstanding:number;events:number;reconstructed:boolean};

/** Reconstruct a legacy receivable as-of only when the original entries form
 * a complete, valid cent-exact history matching the imported final balance.
 * Incomplete workbooks keep their original documented snapshot, never an
 * invented historic balance or a destructive correction. */
export function legacyLendingSnapshot(
  legacy:unknown,asOf?:string
):LegacyLendingSnapshot{
  const record:{outstanding?:unknown;entries?:unknown}=legacy&&typeof legacy==='object'
    ?legacy as {outstanding?:unknown;entries?:unknown}:{};
  const fallback=finiteNumber(record.outstanding);
  const entries=asArray<Record<string,unknown>>(record.entries);
  const preserved={outstanding:fallback,events:entries.length,reconstructed:false};
  if(!asOf||!isValidDateOnly(asOf)||entries.length===0)return preserved;
  const parsed:Array<{date:string;delta:number}>=[];
  for(const entry of entries){
    const date=cleanDate(entry.date);
    if(!isValidDateOnly(date))return preserved;
    let delta=0;
    for(const [kind,sign] of [['lent',1],['repaid',-1],['haircut',-1]] as const){
      const value=entry[kind];
      if(value===null||value===undefined)continue;
      if(typeof value!=='number'&&typeof value!=='string')return preserved;
      if(typeof value==='string'&&!value.trim())return preserved;
      const numeric=Number(value),amount=Math.round(numeric*100);
      if(!Number.isFinite(numeric)||numeric<0||!Number.isSafeInteger(amount)||
        Math.abs(numeric*100-amount)>1e-6)return preserved;
      delta+=sign*amount;
    }
    if(!Number.isSafeInteger(delta))return preserved;
    parsed.push({date,delta});
  }
  const expected=moneyToCents(fallback);
  if(!Number.isSafeInteger(expected)||expected<0||Math.abs(fallback*100-expected)>1e-6)return preserved;
  const sorted=parsed.sort((a,b)=>a.date.localeCompare(b.date));
  let running=0,at=0,count=0;
  for(const row of sorted){
    running+=row.delta;
    if(!Number.isSafeInteger(running)||running<0)return preserved;
    if(row.date<=asOf){at=running;count+=1}
  }
  if(running!==expected)return preserved;
  return {outstanding:centsToMoney(at),events:count,reconstructed:true};
}

export function lendingRows(data: FinanceData,asOf?:string): LendingRow[] {
  const people = new Map<string, LendingRow>();
  for (const legacy of asArray<Record<string,unknown>>(data.seed.lending)) {
    const person=cleanString(legacy.person);
    if(!person)continue;
    const row = people.get(person) ?? { person, outstanding: 0, events: 0 };
    const snapshot=legacyLendingSnapshot(legacy,asOf);
    row.outstanding += snapshot.outstanding;
    row.events += snapshot.events;
    people.set(person, row);
  }
  for (const event of asArray<Record<string,unknown>>(data.state.events)) {
    const person=cleanString(event.person);
    const receivableDelta=finiteNumber(event.receivableDelta);
    if(asOf&&(!cleanDate(event.date)||cleanDate(event.date)>asOf))continue;
    if (!person || receivableDelta===0) continue;
    const row = people.get(person) ?? { person, outstanding: 0, events: 0 };
    row.outstanding += receivableDelta;
    row.events += 1;
    people.set(person, row);
  }
  return [...people.values()].sort((a, b) => b.outstanding - a.outstanding || a.person.localeCompare(b.person,'el'));
}

export function lendingHistory(data:FinanceData,asOf?:string):LendingHistoryRow[]{
  const raw:Array<Omit<LendingHistoryRow,'runningOutstanding'>>=[];
  for(const legacy of asArray<Record<string,unknown>>(data.seed.lending)){
    const person=cleanString(legacy.person);
    if(!person)continue;
    for(const [index,entry] of asArray<Record<string,unknown>>(legacy.entries).entries()){
      const date=cleanDate(entry.date);
      if(!date||(asOf&&date>asOf))continue;
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
    if(!person||!date||amount<=0||(asOf&&date>asOf))continue;
    const id=cleanString(event.id)||`event-${person}-${date}-${raw.length}`;
    const note=cleanString(event.note)||(kind==='repayment'?'Επιστροφή δανεικών':kind==='lending_writeoff'?'Διαγραφή απαίτησης':'Πλήρωσα για άλλον');
    const accountId=cleanString(event.accountId)||cleanString(kind==='repayment'?event.toAccountId:event.fromAccountId)||undefined;
    if(kind==='lending')raw.push({id,person,date,action:'lent',amount,note,accountId,origin:'event'});
    if(kind==='repayment')raw.push({id,person,date,action:'repaid',amount,note,accountId,origin:'event'});
    if(kind==='lending_writeoff')raw.push({id,person,date,action:'forgiven',amount,note,origin:'event'});
  }
  const running=new Map<string,number>();
  const chronological=[...raw].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const withRunning=chronological.map(row=>{const current=running.get(row.person)??0;const next=row.action==='lent'?current+row.amount:Math.max(0,current-row.amount);running.set(row.person,next);return {...row,runningOutstanding:next}});
  return withRunning.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}

export function lendingOutstandingFor(data:FinanceData,person:string,asOf?:string){const target=cleanString(person);return target?lendingRows(data,asOf).find(row=>row.person===target)?.outstanding??0:0}
