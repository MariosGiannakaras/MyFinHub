import { effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy } from './domain.js';
import type { FinanceData, MonthlyBudget } from '../types.js';

export type BudgetStatus = 'ok' | 'near' | 'exceeded';

export interface BudgetProgress {
  id: string;
  month: string;
  scope: 'category' | 'overall';
  category?: string;
  limit: number;
  used: number;
  rawUsed: number;
  remaining: number;
  ratio: number;
  alertThreshold: number;
  status: BudgetStatus;
}

const DEFAULT_ALERT_THRESHOLD = .8;

function cleanCategory(value: string | undefined) {
  const clean = value?.trim();
  return clean || null;
}

function add(target: Map<string, number>, category: string | undefined, value: number) {
  const key = cleanCategory(category);
  if (!key || !Number.isFinite(value) || Math.abs(value) <= .000001) return;
  target.set(key, (target.get(key) ?? 0) + value);
}

/** Net categorized spending for one month. Expenses add usage, refunds reduce it.
 * Transfers/savings/reconciliation/income do not consume category budgets.
 */
export function categoryBudgetSpending(data: FinanceData, month: string) {
  const totals = new Map<string, number>();
  for (const transaction of effectiveLegacyTransactions(data)) {
    if (!transaction.date.startsWith(`${month}-`)) continue;
    const impact = flowImpactLegacy(data, transaction);
    if (impact.expense) add(totals, transaction.category, impact.expense);
    if (impact.refund) add(totals, transaction.category, -impact.refund);
  }
  for (const event of data.state.events ?? []) {
    if (!event.date.startsWith(`${month}-`)) continue;
    if (event.parts?.length) {
      for (const part of event.parts) {
        const kind = part.kind ?? 'expense';
        if (kind === 'expense') add(totals, part.category, Math.abs(Number(part.amount || 0)));
        if (kind === 'refund') add(totals, part.category, -Math.abs(Number(part.amount || 0)));
      }
      continue;
    }
    const impact = flowImpactEvent(event);
    if (impact.expense) add(totals, event.category, impact.expense);
    if (impact.refund) add(totals, event.category, -impact.refund);
  }
  return totals;
}

export function monthlyBudgets(data: FinanceData, month: string) {
  return (data.state.budgets ?? [])
    .filter((budget) => budget.month === month && budget.amount > 0)
    .slice()
    .sort((a, b) => a.scope.localeCompare(b.scope) || (a.category ?? '').localeCompare(b.category ?? '', 'el') || a.id.localeCompare(b.id));
}

export function budgetProgress(data: FinanceData, month: string): BudgetProgress[] {
  const spending = categoryBudgetSpending(data, month);
  const categorizedTotal = [...spending.values()].reduce((sum, value) => sum + value, 0);
  return monthlyBudgets(data, month).map((budget) => {
    const rawUsed = budget.scope === 'overall' ? categorizedTotal : (spending.get(budget.category ?? '') ?? 0);
    const used = Math.max(0, rawUsed);
    const limit = Math.max(0, Number(budget.amount || 0));
    const ratio = limit > 0 ? used / limit : 0;
    const alertThreshold = Math.min(.99, Math.max(.5, Number(budget.alertThreshold ?? DEFAULT_ALERT_THRESHOLD)));
    const status: BudgetStatus = ratio > 1 ? 'exceeded' : ratio >= alertThreshold ? 'near' : 'ok';
    return {
      id: budget.id,
      month: budget.month,
      scope: budget.scope,
      category: budget.category,
      limit,
      used,
      rawUsed,
      remaining: limit - used,
      ratio,
      alertThreshold,
      status,
    };
  });
}

export function budgetSummary(data: FinanceData, month: string) {
  const rows = budgetProgress(data, month);
  return {
    rows,
    near: rows.filter((row) => row.status === 'near').length,
    exceeded: rows.filter((row) => row.status === 'exceeded').length,
    overall: rows.find((row) => row.scope === 'overall') ?? null,
  };
}

export function normalizeBudget(input: MonthlyBudget): MonthlyBudget {
  const amount = Number(input.amount);
  if (!/^\d{4}-\d{2}$/.test(input.month)) throw new Error('Διάλεξε έγκυρο μήνα για το budget.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Το όριο budget πρέπει να είναι μεγαλύτερο από μηδέν.');
  const category = input.scope === 'category' ? input.category?.trim() : undefined;
  if (input.scope === 'category' && !category) throw new Error('Διάλεξε κατηγορία για το συγκεκριμένο budget.');
  const alertThreshold = Math.min(.99, Math.max(.5, Number(input.alertThreshold ?? DEFAULT_ALERT_THRESHOLD)));
  return { ...input, amount, category, alertThreshold };
}

export function budgetStableId(month: string, scope: 'category' | 'overall', category?: string) {
  const suffix = scope === 'overall' ? 'overall' : encodeURIComponent((category ?? '').trim().toLocaleLowerCase('el-GR'));
  return `budget:${month}:${suffix}`;
}
