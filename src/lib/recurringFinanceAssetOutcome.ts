import { ApiError } from './api.js';

/** Only an explicit precommit stale-revision rejection proves the new
 * recurring image is unreferenced by this finance mutation. In particular,
 * a HISTORY_CURSOR_CONFLICT may be discovered AFTER a successful commit.
 */
export function recurringFinanceWriteDefinitelyRejected(error:unknown):boolean{
  return error instanceof ApiError&&error.status===409&&error.code==='REVISION_CONFLICT';
}
