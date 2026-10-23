import {allAccounts} from './domain.js';
import {isSavingsAccount} from './accountSelection.js';
import {isValidDateOnly} from './dateOnly.js';
import {cashFlowForecast} from './forecast.js';
import {savingsGoalBalance} from './savingsGoals.js';
import {centsToMoney,moneyToCents} from './money.js';
import type {FinanceData,SavingsGoal} from '../types.js';

type GoalProjectionStatus='reached'|'undated'|'overdue'|'due_today'|'active';
type Scenario={label:'none'|'suggested'|'custom';monthly:number;totalAtDeadline:number;gapAtDeadline:number};
interface GoalProjection {
  status:GoalProjectionStatus;
  asOf:string;
  targetDate:string|null;
  target:number;
  /** Existing savings funds are a shared pool, not allocated to this goal. */
  sharedSavingsBalance:number;
  remaining:number;
  contributionMonths:number|null;
  suggestedMonthly:number|null;
  operatingLiquidityMinimum90d:number;
  knownObligationCount90d:number;
  forecastOmissions:number;
  forecastCompleteness:'limited'|'known_movements';
  suggestedContributionRisk:'none'|'liquidity_warning'|'no_date';
  scenarios:Scenario[];
}

function exactCents(value:number,allowZero=false){
  const cents=moneyToCents(value);
  if(!Number.isSafeInteger(cents)||cents<0||(!allowZero&&cents===0)||Math.abs(value*100-cents)>1e-6)
    throw new Error('Το ποσό πρέπει να είναι έγκυρο σε ακριβή λεπτά ευρώ.');
  return cents;
}
function monthsAvailable(asOf:string,end:string){
  const [ay,am,ad]=asOf.split('-').map(Number),[ey,em,ed]=end.split('-').map(Number);
  // One contribution opportunity in the last partial calendar month; never
  // silently assume an extra month after the actual target deadline.
  return Math.max(1,(ey-ay)*12+(em-am)+(ed>ad?1:0));
}

/** Advisory only. Uses real as-of account balances, and ONLY already-known
 * scheduled/recurring/loan movements inside an explicit 90-day window.
 * It must never create, reserve, mutate or forecast as posted money. */
export function savingsGoalProjection(
  data:FinanceData,goal:SavingsGoal,asOf:string,customMonthly?:number
):GoalProjection{
  if(!isValidDateOnly(asOf))throw new Error('Μη έγκυρη ημερομηνία αναφοράς στόχου.');
  if(goal.targetDate&&!isValidDateOnly(goal.targetDate))throw new Error('Μη έγκυρη προθεσμία στόχου.');
  const targetCents=exactCents(goal.targetAmount);
  const savedCents=exactCents(savingsGoalBalance(data,asOf),true);
  const remainingCents=Math.max(0,targetCents-savedCents);
  if(customMonthly!==undefined)exactCents(customMonthly,true);
  const targetDate=goal.targetDate??null;
  const status:GoalProjectionStatus=remainingCents===0?'reached':!targetDate?'undated':targetDate<asOf?'overdue':targetDate===asOf?'due_today':'active';
  const months=status==='active'&&targetDate?monthsAvailable(asOf,targetDate):null;
  const suggestedCents=months?Math.ceil(remainingCents/months):status==='reached'?0:null;
  const operatingIds=new Set(allAccounts(data).filter(a=>a.kind!=='credit'&&!isSavingsAccount(a)).map(a=>a.id));
  const forecast=cashFlowForecast(data,asOf,90);
  const operatingMin=forecast.points.reduce((min,point)=>{
    const total=Object.entries(point.balances).reduce((sum,[id,amount])=>operatingIds.has(id)?sum+moneyToCents(amount):sum,0);
    return Math.min(min,total);
  },Number.POSITIVE_INFINITY);
  const operatingMinimumCents=operatingIds.size?operatingMin:0;
  const scenarios:Scenario[]=[];
  const addScenario=(label:Scenario['label'],monthlyCents:number)=>{
    if(months===null)return;
    const total=savedCents+monthlyCents*months;
    if(!Number.isSafeInteger(total))throw new Error('Υπέρβαση του επιτρεπτού χρηματικού ορίου.');
    scenarios.push({label,monthly:centsToMoney(monthlyCents),totalAtDeadline:centsToMoney(total),
      gapAtDeadline:centsToMoney(Math.max(0,targetCents-total))});
  };
  addScenario('none',0);
  if(suggestedCents!==null)addScenario('suggested',suggestedCents);
  if(customMonthly!==undefined)addScenario('custom',exactCents(customMonthly,true));
  return {
    status,asOf,targetDate,target:centsToMoney(targetCents),
    sharedSavingsBalance:centsToMoney(savedCents),
    remaining:centsToMoney(remainingCents),
    contributionMonths:months,
    suggestedMonthly:suggestedCents===null?null:centsToMoney(suggestedCents),
    operatingLiquidityMinimum90d:centsToMoney(operatingMinimumCents),
    knownObligationCount90d:forecast.sourceCounts.scheduled+forecast.sourceCounts.recurring+forecast.sourceCounts.loan,
    forecastOmissions:forecast.omitted.length,
    forecastCompleteness:forecast.insufficientData||forecast.omitted.length?'limited':'known_movements',
    suggestedContributionRisk:suggestedCents===null?'no_date':operatingMinimumCents<suggestedCents?'liquidity_warning':'none',
    scenarios
  };
}
