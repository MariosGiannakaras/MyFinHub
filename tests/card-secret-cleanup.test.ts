import {describe,expect,it} from 'vitest';
import {validateCardStateExtensions} from '../server/cardStateValidation.js';
import {withCardSecretCleanupPending,withCardSecretCleanupComplete} from '../src/lib/cards.js';
import type {FinanceData,PaymentCard} from '../src/types.js';
const card:PaymentCard={id:'test-debit',bankId:'bank',nickname:'Test',kind:'debit',network:'visa',active:false,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'};
const fixture=():FinanceData=>({state:{cards:[card]}} as unknown as FinanceData);
describe('durable card vault deletion intent',()=>{
  it('persists an opaque cleanup marker with the revisioned profile removal',()=>{
    const removed=withCardSecretCleanupPending(fixture(),card,'2026-10-10T00:00:00.000Z','2026-10-10');
    expect(removed.state.cards).toEqual([]);
    expect(removed.state.pendingCardSecretDeletes).toEqual([card.id]);
    expect(()=>validateCardStateExtensions(removed.state)).not.toThrow();
    expect(withCardSecretCleanupComplete(removed,card.id).state.pendingCardSecretDeletes).toEqual([]);
  });
  it('fails closed on missing or still-active profiles',()=>{
    expect(()=>withCardSecretCleanupPending(fixture(),{...card,id:'missing'},'2026-10-10T00:00:00.000Z','2026-10-10')).toThrow('CARD_PROFILE_NOT_FOUND');
    const invalid={...fixture(),state:{...fixture().state,pendingCardSecretDeletes:[card.id]}};
    expect(()=>validateCardStateExtensions(invalid.state)).toThrow();
    expect(()=>withCardSecretCleanupComplete(invalid,card.id)).toThrow('CARD_PROFILE_STILL_ACTIVE');
  });
  it('rejects duplicate and malformed pending IDs',()=>{
    const state={...fixture().state,cards:[]};
    expect(()=>validateCardStateExtensions({...state,pendingCardSecretDeletes:['safe','safe']})).toThrow();
    expect(()=>validateCardStateExtensions({...state,pendingCardSecretDeletes:['../../bad']})).toThrow();
  });
});