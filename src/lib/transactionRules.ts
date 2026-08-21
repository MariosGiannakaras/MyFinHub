import type { FinanceData, FinanceEvent, TransactionRule, TransactionRuleScope } from '../types.js';

export interface RulePreview {
  winner: TransactionRule | null;
  matches: TransactionRule[];
}

function normalize(value: string | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('el-GR');
}

function eventScope(event: FinanceEvent): TransactionRuleScope {
  if (event.source === 'migration') return 'imported';
  if (event.source === 'review') return 'review';
  return 'manual';
}

function categorizedKind(event: FinanceEvent) {
  return event.kind === 'expense' || event.kind === 'refund' || event.kind === 'income' || event.kind === 'card_purchase';
}

function eventAccount(event: FinanceEvent) {
  return event.accountId || event.fromAccountId || '';
}

export function orderedTransactionRules(data: FinanceData) {
  return (data.state.transactionRules ?? [])
    .filter((rule) => rule.enabled)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function transactionRuleMatches(rule: TransactionRule, event: FinanceEvent) {
  if (!rule.enabled || !categorizedKind(event)) return false;
  if (!rule.scopes.includes(eventScope(event))) return false;
  const note = normalize(event.note);
  const description = normalize(rule.match.description);
  const merchant = normalize(rule.match.merchant);
  const accountId = rule.match.accountId?.trim() ?? '';
  const mode = rule.match.mode ?? 'contains';
  if (description) {
    if (mode === 'equals' ? note !== description : !note.includes(description)) return false;
  }
  if (merchant && !note.includes(merchant)) return false;
  if (accountId && eventAccount(event) !== accountId) return false;
  return Boolean(description || merchant || accountId);
}

export function previewTransactionRules(data: FinanceData, event: FinanceEvent): RulePreview {
  const matches = orderedTransactionRules(data).filter((rule) => transactionRuleMatches(rule, event));
  return { winner: matches[0] ?? null, matches };
}

/**
 * Rules apply only to a newly submitted event. Existing history is never walked or
 * rewritten. First matching enabled rule wins. A non-default category selected by
 * the user is treated as an explicit override and is preserved.
 */
export function applyTransactionRules(data: FinanceData, event: FinanceEvent) {
  const { winner } = previewTransactionRules(data, event);
  if (!winner) return event;
  const expenseDefault = data.state.settings.expenseCategories[0] || 'Άλλο';
  const incomeDefault = data.state.settings.incomeCategories[0] || 'Άλλο';
  const genericDefault = event.kind === 'income' ? incomeDefault : expenseDefault;
  const categoryIsDefault = !event.category || event.category === genericDefault;
  const next: FinanceEvent = { ...event };
  if (winner.action.category && categoryIsDefault) next.category = winner.action.category;
  if (winner.action.subcategory && !event.subcategory && categoryIsDefault) next.subcategory = winner.action.subcategory;
  if (winner.action.note && !event.note.trim()) next.note = winner.action.note;
  return next;
}

export function transactionRuleMatchingEvents(data: FinanceData, rule: TransactionRule) {
  const enabledRule={...rule,enabled:true};
  return (data.state.events ?? []).filter((event) => transactionRuleMatches(enabledRule,event));
}

export function transactionRuleMatchCount(data: FinanceData, rule: TransactionRule) {
  return transactionRuleMatchingEvents(data,rule).length;
}

export function normalizeTransactionRule(rule: TransactionRule): TransactionRule {
  const name = rule.name.trim();
  if (!name) throw new Error('Δώσε όνομα στον κανόνα.');
  const numericPriority=Number(rule.priority);
  if (!Number.isFinite(numericPriority)) throw new Error('Η προτεραιότητα του κανόνα πρέπει να είναι έγκυρος αριθμός.');
  const priority = Math.max(0, Math.trunc(numericPriority));
  const description = rule.match.description?.trim() || undefined;
  const merchant = rule.match.merchant?.trim() || undefined;
  const accountId = rule.match.accountId?.trim() || undefined;
  if (!description && !merchant && !accountId) throw new Error('Ο κανόνας χρειάζεται τουλάχιστον μία συνθήκη αντιστοίχισης.');
  if (!rule.action.category?.trim() && !rule.action.subcategory?.trim() && !rule.action.note?.trim()) throw new Error('Ο κανόνας χρειάζεται τουλάχιστον μία ενέργεια.');
  const scopes = [...new Set(rule.scopes)].filter((scope): scope is TransactionRuleScope => scope === 'manual' || scope === 'imported' || scope === 'review');
  if (!scopes.length) throw new Error('Διάλεξε πού επιτρέπεται να εφαρμόζεται ο κανόνας.');
  return {
    ...rule,
    name,
    priority,
    scopes,
    match: { ...rule.match, description, merchant, accountId },
    action: {
      category: rule.action.category?.trim() || undefined,
      subcategory: rule.action.subcategory?.trim() || undefined,
      note: rule.action.note?.trim() || undefined,
    },
  };
}