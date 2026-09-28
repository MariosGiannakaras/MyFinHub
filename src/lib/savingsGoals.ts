import type { FinanceData, SavingsGoal } from '../types.js';
import { accountBalances } from './domain.js';
import { financeAccountChoices } from './accountSelection.js';

export function savingsGoalBalance(data:FinanceData,asOf:string){
  const balances=accountBalances(data,asOf);
  return financeAccountChoices(data).accounts
    .filter(account=>account.kind==='savings')
    .reduce((sum,account)=>sum+Math.max(0,balances[account.id]??0),0);
}

export function savingsGoalProgress(goal:SavingsGoal,balance:number){
  if(!Number.isFinite(goal.targetAmount)||goal.targetAmount<=0)return 0;
  return Math.max(0,Math.min(100,(Math.max(0,balance)/goal.targetAmount)*100));
}
