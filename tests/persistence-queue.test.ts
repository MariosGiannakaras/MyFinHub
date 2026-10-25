import { describe, expect, it } from 'vitest';
import { LatestValueQueue, SequentialQueue, canApplyFinanceReload, remoteRevisionAction, shouldWarnBeforeUnload } from '../src/lib/persistenceQueue.js';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('LatestValueQueue', () => {
  it('keeps only the newest pending value behind an in-flight save', async () => {
    const first = deferred();
    const seen: string[] = [];
    const queue = new LatestValueQueue<string>(async (value) => {
      seen.push(value);
      if (value === 'first') await first.promise;
    });

    queue.enqueue('first');
    await Promise.resolve();
    queue.enqueue('second');
    queue.enqueue('third');

    expect(queue.hasWork()).toBe(true);
    first.resolve();
    await queue.whenIdle();

    expect(seen).toEqual(['first', 'third']);
    expect(queue.hasWork()).toBe(false);
  });

  it('does not automatically retry or flush a pending value after a failed save', async () => {
    const first = deferred();
    const seen: string[] = [];
    const queue = new LatestValueQueue<string>(async (value) => {
      seen.push(value);
      if (value === 'first') await first.promise;
    });

    queue.enqueue('first');
    await Promise.resolve();
    queue.enqueue('pending-after-failure');
    first.reject(new Error('network down'));
    await queue.whenIdle();

    expect(seen).toEqual(['first']);
    expect(queue.hasWork()).toBe(false);

    queue.enqueue('explicit-later-change');
    await queue.whenIdle();
    expect(seen).toEqual(['first', 'explicit-later-change']);
  });
});

describe('SequentialQueue', () => {
  it('preserves every accepted finance mutation in FIFO order', async () => {
    const first = deferred();
    const seen:string[]=[];
    const queue=new SequentialQueue<string>(async value=>{seen.push(value);if(value==='first')await first.promise});

    queue.enqueue('first');
    await Promise.resolve();
    queue.enqueue('second');
    queue.enqueue('third');
    expect(queue.hasWork()).toBe(true);
    first.resolve();
    await queue.whenIdle();

    expect(seen).toEqual(['first','second','third']);
    expect(queue.hasWork()).toBe(false);
  });

  it('resolves a receipt for exactly the completed FIFO mutation, not merely when idle', async()=>{
    const first=deferred();
    const seen:string[]=[];
    const queue=new SequentialQueue<string>(async value=>{seen.push(value);if(value==='first')await first.promise});
    const firstReceipt=queue.enqueueWithReceipt('first');
    const secondReceipt=queue.enqueueWithReceipt('second');
    let firstSettled=false;
    void firstReceipt.then(()=>{firstSettled=true});
    await Promise.resolve();
    expect(seen).toEqual(['first']);
    expect(firstSettled).toBe(false);
    first.resolve();
    await firstReceipt;
    expect(firstSettled).toBe(true);
    await secondReceipt;
    await queue.whenIdle();
    expect(seen).toEqual(['first','second']);
  });

  it('rejects the failed active receipt and all dropped dependent receipts', async()=>{
    const first=deferred(),error=new Error('revision conflict');
    const seen:string[]=[];
    const queue=new SequentialQueue<string>(async value=>{seen.push(value);if(value==='first')await first.promise});
    const active=queue.enqueueWithReceipt('first');
    queue.enqueue('fire-and-forget-dependent');
    const dependent=queue.enqueueWithReceipt('receipt-dependent');
    const results=Promise.allSettled([active,dependent]);
    first.reject(error);
    expect(await results).toEqual([
      {status:'rejected',reason:error},
      {status:'rejected',reason:error},
    ]);
    await queue.whenIdle();
    expect(seen).toEqual(['first']);
    expect(queue.hasWork()).toBe(false);
    await expect(queue.enqueueWithReceipt('explicit-retry')).resolves.toBeUndefined();
    expect(seen).toEqual(['first','explicit-retry']);
  });

  it('interleaves receipt and fire-and-forget writes in the same FIFO order', async()=>{
    const seen:string[]=[];
    const queue=new SequentialQueue<string>(async value=>{seen.push(value)});
    queue.enqueue('ordinary-a');
    const receipt=queue.enqueueWithReceipt('receipted');
    queue.enqueue('ordinary-b');
    await receipt;
    await queue.whenIdle();
    expect(seen).toEqual(['ordinary-a','receipted','ordinary-b']);
    expect(queue.hasWork()).toBe(false);
  });

  it('fails closed and discards dependent pending mutations after the first persistence failure', async () => {
    const first=deferred();
    const seen:string[]=[];
    const queue=new SequentialQueue<string>(async value=>{seen.push(value);if(value==='first')await first.promise});

    queue.enqueue('first');
    await Promise.resolve();
    queue.enqueue('must-not-run');
    first.reject(new Error('revision conflict'));
    await queue.whenIdle();
    expect(seen).toEqual(['first']);
    expect(queue.hasWork()).toBe(false);

    queue.enqueue('explicit-later-change');
    await queue.whenIdle();
    expect(seen).toEqual(['first','explicit-later-change']);
  });
});

