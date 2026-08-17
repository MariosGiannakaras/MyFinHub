import { ApiError } from './http.js';
import type { FinanceData } from '../src/types.js';

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function array(value: unknown, name: string, max: number): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new ApiError(400, 'INVALID_DATA', `${name} must be an array.`);
  if (value.length > max) throw new ApiError(400, 'INVALID_DATA', `${name} exceeds the supported size.`);
}

function record(value: unknown, name: string, max = 100_000): asserts value is Record<string, unknown> {
  if (!object(value)) throw new ApiError(400, 'INVALID_DATA', `${name} must be an object.`);
  if (Object.keys(value).length > max) throw new ApiError(400, 'INVALID_DATA', `${name} exceeds the supported size.`);
}

export function validateFinanceData(value: unknown): asserts value is FinanceData {
  if (!object(value)) throw new ApiError(400, 'INVALID_DATA', 'Finance state must be a JSON object.');
  if (typeof value.app !== 'string' || value.app.length > 64) throw new ApiError(400, 'INVALID_DATA', 'Invalid app identifier.');
  if (!Number.isInteger(value.schemaVersion) || Number(value.schemaVersion) < 1 || Number(value.schemaVersion) > 100) {
    throw new ApiError(400, 'INVALID_DATA', 'Invalid schema version.');
  }
  if (typeof value.updatedAt !== 'string' || value.updatedAt.length > 64) throw new ApiError(400, 'INVALID_DATA', 'Invalid updatedAt value.');

  if (!object(value.seed)) throw new ApiError(400, 'INVALID_DATA', 'Missing seed data.');
  if (!object(value.state)) throw new ApiError(400, 'INVALID_DATA', 'Missing application state.');

  array(value.seed.accounts, 'seed.accounts', 100);
  array(value.seed.months, 'seed.months', 1_200);
  array(value.seed.transactions, 'seed.transactions', 100_000);
  array(value.seed.snapshots, 'seed.snapshots', 100_000);
  array(value.seed.recurring, 'seed.recurring', 10_000);
  array(value.seed.subscriptions, 'seed.subscriptions', 10_000);
  array(value.seed.loans, 'seed.loans', 10_000);
  array(value.seed.lending, 'seed.lending', 10_000);
  record(value.seed.stats, 'seed.stats', 10_000);

  array(value.state.customTransactions, 'state.customTransactions', 100_000);
  array(value.state.recurringCustom, 'state.recurringCustom', 10_000);
  array(value.state.customLoans, 'state.customLoans', 10_000);
  array(value.state.lendingCustom, 'state.lendingCustom', 100_000);
  record(value.state.overrides, 'state.overrides');
  record(value.state.recurringOverrides, 'state.recurringOverrides', 10_000);
  record(value.state.loanExtra, 'state.loanExtra', 10_000);
  record(value.state.loanOverrides, 'state.loanOverrides', 10_000);
  if (!object(value.state.settings)) throw new ApiError(400, 'INVALID_DATA', 'Missing settings.');

  if (value.state.events !== undefined) array(value.state.events, 'state.events', 100_000);
  if (value.state.reviewDecisions !== undefined) record(value.state.reviewDecisions, 'state.reviewDecisions', 100_000);

  const accountIds = new Set<string>();
  for (const account of value.seed.accounts) {
    if (!object(account) || typeof account.id !== 'string' || !account.id || account.id.length > 100) {
      throw new ApiError(400, 'INVALID_DATA', 'Invalid account entry.');
    }
    if (accountIds.has(account.id)) throw new ApiError(400, 'INVALID_DATA', 'Duplicate account id.');
    accountIds.add(account.id);
  }

  for (const event of value.state.events ?? []) {
    if (!object(event) || typeof event.id !== 'string' || !event.id || event.id.length > 200) {
      throw new ApiError(400, 'INVALID_DATA', 'Invalid event entry.');
    }
    if (typeof event.amount !== 'number' || !Number.isFinite(event.amount) || Math.abs(event.amount) > 1_000_000_000) {
      throw new ApiError(400, 'INVALID_DATA', 'Invalid event amount.');
    }
    if (!Array.isArray(event.legs) || event.legs.length > 50) throw new ApiError(400, 'INVALID_DATA', 'Invalid event legs.');
  }
}
