import { ApiError } from './api.js';

// A received precommit stale-revision rejection is the only generic
// server response proven not to have committed this finance mutation.
// All lost/timeout/5xx replies, untyped failures and postcommit history
// mismatches must not trigger blind resubmission of a newly generated event.
export function financeWriteDefinitelyRejected(error:unknown):boolean{
  return error instanceof ApiError
    &&error.status===409&&error.code==='REVISION_CONFLICT';
}

export const FINANCE_RECEIPT_UNVERIFIED=
  'Η οικονομική κίνηση ίσως έχει ήδη αποθηκευτεί, αλλά δεν επιβεβαιώθηκε η απάντηση. Μην την καταχωρίσεις ξανά. Κλείσε τη φόρμα και φόρτωσε την τελευταία αποθηκευμένη κατάσταση πριν συνεχίσεις.';