describe('remoteRevisionAction', () => {
  it('ignores the same or an older revision', () => {
    expect(remoteRevisionAction('12', '12', false, false)).toBe('ignore');
    expect(remoteRevisionAction('12', '11', false, false)).toBe('ignore');
  });

  it('reloads a clean tab for a newer revision', () => {
    expect(remoteRevisionAction('12', '13', false, false)).toBe('reload');
  });

  it('turns a newer remote revision into a conflict when local work is unsafe to replace', () => {
    expect(remoteRevisionAction('12', '13', true, false)).toBe('conflict');
    expect(remoteRevisionAction('12', '13', false, true)).toBe('conflict');
  });

  it('keeps hard reload guarded while a write is pending or the last save failed', () => {
    expect(shouldWarnBeforeUnload(false,false)).toBe(false);
    expect(shouldWarnBeforeUnload(true,false)).toBe(true);
    expect(shouldWarnBeforeUnload(false,true)).toBe(true);
    expect(shouldWarnBeforeUnload(true,true)).toBe(true);
  });

});

describe('finance reload request generation race safety',()=>{
  const apply=(readMutationEpoch:number,currentMutationEpoch:number,readId:number,currentId:number,work:boolean,exclusive:boolean,state:string)=>
    canApplyFinanceReload(readMutationEpoch,currentMutationEpoch,readId,currentId,work,exclusive,state);

  it('keeps a stable loading snapshot eligible but refuses any pending writer or cursor move',()=>{
    expect(apply(4,4,9,9,false,false,'loading')).toBe(true);
    expect(apply(4,4,9,9,true,false,'loading')).toBe(false);
    expect(apply(4,4,9,9,false,true,'loading')).toBe(false);
    expect(apply(4,4,9,9,false,false,'conflict')).toBe(false);
    expect(apply(4,4,9,9,false,false,'error')).toBe(false);
  });

  it('rejects a delayed old load after a save finishes, even when there is no queued work',async()=>{
    let resolveRead!: (value:string)=>void;
    const oldRead=new Promise<string>(resolve=>{resolveRead=resolve});
    const accepted:string[]=[];
    let mutationEpoch=12;
    const startedEpoch=mutationEpoch;
    const task=oldRead.then(snapshot=>{
      if(apply(startedEpoch,mutationEpoch,5,5,false,false,'loading'))accepted.push(snapshot);
    });
    mutationEpoch+=1; // Optimistic write started and received its server revision meanwhile.
    resolveRead('stale-before-save');
    await task;
    expect(accepted).toEqual([]);
    expect(apply(startedEpoch,mutationEpoch,5,5,false,false,'loading')).toBe(false);
  });

  it('only the newest reload may install results, including failed or superseded remote reads',()=>{
    expect(apply(7,7,14,15,false,false,'loading')).toBe(false);
    expect(apply(7,7,15,15,false,false,'loading')).toBe(true);
    expect(apply(7,8,15,15,false,false,'loading')).toBe(false);
  });
});
