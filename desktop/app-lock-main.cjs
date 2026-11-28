'use strict';

const { app, ipcMain, safeStorage } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PIN_PATTERN = /^\d{4}$/;
const RECORD_VERSION = 2;
const DEFAULT_IDLE_MINUTES = 5;
const ALLOWED_IDLE_MINUTES = new Set([1, 5, 15, 30, 60]);
const MAX_FAILURES_BEFORE_DELAY = 5;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 5 * 60_000;
const SCRYPT_OPTIONS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
let failedAttempts = 0;
let blockedUntil = 0;
let operationPending = false;

function appLockPath() {
  return path.join(app.getPath('userData'), 'app-lock.json');
}

function supported() {
  return process.platform === 'win32' && safeStorage.isEncryptionAvailable();
}

function requireSupported() {
  if (!supported()) throw new Error('APP_LOCK_UNAVAILABLE');
}

function normalizeIdleMinutes(value) {
  const minutes = Number(value);
  return ALLOWED_IDLE_MINUTES.has(minutes) ? minutes : DEFAULT_IDLE_MINUTES;
}

function retryAfterMs() {
  return Math.max(0, blockedUntil - Date.now());
}

function readEnvelope() {
  const file = appLockPath();
  if (!fs.existsSync(file)) return null;
  try {
    const envelope = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (![1, RECORD_VERSION].includes(envelope?.version) || typeof envelope?.protectedVerifier !== 'string' || !envelope.protectedVerifier) throw new Error('invalid envelope');
    return {
      version: envelope.version,
      protectedVerifier: envelope.protectedVerifier,
      idleMinutes: normalizeIdleMinutes(envelope.idleMinutes),
    };
  } catch {
    throw new Error('APP_LOCK_CORRUPT');
  }
}

function publicState() {
  const envelope = readEnvelope();
  return {
    supported: supported(),
    enabled: Boolean(envelope),
    idleMinutes: envelope?.idleMinutes ?? DEFAULT_IDLE_MINUTES,
    failedAttempts,
    retryAfterMs: retryAfterMs(),
  };
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    try { fs.unlinkSync(temporary); } catch { /* already moved */ }
  }
}

function readVerifier() {
  requireSupported();
  const envelope = readEnvelope();
  if (!envelope) return null;
  try {
    const protectedBytes = Buffer.from(envelope.protectedVerifier, 'base64');
    const verifier = JSON.parse(safeStorage.decryptString(protectedBytes));
    if (typeof verifier?.salt !== 'string' || typeof verifier?.digest !== 'string') throw new Error('invalid verifier');
    const salt = Buffer.from(verifier.salt, 'base64');
    const digest = Buffer.from(verifier.digest, 'base64');
    if (salt.length !== 16 || digest.length !== 32) throw new Error('invalid verifier lengths');
    return { salt, digest, idleMinutes: envelope.idleMinutes };
  } catch {
    throw new Error('APP_LOCK_CORRUPT');
  }
}

function derivePin(pin, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, 32, SCRYPT_OPTIONS, (error, derived) => error ? reject(error) : resolve(Buffer.from(derived)));
  });
}

async function writeVerifier(pin, idleMinutes = DEFAULT_IDLE_MINUTES, assertCurrentSender) {
  requireSupported();
  if (!PIN_PATTERN.test(pin)) throw new Error('INVALID_PIN_FORMAT');
  const salt = crypto.randomBytes(16);
  const digest = await derivePin(pin, salt);
  const protectedVerifier = safeStorage.encryptString(JSON.stringify({
    salt: salt.toString('base64'),
    digest: digest.toString('base64'),
  })).toString('base64');
  assertCurrentSender();
  writePrivateJson(appLockPath(), {
    version: RECORD_VERSION,
    protectedVerifier,
    idleMinutes: normalizeIdleMinutes(idleMinutes),
  });
  failedAttempts = 0;
  blockedUntil = 0;
}

