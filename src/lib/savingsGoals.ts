import type { FinanceData, SavingsGoal } from '../types.js';
import { accountBalances } from './domain.js';
import { financeAccountChoices, isSavingsAccount } from './accountSelection.js';

/** A historical goal's unchanged deadline may be retained after it passes.
 * Never allow creation or editing to introduce a different past deadline. */
export function validSavingsGoalDeadline(next:string|null|undefined,asOf:string,previous?:string|null){
  return !next||next>=asOf||Boolean(previous&&next===previous);
}

export function savingsGoalBalance(data:FinanceData,asOf:string){
  const balances=accountBalances(data,asOf);
  return financeAccountChoices(data).accounts
    .filter(isSavingsAccount)
    .reduce((sum,account)=>sum+Math.max(0,balances[account.id]??0),0);
}

export function savingsGoalProgress(goal:SavingsGoal,balance:number){
  if(!Number.isFinite(goal.targetAmount)||goal.targetAmount<=0)return 0;
  return Math.max(0,Math.min(100,(Math.max(0,balance)/goal.targetAmount)*100));
}
