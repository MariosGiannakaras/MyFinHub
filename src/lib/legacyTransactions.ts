import type { FinanceData, LegacyTransaction } from '../types.js';

function deletedIds(value: FinanceData['state']['deleted']) {
  if (Array.isArray(value)) return new Set(value);
  return new Set(Object.entries(value ?? {}).filter(([, deleted]) => deleted).map(([id]) => id));
}

export function legacyTransactionIsDeleted(data: FinanceData, id: string) {
  return deletedIds(data.state.deleted).has(id);
}

export function seedLegacyTransaction(data: FinanceData, id: string) {
  return data.seed.transactions.find((transaction) => transaction.id === id);
}

export function effectiveLegacyTransaction(data: FinanceData, id: string): LegacyTransaction | null {
  if (legacyTransactionIsDeleted(data, id)) return null;
  const seed = seedLegacyTransaction(data, id);
  if (!seed) return null;
  return data.state.overrides?.[id] ?? seed;
}

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function requireKnownAccount(data: FinanceData, id: string | undefined, label: string) {
  if (!id || !data.seed.accounts.some((account) => account.id === id)) throw new Error(`${label} δεν είναι πλέον διαθέσιμος.`);
  return id;
}

export function normalizeLegacyOverride(data: FinanceData, input: LegacyTransaction): LegacyTransaction {
  const original = seedLegacyTransaction(data, input.id);
  if (!original) throw new Error('Η ιστορική κίνηση δεν υπάρχει πλέον στο αρχικό εισαγόμενο αρχείο.');
  if (!validIsoDate(input.date)) throw new Error('Διάλεξε έγκυρη ημερομηνία.');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || (input.type === 'adjustment' ? amount === 0 : amount <= 0)) {
    throw new Error(input.type === 'adjustment' ? 'Η διόρθωση δεν μπορεί να έχει μηδενικό ποσό.' : 'Συμπλήρωσε ποσό μεγαλύτερο από μηδέν.');
  }
  if (!['income', 'expense', 'transfer', 'adjustment'].includes(input.type)) throw new Error('Ο τύπος της ιστορικής κίνησης δεν υποστηρίζεται.');

  let accountId: string | undefined;
  let fromAccountId: string | undefined;
  let toAccountId: string | undefined;
  if (input.type === 'transfer') {
    fromAccountId = requireKnownAccount(data, input.fromAccountId, 'Ο λογαριασμός προέλευσης');
    toAccountId = requireKnownAccount(data, input.toAccountId, 'Ο λογαριασμός προορισμού');
    if (fromAccountId === toAccountId) throw new Error('Η μεταφορά χρειάζεται δύο διαφορετικούς λογαριασμούς.');
  } else {
    accountId = requireKnownAccount(data, input.accountId, 'Ο λογαριασμός');
  }

  const category = input.category?.trim() || undefined;
  const subcategory = category ? input.subcategory?.trim() || undefined : undefined;
  return {
    ...original,
    id: original.id,
    date: input.date,
    type: input.type,
    accountId,
    fromAccountId,
    toAccountId,
    amount,
    note: input.note.trim(),
    category,
    subcategory,
    source: original.source,
    cell: original.cell,
    sheet: original.sheet,
    formula: original.formula,
  };
}

export function withLegacyOverride(data: FinanceData, input: LegacyTransaction): FinanceData {
  const override = normalizeLegacyOverride(data, input);
  const deleted = deletedIds(data.state.deleted);
  deleted.delete(override.id);
  const reviewDecisions = { ...(data.state.reviewDecisions ?? {}) };
  delete reviewDecisions[override.id];
  return {
    ...data,
    state: {
      ...data.state,
      overrides: { ...(data.state.overrides ?? {}), [override.id]: override },
      deleted: [...deleted],
      reviewDecisions,
    },
  };
}

export function withLegacyTombstone(data: FinanceData, id: string): FinanceData {
  if (!seedLegacyTransaction(data, id)) throw new Error('Η ιστορική κίνηση δεν υπάρχει πλέον στο αρχικό εισαγόμενο αρχείο.');
  const deleted = deletedIds(data.state.deleted);
  deleted.add(id);
  return { ...data, state: { ...data.state, deleted: [...deleted] } };
}

export function restoreLegacyOriginal(data: FinanceData, id: string): FinanceData {
  if (!seedLegacyTransaction(data, id)) throw new Error('Η ιστορική κίνηση δεν υπάρχει πλέον στο αρχικό εισαγόμενο αρχείο.');
  const deleted = deletedIds(data.state.deleted);
  deleted.delete(id);
  const overrides = { ...(data.state.overrides ?? {}) };
  delete overrides[id];
  return { ...data, state: { ...data.state, overrides, deleted: [...deleted] } };
}