function rewriteIdleMinutes(minutes) {
  requireSupported();
  const envelope = readEnvelope();
  if (!envelope) throw new Error('APP_LOCK_NOT_CONFIGURED');
  writePrivateJson(appLockPath(), {
    version: RECORD_VERSION,
    protectedVerifier: envelope.protectedVerifier,
    idleMinutes: normalizeIdleMinutes(minutes),
  });
}

function recordFailure() {
  failedAttempts += 1;
  if (failedAttempts < MAX_FAILURES_BEFORE_DELAY) return;
  const level = Math.floor((failedAttempts - MAX_FAILURES_BEFORE_DELAY) / 3);
  blockedUntil = Date.now() + Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** level));
}

async function verifyPin(pin) {
  if (retryAfterMs() > 0) return false;
  if (!PIN_PATTERN.test(String(pin || ''))) {
    recordFailure();
    return false;
  }
  const verifier = readVerifier();
  if (!verifier) return false;
  const candidate = await derivePin(pin, verifier.salt);
  const ok = candidate.length === verifier.digest.length && crypto.timingSafeEqual(candidate, verifier.digest);
  if (ok) {
    failedAttempts = 0;
    blockedUntil = 0;
  } else recordFailure();
  return ok;
}

// Legacy device PIN is a compatibility fallback, not a shared backend ticket.
function registerAppLockIpc({ isTrustedSender, requireLegacyAccess }) {
  const assertSender = event => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC sender.');
  };
  const exclusive = (event, operation) => {
    assertSender(event);
    if (operationPending) throw new Error('APP_LOCK_BUSY');
    operationPending = true;
    return (async () => {
      try {
        await requireLegacyAccess(event);
        assertSender(event);
        return await operation(() => assertSender(event));
      } finally { operationPending = false; }
    })();
  };
  ipcMain.handle('myfinhub:get-app-lock-state', event => {
    assertSender(event);
    return publicState();
  });
  ipcMain.handle('myfinhub:verify-app-pin', (event, pin) => exclusive(event, async assertCurrentSender => {
    requireSupported();
    if (!readEnvelope()) return { ok: false, ...publicState() };
    const ok = await verifyPin(String(pin || ''));
    assertCurrentSender();
    return { ok, ...publicState() };
  }));
  ipcMain.handle('myfinhub:set-app-pin', (event, value) => exclusive(event, async assertCurrentSender => {
    requireSupported();
    const pin = String(value?.pin || '');
    if (!PIN_PATTERN.test(pin)) return { ok: false, error: 'INVALID_PIN_FORMAT', ...publicState() };
    const existing = readEnvelope();
    if (existing) {
      if (!await verifyPin(String(value?.currentPin || ''))) return { ok: false, error: 'APP_LOCK_WRONG_PIN', ...publicState() };
      if (pin === value.currentPin) return { ok: false, error: 'PIN_UNCHANGED', ...publicState() };
    }
    await writeVerifier(pin, existing?.idleMinutes ?? DEFAULT_IDLE_MINUTES, assertCurrentSender);
    return { ok: true, ...publicState() };
  }));
  ipcMain.handle('myfinhub:set-app-lock-timeout', (event, minutes, currentPin) => exclusive(event, async assertCurrentSender => {
    requireSupported();
    if (!ALLOWED_IDLE_MINUTES.has(Number(minutes))) return { ok: false, error: 'INVALID_IDLE_TIMEOUT', ...publicState() };
    if (!await verifyPin(String(currentPin || ''))) return { ok: false, error: 'APP_LOCK_WRONG_PIN', ...publicState() };
    assertCurrentSender();
    rewriteIdleMinutes(Number(minutes));
    return { ok: true, ...publicState() };
  }));
  ipcMain.handle('myfinhub:disable-app-pin', (event, currentPin) => exclusive(event, async assertCurrentSender => {
    requireSupported();
    if (!readEnvelope()) return { ok: true, ...publicState() };
    if (!await verifyPin(String(currentPin || ''))) return { ok: false, error: 'APP_LOCK_WRONG_PIN', ...publicState() };
    assertCurrentSender();
    fs.unlinkSync(appLockPath());
    failedAttempts = 0;
    blockedUntil = 0;
    return { ok: true, ...publicState() };
  }));
}

module.exports = { registerAppLockIpc };
