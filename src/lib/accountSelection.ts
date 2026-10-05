import type { Account, FinanceData } from '../types.js';
import { allAccounts } from './domain.js';

export type DashboardPrimaryRole='cash'|'payroll'|'savings';
export type DashboardPrimarySlot={role:DashboardPrimaryRole;label:string;account?:Account};

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
  const operatingPredicate=(account:Account)=>account.kind!=='savings';
  const quick=(account:Account)=>account.showInQuickChoices!==false;

  const operating=
    firstUnique(accounts,[data.state.settings.defaultExpenseAccount,data.state.settings.defaultIncomeAccount],operatingPredicate)
    ??accounts.find(account=>operatingPredicate(account)&&quick(account)&&account.kind==='bank')
    ??accounts.find(account=>operatingPredicate(account)&&quick(account)&&account.kind==='cash'&&account.cashRole==='daily')
    ??accounts.find(account=>operatingPredicate(account)&&quick(account))
    ??accounts.find(operatingPredicate);

  const savings=
    accounts.find(account=>account.kind==='savings'&&quick(account))
    ??accounts.find(account=>account.kind==='savings');

  // Dashboard primary slots are a product hierarchy, not generic quick choices.
  // Never replace payroll with an operating/current/default account.
  const dashboardDailyCash=preferQuick(accounts,account=>account.kind==='cash'&&account.cashRole==='daily');
  const dashboardPayroll=preferQuick(accounts,account=>account.kind==='bank'&&account.bankAccountCategory==='payroll');
  const dashboardSavings=preferQuick(accounts,account=>account.kind==='savings'||(account.kind==='bank'&&account.bankAccountCategory==='savings'));
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
