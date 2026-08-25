import type { FinanceData, FinanceEvent, RecurringItem, RecurringStatus } from '../types.js';
import { advanceRecurringDate, recurringCadence, recurringMonthlyEquivalent, validRecurringAnchor } from './recurringCadence.js';

export function recurringStatus(item:RecurringItem):RecurringStatus{
  if(!item.active)return item.status==='paused'?'paused':'stopped';
  return item.status??'active';
}

export function allRecurringItems(data:FinanceData):RecurringItem[]{
  const seeded=(data.seed.recurring??[]).map(item=>data.state.recurringOverrides?.[item.id]??item);
  return [...seeded,...(data.state.recurringCustom??[])];
}

export function activeRecurringItems(data:FinanceData){return allRecurringItems(data).filter(item=>recurringStatus(item)==='active')}
export function inactiveRecurringItems(data:FinanceData){return allRecurringItems(data).filter(item=>recurringStatus(item)!=='active')}

export function recurringAccountChoice(availableAccountIds:string[],...preferred:Array<string|null|undefined>):string{
  const available=new Set(availableAccountIds);
  for(const candidate of preferred)if(candidate&&available.has(candidate))return candidate;
  return availableAccountIds[0]??'';
}

export function recurringAccountError(availableAccountIds:string[],accountId:string):string|null{
  if(!availableAccountIds.length)return 'Δεν υπάρχει διαθέσιμος λογαριασμός για αυτό το πάγιο. Πρόσθεσε ή ενεργοποίησε έναν λογαριασμό και δοκίμασε ξανά.';
  if(!accountId||!availableAccountIds.includes(accountId))return 'Ο επιλεγμένος λογαριασμός δεν είναι πλέον διαθέσιμος. Επίλεξε έναν από τους διαθέσιμους λογαριασμούς.';
  return null;
}

export function recurringPayments(data:FinanceData,itemId:string):FinanceEvent[]{
  return (data.state.events??[]).filter(event=>event.recurringId===itemId).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
}

export function typicalPaymentDay(data:FinanceData,item:RecurringItem):number|null{
  const payments=recurringPayments(data,item.id);
  if(payments.length){
    const avg=payments.reduce((sum,event)=>sum+Number(event.date.slice(8,10)),0)/payments.length;
    return Math.max(1,Math.min(31,Math.round(avg)));
  }
  if(item.firstExpectedDate)return Number(item.firstExpectedDate.slice(8,10))||null;
  return item.day??null;
}

function monthlyNextDate(data:FinanceData,item:RecurringItem,asOf:string){
  const day=typicalPaymentDay(data,item);
  if(!day)return validRecurringAnchor(item.firstExpectedDate);
  const base=new Date(`${asOf}T12:00:00Z`);
  const build=(year:number,monthIndex:number)=>{const last=new Date(Date.UTC(year,monthIndex+1,0)).getUTCDate();return new Date(Date.UTC(year,monthIndex,Math.min(day,last),12))};
  let due=build(base.getUTCFullYear(),base.getUTCMonth());
  if(due.getTime()<base.getTime())due=build(base.getUTCFullYear(),base.getUTCMonth()+1);
  return due.toISOString().slice(0,10);
}

export function nextRecurringDate(data:FinanceData,item:RecurringItem,asOf:string):string|null{
  if(recurringStatus(item)!=='active')return null;
  const cadence=recurringCadence(item);
  if(cadence.months===1)return monthlyNextDate(data,item,asOf);

  const explicitAnchor=validRecurringAnchor(item.firstExpectedDate);
  if(explicitAnchor)return advanceRecurringDate(explicitAnchor,item,asOf);

  const lastPayment=recurringPayments(data,item.id)[0]?.date;
  if(lastPayment){
    const firstAfterPayment=advanceRecurringDate(lastPayment,item,'9999-12-31');
    if(firstAfterPayment&&firstAfterPayment!==lastPayment)return advanceRecurringDate(firstAfterPayment,item,asOf);
  }

  return null;
}

export function recurringMonthlyTotal(data:FinanceData){return activeRecurringItems(data).reduce((sum,item)=>sum+recurringMonthlyEquivalent(item),0)}

export function recurringUpcoming(data:FinanceData,asOf:string){
  return activeRecurringItems(data).map(item=>({item,nextDate:nextRecurringDate(data,item,asOf),typicalDay:typicalPaymentDay(data,item),lastPayment:recurringPayments(data,item.id)[0]??null})).sort((a,b)=>(a.nextDate??'9999').localeCompare(b.nextDate??'9999')||a.item.name.localeCompare(b.item.name,'el'));
}
