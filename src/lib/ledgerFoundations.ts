import { allAccounts, createEvent } from './domain.js';
import { financeAccountChoices, isSavingsAccount, isSavingContributionSource } from './accountSelection.js';
import { centsToMoney, moneyToCents } from './money.js';
import type { FinanceData, FinanceEvent, SplitPart } from '../types.js';

export { centsToMoney, moneyToCents } from './money.js';

function transferEligibleAccounts(data: FinanceData) {
  return allAccounts(data).filter((account) => account.kind !== 'credit');
}

/** Existing hidden-but-real legacy accounts remain valid for non-destructive edits. */
export function singleAccountDraftError(data:FinanceData,id:string){
  return transferEligibleAccounts(data).some(account=>account.id===id)
    ?null:'Διάλεξε υπαρκτό λογαριασμό για την κίνηση.';
}

export function defaultTransferPair(data: FinanceData) {
  const accounts = transferEligibleAccounts(data);
  const preferredFrom = data.state.settings.defaultExpenseAccount;
  const from = accounts.find((account) => account.id === preferredFrom)?.id ?? accounts[0]?.id ?? '';
  const to = accounts.find((account) => account.id !== from && isSavingsAccount(account))?.id
    ?? accounts.find((account) => account.id !== from)?.id
    ?? '';
  return { from, to };
}

/** A withdrawal is bank → cash, not a generic transfer. Missing roles must
 * stay empty rather than silently selecting an unrelated destination. */
export function withdrawalAccountChoices(data:FinanceData){
  const accounts=transferEligibleAccounts(data);
  const sources=accounts.filter(account=>account.kind==='bank');
  const targets=accounts.filter(account=>account.kind==='cash');
  const source=sources.find(account=>account.id===data.state.settings.defaultExpenseAccount)
    ??sources.find(account=>account.showInQuickChoices!==false)??sources[0];
  const target=targets.find(account=>account.cashRole==='daily'&&account.showInQuickChoices!==false)
    ??targets.find(account=>account.showInQuickChoices!==false)??targets[0];
  return {sources,targets,from:source?.id??'',to:target?.id??''};
}

export function withdrawalDraftError(data:FinanceData,draft:{fromAccountId:string;toAccountId:string;amount:number},initial?:FinanceEvent|null){
  const error=transferDraftError(data,draft);
  if(error)return error;
  // Do not rewrite historical account legs merely because the editor now
  // restricts newly selected withdrawal pairs.
  if(initial?.kind==='withdrawal'&&
    (initial.fromAccountId||initial.legs.find(leg=>leg.amount<0)?.accountId)===draft.fromAccountId&&
    (initial.toAccountId||initial.legs.find(leg=>leg.amount>0)?.accountId)===draft.toAccountId)return null;
  const choices=withdrawalAccountChoices(data);
  if(!choices.sources.some(account=>account.id===draft.fromAccountId))return 'Η ανάληψη χρειάζεται τραπεζικό λογαριασμό προέλευσης.';
  if(!choices.targets.some(account=>account.id===draft.toAccountId))return 'Η ανάληψη χρειάζεται λογαριασμό μετρητών ως προορισμό.';
  return null;
}

/** Saving cash-offsets are bank(current/payroll) → savings, not wallet
 * movements. A generic transfer may use any non-credit accounts. */
export function defaultSavingContributionPair(data:FinanceData){
  const choices=financeAccountChoices(data);
  const candidates=choices.accounts.filter(isSavingContributionSource);
  const preferred=[data.state.settings.defaultExpenseAccount,data.state.settings.defaultIncomeAccount];
  const from=preferred.map(id=>candidates.find(account=>account.id===id)).find(Boolean)
    ??candidates.find(account=>account.showInQuickChoices!==false)
    ??candidates[0];
  return {from:from?.id??'',to:choices.savings?.id??''};
}

export function savingContributionDraftError(data:FinanceData,draft:{fromAccountId:string;toAccountId:string;amount:number}){
  const error=transferDraftError(data,draft);
  if(error)return error;
  const accounts=transferEligibleAccounts(data);
  const source=accounts.find(account=>account.id===draft.fromAccountId)!;
  const target=accounts.find(account=>account.id===draft.toAccountId)!;
  if(!isSavingContributionSource(source))return 'Η νέα αποταμίευση χρειάζεται τραπεζικό λογαριασμό μισθοδοσίας ή τρεχούμενο ως πηγή.';
  if(!isSavingsAccount(target))return 'Διάλεξε πραγματικό αποταμιευτικό λογαριασμό ως προορισμό.';
  return null;
}

