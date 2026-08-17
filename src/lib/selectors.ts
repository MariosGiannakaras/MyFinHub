import {
  accountBalances,
  availableMoney,
  categoryTotals,
  dailyExpenseSeries,
  frequentDescriptions,
  monthlyFlow,
  netWorth,
} from './domain.js';
import type { FinanceData } from '../types.js';

type CacheBucket = {
  balances: Map<string, ReturnType<typeof accountBalances>>;
  available: Map<string, number>;
  netWorth: Map<string, number>;
  monthlyFlow: Map<string, ReturnType<typeof monthlyFlow>>;
  categories: Map<string, ReturnType<typeof categoryTotals>>;
  dailyExpense: Map<string, ReturnType<typeof dailyExpenseSeries>>;
  frequent: Map<string, ReturnType<typeof frequentDescriptions>>;
};

const cache = new WeakMap<FinanceData, CacheBucket>();

function bucket(data: FinanceData) {
  let value = cache.get(data);
  if (!value) {
    value = {
      balances: new Map(),
      available: new Map(),
      netWorth: new Map(),
      monthlyFlow: new Map(),
      categories: new Map(),
      dailyExpense: new Map(),
      frequent: new Map(),
    };
    cache.set(data, value);
  }
  return value;
}

function memo<K, V>(map: Map<K, V>, key: K, calculate: () => V) {
  if (map.has(key)) return map.get(key)!;
  const value = calculate();
  map.set(key, value);
  return value;
}

export function selectAccountBalances(data: FinanceData, asOf: string) {
  return memo(bucket(data).balances, asOf, () => accountBalances(data, asOf));
}

export function selectAvailableMoney(data: FinanceData, asOf: string) {
  return memo(bucket(data).available, asOf, () => availableMoney(data, asOf));
}

export function selectNetWorth(data: FinanceData, asOf: string) {
  return memo(bucket(data).netWorth, asOf, () => netWorth(data, asOf));
}

export function selectMonthlyFlow(data: FinanceData, month: string) {
  return memo(bucket(data).monthlyFlow, month, () => monthlyFlow(data, month));
}

export function selectCategoryTotals(data: FinanceData, month: string) {
  return memo(bucket(data).categories, month, () => categoryTotals(data, month));
}

export function selectDailyExpenseSeries(data: FinanceData, month: string) {
  return memo(bucket(data).dailyExpense, month, () => dailyExpenseSeries(data, month));
}

export function selectFrequentDescriptions(data: FinanceData, kind: 'expense' | 'income', limit = 8) {
  const key = `${kind}:${limit}`;
  return memo(bucket(data).frequent, key, () => frequentDescriptions(data, kind, limit));
}
