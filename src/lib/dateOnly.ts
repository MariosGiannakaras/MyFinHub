const DATE_ONLY=/^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_ONLY=/^(\d{4})-(\d{2})$/;

function leapYear(year:number){
  return year%4===0&&(year%100!==0||year%400===0);
}

function daysInCalendarMonth(year:number,month:number){
  if(!Number.isInteger(year)||year<1||year>9999||!Number.isInteger(month)||month<1||month>12)return 0;
  if(month===2)return leapYear(year)?29:28;
  return [4,6,9,11].includes(month)?30:31;
}

function parseDateOnly(value:string){
  const match=DATE_ONLY.exec(value);
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const last=daysInCalendarMonth(year,month);
  if(!last||day<1||day>last)return null;
  return {year,month,day};
}

export function isValidDateOnly(value:unknown):value is string{
  return typeof value==='string'&&parseDateOnly(value)!==null;
}

const RFC3339=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export function isValidIsoTimestamp(value:unknown):value is string{
  if(typeof value!=='string')return false;
  const match=RFC3339.exec(value);
  if(!match)return false;
  const datePart=`${match[1]}-${match[2]}-${match[3]}`;
  if(!isValidDateOnly(datePart))return false;
  const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]);
  if(hour>23||minute>59||second>59)return false;
  const zone=match[7];
  if(zone!=='Z'){
    const zoneHour=Number(zone.slice(1,3));
    const zoneMinute=Number(zone.slice(4,6));
    if(zoneHour>23||zoneMinute>59)return false;
  }
  return true;
}

export function isValidDateStamp(value:unknown):value is string{
  return isValidDateOnly(value)||isValidIsoTimestamp(value);
}

export function parseMonthOnly(value:string){
  const match=MONTH_ONLY.exec(value);
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]);
  return daysInCalendarMonth(year,month)?{year,month}:null;
}

export function isValidMonthOnly(value:unknown):value is string{
  return typeof value==='string'&&parseMonthOnly(value)!==null;
}

export function calendarMonthRange(month:string){
  const parsed=parseMonthOnly(month);
  if(!parsed)throw new Error('Μη έγκυρος μήνας.');
  const end=String(daysInCalendarMonth(parsed.year,parsed.month)).padStart(2,'0');
  return {start:`${month}-01`,end:`${month}-${end}`};
}

export function addCalendarDays(value:string,days:number){
  const parsed=parseDateOnly(value);
  if(!parsed||!Number.isInteger(days))throw new Error('Μη έγκυρη ημερομηνία.');
  const date=new Date(Date.UTC(2000,parsed.month-1,parsed.day,12));
  date.setUTCFullYear(parsed.year);
  date.setUTCDate(date.getUTCDate()+days);
  const year=String(date.getUTCFullYear()).padStart(4,'0');
  const month=String(date.getUTCMonth()+1).padStart(2,'0');
  const day=String(date.getUTCDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}


export function dateOnlyToUtcDate(value:string){
  const parsed=parseDateOnly(value);
  if(!parsed)return null;
  const date=new Date(Date.UTC(2000,parsed.month-1,parsed.day,12));
  date.setUTCFullYear(parsed.year);
  return date;
}

export function monthOnlyToUtcDate(value:string){
  const parsed=parseMonthOnly(value);
  if(!parsed)return null;
  const date=new Date(Date.UTC(2000,parsed.month-1,1,12));
  date.setUTCFullYear(parsed.year);
  return date;
}
