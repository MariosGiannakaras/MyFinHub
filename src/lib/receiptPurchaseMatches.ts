import type {FinanceData,FinanceEvent,LegacyTransaction} from '../types.js';
import {effectiveLegacyTransactions,flowImpactEvent,flowImpactLegacy,reviewDecision} from './domain.js';
import type {ReceiptProposal} from './receiptDrafts.js';

type ReceiptPurchaseCandidate={
  /** Scoped to its canonical source to avoid conflating legacy and new IDs. */
  id:string;
  source:'event'|'legacy';
  sourceId:string;
  date:string;
  note:string;
  amount:number;
  daysApart:number;
  merchantMatches:boolean;
};

function cents(value:unknown):number|null{
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)return null;
  const rounded=Math.round(value*100);
  return Number.isSafeInteger(rounded)&&rounded>0&&Math.abs(value-rounded/100)<1e-8?rounded:null;
}
function utcDay(value:unknown):number|null{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value?date.getTime()/86400000:null;
}
function merchantKey(value:string|undefined){
  return (value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('el-GR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function eligibleLegacy(data:FinanceData,tx:LegacyTransaction){
  const decision=reviewDecision(data,tx.id);
  if(decision?.status==='confirmed'&&decision.semanticKind){
    if(decision.semanticKind==='split')return Boolean(decision.parts?.length)&&decision.parts!.every(part=>(part.kind??'expense')==='expense');
    if(decision.semanticKind!=='expense'&&decision.semanticKind!=='card_purchase')return false;
  }
  return tx.type==='expense'||(decision?.status==='confirmed'&&decision.semanticKind==='split');
}
function eligibleEvent(event:FinanceEvent){
  if(event.kind==='split')return Boolean(event.parts?.length)&&event.parts!.every(part=>(part.kind??'expense')==='expense');
  return event.kind==='expense'||event.kind==='card_purchase';
}

/**
 * Advisory, local-only hints from existing posted purchases. Exact EUR cents and
 * an actual nearby calendar date are mandatory; no mutation or auto-association.
 */
export function findReceiptPurchaseCandidates(
  data:FinanceData,
  proposal:Pick<ReceiptProposal,'merchant'|'date'|'total'|'currency'>,
  limit=6
):ReceiptPurchaseCandidate[]{
  const targetDay=utcDay(proposal.date);
  const targetAmount=cents(proposal.total);
  if(targetDay===null||targetAmount===null||(proposal.currency&&proposal.currency!=='EUR'))return [];
  const max=Math.max(0,Math.min(12,Number.isFinite(limit)?Math.floor(limit):6));
  if(!max)return [];
  const merchant=merchantKey(proposal.merchant);
  const candidates:ReceiptPurchaseCandidate[]=[];
  const add=(source:'event'|'legacy',sourceId:string,date:string,note:string,amount:number)=>{
    const day=utcDay(date);
    const distance=day===null?Infinity:Math.abs(day-targetDay);
    if(distance>3||cents(amount)!==targetAmount)return;
    const normalized=merchantKey(note);
    const merchantMatches=merchant.length>=4&&normalized.length>=4&&(normalized.includes(merchant)||merchant.includes(normalized));
    candidates.push({id:`${source}:${sourceId}`,source,sourceId,date,note:note.slice(0,120),amount:targetAmount/100,daysApart:distance,merchantMatches});
  };
  for(const event of data.state.events??[]){
    if(!eligibleEvent(event))continue;
    add('event',event.id,event.date,event.note,flowImpactEvent(event).expense);
  }
  for(const tx of effectiveLegacyTransactions(data)){
    if(!eligibleLegacy(data,tx))continue;
    add('legacy',tx.id,tx.date,tx.note,flowImpactLegacy(data,tx).expense);
  }
  return [...new Map(candidates.map(candidate=>[candidate.id,candidate])).values()]
    .sort((a,b)=>Number(b.merchantMatches)-Number(a.merchantMatches)||a.daysApart-b.daysApart||b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
    .slice(0,max);
}
