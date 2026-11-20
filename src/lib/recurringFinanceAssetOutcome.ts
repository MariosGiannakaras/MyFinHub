import { financeWriteDefinitelyRejected } from './financeWriteOutcome.js';

/** Use the common strict precommit finance-rejection predicate when deciding
 * whether deleting an independently stored recurring image is safe. */
export const recurringFinanceWriteDefinitelyRejected=financeWriteDefinitelyRejected;
