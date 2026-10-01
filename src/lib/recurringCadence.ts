import type { RecurrenceUnit, RecurringItem } from '../types.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parsedIsoDate(value:string){
  if(!ISO_DATE.test(value))return null;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day,12));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
  return date;
}

function normalizedInterval(value: unknown) {
  const parsed = Number(value ?? 1);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 120 ? parsed : 1;
}

export function recurringCadence(item: RecurringItem) {
  const unit: RecurrenceUnit = item.recurrenceUnit === 'year' ? 'year' : 'month';
  const interval = normalizedInterval(item.recurrenceInterval);
  return { unit, interval, months: unit === 'year' ? interval * 12 : interval };
}

export function recurringCadenceLabel(item: RecurringItem) {
  const { unit, interval } = recurringCadence(item);
  if (unit === 'month') {
    if (interval === 1) return 'Κάθε μήνα';
    if (interval === 6) return 'Κάθε 6 μήνες';
    return `Κάθε ${interval} μήνες`;
  }
  if (interval === 1) return 'Κάθε χρόνο';
  return `Κάθε ${interval} χρόνια`;
}

export function recurringMonthlyEquivalent(item: RecurringItem) {
  const months = recurringCadence(item).months;
  return Number(item.amount || 0) / months;
}

function utcDate(value:string){
  return parsedIsoDate(value);
}

function buildDate(year: number, monthIndex: number, day: number) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, last), 12)).toISOString().slice(0, 10);
}

export function addRecurringInterval(date:string,item:RecurringItem){
  const parsed=utcDate(date);
  if(!parsed)return null;
  const months=recurringCadence(item).months;
  return buildDate(parsed.getUTCFullYear(),parsed.getUTCMonth()+months,parsed.getUTCDate());
}

export function advanceRecurringDate(anchor:string,item:RecurringItem,asOf:string){
  const anchorDate=utcDate(anchor);
  const target=utcDate(asOf);
  if(!anchorDate||!target)return null;
  if(anchor>=asOf)return anchor;

  const cadenceMonths=recurringCadence(item).months;
  const anchorMonth=anchorDate.getUTCFullYear()*12+anchorDate.getUTCMonth();
  const targetMonth=target.getUTCFullYear()*12+target.getUTCMonth();
  let steps=Math.max(0,Math.floor((targetMonth-anchorMonth)/cadenceMonths));

  let candidate=buildDate(
    anchorDate.getUTCFullYear(),
    anchorDate.getUTCMonth()+steps*cadenceMonths,
    anchorDate.getUTCDate(),
  );
  if(candidate<asOf){
    steps+=1;
    candidate=buildDate(
      anchorDate.getUTCFullYear(),
      anchorDate.getUTCMonth()+steps*cadenceMonths,
      anchorDate.getUTCDate(),
    );
  }
  return candidate;
}

export function validRecurringAnchor(value:string|null|undefined){
  return typeof value==='string'&&parsedIsoDate(value)?value:null;
}
