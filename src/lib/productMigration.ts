import type { FinanceData } from '../types.js';
import { migrateData } from './domain.js';

/**
 * Product-level schema migration wrapper.
 *
 * The historical schema-v3 migrator predates later product domains and rebuilds
 * mutable state from its then-known fields. Preserve additive product metadata
 * explicitly so reads/imports never drop Cards, Scheduled Transactions, Action
 * Center decisions, budgets, transaction rules or category configuration while
 * the canonical FinanceData schema remains backwards compatible.
 */
export function migrateProductData(input:FinanceData):FinanceData{
  const migrated=migrateData(input);
  const sourceState=input.state??({} as FinanceData['state']);
  return {
    ...migrated,
    state:{
      ...migrated.state,
      settings:{
        ...migrated.state.settings,
        expenseCategoryTree:sourceState.settings?.expenseCategoryTree??migrated.state.settings.expenseCategoryTree,
        incomeCategoryTree:sourceState.settings?.incomeCategoryTree??migrated.state.settings.incomeCategoryTree,
        categoryIcons:sourceState.settings?.categoryIcons??migrated.state.settings.categoryIcons,
        subcategoryIcons:sourceState.settings?.subcategoryIcons??migrated.state.settings.subcategoryIcons,
      },
      cardBanks:sourceState.cardBanks??[],
      cards:sourceState.cards??[],
      scheduled:sourceState.scheduled??[],
      attentionDecisions:sourceState.attentionDecisions??{},
      budgets:sourceState.budgets??[],
      transactionRules:sourceState.transactionRules??[],
    },
  };
}