export function transferDraftError(data: FinanceData, draft: { fromAccountId: string; toAccountId: string; amount: number }) {
  const ids = new Set(transferEligibleAccounts(data).map((account) => account.id));
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) return 'Συμπλήρωσε θετικό ποσό μεταφοράς.';
  const cents=moneyToCents(draft.amount);
  if (!Number.isSafeInteger(cents)) return 'Το ποσό μεταφοράς είναι εκτός επιτρεπτού εύρους.';
  // Domain callers must not bypass MoneyInput and silently round a posted
  // transfer or savings contribution to zero/sub-cent-adjusted ledger legs.
  if(cents<=0||Math.abs(draft.amount*100-cents)>1e-6)
    return 'Το ποσό μεταφοράς πρέπει να είναι τουλάχιστον ένα λεπτό με έως δύο δεκαδικά.';
  if (!draft.fromAccountId || !ids.has(draft.fromAccountId)) return 'Διάλεξε υπαρκτό λογαριασμό προέλευσης.';
  if (!draft.toAccountId || !ids.has(draft.toAccountId)) return 'Διάλεξε υπαρκτό λογαριασμό προορισμού.';
  if (draft.fromAccountId === draft.toAccountId) return 'Ο λογαριασμός προέλευσης και προορισμού πρέπει να είναι διαφορετικοί.';
  return null;
}

export function createTransferEvent(data: FinanceData, args: {
  date: string;
  amount: number;
  note?: string;
  fromAccountId: string;
  toAccountId: string;
}) {
  const error = transferDraftError(data, args);
  if (error) throw new Error(error);
  return createEvent({
    kind: 'transfer',
    date: args.date,
    amount: centsToMoney(moneyToCents(args.amount)),
    note: args.note?.trim() || 'Μεταφορά μεταξύ λογαριασμών',
    fromAccountId: args.fromAccountId,
    toAccountId: args.toAccountId,
  });
}

type SplitAllocation = {
  totalCents: number;
  total: number;
  normalizedParts: SplitPart[];
};

/**
 * Split parts are the economic source of truth. The parent amount is always
 * derived in integer cents so 0.1 + 0.2 cannot create reconciliation drift.
 */
export function splitAllocation(parts: SplitPart[]): SplitAllocation {
  const normalizedParts = parts.map((part) => ({
    ...part,
    label: part.label.trim(),
    category: part.category.trim() || 'Άλλο',
    subcategory: part.subcategory?.trim() || undefined,
    amount: centsToMoney(moneyToCents(Number(part.amount))),
    kind: 'expense' as const,
  }));
  const totalCents = normalizedParts.reduce((sum, part) => sum + moneyToCents(part.amount), 0);
  return { totalCents, total: centsToMoney(totalCents), normalizedParts };
}

export function splitDraftError(data: FinanceData, draft: { accountId: string; parts: SplitPart[] }) {
  const accountIds = new Set(transferEligibleAccounts(data).map((account) => account.id));
  if (!draft.accountId || !accountIds.has(draft.accountId)) return 'Διάλεξε υπαρκτό λογαριασμό πληρωμής.';
  if (draft.parts.length < 2) return 'Ο διαχωρισμός χρειάζεται τουλάχιστον δύο μέρη.';
  const invalidPartIndex=draft.parts.findIndex((part) => !Number.isFinite(Number(part.amount)) || Number(part.amount) <= 0);
  if (invalidPartIndex >= 0) return `Το ποσό στο μέρος ${invalidPartIndex + 1} πρέπει να είναι θετικό.`;
  // Do not let direct/domain callers silently round a user-confirmed amount.
  // Legacy read-only allocations can remain normalized; new writes cannot.
  const imprecisePartIndex=draft.parts.findIndex((part)=>{
    const amount=Number(part.amount),cents=moneyToCents(amount);
    return !Number.isSafeInteger(cents)||Math.abs(amount*100-cents)>1e-6;
  });
  if(imprecisePartIndex>=0)return `Το ποσό στο μέρος ${imprecisePartIndex+1} πρέπει να έχει έως δύο δεκαδικά και ασφαλή λεπτά ευρώ.`;
  const allocation = splitAllocation(draft.parts);
  if (!Number.isSafeInteger(allocation.totalCents) || allocation.normalizedParts.some((part) => !Number.isSafeInteger(moneyToCents(part.amount)))) return 'Το συνολικό ποσό διαχωρισμού υπερβαίνει το ασφαλές όριο.';
  if (allocation.totalCents <= 0) return 'Το σύνολο των επιμέρους ποσών πρέπει να είναι θετικό.';
  return null;
}

export function createExpenseSplitEvent(data: FinanceData, args: {
  date: string;
  note?: string;
  accountId: string;
  parts: SplitPart[];
}): FinanceEvent {
  const error = splitDraftError(data, args);
  if (error) throw new Error(error);
  const allocation = splitAllocation(args.parts);
  return createEvent({
    kind: 'split',
    date: args.date,
    amount: allocation.total,
    note: args.note?.trim() || 'Διαχωρισμένη αγορά',
    accountId: args.accountId,
    parts: allocation.normalizedParts,
  });
}

