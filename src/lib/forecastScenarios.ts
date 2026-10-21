import {cashFlowForecast,LOW_BALANCE_THRESHOLD,type ForecastHorizon,type ForecastPoint} from './forecast.js';
import {isValidDateOnly} from './dateOnly.js';
import {moneyToCents,centsToMoney} from './money.js';
import type {FinanceData} from '../types.js';

export interface ForecastScenarioAssumption {
  id:string;
  accountId:string;
  date:string;
  kind:'extra_income'|'extra_expense';
  amount:number;
}

export interface ForecastScenarioPoint extends ForecastPoint {
  /** Hypothetical movement impact; never a finance ledger entry. */
  scenarioDelta:number;
}

export interface ForecastScenarioResult {
  baseline:ReturnType<typeof cashFlowForecast>;
  points:ForecastScenarioPoint[];
  projectedPortfolio:number;
  minimumPortfolio:number;
  minimumPortfolioDate:string;
  firstPortfolioShortfallDate:string|null;
  accounts:Array<{
    accountId:string;
    projected:number;
    minimum:number;
    firstNegativeDate:string|null;
    firstLowDate:string|null;
  }>;
  assumptions:ForecastScenarioAssumption[];
  evidence:{
    /** User-entered future finance dates and explicitly scheduled items, not guaranteed cash. */
    declared:number;
    /** Recurrence/loan estimations from the existing forecast engine. */
    estimated:number;
    /** Extra hypotheses entered by the owner only for this calculation. */
    hypothetical:number;
    omitted:number;
  };
}

function exactPositiveCents(value:number){
  const cents=moneyToCents(value);
  if(!Number.isSafeInteger(cents)||cents<=0||Math.abs(value*100-cents)>1e-6)
    throw new Error('Το ποσό σεναρίου πρέπει να είναι θετικό και ακριβές σε λεπτά ευρώ.');
  return cents;
}

/**
 * Pure what-if overlay on the existing canonical 30/60/90-day forecast.
 * No state write, no money posting, and no heuristic deduplication of
 * unrelated same-day obligations merely because their amounts match.
 */
export function cashFlowScenario(
  data:FinanceData,asOf:string,horizon:ForecastHorizon,
  assumptions:readonly ForecastScenarioAssumption[]
):ForecastScenarioResult{
  if(!isValidDateOnly(asOf))throw new Error('Μη έγκυρη ημερομηνία πρόβλεψης.');
  if(![30,60,90].includes(horizon))throw new Error('Επίλεξε ορίζοντα 30, 60 ή 90 ημερών.');
  if(assumptions.length>16)throw new Error('Μέχρι 16 υποθέσεις ανά σενάριο.');
  const baseline=cashFlowForecast(data,asOf,horizon);
  const ids=new Set(baseline.accounts.map(account=>account.accountId));
  const seen=new Set<string>();
  const byDate=new Map<string,Map<string,number>>();
  for(const assumption of assumptions){
    if(!assumption.id||assumption.id.length>160||seen.has(assumption.id))
      throw new Error('Κάθε υπόθεση χρειάζεται μοναδική ταυτότητα.');
    seen.add(assumption.id);
    if(!ids.has(assumption.accountId))throw new Error('Η υποθετική κίνηση χρειάζεται πραγματικό λογαριασμό.');
    if(!isValidDateOnly(assumption.date)||assumption.date<=asOf||assumption.date>baseline.endDate)
      throw new Error('Η υποθετική ημερομηνία πρέπει να είναι μέσα στο μέλλον του ορίζοντα.');
    if(assumption.kind!=='extra_income'&&assumption.kind!=='extra_expense')
      throw new Error('Μη έγκυρος τύπος υποθετικής κίνησης.');
    const cents=exactPositiveCents(assumption.amount);
    const signed=assumption.kind==='extra_income'?cents:-cents;
    const amounts=byDate.get(assumption.date)??new Map<string,number>();
    const total=(amounts.get(assumption.accountId)??0)+signed;
    if(!Number.isSafeInteger(total))throw new Error('Υπέρβαση ποσού υποθετικού σεναρίου.');
    amounts.set(assumption.accountId,total);
    byDate.set(assumption.date,amounts);
  }
  const dates=[...new Set([...baseline.points.map(point=>point.date),...byDate.keys()])].sort();
  const ongoing=new Map<string,number>();
  const minimum=new Map(baseline.accounts.map(account=>[account.accountId,account.current]));
  const firstNegative=new Map(baseline.accounts.map(account=>[account.accountId,account.current<0?asOf:null]));
  const firstLow=new Map(baseline.accounts.map(account=>[account.accountId,account.current<LOW_BALANCE_THRESHOLD?asOf:null]));
  let baselineIndex=0,minimumPortfolio=Infinity,minimumPortfolioDate=asOf,firstPortfolioShortfallDate:string|null=null;
  const points:ForecastScenarioPoint[]=[];
  for(const date of dates){
    while(baselineIndex+1<baseline.points.length&&baseline.points[baselineIndex+1].date<=date)
      baselineIndex++;
    const baselinePoint=baseline.points[baselineIndex];
    const amounts=byDate.get(date);
    if(amounts)for(const [id,cents] of amounts)
      ongoing.set(id,(ongoing.get(id)??0)+cents);
    const balances:Record<string,number>={};
    let portfolioCents=0,deltaCents=0;
    for(const id of ids){
      const delta=ongoing.get(id)??0;
      const cents=moneyToCents(baselinePoint.balances[id]??0)+delta;
      if(!Number.isSafeInteger(cents))throw new Error('Υπέρβαση ορίου υπολογισμού σεναρίου.');
      portfolioCents+=cents;deltaCents+=delta;
      if(!Number.isSafeInteger(portfolioCents))throw new Error('Υπέρβαση συνολικού υπολοίπου.');
      balances[id]=centsToMoney(cents);
      minimum.set(id,Math.min(minimum.get(id)??balances[id],balances[id]));
      if(firstNegative.get(id)===null&&cents<0)firstNegative.set(id,date);
      if(firstLow.get(id)===null&&cents<LOW_BALANCE_THRESHOLD*100)firstLow.set(id,date);
    }
    const portfolio=centsToMoney(portfolioCents);
    points.push({date,balances,portfolio,scenarioDelta:centsToMoney(deltaCents)});
    if(portfolio<minimumPortfolio){minimumPortfolio=portfolio;minimumPortfolioDate=date}
    if(firstPortfolioShortfallDate===null&&portfolioCents<0)firstPortfolioShortfallDate=date;
  }
  const last=points.at(-1)!;
  return {
    baseline,points,projectedPortfolio:last.portfolio,minimumPortfolio,minimumPortfolioDate,firstPortfolioShortfallDate,
    accounts:baseline.accounts.map(account=>({
      accountId:account.accountId,projected:last.balances[account.accountId]??0,
      minimum:minimum.get(account.accountId)??0,
      firstNegativeDate:firstNegative.get(account.accountId)??null,
      firstLowDate:firstLow.get(account.accountId)??null,
    })),assumptions:[...assumptions],
    evidence:{
      declared:baseline.sourceCounts.dated_event+baseline.sourceCounts.scheduled,
      estimated:baseline.sourceCounts.recurring+baseline.sourceCounts.loan,
      hypothetical:assumptions.length,omitted:baseline.omitted.length,
    }
  };
}
