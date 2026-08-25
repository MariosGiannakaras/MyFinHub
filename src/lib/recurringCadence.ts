import type { RecurrenceUnit, RecurringItem } from '../types.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

function utcDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function buildDate(year: number, monthIndex: number, day: number) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, last), 12)).toISOString().slice(0, 10);
}

export function addRecurringInterval(date: string, item: RecurringItem) {
  if (!ISO_DATE.test(date)) return null;
  const parsed = utcDate(date);
  const months = recurringCadence(item).months;
  return buildDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + months, parsed.getUTCDate());
}

export function advanceRecurringDate(anchor: string, item: RecurringItem, asOf: string) {
  if (!ISO_DATE.test(anchor) || !ISO_DATE.test(asOf)) return null;
  let next = anchor;
  let guard = 0;
  while (next < asOf && guard < 240) {
    const advanced = addRecurringInterval(next, item);
    if (!advanced || advanced === next) return null;
    next = advanced;
    guard += 1;
  }
  return next;
}

export function validRecurringAnchor(value: string | null | undefined) {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
}
