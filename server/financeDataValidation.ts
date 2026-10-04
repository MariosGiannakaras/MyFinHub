import type { FinanceData } from '../src/types.js';
import { validateCardStateExtensions } from './cardStateValidation.js';
import { validateCategoryIdentityState } from './categoryIdentityValidation.js';
import { validateRecurringCadenceData } from './recurringCadenceValidation.js';
import { validateCompleteFinanceSemantics } from './financeSemanticValidation.js';
import { validateFinanceData } from './validation.js';

/**
 * Canonical full-document trust boundary.
 *
 * Structural validation alone is not enough for additive product domains:
 * cards/statements, category identities and recurring cadence carry relational
 * invariants that must be enforced on imports and stored-data reads as well as
 * normal mutable saves.
 */
export function validateCompleteFinanceData(value: unknown): asserts value is FinanceData {
  validateFinanceData(value);
  const data=value as FinanceData;
  validateCardStateExtensions(data.state);
  validateCategoryIdentityState(data.state);
  validateRecurringCadenceData(data);
  validateCompleteFinanceSemantics(data);
}
