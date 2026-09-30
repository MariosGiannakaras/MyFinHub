import type { FinanceData } from '../types.js';
import { ensureCategoryIdentities } from './categoryIdentity.js';
import { migrateData } from './domain.js';

/**
 * Product-level schema migration wrapper.
 *
 * The historical schema-v3 migrator predates later product domains and rebuilds
 * mutable state from its then-known fields. Preserve additive product metadata
 * explicitly so reads/imports never drop Cards, Credit Statements, Scheduled
 * Transactions, Action Center decisions, budgets, transaction rules or category
 * configuration while the canonical FinanceData schema remains backwards compatible.
 */
export function migrateProductData(input:FinanceData):FinanceData{
  const migrated=migrateData(input);
  const sourceState=input.state??({} as FinanceData['state']);
  const settings=ensureCategoryIdentities({
    ...migrated.state.settings,
    expenseCategoryTree:sourceState.settings?.expenseCategoryTree??migrated.state.settings.expenseCategoryTree,
    incomeCategoryTree:sourceState.settings?.incomeCategoryTree??migrated.state.settings.incomeCategoryTree,
    categoryIdentities:sourceState.settings?.categoryIdentities??migrated.state.settings.categoryIdentities,
    categoryIcons:sourceState.settings?.categoryIcons??migrated.state.settings.categoryIcons,
    subcategoryIcons:sourceState.settings?.subcategoryIcons??migrated.state.settings.subcategoryIcons,
    categoryIconPack:sourceState.settings?.categoryIconPack??migrated.state.settings.categoryIconPack,
    categoryIconPackSelections:sourceState.settings?.categoryIconPackSelections??migrated.state.settings.categoryIconPackSelections,
    subcategoryIconPackSelections:sourceState.settings?.subcategoryIconPackSelections??migrated.state.settings.subcategoryIconPackSelections,
    categoryIconColors:sourceState.settings?.categoryIconColors??migrated.state.settings.categoryIconColors,
    subcategoryIconColors:sourceState.settings?.subcategoryIconColors??migrated.state.settings.subcategoryIconColors,
  });
  return {
    ...migrated,
    state:{
      ...migrated.state,
      settings,
      cardBanks:sourceState.cardBanks??[],
      cards:(sourceState.cards??[]).map(card=>card.kind==='credit'&&!card.statementBoundaryRule?{...card,statementBoundaryRule:'next-cycle' as const}:card),
      deletedCards:sourceState.deletedCards??[],
      creditStatements:sourceState.creditStatements??[],
      scheduled:sourceState.scheduled??[],
      attentionDecisions:sourceState.attentionDecisions??{},
      budgets:sourceState.budgets??[],
      savingsGoals:sourceState.savingsGoals??[],
      transactionRules:sourceState.transactionRules??[],
    },
  };
}
