import type { Account, FinanceData } from '../types.js';
import { allAccounts } from './domain.js';

function firstUnique(accounts:Account[],ids:Array<string|undefined>,predicate:(account:Account)=>boolean){
  for(const id of ids){
    if(!id)continue;
    const account=accounts.find(item=>item.id===id&&predicate(item));
    if(account)return account;
  }
  return undefined;
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

  const dailyCash=accounts.find(account=>account.kind==='cash'&&account.cashRole==='daily'&&quick(account));
  const primary:Account[]=[];
  const add=(account:Account|undefined)=>{if(account&&!primary.some(item=>item.id===account.id))primary.push(account)};
  add(dailyCash);add(operating);add(savings);
  for(const account of accounts){if(primary.length>=3)break;if(quick(account))add(account)}
  for(const account of accounts){if(primary.length>=3)break;add(account)}

  return {
    accounts,
    operating,
    savings,
    dashboardPrimary:primary.slice(0,3),
  };
}
