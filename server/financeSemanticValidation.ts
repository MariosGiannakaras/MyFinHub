import type { FinanceData, FinanceEvent, SplitPart } from '../src/types.js';
import { moneyToCents } from '../src/lib/money.js';
import { ApiError } from './http.js';

const CREDIT_ACCOUNT_ID='credit-card';

function invalid(message:string):never{
  throw new ApiError(400,'INVALID_DATA',message);
}

function cents(value:number,name:string){
  const result=moneyToCents(Number(value));
  if(!Number.isSafeInteger(result))invalid(`Invalid ${name}.`);
  return result;
}

function requirePositiveAmount(event:FinanceEvent){
  const amount=cents(event.amount,`event ${event.id} amount`);
  if(event.kind==='reconciliation'){
    if(amount<0)invalid(`Invalid reconciliation amount for event ${event.id}.`);
  }else if(amount<=0)invalid(`Invalid amount for event ${event.id}.`);
  return amount;
}

function assertDistinctPair(from:string|undefined,to:string|undefined,event:FinanceEvent){
  if(!from||!to||from===to)invalid(`Invalid account pair for event ${event.id}.`);
}

function assertLegs(event:FinanceEvent,expected:Array<[string,number]>){
  if(event.legs.length!==expected.length)invalid(`Invalid ledger legs for event ${event.id}.`);
  const actual=new Map<string,number>();
  for(const leg of event.legs){
    if(actual.has(leg.accountId))invalid(`Duplicate ledger account in event ${event.id}.`);
    actual.set(leg.accountId,cents(leg.amount,`event ${event.id} leg`));
  }
  for(const [accountId,amount] of expected){
    if(actual.get(accountId)!==amount)invalid(`Invalid ledger legs for event ${event.id}.`);
  }
}

function validateOptionalDelta(value:number|undefined,expected:number,event:FinanceEvent,name:string){
  if(value===undefined)return;
  if(cents(value,`event ${event.id} ${name}`)!==expected)invalid(`Invalid ${name} for event ${event.id}.`);
}

function validateSplitParts(parts:SplitPart[]|undefined,parentCents:number,context:string){
  if(!parts||parts.length<2)invalid(`Invalid split parts for ${context}.`);
  const ids=new Set<string>();
  let total=0;
  for(const part of parts){
    if(ids.has(part.id))invalid(`Duplicate split part id for ${context}.`);
    ids.add(part.id);
    const amount=cents(part.amount,`${context} split amount`);
    if(amount<=0)invalid(`Invalid split amount for ${context}.`);
    total+=amount;
    if(!Number.isSafeInteger(total))invalid(`Invalid split total for ${context}.`);
  }
  if(total!==parentCents)invalid(`Split parts do not balance for ${context}.`);
}

function validateEvent(event:FinanceEvent){
  const amount=requirePositiveAmount(event);
  switch(event.kind){
    case 'expense':{
      if(!event.accountId)invalid(`Missing account for event ${event.id}.`);
      assertLegs(event,[[event.accountId,-amount]]);
      break;
    }
    case 'income':
    case 'refund':{
      if(!event.accountId)invalid(`Missing account for event ${event.id}.`);
      assertLegs(event,[[event.accountId,amount]]);
      break;
    }
    case 'transfer':
    case 'withdrawal':
    case 'saving_cash_offset':{
      assertDistinctPair(event.fromAccountId,event.toAccountId,event);
      assertLegs(event,[[event.fromAccountId!,-amount],[event.toAccountId!,amount]]);
      break;
    }
    case 'lending':{
      if(!event.accountId)invalid(`Missing account for event ${event.id}.`);
      assertLegs(event,[[event.accountId,-amount]]);
      break;
    }
    case 'repayment':{
      if(!event.accountId)invalid(`Missing account for event ${event.id}.`);
      assertLegs(event,[[event.accountId,amount]]);
      break;
    }
    case 'card_purchase':
      assertLegs(event,[[CREDIT_ACCOUNT_ID,-amount]]);
      break;
    case 'card_payment':{
      if(!event.fromAccountId)invalid(`Missing payment account for event ${event.id}.`);
      assertLegs(event,[[event.fromAccountId,-amount],[CREDIT_ACCOUNT_ID,amount]]);
      break;
    }
    case 'reconciliation':{
      if(!event.accountId||event.legs.length!==1||event.legs[0]?.accountId!==event.accountId)invalid(`Invalid reconciliation event ${event.id}.`);
      const delta=Math.abs(cents(event.legs[0].amount,`event ${event.id} reconciliation leg`));
      if(delta!==amount)invalid(`Invalid reconciliation delta for event ${event.id}.`);
      break;
    }
    case 'split':{
      if(!event.accountId)invalid(`Missing account for event ${event.id}.`);
      assertLegs(event,[[event.accountId,-amount]]);
      validateSplitParts(event.parts,amount,`event ${event.id}`);
      break;
    }
  }

  validateOptionalDelta(event.savingAmount,event.kind==='saving_cash_offset'?amount:0,event,'savingAmount');
  validateOptionalDelta(event.receivableDelta,event.kind==='lending'?amount:event.kind==='repayment'?-amount:0,event,'receivableDelta');
  validateOptionalDelta(event.creditDelta,event.kind==='card_purchase'?-amount:event.kind==='card_payment'?amount:0,event,'creditDelta');
}

