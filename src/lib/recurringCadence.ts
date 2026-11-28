import type { RecurrenceUnit, RecurringItem } from '../types.js';
import { calendarMonthRange, isValidDateOnly } from './dateOnly.js';

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

export function addRecurringInterval(date: string, item: RecurringItem) {
  if (!isValidDateOnly(date)) return null;
  const absolute=Number(date.slice(0,4))*12+Number(date.slice(5,7))-1+recurringCadence(item).months;
  const year=Math.floor(absolute/12);
  if(year<1||year>9999)return null;
  const month=String(year).padStart(4,'0')+'-'+String(absolute%12+1).padStart(2,'0');
  const last=Number(calendarMonthRange(month).end.slice(8));
  return month+'-'+String(Math.min(Number(date.slice(8)),last)).padStart(2,'0');
}

export function advanceRecurringDate(anchor: string, item: RecurringItem, asOf: string) {
  if (!isValidDateOnly(anchor) || !isValidDateOnly(asOf)) return null;
  let next = anchor;
  let guard = 0;
  while (next < asOf && guard < 240) {
    const advanced = addRecurringInterval(next, item);
    if (!advanced || advanced <= next) return null;
    next = advanced;
    guard += 1;
  }
  return next>=asOf?next:null;
}

export function validRecurringAnchor(value: string | null | undefined) {
  return isValidDateOnly(value) ? value : null;
}
