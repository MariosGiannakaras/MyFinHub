import type { FinanceEvent } from '../types.js';

/**
 * A finance event's origin is historical provenance, not the actor on its
 * latest revision. Generic Quick Entry edits rebuild events; do not silently
 * erase non-editable lending/savings metadata on a note/amount correction.
 */
export function preserveEntryEditProvenance(next:FinanceEvent,previous:FinanceEvent|null|undefined){
  if(!previous)return next;
  if(previous.source)next.source=previous.source;
  if(previous.kind!==next.kind)return next;

  if(next.kind==='lending'&&previous.expectedReturnDate){
    // The editor has no due-date control. Do not make an inconsistent date
    // change look valid by dropping the owner-confirmed return date.
    if(next.date!==previous.date&&next.date>previous.expectedReturnDate)
      throw new Error('Η νέα ημερομηνία δανεισμού είναι μετά την ήδη καταγεγραμμένη αναμενόμενη επιστροφή. Διόρθωσε πρώτα τα στοιχεία της υποχρέωσης.');
    next.expectedReturnDate=previous.expectedReturnDate;
  }
  if(next.kind==='saving_cash_offset'&&previous.savingSource)
    next.savingSource=previous.savingSource;
  return next;
}
