import { accountBalances, allAccounts } from './domain.js';
import { isSelfLoan, loanRemainingInstallments, typicalLoanPaymentDay } from './loans.js';
import { activeRecurringItems, nextRecurringDate } from './recurring.js';
import { pendingScheduled } from './scheduled.js';
import type { FinanceData, LedgerLeg, Loan } from '../types.js';

export type ForecastHorizon = 30 | 60 | 90;
export type ForecastSource = 'scheduled' | 'recurring' | 'loan' | 'dated_event';

export interface ForecastMovement {
  id: string;
  date: string;
  label: string;
  source: ForecastSource;
  legs: LedgerLeg[];
  portfolioDelta: number;
}

export interface ForecastPoint {
  date: string;
  portfolio: number;
  balances: Record<string, number>;
}

export interface ForecastAccountSummary {
  accountId: string;
  current: number;
  projected: number;
  minimum: number;
  firstLowDate: string | null;
  firstNegativeDate: string | null;
}

export interface CashFlowForecast {
  asOf: string;
  endDate: string;
  horizon: ForecastHorizon;
  currentPortfolio: number;
  projectedPortfolio: number;
  minimumPortfolio: number;
  minimumPortfolioDate: string;
  points: ForecastPoint[];
  movements: ForecastMovement[];
  accounts: ForecastAccountSummary[];
  omitted: string[];
  sourceCounts: Record<ForecastSource, number>;
  insufficientData: boolean;
}

export const LOW_BALANCE_THRESHOLD = 100;

function utcDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

export function addDays(value: string, days: number) {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildMonthlyDate(year: number, monthIndex: number, day: number) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, last), 12)).toISOString().slice(0, 10);
}

function nextMonthlyDate(from: string, day: number, allowSameDay = true) {
  const date = utcDate(from);
  let candidate = buildMonthlyDate(date.getUTCFullYear(), date.getUTCMonth(), day);
  if (candidate < from || (!allowSameDay && candidate === from)) candidate = buildMonthlyDate(date.getUTCFullYear(), date.getUTCMonth() + 1, day);
  return candidate;
}

function followingMonthlyDate(value: string, day: number) {
  const date = utcDate(value);
  return buildMonthlyDate(date.getUTCFullYear(), date.getUTCMonth() + 1, day);
}

function effectiveLoans(data: FinanceData): Loan[] {
  const seeded = (data.seed.loans ?? []).map((loan) => data.state.loanOverrides?.[loan.id] ?? loan);
  return [...seeded, ...(data.state.customLoans ?? [])];
}

function currentAccountIds(data: FinanceData) {
  return new Set(allAccounts(data).filter((account) => account.kind !== 'credit').map((account) => account.id));
}

function portfolioDelta(legs: LedgerLeg[], ids: Set<string>) {
  return legs.reduce((sum, leg) => ids.has(leg.accountId) ? sum + Number(leg.amount || 0) : sum, 0);
}

function pushMovement(target: ForecastMovement[], movement: Omit<ForecastMovement, 'portfolioDelta'>, ids: Set<string>) {
  target.push({ ...movement, portfolioDelta: portfolioDelta(movement.legs, ids) });
}

function recurringMovements(data: FinanceData, asOf: string, endDate: string, ids: Set<string>, omitted: string[]) {
  const result: ForecastMovement[] = [];
  for (const item of activeRecurringItems(data)) {
    if (!ids.has(item.accountId)) {
      omitted.push(`Το πάγιο «${item.name}» δεν προβλήθηκε επειδή ο λογαριασμός του δεν είναι διαθέσιμος.`);
      continue;
    }
    const first = nextRecurringDate(data, item, asOf);
    if (!first) {
      omitted.push(`Το πάγιο «${item.name}» δεν προβλήθηκε επειδή δεν υπάρχει αρκετή πληροφορία ημερομηνίας.`);
      continue;
    }
    const day = Number(first.slice(8, 10));
    let date = first;
    let index = 0;
    while (date <= endDate) {
      pushMovement(result, {
        id: `forecast-recurring-${item.id}-${date}`,
        date,
        label: item.name,
        source: 'recurring',
        legs: [{ accountId: item.accountId, amount: -Math.abs(Number(item.amount || 0)) }],
      }, ids);
      date = followingMonthlyDate(date, day);
      index += 1;
      if (index > 4) break;
    }
  }
  return result;
}

