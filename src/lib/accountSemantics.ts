import type { Account } from '../types.js';

/** Savings identity is independent of UI/account defaults and safe to reuse
 * during migration (before accountSelection and domain are initialized). */
export function isSavingsAccount(account:Pick<Account,'kind'|'bankAccountCategory'>){
  return account.kind==='savings'||(account.kind==='bank'&&account.bankAccountCategory==='savings');
}
