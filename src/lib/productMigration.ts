import type { FinanceData } from '../types.js';
import { migrateData } from './domain.js';

/**
 * Product-level schema migration wrapper.
 *
 * The historical schema-v3 migrator predates later product domains and rebuilds
 * mutable state from its then-known fields. Preserve additive product metadata
 * explicitly so reads/imports never drop Cards or Scheduled Transactions while
 * the canonical FinanceData schema remains backwards compatible.
 */
export function migrateProductData(input:FinanceData):FinanceData{
  const migrated=migrateData(input);
  const sourceState=input.state??({} as FinanceData['state']);
  return {
    ...migrated,
    state:{
      ...migrated.state,
      cardBanks:sourceState.cardBanks??[],
      cards:sourceState.cards??[],
      scheduled:sourceState.scheduled??[],
    },
  };
}
