'use strict';

// Application-data backup store, not a PostgreSQL dump or Card Vault export.
// No credentials or database roles are ever stored in this directory.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BYTES = 4 * 1024 * 1024;
const INDEX_NAME = 'backup-index.json';
const CONFIG_NAME = 'desktop-backup-config.json';
const DAY = 24 * 60 * 60 * 1000;
const MAX_FILES = 45;
const MAX_AGE = 30 * DAY;
const VALID_NAME = /^MyFinHub-finance-[0-9T-Z-]+-r[0-9]+-[a-f0-9]{8}\.json$/;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function atomicWrite(filename, content) {
  const temporary = filename + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, filename);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch { /* already moved */ }
  }
}

function assertDirectory(folder) {
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (!fs.statSync(folder).isDirectory() || fs.lstatSync(folder).isSymbolicLink()) {
    throw new Error('Ο φάκελος backup δεν είναι ασφαλής.');
  }
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Μη έγκυρο backup.');
  const { data, revision } = snapshot;
  if (typeof revision !== 'string' || !/^[0-9]{1,18}$/.test(revision)) throw new Error('Λείπει έγκυρο server revision.');
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !['RheomIQ', 'MyFinHub'].includes(data.app) ||
      !Number.isInteger(data.schemaVersion) || !data.seed || !data.state ||
      typeof data.seed !== 'object' || typeof data.state !== 'object' ||
      Array.isArray(data.seed) || Array.isArray(data.state)) {
    throw new Error('Μη συμβατά δεδομένα οικονομικού αντιγράφου.');
  }
  // Canonical /api/data intentionally excludes vault ciphertext and credentials.
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) throw new Error('Το backup υπερβαίνει το όριο των 4 MB.');
  return serialized;
}

