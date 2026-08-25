import type { FinanceData, RecurringItem } from '../src/types.js';
import { ApiError } from './http.js';

type CadencedRecurring = RecurringItem & { recurrenceUnit?: unknown; recurrenceInterval?: unknown };

function invalid(): never {
  throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
}

function validateItem(value: RecurringItem) {
  const item = value as CadencedRecurring;
  if (item.recurrenceUnit !== undefined && item.recurrenceUnit !== 'month' && item.recurrenceUnit !== 'year') invalid();
  if (item.recurrenceInterval !== undefined) {
    if (typeof item.recurrenceInterval !== 'number' || !Number.isInteger(item.recurrenceInterval) || item.recurrenceInterval < 1 || item.recurrenceInterval > 120) invalid();
  }
  if ((item.recurrenceUnit === 'year' || Number(item.recurrenceInterval ?? 1) > 1) && item.active) {
    const anchor = item.firstExpectedDate;
    if (typeof anchor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) invalid();
  }
}

export function validateRecurringCadenceState(state: FinanceData['state']) {
  for (const item of state.recurringCustom ?? []) validateItem(item);
  for (const item of Object.values(state.recurringOverrides ?? {})) validateItem(item);
}

export function validateRecurringCadenceData(data: FinanceData) {
  for (const item of data.seed.recurring ?? []) validateItem(item);
  validateRecurringCadenceState(data.state);
}
