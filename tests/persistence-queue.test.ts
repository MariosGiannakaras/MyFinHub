import { describe, expect, it } from 'vitest';
import { LatestValueQueue, SequentialQueue, remoteRevisionAction } from '../src/lib/persistenceQueue.js';

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
});
