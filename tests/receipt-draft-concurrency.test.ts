import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertReceiptDraftUnposted,
  createReceiptDraft,
  deleteReceiptDraft,
  listReceiptDrafts,
  markReceiptDraftError,
  markReceiptDraftPosted,
  saveReceiptProposal,
  type NormalizedReceiptImage,
  type ReceiptDraft,
} from '../src/lib/receiptDrafts.js';

// Deterministic async IndexedDB protocol: overlapping readwrite transactions
// are serialized, requests complete before the transaction commit event.
function localIndexedDb(initial: ReceiptDraft[] = []) {
  const rows = new Map(initial.map(draft => [draft.id, draft]));
  let lastTransaction = Promise.resolve();
  const request = <T>(result: T) => ({
    result,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  });
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => { throw new Error('Unexpected IndexedDB schema migration'); },
    transaction: (_store: string, _mode: string) => {
      let release!: () => void;
      const gate = lastTransaction;
      lastTransaction = new Promise<void>(resolve => { release = resolve; });
      let pending = 0;
      let finished = false;
      let finishTimer: ReturnType<typeof setTimeout> | undefined;
      const tx = {
        oncomplete: null as (() => void) | null,
        onabort: null as (() => void) | null,
        onerror: null as (() => void) | null,
        objectStore: (_name: string) => store,
      };
      function maybeFinish() {
        if (finishTimer) clearTimeout(finishTimer);
        if (pending !== 0 || finished) return;
        finishTimer = setTimeout(() => {
          if (pending !== 0 || finished) return;
          finished = true;
          tx.oncomplete?.();
          release();
        }, 0);
      }
      function enqueue<T>(op: () => T) {
        pending += 1;
        const req = request<T>(undefined as T);
        void gate.then(() => {
          setTimeout(() => {
            req.result = op();
            pending -= 1;
            req.onsuccess?.();
            maybeFinish();
          }, 0);
        });
        return req;
      }
      const store = {
        getAll: () => enqueue(() => [...rows.values()]),
        get: (id: string) => enqueue(() => rows.get(id)),
        put: (draft: ReceiptDraft) => enqueue(() => { rows.set(draft.id, draft); return draft.id; }),
        delete: (id: string) => enqueue(() => { rows.delete(id); }),
      };
      return tx;
    },
    close: () => {},
  };
  return {
    open: (_name: string, _version: number) => {
      const req = { ...request(db), onupgradeneeded: null as (() => void) | null };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
  };
}

const image = (bytes: number): NormalizedReceiptImage => ({
  image: new Blob(['receipt pixels'], { type: 'image/jpeg' }),
  mimeType: 'image/jpeg',
  bytes,
  width: 100,
  height: 100,
});

const existing = (id: string, bytes: number): ReceiptDraft => ({
  id,
  capturedAt: '2026-01-01T12:00:00.000Z',
  updatedAt: '2026-01-01T12:00:00.000Z',
  status: 'pending',
  ...image(bytes),
});

afterEach(() => vi.unstubAllGlobals());

describe('local receipts: real persistence functions with serialized IndexedDB transactions', () => {
  it('accepts at most one simultaneous capture when 29 of 30 slots exist', async () => {
    vi.stubGlobal('indexedDB', localIndexedDb(Array.from({ length: 29 }, (_, i) => existing('old-' + i, 1))));
    const writes = await Promise.allSettled([createReceiptDraft(image(1)), createReceiptDraft(image(1))]);
    expect(writes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(writes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await listReceiptDrafts()).length).toBe(30);
  });

  it('accepts at most one simultaneous capture at the unchanged 60 MiB byte cap', async () => {
    const mebibyte = 1024 * 1024;
    vi.stubGlobal('indexedDB', localIndexedDb([existing('old', 58 * mebibyte + 1)]));
    const writes = await Promise.allSettled([
      createReceiptDraft(image(mebibyte)),
      createReceiptDraft(image(mebibyte)),
    ]);
    expect(writes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(writes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await listReceiptDrafts()).toHaveLength(2);
  });

  it('never resurrects deleted receipts through an overlapping proposal or error update', async () => {
    vi.stubGlobal('indexedDB', localIndexedDb([existing('gone', 1), existing('also-gone', 1)]));
    const [deleted, attemptedUpdate] = await Promise.allSettled([
      deleteReceiptDraft('gone'),
      saveReceiptProposal('gone', { merchant: 'local only' }),
    ]);
    expect(deleted.status).toBe('fulfilled');
    expect(attemptedUpdate.status).toBe('rejected');
    const [secondDelete, laterError] = await Promise.all([
      deleteReceiptDraft('also-gone'),
      markReceiptDraftError('also-gone'),
    ]);
    expect(secondDelete).toBeUndefined();
    expect(laterError).toBeNull();
    expect(await listReceiptDrafts()).toEqual([]);
  });
  it('blocks a stale Quick Entry receipt handoff after another tab posted or deleted the draft',async()=>{
    vi.stubGlobal('indexedDB',localIndexedDb([existing('stale',1)]));
    await expect(assertReceiptDraftUnposted('stale')).resolves.toBeUndefined();
    await markReceiptDraftPosted('stale');
    await expect(assertReceiptDraftUnposted('stale')).rejects.toThrow('Μην καταχωρίσεις ξανά');
    await deleteReceiptDraft('stale');
    await expect(assertReceiptDraftUnposted('stale')).rejects.toThrow('δεν υπάρχει πλέον');
    expect(await listReceiptDrafts()).toEqual([]);
  });
  it('retains a durably posted receipt after local cleanup fails and disallows a second finance handoff',async()=>{
    vi.stubGlobal('indexedDB',localIndexedDb([existing('committed',1)]));
    await markReceiptDraftPosted('committed');
    expect(await listReceiptDrafts()).toMatchObject([{id:'committed',status:'posted'}]);
    await expect(saveReceiptProposal('committed',{merchant:'duplicate'}))
      .rejects.toThrow('Η οικονομική κίνηση έχει ήδη καταχωριστεί');
    await expect(markReceiptDraftError('committed')).resolves.toMatchObject({status:'posted'});
    expect(await listReceiptDrafts()).toMatchObject([{id:'committed',status:'posted'}]);
    await markReceiptDraftPosted('committed'); // idempotent local marker
    await deleteReceiptDraft('committed');
    expect(await listReceiptDrafts()).toEqual([]);
  });

});
