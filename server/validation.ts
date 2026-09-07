import { Buffer } from 'node:buffer';
import type { FinanceData } from '../src/types.js';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../src/lib/limits.js';
import { ApiError } from './http.js';

function invalid(message: string): never {
  throw new ApiError(400, 'INVALID_DATA', message);
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function array(value: unknown, name: string, max: number): asserts value is unknown[] {
  if (!Array.isArray(value)) invalid(`${name} must be an array.`);
  if (value.length > max) invalid(`${name} exceeds the supported size.`);
}

function record(value: unknown, name: string, max = 100_000): asserts value is Record<string, unknown> {
  if (!object(value)) invalid(`${name} must be an object.`);
  if (Object.keys(value).length > max) invalid(`${name} exceeds the supported size.`);
}

function text(value: unknown, name: string, max = 1_000, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && !value) || value.length > max) invalid(`Invalid ${name}.`);
}

function optionalText(value: unknown, name: string, max = 1_000) {
  if (value !== undefined && value !== null) text(value, name, max, true);
}

function finiteNumber(value: unknown, name: string, maxAbs = 1_000_000_000): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > maxAbs) invalid(`Invalid ${name}.`);
}

function optionalNumber(value: unknown, name: string, maxAbs = 1_000_000_000) {
  if (value !== undefined && value !== null) finiteNumber(value, name, maxAbs);
}

function oneOf(value: unknown, allowed: readonly string[], name: string): asserts value is string {
  if (typeof value !== 'string' || !allowed.includes(value)) invalid(`Invalid ${name}.`);
}

function stringArray(value: unknown, name: string, max: number, itemMax = 500): asserts value is string[] {
  array(value, name, max);
  for (const item of value) text(item, `${name} item`, itemMax, true);
}

function validateStringRecord(value: unknown, name: string, max = 10_000) {
  record(value, name, max);
  for (const child of Object.values(value)) text(child, `${name} value`, 1_000, true);
}

function validateNumberRecord(value: unknown, name: string, max = 10_000) {
  record(value, name, max);
  for (const child of Object.values(value)) finiteNumber(child, `${name} value`);
}

function validateLegacyTransaction(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.id, `${name}.id`, 200);
  text(value.date, `${name}.date`, 64);
  oneOf(value.type, ['income', 'expense', 'transfer', 'adjustment'], `${name}.type`);
  finiteNumber(value.amount, `${name}.amount`);
  text(value.note, `${name}.note`, 20_000, true);
  optionalText(value.accountId, `${name}.accountId`, 200);
  optionalText(value.fromAccountId, `${name}.fromAccountId`, 200);
  optionalText(value.toAccountId, `${name}.toAccountId`, 200);
  optionalText(value.category, `${name}.category`, 1_000);
  optionalText(value.subcategory, `${name}.subcategory`, 1_000);
  optionalText(value.source, `${name}.source`, 1_000);
  optionalText(value.cell, `${name}.cell`, 200);
  optionalText(value.sheet, `${name}.sheet`, 500);
  optionalText(value.formula, `${name}.formula`, 20_000);
}

function validateAccount(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.id, `${name}.id`, 100);
  text(value.name, `${name}.name`, 500);
  text(value.kind, `${name}.kind`, 100);
  optionalText(value.short, `${name}.short`, 100);
  optionalText(value.provider, `${name}.provider`, 500);
  if (value.cashRole !== undefined) oneOf(value.cashRole, ['daily','reserve'], `${name}.cashRole`);
  if (value.excludeFromAvailable !== undefined && typeof value.excludeFromAvailable !== 'boolean') invalid(`Invalid ${name}.excludeFromAvailable.`);
  if (value.showInQuickChoices !== undefined && typeof value.showInQuickChoices !== 'boolean') invalid(`Invalid ${name}.showInQuickChoices.`);
  if (value.custom !== undefined && typeof value.custom !== 'boolean') invalid(`Invalid ${name}.custom.`);
}

function validateCardBank(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.id, `${name}.id`, 100);
  text(value.name, `${name}.name`, 500);
  finiteNumber(value.order, `${name}.order`, 100_000);
  if (value.custom !== undefined && typeof value.custom !== 'boolean') invalid(`Invalid ${name}.custom.`);
}

const FORBIDDEN_CARD_SECRET_FIELDS = new Set([
  'pan','cardnumber','fullcardnumber','primaryaccountnumber','expiry','expirydate','expiration','expirationdate','cvv','cvc','securitycode','cardverificationvalue','cardverificationcode',
]);

