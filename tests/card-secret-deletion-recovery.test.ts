import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {FinanceData,PaymentCard} from '../src/types.js';
import {withCardSecretCleanupPending} from '../src/lib/cards.js';

const stubs=vi.hoisted(()=>({remote:vi.fn(),local:vi.fn()}));
vi.mock('../src/lib/cardVaultClient.js',()=>({deleteCardSecret:stubs.remote}));
vi.mock('../src/lib/localCvvVault.js',()=>({deleteLocalCvv:stubs.local}));
import {finishCardDeletion} from '../src/lib/cardSecretDeletion.js';

const card:PaymentCard={id:'my-card',bankId:'bank',nickname:'Card',kind:'debit',network:'visa',active:true,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'};
function pending():FinanceData{
  const base={state:{cards:[card]}} as unknown as FinanceData;
  return withCardSecretCleanupPending(base,card,'2026-10-10T01:00:00.000Z','2026-10-10');
}
beforeEach(()=>{stubs.remote.mockReset();stubs.local.mockReset();stubs.remote.mockResolvedValue({deleted:true});stubs.local.mockResolvedValue(undefined)});

describe('recoverable encrypted card-vault cleanup',()=>{
  it('deletes remote, then local secret, then acknowledges the finance marker',async()=>{
    let state=pending();const seen:string[]=[];
    stubs.remote.mockImplementation(async(id:string,confirmed:boolean)=>{seen.push('remote');expect(id).toBe(card.id);expect(confirmed).toBe(true)});
    stubs.local.mockImplementation(async()=>{seen.push('local')});
    const update=async(recipe:(s:FinanceData)=>FinanceData)=>{seen.push('finance');state=recipe(state)};
    await finishCardDeletion(card.id,update);
    expect(seen).toEqual(['remote','local','finance']);
    expect(state.state.pendingCardSecretDeletes).toEqual([]);
  });

  it('retains durable cleanup intent and local CVV when remote delete fails',async()=>{
    let state=pending();const update=vi.fn(async(recipe:(s:FinanceData)=>FinanceData)=>{state=recipe(state)});
    stubs.remote.mockRejectedValue(new Error('network unavailable'));
    await expect(finishCardDeletion(card.id,update)).rejects.toThrow('network unavailable');
    expect(stubs.local).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(state.state.pendingCardSecretDeletes).toEqual([card.id]);
  });

  it('retains the marker when local CVV cleanup fails so another session can retry',async()=>{
    let state=pending();const update=vi.fn(async(recipe:(s:FinanceData)=>FinanceData)=>{state=recipe(state)});
    stubs.local.mockRejectedValueOnce(new Error('indexedDB locked'));
    await expect(finishCardDeletion(card.id,update)).rejects.toThrow('indexedDB locked');
    expect(update).not.toHaveBeenCalled();
    expect(state.state.pendingCardSecretDeletes).toEqual([card.id]);
    await finishCardDeletion(card.id,update);
    expect(stubs.remote).toHaveBeenCalledTimes(2);
    expect(state.state.pendingCardSecretDeletes).toEqual([]);
  });

  it('does not clear marker after a failed revisioned completion save',async()=>{
    let state=pending();
    const fail=async(_recipe:(s:FinanceData)=>FinanceData):Promise<void>=>{throw new Error('history conflict')};
    await expect(finishCardDeletion(card.id,fail)).rejects.toThrow('history conflict');
    expect(state.state.pendingCardSecretDeletes).toEqual([card.id]);
    await finishCardDeletion(card.id,async recipe=>{state=recipe(state)});
    expect(state.state.pendingCardSecretDeletes).toEqual([]);
  });
});
