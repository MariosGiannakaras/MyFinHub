export type ReceiptFieldConfidence = {
  merchant?: number;
  date?: number;
  total?: number;
  currency?: number;
  ocr?: number;
};

export type ReceiptProposal = {
  merchant?: string;
  date?: string;
  total?: number;
  currency?: string;
  category?: string;
  accountId?: string;
  confidence?: ReceiptFieldConfidence;
};

export type ReceiptDraftStatus = 'pending' | 'ready' | 'error';

export type ReceiptDraft = {
  id: string;
  capturedAt: string;
  updatedAt: string;
  status: ReceiptDraftStatus;
  image: Blob;
  mimeType: 'image/jpeg' | 'image/png';
  bytes: number;
  width: number;
  height: number;
  proposal?: ReceiptProposal;
  errorCode?: 'ocr-failed' | 'unsupported-image' | 'storage';
};

export type NormalizedReceiptImage = Pick<ReceiptDraft, 'image' | 'mimeType' | 'bytes' | 'width' | 'height'>;

export const RECEIPT_DRAFT_LIMIT = 30;
export const RECEIPT_STORAGE_BUDGET_BYTES = 60 * 1024 * 1024;

const DB_NAME = 'myfinhub-local-receipts-v1';
const DB_VERSION = 1;
const STORE = 'receipts';

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
});

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
});

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('Η τοπική αποθήκευση αποδείξεων δεν υποστηρίζεται σε αυτό το περιβάλλον.'));
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Δεν άνοιξε η τοπική αποθήκευση αποδείξεων.'));
});

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T> | T) => {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = await run(store);
    await transactionDone(transaction);
    return result;
  } finally {
    db.close();
  }
};

export async function listReceiptDrafts(): Promise<ReceiptDraft[]> {
  return withStore('readonly', async (store) => {
    const rows = await requestResult(store.getAll() as IDBRequest<ReceiptDraft[]>);
    return rows.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  });
}

export async function getReceiptDraft(id: string): Promise<ReceiptDraft | null> {
  return withStore('readonly', async (store) => {
    const row = await requestResult(store.get(id) as IDBRequest<ReceiptDraft | undefined>);
    return row ?? null;
  });
}

export async function requestPersistentReceiptStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function createReceiptDraft(image: NormalizedReceiptImage): Promise<ReceiptDraft> {
  const existing = await listReceiptDrafts();
  const usedBytes = existing.reduce((sum, draft) => sum + Number(draft.bytes || draft.image.size || 0), 0);
  if (existing.length >= RECEIPT_DRAFT_LIMIT) {
    throw new Error(`Έχεις ήδη ${RECEIPT_DRAFT_LIMIT} αποδείξεις σε αναμονή. Επεξεργάσου ή διέγραψε κάποια πριν προσθέσεις άλλη.`);
  }
  if (usedBytes + image.bytes > RECEIPT_STORAGE_BUDGET_BYTES) {
    throw new Error('Ο τοπικός χώρος για αποδείξεις σε αναμονή έφτασε το όριό του. Επεξεργάσου ή διέγραψε παλιότερες αποδείξεις.');
  }
  const now = new Date().toISOString();
  const draft: ReceiptDraft = {
    id: typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    capturedAt: now,
    updatedAt: now,
    status: 'pending',
    ...image,
  };
  await withStore('readwrite', (store) => { store.put(draft); });
  void requestPersistentReceiptStorage();
  return draft;
}

export async function saveReceiptProposal(id: string, proposal: ReceiptProposal): Promise<ReceiptDraft> {
  const draft = await getReceiptDraft(id);
  if (!draft) throw new Error('Η απόδειξη δεν υπάρχει πλέον στην τοπική αναμονή.');
  const next: ReceiptDraft = {
    ...draft,
    status: 'ready',
    proposal,
    errorCode: undefined,
    updatedAt: new Date().toISOString(),
  };
  await withStore('readwrite', (store) => { store.put(next); });
  return next;
}

export async function markReceiptDraftError(id: string, errorCode: ReceiptDraft['errorCode'] = 'ocr-failed') {
  const draft = await getReceiptDraft(id);
  if (!draft) return null;
  const next: ReceiptDraft = {
    ...draft,
    status: 'error',
    errorCode,
    updatedAt: new Date().toISOString(),
  };
  await withStore('readwrite', (store) => { store.put(next); });
  return next;
}

export async function deleteReceiptDraft(id: string) {
  await withStore('readwrite', (store) => { store.delete(id); });
}

export async function deleteReceiptDrafts(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  await withStore('readwrite', (store) => {
    for (const id of unique) store.delete(id);
  });
}
