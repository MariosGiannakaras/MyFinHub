import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FinanceData } from '../src/types.js';
import { migrateData } from '../src/lib/domain.js';

const ROOT = process.cwd();
export const DATA_FILE = path.resolve(process.env.RHEOMIQ_DATA_FILE || path.join(ROOT, 'data', 'rheomiq-data.json'));
const EXAMPLE_FILE = path.join(ROOT, 'data', 'rheomiq-data.example.json');
const BACKUP_DIR = path.resolve(process.env.RHEOMIQ_BACKUP_DIR || path.join(path.dirname(DATA_FILE), 'backups'));
let lastAutomaticBackup = 0;

function rev(raw: string) { return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20); }

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try { await fs.access(DATA_FILE); }
  catch {
    const fallback = await fs.readFile(EXAMPLE_FILE, 'utf8');
    await fs.writeFile(DATA_FILE, fallback, { encoding: 'utf8', mode: 0o600 });
  }
}

export async function readStore() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = migrateData(JSON.parse(raw) as FinanceData);
  const stat = await fs.stat(DATA_FILE);
  return { data: parsed, revision: rev(raw), filePath: DATA_FILE, lastSavedAt: stat.mtime.toISOString() };
}

async function atomicWrite(data: FinanceData) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const temp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, serialized, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temp, DATA_FILE);
  return serialized;
}

export async function backupStore() {
  await ensureDataFile(); await fs.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(BACKUP_DIR, `rheomiq-${stamp}.json`);
  await fs.copyFile(DATA_FILE, target); return target;
}

export async function writeStore(data: FinanceData, expectedRevision?: string, force = false) {
  const current = await readStore();
  if (!force && expectedRevision && expectedRevision !== current.revision) {
    const error = new Error('Revision conflict: το αρχείο άλλαξε από άλλη διεργασία. Κάνε refresh πριν ξαναγράψεις.') as Error & { code?: string };
    error.code = 'REVISION_CONFLICT'; throw error;
  }
  if (Date.now() - lastAutomaticBackup > 60_000) { await backupStore(); lastAutomaticBackup = Date.now(); }
  const next = migrateData({ ...data, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() });
  const raw = await atomicWrite(next);
  return { data: next, revision: rev(raw), filePath: DATA_FILE, lastSavedAt: new Date().toISOString() };
}