export function validateFinanceStateSemantics(state:FinanceData['state']){
  for(const event of state.events??[])validateEvent(event);
}

function accountIds(data:FinanceData){
  const ids=new Set<string>(data.seed.accounts.map(account=>account.id));
  for(const account of data.state.settings.customAccounts??[])ids.add(account.id);
  for(const account of Object.values(data.state.settings.accountOverrides??{}))ids.add(account.id);
  ids.add(CREDIT_ACCOUNT_ID);
  return ids;
}

function requireAccount(ids:Set<string>,value:string|undefined,name:string,{allowCredit=false}={}){
  if(!value)return;
  if(!ids.has(value)||(value===CREDIT_ACCOUNT_ID&&!allowCredit))invalid(`Invalid ${name} account reference.`);
}

function validateRecurringAccounts(data:FinanceData,ids:Set<string>){
  for(const [index,item] of data.seed.recurring.entries())requireAccount(ids,item.accountId,`seed.recurring[${index}]`);
  for(const [index,item] of (data.state.recurringCustom??[]).entries())requireAccount(ids,item.accountId,`state.recurringCustom[${index}]`);
  for(const [id,item] of Object.entries(data.state.recurringOverrides??{}))requireAccount(ids,item.accountId,`state.recurringOverrides.${id}`);
}

function validateLoanAccounts(data:FinanceData,ids:Set<string>){
  const rows=[...data.seed.loans,...Object.values(data.state.loanOverrides??{}),...(data.state.customLoans??[])];
  rows.forEach((loan,index)=>requireAccount(ids,loan.defaultAccountId,`loan[${index}]`));
}

function validateScheduledAccounts(data:FinanceData,ids:Set<string>){
  for(const [index,item] of (data.state.scheduled??[]).entries()){
    if(item.kind==='transfer'){
      requireAccount(ids,item.fromAccountId,`state.scheduled[${index}].fromAccountId`);
      requireAccount(ids,item.toAccountId,`state.scheduled[${index}].toAccountId`);
    }else{
      requireAccount(ids,item.accountId,`state.scheduled[${index}].accountId`);
    }
  }
}

function validateEventAccounts(data:FinanceData,ids:Set<string>){
  for(const [index,event] of (data.state.events??[]).entries()){
    requireAccount(ids,event.accountId,`state.events[${index}].accountId`);
    requireAccount(ids,event.fromAccountId,`state.events[${index}].fromAccountId`);
    requireAccount(ids,event.toAccountId,`state.events[${index}].toAccountId`);
    for(const [legIndex,leg] of event.legs.entries())requireAccount(ids,leg.accountId,`state.events[${index}].legs[${legIndex}]`,{allowCredit:true});
  }
}

function validateSettingsAccounts(data:FinanceData,ids:Set<string>){
  const settings=data.state.settings;
  requireAccount(ids,settings.defaultExpenseAccount,'state.settings.defaultExpenseAccount');
  requireAccount(ids,settings.defaultIncomeAccount,'state.settings.defaultIncomeAccount');
  requireAccount(ids,settings.defaultLoanAccount,'state.settings.defaultLoanAccount');
  for(const [index,id] of (settings.excludedFromAvailable??[]).entries())requireAccount(ids,id,`state.settings.excludedFromAvailable[${index}]`);
}

function validateRuleAccounts(data:FinanceData,ids:Set<string>){
  for(const [index,rule] of (data.state.transactionRules??[]).entries())requireAccount(ids,rule.match.accountId,`state.transactionRules[${index}].match.accountId`);
}

export function validateCompleteFinanceSemantics(data:FinanceData){
  validateFinanceStateSemantics(data.state);
  const ids=accountIds(data);
  validateSettingsAccounts(data,ids);
  validateRecurringAccounts(data,ids);
  validateLoanAccounts(data,ids);
  validateScheduledAccounts(data,ids);
  validateEventAccounts(data,ids);
  validateRuleAccounts(data,ids);
}