function loanMovements(data: FinanceData, asOf: string, endDate: string, ids: Set<string>, omitted: string[]) {
  const result: ForecastMovement[] = [];
  for (const loan of effectiveLoans(data)) {
    const remaining = loanRemainingInstallments(data, loan);
    if (remaining <= 0 || Number(loan.installment || 0) <= 0) continue;
    if (isSelfLoan(loan)) {
      omitted.push(`Το εσωτερικό δάνειο «${loan.name}» δεν προβλήθηκε επειδή δεν υπάρχει ρητός λογαριασμός προορισμού για ουδέτερη εσωτερική μεταφορά.`);
      continue;
    }
    const accountId = loan.defaultAccountId || data.state.settings.defaultLoanAccount;
    if (!accountId || !ids.has(accountId)) {
      omitted.push(`Η δόση «${loan.name}» δεν προβλήθηκε επειδή ο λογαριασμός πληρωμής δεν είναι διαθέσιμος.`);
      continue;
    }
    const day = typicalLoanPaymentDay(data, loan);
    if (!day) {
      omitted.push(`Η δόση «${loan.name}» δεν προβλήθηκε επειδή δεν υπάρχει γνωστή ημέρα πληρωμής.`);
      continue;
    }
    let date = loan.firstExpectedDate && loan.firstExpectedDate >= asOf ? loan.firstExpectedDate : nextMonthlyDate(asOf, day, true);
    let count = 0;
    while (date <= endDate && count < remaining) {
      pushMovement(result, {
        id: `forecast-loan-${loan.id}-${date}-${count}`,
        date,
        label: loan.name,
        source: 'loan',
        legs: [{ accountId, amount: -Math.abs(Number(loan.installment || 0)) }],
      }, ids);
      date = followingMonthlyDate(date, day);
      count += 1;
    }
  }
  return result;
}

function scheduledMovements(data: FinanceData, asOf: string, endDate: string, ids: Set<string>, omitted: string[]) {
  const result: ForecastMovement[] = [];
  for (const item of pendingScheduled(data)) {
    if (item.dueDate > endDate) continue;
    const date = item.dueDate < asOf ? asOf : item.dueDate;
    if (item.kind === 'transfer') {
      if (!item.fromAccountId || !item.toAccountId || !ids.has(item.fromAccountId) || !ids.has(item.toAccountId) || item.fromAccountId === item.toAccountId) {
        omitted.push(`Η προγραμματισμένη μεταφορά «${item.note}» δεν προβλήθηκε επειδή οι λογαριασμοί της δεν είναι πλέον έγκυροι.`);
        continue;
      }
      pushMovement(result, {
        id: `forecast-scheduled-${item.id}`,
        date,
        label: item.note,
        source: 'scheduled',
        legs: [{ accountId: item.fromAccountId, amount: -Math.abs(item.amount) }, { accountId: item.toAccountId, amount: Math.abs(item.amount) }],
      }, ids);
      continue;
    }
    if (!item.accountId || !ids.has(item.accountId)) {
      omitted.push(`Η προγραμματισμένη κίνηση «${item.note}» δεν προβλήθηκε επειδή ο λογαριασμός της δεν είναι διαθέσιμος.`);
      continue;
    }
    pushMovement(result, {
      id: `forecast-scheduled-${item.id}`,
      date,
      label: item.note,
      source: 'scheduled',
      legs: [{ accountId: item.accountId, amount: item.kind === 'income' ? Math.abs(item.amount) : -Math.abs(item.amount) }],
    }, ids);
  }
  return result;
}