function rejectPaymentCardSecrets(value: Record<string, unknown>, name: string) {
  for (const key of Object.keys(value)) {
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (FORBIDDEN_CARD_SECRET_FIELDS.has(normalized)) invalid(`Payment-card secret field ${name}.${key} is not allowed in finance state.`);
  }
}

function validatePaymentCard(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  rejectPaymentCardSecrets(value, name);
  text(value.id, `${name}.id`, 200);
  text(value.bankId, `${name}.bankId`, 100);
  text(value.nickname, `${name}.nickname`, 500);
  oneOf(value.kind, ['debit','prepaid','credit'], `${name}.kind`);
  oneOf(value.network, ['visa','mastercard','other'], `${name}.network`);
  optionalText(value.holderName, `${name}.holderName`, 500);
  optionalText(value.last4, `${name}.last4`, 4);
  if (value.last4 !== undefined && value.last4 !== null && !/^\d{4}$/.test(String(value.last4))) invalid(`Invalid ${name}.last4.`);
  optionalText(value.vaultRef, `${name}.vaultRef`, 500);
  if (typeof value.active !== 'boolean') invalid(`Invalid ${name}.active.`);
  text(value.createdAt, `${name}.createdAt`, 64);
  text(value.updatedAt, `${name}.updatedAt`, 64);
}

function validateSnapshot(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.date, `${name}.date`, 64);
  validateNumberRecord(value.balances, `${name}.balances`, 10_000);
  optionalText(value.sheet, `${name}.sheet`, 500);
}

function validateRecurring(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.id, `${name}.id`, 200);
  text(value.name, `${name}.name`, 1_000);
  finiteNumber(value.amount, `${name}.amount`);
  if (value.amount <= 0) invalid(`Invalid ${name}.amount.`);
  if (value.day !== undefined && value.day !== null) {
    finiteNumber(value.day, `${name}.day`, 31);
    if (!Number.isInteger(value.day) || value.day < 1 || value.day > 31) invalid(`Invalid ${name}.day.`);
  }
  optionalText(value.firstExpectedDate, `${name}.firstExpectedDate`, 64);
  text(value.accountId, `${name}.accountId`, 200, true);
  text(value.category, `${name}.category`, 1_000, true);
  if (typeof value.active !== 'boolean') invalid(`Invalid ${name}.active.`);
  if (value.status !== undefined) oneOf(value.status, ['active','paused','stopped'], `${name}.status`);
  optionalText(value.source, `${name}.source`, 1_000);
}

function validateSubscription(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.id, `${name}.id`, 200);
  text(value.name, `${name}.name`, 1_000);
  finiteNumber(value.cost, `${name}.cost`);
  optionalText(value.due, `${name}.due`, 200);
  optionalText(value.period, `${name}.period`, 200);
}

function validateLoan(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.id, `${name}.id`, 200);
  text(value.name, `${name}.name`, 1_000);
  finiteNumber(value.total, `${name}.total`);
  if (value.total <= 0) invalid(`Invalid ${name}.total.`);
  finiteNumber(value.installment, `${name}.installment`);
  if (value.installment <= 0) invalid(`Invalid ${name}.installment.`);
  finiteNumber(value.installments, `${name}.installments`, 100_000);
  if (!Number.isInteger(value.installments) || value.installments <= 0) invalid(`Invalid ${name}.installments.`);
  optionalText(value.day, `${name}.day`, 200);
  optionalText(value.provider, `${name}.provider`, 1_000);
  if (value.paidCount !== undefined && value.paidCount !== null) {
    finiteNumber(value.paidCount, `${name}.paidCount`, 100_000);
    if (!Number.isInteger(value.paidCount) || value.paidCount < 0 || value.paidCount > value.installments) invalid(`Invalid ${name}.paidCount.`);
  }
  optionalText(value.source, `${name}.source`, 1_000);
  if (value.accountingMode !== undefined) oneOf(value.accountingMode, ['expense-per-installment', 'liability-repayment'], `${name}.accountingMode`);
  if (value.kind !== undefined) oneOf(value.kind, ['installment','loan','self-loan'], `${name}.kind`);
  optionalText(value.firstExpectedDate, `${name}.firstExpectedDate`, 64);
  optionalText(value.defaultAccountId, `${name}.defaultAccountId`, 200);
  if (value.forgivenAmount !== undefined && value.forgivenAmount !== null) {
    finiteNumber(value.forgivenAmount, `${name}.forgivenAmount`);
    if (value.forgivenAmount < 0 || value.forgivenAmount > value.total) invalid(`Invalid ${name}.forgivenAmount.`);
  }
  if (value.longTermRecurring !== undefined && typeof value.longTermRecurring !== 'boolean') invalid(`Invalid ${name}.longTermRecurring.`);
  if (value.schedule !== undefined) {
    array(value.schedule, `${name}.schedule`, 100_000);
    for (const [index, item] of value.schedule.entries()) {
      if (!object(item)) invalid(`Invalid ${name}.schedule[${index}].`);
      text(item.date, `${name}.schedule[${index}].date`, 64);
      text(item.status, `${name}.schedule[${index}].status`, 200, true);
    }
  }
}

