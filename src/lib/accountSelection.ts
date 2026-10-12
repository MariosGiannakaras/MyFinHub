import type { Account, FinanceData } from '../types.js';
import { allAccounts } from './domain.js';

/** One savings identity for account choices, goals, and transfer source/target UI. */
export function isSavingsAccount(account:Pick<Account,'kind'|'bankAccountCategory'>){
  return account.kind==='savings'||(account.kind==='bank'&&account.bankAccountCategory==='savings');
}

/** An explicitly booked new saving must originate from a bank operating account.
 * Unknown legacy bank categories remain compatible with older imported data;
 * a cash wallet, term deposit, payment-only account or savings account cannot
 * be the origin of fresh saving_cash_offset flow. */
export function isSavingContributionSource(account:Pick<Account,'kind'|'bankAccountCategory'>){
  return account.kind==='bank'&&(
    account.bankAccountCategory===undefined||
    account.bankAccountCategory==='current'||
    account.bankAccountCategory==='payroll'
  );
}

type DashboardPrimaryRole='cash'|'payroll'|'savings';
type DashboardPrimarySlot={role:DashboardPrimaryRole;label:string;account?:Account};

function firstUnique(accounts:Account[],ids:Array<string|undefined>,predicate:(account:Account)=>boolean){
  for(const id of ids){
    if(!id)continue;
    const account=accounts.find(item=>item.id===id&&predicate(item));
    if(account)return account;
  }
  return undefined;
}

function preferQuick(accounts:Account[],predicate:(account:Account)=>boolean){
  return accounts.find(account=>predicate(account)&&account.showInQuickChoices!==false)
    ??accounts.find(predicate);
}

export function financeAccountChoices(data:FinanceData){
  const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  // A bank-classified savings account is still savings, not an operating source.
  const operatingPredicate=(account:Account)=>!isSavingsAccount(account);
  const quick=(account:Account)=>account.showInQuickChoices!==false;

  const operating=
    firstUnique(accounts,[data.state.settings.defaultExpenseAccount,data.state.settings.defaultIncomeAccount],operatingPredicate)
    ??accounts.find(account=>operatingPredicate(account)&&quick(account)&&account.kind==='bank')
    ??accounts.find(account=>operatingPredicate(account)&&quick(account)&&account.kind==='cash'&&account.cashRole==='daily')
    ??accounts.find(account=>operatingPredicate(account)&&quick(account))
    ??accounts.find(operatingPredicate);

  const savings=
    accounts.find(account=>isSavingsAccount(account)&&quick(account))
    ??accounts.find(isSavingsAccount);

  // Dashboard primary slots are a product hierarchy, not generic quick choices.
  // Never replace payroll with an operating/current/default account.
  const dashboardDailyCash=preferQuick(accounts,account=>account.kind==='cash'&&account.cashRole==='daily');
  const dashboardPayroll=preferQuick(accounts,account=>account.kind==='bank'&&account.bankAccountCategory==='payroll');
  const dashboardSavings=preferQuick(accounts,isSavingsAccount);
  const dashboardPrimarySlots:DashboardPrimarySlot[]=[
    {role:'cash',label:'Μετρητά',account:dashboardDailyCash},
    {role:'payroll',label:'Μισθοδοσίας',account:dashboardPayroll},
    {role:'savings',label:'Αποταμιευτικός',account:dashboardSavings},
  ];
  const dashboardPrimary=dashboardPrimarySlots.flatMap(slot=>slot.account?[slot.account]:[]);

  return {
    accounts,
    operating,
    savings,
    dashboardDailyCash,
    dashboardPayroll,
    dashboardSavings,
    dashboardPrimarySlots,
    dashboardPrimary,
  };
}
