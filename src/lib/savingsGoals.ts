import type { Account, FinanceData, SavingsGoal } from '../types.js';
import { accountBalances } from './domain.js';
import { financeAccountChoices } from './accountSelection.js';

/** All bank savings accounts fund the shared Savings balance, regardless of
 * whether an imported/overridden account is typed as kind=savings or the bank
 * taxonomy reports bankAccountCategory=savings. */
export function isSavingsGoalAccount(account:Pick<Account,'kind'|'bankAccountCategory'>){
  return account.kind==='savings'||(account.kind==='bank'&&account.bankAccountCategory==='savings');
}

/** A historical goal's unchanged deadline may be retained after it passes.
 * Never allow creation or editing to introduce a different past deadline. */
export function validSavingsGoalDeadline(next:string|null|undefined,asOf:string,previous?:string|null){
  return !next||next>=asOf||Boolean(previous&&next===previous);
}

export function savingsGoalBalance(data:FinanceData,asOf:string){
  const balances=accountBalances(data,asOf);
  return financeAccountChoices(data).accounts
    .filter(isSavingsGoalAccount)
    .reduce((sum,account)=>sum+Math.max(0,balances[account.id]??0),0);
}

export function savingsGoalProgress(goal:SavingsGoal,balance:number){
  if(!Number.isFinite(goal.targetAmount)||goal.targetAmount<=0)return 0;
  return Math.max(0,Math.min(100,(Math.max(0,balance)/goal.targetAmount)*100));
}