function validateLending(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.person, `${name}.person`, 1_000);
  finiteNumber(value.outstanding, `${name}.outstanding`);
  array(value.entries, `${name}.entries`, 100_000);
  for (const [index, entry] of value.entries.entries()) {
    if (!object(entry)) invalid(`Invalid ${name}.entries[${index}].`);
    text(entry.date, `${name}.entries[${index}].date`, 64);
    finiteNumber(entry.lent, `${name}.entries[${index}].lent`);
    finiteNumber(entry.repaid, `${name}.entries[${index}].repaid`);
    optionalNumber(entry.haircut, `${name}.entries[${index}].haircut`);
  }
}

const EVENT_KINDS = ['expense','income','transfer','saving_cash_offset','withdrawal','refund','lending','repayment','card_purchase','card_payment','reconciliation','split'] as const;
const PART_KINDS = ['expense','income','refund','saving','transfer','reconciliation'] as const;

function validateSplitPart(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.id, `${name}.id`, 200);
  text(value.label, `${name}.label`, 1_000, true);
  text(value.category, `${name}.category`, 1_000, true);
  optionalText(value.subcategory, `${name}.subcategory`, 1_000);
  finiteNumber(value.amount, `${name}.amount`);
  if (value.kind !== undefined) oneOf(value.kind, PART_KINDS, `${name}.kind`);
}

function validateEvent(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  text(value.id, `${name}.id`, 200);
  text(value.date, `${name}.date`, 64);
  oneOf(value.kind, EVENT_KINDS, `${name}.kind`);
  finiteNumber(value.amount, `${name}.amount`);
  text(value.note, `${name}.note`, 20_000, true);
  optionalText(value.category, `${name}.category`, 1_000);
  optionalText(value.subcategory, `${name}.subcategory`, 1_000);
  optionalText(value.accountId, `${name}.accountId`, 200);
  optionalText(value.fromAccountId, `${name}.fromAccountId`, 200);
  optionalText(value.toAccountId, `${name}.toAccountId`, 200);
  optionalText(value.person, `${name}.person`, 1_000);
  optionalText(value.source, `${name}.source`, 100);
  optionalText(value.createdAt, `${name}.createdAt`, 64);
  optionalText(value.updatedAt, `${name}.updatedAt`, 64);
  optionalText(value.loanId, `${name}.loanId`, 200);
  optionalText(value.recurringId, `${name}.recurringId`, 200);
  if (value.installmentCount !== undefined && value.installmentCount !== null) {
    finiteNumber(value.installmentCount, `${name}.installmentCount`, 100_000);
    if (!Number.isInteger(value.installmentCount) || value.installmentCount <= 0) invalid(`Invalid ${name}.installmentCount.`);
  }
  if (value.savingSource !== undefined) oneOf(value.savingSource, ['pay_and_save','manual_transfer','cash_offset'], `${name}.savingSource`);
  optionalNumber(value.savingAmount, `${name}.savingAmount`);
  optionalNumber(value.receivableDelta, `${name}.receivableDelta`);
  optionalNumber(value.creditDelta, `${name}.creditDelta`);
  array(value.legs, `${name}.legs`, 50);
  for (const [index, leg] of value.legs.entries()) {
    if (!object(leg)) invalid(`Invalid ${name}.legs[${index}].`);
    text(leg.accountId, `${name}.legs[${index}].accountId`, 200);
    finiteNumber(leg.amount, `${name}.legs[${index}].amount`);
  }
  if (value.parts !== undefined) {
    array(value.parts, `${name}.parts`, 1_000);
    value.parts.forEach((part, index) => validateSplitPart(part, `${name}.parts[${index}]`));
  }
}

