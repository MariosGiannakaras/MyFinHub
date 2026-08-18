import { normalizeLocalCvv } from './localCvvFormat';
export { normalizeLocalCvv } from './localCvvFormat';

const DB_NAME = 'rheomiq-local-card-vault';
const DB_VERSION = 1;
const KEY_STORE = 'keys';
const CVV_STORE = 'cvv';
const KEY_ID = 'cvv-aes-gcm-v1';
const RECORD_VERSION = 1;
const IV_BYTES = 12;

export type LocalCvvRecord = {
  version: number;
  cardId: string;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  updatedAt: string;
};

function requireBrowserCrypto() {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('LOCAL_CVV_UNAVAILABLE');
  }
}

function openDb() {
  requireBrowserCrypto();
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(CVV_STORE)) db.createObjectStore(CVV_STORE, { keyPath: 'cardId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('LOCAL_CVV_DATABASE_FAILED'));
    request.onblocked = () => reject(new Error('LOCAL_CVV_DATABASE_BLOCKED'));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('LOCAL_CVV_DATABASE_FAILED'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('LOCAL_CVV_DATABASE_FAILED'));
    transaction.onabort = () => reject(transaction.error ?? new Error('LOCAL_CVV_DATABASE_ABORTED'));
  });
}

async function readStore<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  try {
    const transaction = db.transaction(storeName, 'readonly');
    const done = transactionDone(transaction);
    const value = await requestResult(transaction.objectStore(storeName).get(key));
    await done;
    return value as T | undefined;
  } finally {
    db.close();
  }
}

async function writeStore(storeName: string, value: unknown, key?: IDBValidKey) {
  const db = await openDb();
  try {
    const transaction = db.transaction(storeName, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(storeName);
    if (key === undefined) store.put(value);
    else store.put(value, key);
    await done;
  } finally {
    db.close();
  }
}

async function deleteStore(storeName: string, key: IDBValidKey) {
  const db = await openDb();
  try {
    const transaction = db.transaction(storeName, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(storeName).delete(key);
    await done;
  } finally {
    db.close();
  }
}

function looksLikeCryptoKey(value: unknown): value is CryptoKey {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CryptoKey>;
  return candidate.type === 'secret' && Boolean(candidate.algorithm) && Array.isArray(candidate.usages);
}

async function encryptionKey(): Promise<CryptoKey> {
  const existing = await readStore<unknown>(KEY_STORE, KEY_ID);
  if (looksLikeCryptoKey(existing)) return existing;

  const generated = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  ) as CryptoKey;

  await writeStore(KEY_STORE, generated, KEY_ID);
  return generated;
}

function aad(cardId: string) {
  if (!cardId || cardId.length > 160) throw new Error('INVALID_CARD_ID');
  const origin = typeof location === 'undefined' ? 'local' : location.origin;
  return new TextEncoder().encode(`rheomiq-local-cvv-v1:${origin}:${cardId}:${RECORD_VERSION}`);
}

export async function encryptLocalCvvValue(cardId: string, cvv: string, key: CryptoKey) {
  const normalized = normalizeLocalCvv(cvv);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(cardId), tagLength: 128 },
    key,
    new TextEncoder().encode(normalized),
  );
  return { iv, ciphertext };
}

export async function decryptLocalCvvValue(cardId: string, record: Pick<LocalCvvRecord, 'iv' | 'ciphertext'>, key: CryptoKey) {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(record.iv), additionalData: aad(cardId), tagLength: 128 },
      key,
      record.ciphertext,
    );
    return normalizeLocalCvv(new TextDecoder().decode(plaintext));
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CVV') throw error;
    throw new Error('LOCAL_CVV_DECRYPT_FAILED');
  }
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Persistence is best-effort. IndexedDB still remains available when the browser declines.
  }
}

export async function saveLocalCvv(cardId: string, cvv: string) {
  requireBrowserCrypto();
  const key = await encryptionKey();
  const encrypted = await encryptLocalCvvValue(cardId, cvv, key);
  const record: LocalCvvRecord = {
    version: RECORD_VERSION,
    cardId,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(CVV_STORE, record);
  await requestPersistentStorage();
}

export async function readLocalCvv(cardId: string) {
  requireBrowserCrypto();
  const record = await readStore<LocalCvvRecord>(CVV_STORE, cardId);
  if (!record) return null;
  if (record.version !== RECORD_VERSION || record.cardId !== cardId) throw new Error('LOCAL_CVV_RECORD_INVALID');
  return decryptLocalCvvValue(cardId, record, await encryptionKey());
}

export async function hasLocalCvv(cardId: string) {
  requireBrowserCrypto();
  return Boolean(await readStore<LocalCvvRecord>(CVV_STORE, cardId));
}

export async function deleteLocalCvv(cardId: string) {
  requireBrowserCrypto();
  await deleteStore(CVV_STORE, cardId);
}
