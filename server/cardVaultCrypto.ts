import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type CardSecretPlaintext = {
  pan?: string;
  expiry?: string;
};

export type CardSecretEnvelope = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function normalizePan(value?: string) {
  if (value == null || value.trim() === '') return undefined;
  const digits = value.replace(/\D/g, '');
  if (!digits) throw new Error('INVALID_CARD_PAN');
  return digits;
}

function normalizeExpiry(value?: string) {
  if (value == null || value.trim() === '') return undefined;
  const match = value.trim().match(/^(0[1-9]|1[0-2])\s*[/\-]\s*(\d{2}|\d{4})$/);
  if (!match) throw new Error('INVALID_CARD_EXPIRY');
  const year = match[2].length === 4 ? match[2].slice(2) : match[2];
  return `${match[1]}/${year}`;
}

export function normalizeCardSecrets(input: unknown): CardSecretPlaintext {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_CARD_SECRET');
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!['pan', 'expiry'].includes(key)) {
      if (key.toLowerCase() === 'cvv' || key.toLowerCase() === 'cvc' || key.toLowerCase() === 'securitycode') throw new Error('CVV_PERSISTENCE_DISABLED');
      throw new Error('INVALID_CARD_SECRET');
    }
  }
  const pan = typeof record.pan === 'string' ? normalizePan(record.pan) : record.pan == null ? undefined : (() => { throw new Error('INVALID_CARD_PAN'); })();
  const expiry = typeof record.expiry === 'string' ? normalizeExpiry(record.expiry) : record.expiry == null ? undefined : (() => { throw new Error('INVALID_CARD_EXPIRY'); })();
  if (!pan && !expiry) throw new Error('EMPTY_CARD_SECRET');
  return { pan, expiry };
}

function parseKey(raw: string | undefined) {
  if (!raw) throw new Error('CARD_VAULT_KEY_NOT_CONFIGURED');
  const trimmed = raw.trim();
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) key = Buffer.from(trimmed, 'hex');
  else {
    try { key = Buffer.from(trimmed, 'base64'); }
    catch { throw new Error('CARD_VAULT_KEY_INVALID'); }
  }
  if (key.length !== 32) throw new Error('CARD_VAULT_KEY_INVALID');
  return key;
}

function keyVersion(raw = process.env.CARD_VAULT_KEY_VERSION) {
  const version = raw ? Number(raw) : 1;
  if (!Number.isInteger(version) || version < 1) throw new Error('CARD_VAULT_KEY_VERSION_INVALID');
  return version;
}

function aad(ownerUserId: string, cardId: string, version: number) {
  if (!ownerUserId || !cardId) throw new Error('INVALID_CARD_VAULT_CONTEXT');
  return Buffer.from(`rheomiq-card-v1:${ownerUserId}:${cardId}:${version}`, 'utf8');
}

export function encryptCardSecrets(input: unknown, ownerUserId: string, cardId: string, rawKey = process.env.CARD_VAULT_KEY, rawVersion = process.env.CARD_VAULT_KEY_VERSION): CardSecretEnvelope {
  const plaintext = normalizeCardSecrets(input);
  const key = parseKey(rawKey);
  const version = keyVersion(rawVersion);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad(ownerUserId, cardId, version));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: authTag.toString('base64'), keyVersion: version };
}

export function decryptCardSecrets(envelope: CardSecretEnvelope, ownerUserId: string, cardId: string, rawKey = process.env.CARD_VAULT_KEY): CardSecretPlaintext {
  const key = parseKey(rawKey);
  const version = envelope.keyVersion;
  if (!Number.isInteger(version) || version < 1) throw new Error('CARD_VAULT_KEY_VERSION_INVALID');
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(aad(ownerUserId, cardId, version));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
    return normalizeCardSecrets(JSON.parse(plaintext));
  } catch (error) {
    if (error instanceof Error && ['INVALID_CARD_PAN','INVALID_CARD_EXPIRY','EMPTY_CARD_SECRET','INVALID_CARD_SECRET'].includes(error.message)) throw error;
    throw new Error('CARD_VAULT_DECRYPT_FAILED');
  }
}
