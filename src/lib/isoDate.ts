const ISO_CALENDAR_DATE=/^(\d{4})-(\d{2})-(\d{2})$/;

function leapYear(year:number){
  return year%4===0&&(year%100!==0||year%400===0);
}

function daysInMonth(year:number,month:number){
  if(month===2)return leapYear(year)?29:28;
  if(month===4||month===6||month===9||month===11)return 30;
  return 31;
}

export function isIsoCalendarDate(value:unknown):value is string{
  if(typeof value!=='string')return false;
  const match=ISO_CALENDAR_DATE.exec(value);
  if(!match)return false;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  return Number.isInteger(year)&&month>=1&&month<=12&&day>=1&&day<=daysInMonth(year,month);
}

export function parseIsoCalendarDateUtc(value:unknown):Date|null{
  if(!isIsoCalendarDate(value))return null;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(0);
  date.setUTCFullYear(year,month-1,day);
  date.setUTCHours(12,0,0,0);
  return date;
}