function futureDatedEvents(data: FinanceData, asOf: string, endDate: string, ids: Set<string>) {
  const result: ForecastMovement[] = [];
  for (const event of data.state.events ?? []) {
    if (event.date <= asOf || event.date > endDate) continue;
    const legs = event.legs.filter((leg) => ids.has(leg.accountId));
    if (!legs.length) continue;
    pushMovement(result, {
      id: `forecast-event-${event.id}`,
      date: event.date,
      label: event.note,
      source: 'dated_event',
      legs,
    }, ids);
  }
  return result;
}

export function cashFlowForecast(data: FinanceData, asOf: string, horizon: ForecastHorizon): CashFlowForecast {
  const endDate = addDays(asOf, horizon);
  const accounts = allAccounts(data).filter((account) => account.kind !== 'credit');
  const ids = new Set(accounts.map((account) => account.id));
  const current = accountBalances(data, asOf);
  const balances = Object.fromEntries(accounts.map((account) => [account.id, Number(current[account.id] || 0)]));
  const currentPortfolio = Object.values(balances).reduce((sum, value) => sum + value, 0);
  const omitted: string[] = [];
  const movements = [
    ...scheduledMovements(data, asOf, endDate, ids, omitted),
    ...recurringMovements(data, asOf, endDate, ids, omitted),
    ...loanMovements(data, asOf, endDate, ids, omitted),
    ...futureDatedEvents(data, asOf, endDate, ids),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));

  const minimumByAccount = { ...balances };
  const firstLow: Record<string, string | null> = Object.fromEntries(accounts.map((account) => [account.id, balances[account.id] < LOW_BALANCE_THRESHOLD ? asOf : null]));
  const firstNegative: Record<string, string | null> = Object.fromEntries(accounts.map((account) => [account.id, balances[account.id] < 0 ? asOf : null]));
  let portfolio = currentPortfolio;
  let minimumPortfolio = currentPortfolio;
  let minimumPortfolioDate = asOf;
  const points: ForecastPoint[] = [{ date: asOf, portfolio, balances: { ...balances } }];

  let index = 0;
  while (index < movements.length) {
    const date = movements[index].date;
    while (index < movements.length && movements[index].date === date) {
      for (const leg of movements[index].legs) {
        if (!ids.has(leg.accountId)) continue;
        balances[leg.accountId] = Number(balances[leg.accountId] || 0) + Number(leg.amount || 0);
      }
      index += 1;
    }
    portfolio = Object.values(balances).reduce((sum, value) => sum + value, 0);
    if (portfolio < minimumPortfolio) { minimumPortfolio = portfolio; minimumPortfolioDate = date; }
    for (const account of accounts) {
      const value = balances[account.id] ?? 0;
      minimumByAccount[account.id] = Math.min(minimumByAccount[account.id] ?? value, value);
      if (!firstLow[account.id] && value < LOW_BALANCE_THRESHOLD) firstLow[account.id] = date;
      if (!firstNegative[account.id] && value < 0) firstNegative[account.id] = date;
    }
    const next = { date, portfolio, balances: { ...balances } };
    if (points.at(-1)?.date === date) points[points.length - 1] = next;
    else points.push(next);
  }
  if (points.at(-1)?.date !== endDate) points.push({ date: endDate, portfolio, balances: { ...balances } });

  const sourceCounts: Record<ForecastSource, number> = { scheduled: 0, recurring: 0, loan: 0, dated_event: 0 };
  movements.forEach((movement) => { sourceCounts[movement.source] += 1; });

  return {
    asOf,
    endDate,
    horizon,
    currentPortfolio,
    projectedPortfolio: portfolio,
    minimumPortfolio,
    minimumPortfolioDate,
    points,
    movements,
    accounts: accounts.map((account) => ({
      accountId: account.id,
      current: Number(current[account.id] || 0),
      projected: Number(balances[account.id] || 0),
      minimum: Number(minimumByAccount[account.id] || 0),
      firstLowDate: firstLow[account.id],
      firstNegativeDate: firstNegative[account.id],
    })),
    omitted,
    sourceCounts,
    insufficientData: movements.length === 0,
  };
}
