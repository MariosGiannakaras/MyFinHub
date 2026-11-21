import type { FinanceEvent } from '../types.js';

/**
 * Editing a credit event is not a new purchase/payment: preserve the exact
 * card identity, and preserve a chosen payment statement. A purchase moved
 * to another billing cycle must be assigned by the existing statement engine
 * instead of keeping a stale statement ID. Changing event kind never copies
 * old card metadata into an unrelated economic event.
 */
export function preserveCreditEventEditLink(next:FinanceEvent,previous:FinanceEvent|null|undefined){
  if(!previous||next.kind!==previous.kind||!previous.cardId||
    (next.kind!=='card_purchase'&&next.kind!=='card_payment'))return next;
  next.cardId=previous.cardId;
  if(next.kind==='card_payment'||next.date===previous.date)next.statementId=previous.statementId;
  return next;
}