function createDesktopBackupStore({ userData, documents }) {
  const configPath = path.join(userData, CONFIG_NAME);
  const defaultFolder = path.join(documents, 'MyFinHub', 'Backups');
  let busy = false;
  function config() {
    if (!fs.existsSync(configPath)) return { folder: defaultFolder };
    const value = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!value || typeof value.folder !== 'string' || !path.isAbsolute(value.folder)) throw new Error('Μη έγκυρη τοπική ρύθμιση backup.');
    return value;
  }
  function folder() { return config().folder; }
  function readIndex() {
    const target = folder();
    assertDirectory(target);
    const filename = path.join(target, INDEX_NAME);
    if (!fs.existsSync(filename)) {
      atomicWrite(filename, JSON.stringify({ version: 1, backups: [], lastFailureAt: null }) + '\n');
    }
    if (!fs.statSync(filename).isFile() || fs.lstatSync(filename).isSymbolicLink()) throw new Error('Μη έγκυρο αρχείο καταλόγου backup.');
    const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (value.version !== 1 || !Array.isArray(value.backups)) throw new Error('Ο κατάλογος backup δεν είναι συμβατός.');
    return value;
  }
  function initialize() {
    fs.mkdirSync(userData, { recursive: true, mode: 0o700 });
    readIndex();
    return status();
  }
  function checkedEntry(entry) {
    if (!entry || typeof entry !== 'object' || !VALID_NAME.test(entry.name) ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.size) ||
        entry.size < 1 || entry.size > MAX_BYTES || !/^[0-9]{1,18}$/.test(entry.revision)) {
      throw new Error('Μη έγκυρα μεταδεδομένα backup.');
    }
    const filename = path.join(folder(), entry.name);
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.size) throw new Error('Το αντίγραφο δεν είναι έγκυρο.');
    const content = fs.readFileSync(filename);
    if (digest(content) !== entry.sha256) throw new Error('Αποτυχία επαλήθευσης checksum backup.');
    return content;
  }
  function status() {
    const index = readIndex();
    const backups = index.backups.map(entry => {
      let valid = false;
      try { checkedEntry(entry); valid = true; } catch { /* preserve failed entry */ }
      return { name: entry.name, createdAt: entry.createdAt, revision: entry.revision, bytes: entry.size, valid };
    });
    return { folder: folder(), intervalHours: 24, retentionDays: 30, backups, lastValidBackupAt: backups.find(item => item.valid)?.createdAt ?? null, lastFailureAt: typeof index.lastFailureAt === 'string' ? index.lastFailureAt : null };
  }
  function save(snapshot) {
    if (busy) throw new Error('Άλλο backup βρίσκεται σε εξέλιξη.');
    busy = true;
    try {
      const serialized = validateSnapshot(snapshot);
      const index = readIndex();
      const createdAt = new Date().toISOString();
      const name = `MyFinHub-finance-${createdAt.replace(/[:.]/g, '-')}-r${snapshot.revision}-${crypto.randomBytes(4).toString('hex')}.json`;
      const filename = path.join(folder(), name);
      const bytes = Buffer.from(serialized, 'utf8');
      atomicWrite(filename, bytes);
      const entry = { name, createdAt, revision: snapshot.revision, size: bytes.length, sha256: digest(bytes) };
      checkedEntry(entry); // Never claim success without read-back and SHA verification.
      index.backups.unshift(entry);
      // Preserve at least the newest verified backup. Retention affects only our own filenames.
      const now = Date.now();
      const keep = index.backups.filter((item, i) => i === 0 || (i < MAX_FILES && Date.parse(item.createdAt) >= now - MAX_AGE));
      atomicWrite(path.join(folder(), INDEX_NAME), JSON.stringify({ version: 1, backups: keep, lastFailureAt: null }, null, 2) + '\n');
      const removed = index.backups.filter(item => !keep.includes(item));
      for (const old of removed) {
        if (!VALID_NAME.test(old.name)) continue;
        try {
          const candidate = path.join(folder(), old.name);
          if (fs.lstatSync(candidate).isFile() && !fs.lstatSync(candidate).isSymbolicLink()) fs.unlinkSync(candidate);
        } catch { /* never report retention cleanup as successful delete */ }
      }
      return { name, revision: snapshot.revision, createdAt, verified: true };
    } catch (error) {
      reportFailure();
      throw error;
    } finally { busy = false; }
  }
  function restoreCandidate(name) {
    if (typeof name !== 'string' || !VALID_NAME.test(name)) throw new Error('Μη έγκυρη επιλογή backup.');
    const entry = readIndex().backups.find(item => item.name === name);
    if (!entry) throw new Error('Το backup δεν υπάρχει στον κατάλογο.');
    const bytes = checkedEntry(entry);
    const data = JSON.parse(bytes.toString('utf8'));
    validateSnapshot({ data, revision: entry.revision });
    return data; // UI MUST still confirm destructive import with normal owner+AAL2 API.
  }
  function setFolder(next) {
    if (typeof next !== 'string' || !path.isAbsolute(next)) throw new Error('Μη έγκυρη επιλογή φακέλου.');
    if (busy) throw new Error('Το backup είναι σε εξέλιξη.');
    assertDirectory(next);
    // Validate destination BEFORE changing settings; do not silently migrate old backups.
    const previous = folder();
    try {
      atomicWrite(configPath, JSON.stringify({ folder: next }) + '\n');
      readIndex();
    } catch (error) {
      atomicWrite(configPath, JSON.stringify({ folder: previous }) + '\n');
      throw error;
    }
    return status();
  }
  // Used when the authenticated /api/data read fails before a local file write.
  function reportFailure() {
    try {
      const index = readIndex();
      atomicWrite(path.join(folder(), INDEX_NAME), JSON.stringify({ ...index, lastFailureAt: new Date().toISOString() }, null, 2) + '\n');
    } catch { /* never hide the original failure when the backup directory is unwritable */ }
  }
  return { initialize, status, save, restoreCandidate, setFolder, folder, reportFailure };
}
module.exports = { createDesktopBackupStore, validateSnapshot };