function validateReviewDecision(value: unknown, name: string) {
  if (!object(value)) invalid(`Invalid ${name}.`);
  oneOf(value.status, ['confirmed','kept','snoozed'], `${name}.status`);
  if (value.semanticKind !== undefined) oneOf(value.semanticKind, [...EVENT_KINDS, 'split_required'], `${name}.semanticKind`);
  optionalText(value.category, `${name}.category`, 1_000);
  text(value.decidedAt, `${name}.decidedAt`, 64);
  optionalText(value.snoozedUntil, `${name}.snoozedUntil`, 64);
  if (value.parts !== undefined) {
    array(value.parts, `${name}.parts`, 1_000);
    value.parts.forEach((part, index) => validateSplitPart(part, `${name}.parts[${index}]`));
  }
}

function validateSettings(value: unknown) {
  if (!object(value)) invalid('Missing settings.');
  stringArray(value.excludedFromAvailable, 'state.settings.excludedFromAvailable', 10_000, 200);
  validateStringRecord(value.accountNames, 'state.settings.accountNames');
  if (value.customAccounts !== undefined) {
    array(value.customAccounts, 'state.settings.customAccounts', 1_000);
    value.customAccounts.forEach((item, index) => validateAccount(item, `state.settings.customAccounts[${index}]`));
    ensureUniqueIds(value.customAccounts, 'state.settings.customAccounts');
  }
  if (value.accountOverrides !== undefined) {
    record(value.accountOverrides, 'state.settings.accountOverrides', 1_000);
    for (const [id, item] of Object.entries(value.accountOverrides)) {
      text(id, 'state.settings.accountOverrides key', 100);
      validateAccount(item, `state.settings.accountOverrides.${id}`);
      if (object(item) && item.id !== id) invalid(`Invalid state.settings.accountOverrides.${id}.id.`);
    }
  }
  stringArray(value.expenseCategories, 'state.settings.expenseCategories', 10_000, 1_000);
  stringArray(value.incomeCategories, 'state.settings.incomeCategories', 10_000, 1_000);
  stringArray(value.customPresets, 'state.settings.customPresets', 10_000, 1_000);
  stringArray(value.pinnedPresets, 'state.settings.pinnedPresets', 10_000, 1_000);
  text(value.defaultExpenseAccount, 'state.settings.defaultExpenseAccount', 200, true);
  text(value.defaultIncomeAccount, 'state.settings.defaultIncomeAccount', 200, true);
  text(value.defaultLoanAccount, 'state.settings.defaultLoanAccount', 200, true);
  if (value.monthlyBudget !== undefined) {
    finiteNumber(value.monthlyBudget, 'state.settings.monthlyBudget');
    if (value.monthlyBudget < 0) invalid('Invalid state.settings.monthlyBudget.');
  }
  if (value.savingsTargetRate !== undefined) {
    finiteNumber(value.savingsTargetRate, 'state.settings.savingsTargetRate', 1);
    if (value.savingsTargetRate < 0 || value.savingsTargetRate > 1) invalid('Invalid state.settings.savingsTargetRate.');
  }
  if (value.creditLimit !== undefined) {
    finiteNumber(value.creditLimit, 'state.settings.creditLimit');
    if (value.creditLimit < 0) invalid('Invalid state.settings.creditLimit.');
  }
  if (value.motion !== undefined) oneOf(value.motion, ['system','reduced','full'], 'state.settings.motion');
  if (value.textSize !== undefined) oneOf(value.textSize, ['compact','normal','large'], 'state.settings.textSize');
}

function ensureUniqueIds(items: unknown[], name: string) {
  const ids = new Set<string>();
  for (const item of items) {
    if (!object(item) || typeof item.id !== 'string') continue;
    if (ids.has(item.id)) invalid(`Duplicate id in ${name}.`);
    ids.add(item.id);
  }
}

function validateDocumentSize(value: unknown) {
  let raw: string;
  try { raw = JSON.stringify(value); }
  catch { invalid('Finance state must be serializable JSON.'); }
  if (Buffer.byteLength(raw, 'utf8') > MAX_FINANCE_DOCUMENT_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Finance state exceeds the supported production size.');
  }
}

