import type { FinanceData } from '../types.js';
import { migrateData } from './domain.js';

/**
 * Product-level schema migration wrapper.
 *
 * The historical schema-v3 migrator predates the Cards domain and rebuilds the
 * mutable state object from its then-known fields. Preserve newer card metadata
 * explicitly so reads/imports never drop shared card identities while the
 * canonical FinanceData schema remains backwards compatible.
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
    },
  };
}
