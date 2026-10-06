import { isValidMonthOnly, parseMonthOnly } from './dateOnly.js';

export function localMonthKey(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

export function shiftReportingMonth(month:string,delta:number){
  const parsed=parseMonthOnly(month);
  if(!parsed||!Number.isInteger(delta))throw new Error(`Invalid reporting month: ${month}`);
  const absoluteMonth=parsed.year*12+(parsed.month-1)+delta;
  const year=Math.floor(absoluteMonth/12);
  const rawMonth=((absoluteMonth%12)+12)%12+1;
  if(year<1||year>9999)throw new Error(`Reporting month is out of range: ${month}`);
  return `${String(year).padStart(4,'0')}-${String(rawMonth).padStart(2,'0')}`;
}

export function canAdvanceReportingMonth(month:string,maxMonth:string){
  if(!isValidMonthOnly(month)||!isValidMonthOnly(maxMonth))return false;
  return shiftReportingMonth(month,1)<=maxMonth;
}