export function validateFinanceData(value: unknown): asserts value is FinanceData {
  if (!object(value)) invalid('Finance state must be a JSON object.');
  validateDocumentSize(value);
  text(value.app, 'app identifier', 64);
  if (!Number.isInteger(value.schemaVersion) || Number(value.schemaVersion) < 1 || Number(value.schemaVersion) > 100) invalid('Invalid schema version.');
  text(value.updatedAt, 'updatedAt value', 64);
  if (!object(value.seed)) invalid('Missing seed data.');
  if (!object(value.state)) invalid('Missing application state.');

  const seed = value.seed;
  const state = value.state;

  array(seed.accounts, 'seed.accounts', 100);
  seed.accounts.forEach((item, index) => validateAccount(item, `seed.accounts[${index}]`));
  ensureUniqueIds(seed.accounts, 'seed.accounts');
  stringArray(seed.months, 'seed.months', 1_200, 64);
  array(seed.transactions, 'seed.transactions', 100_000);
  seed.transactions.forEach((item, index) => validateLegacyTransaction(item, `seed.transactions[${index}]`));
  ensureUniqueIds(seed.transactions, 'seed.transactions');
  array(seed.snapshots, 'seed.snapshots', 100_000);
  seed.snapshots.forEach((item, index) => validateSnapshot(item, `seed.snapshots[${index}]`));
  array(seed.recurring, 'seed.recurring', 10_000);
  seed.recurring.forEach((item, index) => validateRecurring(item, `seed.recurring[${index}]`));
  ensureUniqueIds(seed.recurring, 'seed.recurring');
  array(seed.subscriptions, 'seed.subscriptions', 10_000);
  seed.subscriptions.forEach((item, index) => validateSubscription(item, `seed.subscriptions[${index}]`));
  ensureUniqueIds(seed.subscriptions, 'seed.subscriptions');
  array(seed.loans, 'seed.loans', 10_000);
  seed.loans.forEach((item, index) => validateLoan(item, `seed.loans[${index}]`));
  ensureUniqueIds(seed.loans, 'seed.loans');
  array(seed.lending, 'seed.lending', 10_000);
  seed.lending.forEach((item, index) => validateLending(item, `seed.lending[${index}]`));
  validateNumberRecord(seed.stats, 'seed.stats', 10_000);

  array(state.customTransactions, 'state.customTransactions', 100_000);
  state.customTransactions.forEach((item, index) => validateLegacyTransaction(item, `state.customTransactions[${index}]`));
  ensureUniqueIds(state.customTransactions, 'state.customTransactions');
  record(state.overrides, 'state.overrides');
  Object.entries(state.overrides).forEach(([id, item]) => { text(id, 'state.overrides key', 200); validateLegacyTransaction(item, `state.overrides.${id}`); });
  if (Array.isArray(state.deleted)) stringArray(state.deleted, 'state.deleted', 100_000, 200);
  else {
    record(state.deleted, 'state.deleted', 100_000);
    for (const child of Object.values(state.deleted)) if (typeof child !== 'boolean') invalid('Invalid state.deleted value.');
  }
  array(state.recurringCustom, 'state.recurringCustom', 10_000);
  state.recurringCustom.forEach((item, index) => validateRecurring(item, `state.recurringCustom[${index}]`));
  ensureUniqueIds(state.recurringCustom, 'state.recurringCustom');
  record(state.recurringOverrides, 'state.recurringOverrides', 10_000);
  Object.entries(state.recurringOverrides).forEach(([id, item]) => validateRecurring(item, `state.recurringOverrides.${id}`));
  validateNumberRecord(state.loanExtra, 'state.loanExtra', 10_000);
  record(state.loanOverrides, 'state.loanOverrides', 10_000);
  Object.entries(state.loanOverrides).forEach(([id, item]) => validateLoan(item, `state.loanOverrides.${id}`));
  array(state.customLoans, 'state.customLoans', 10_000);
  state.customLoans.forEach((item, index) => validateLoan(item, `state.customLoans[${index}]`));
  ensureUniqueIds(state.customLoans, 'state.customLoans');
  array(state.lendingCustom, 'state.lendingCustom', 100_000);
  validateSettings(state.settings);
  if (state.cardBanks !== undefined) {
    array(state.cardBanks, 'state.cardBanks', 100);
    state.cardBanks.forEach((item, index) => validateCardBank(item, `state.cardBanks[${index}]`));
    ensureUniqueIds(state.cardBanks, 'state.cardBanks');
  }
  if (state.cards !== undefined) {
    array(state.cards, 'state.cards', 1_000);
    state.cards.forEach((item, index) => validatePaymentCard(item, `state.cards[${index}]`));
    ensureUniqueIds(state.cards, 'state.cards');
  }
  if (state.events !== undefined) {
    array(state.events, 'state.events', 100_000);
    state.events.forEach((item, index) => validateEvent(item, `state.events[${index}]`));
    ensureUniqueIds(state.events, 'state.events');
  }
  if (state.reviewDecisions !== undefined) {
    record(state.reviewDecisions, 'state.reviewDecisions', 100_000);
    Object.entries(state.reviewDecisions).forEach(([id, item]) => { text(id, 'state.reviewDecisions key', 200); validateReviewDecision(item, `state.reviewDecisions.${id}`); });
  }
}