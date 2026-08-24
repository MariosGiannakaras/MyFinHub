const MONTH_KEY=/^(\d{4})-(0[1-9]|1[0-2])$/;

export function localMonthKey(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

export function shiftReportingMonth(month:string,delta:number){
  const match=MONTH_KEY.exec(month);
  if(!match)throw new Error(`Invalid reporting month: ${month}`);
  const year=Number(match[1]);
  const rawMonth=Number(match[2]);
  const date=new Date(Date.UTC(year,rawMonth-1+delta,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

export function canAdvanceReportingMonth(month:string,maxMonth:string){
  if(!MONTH_KEY.test(month)||!MONTH_KEY.test(maxMonth))return false;
  return shiftReportingMonth(month,1)<=maxMonth;
}
