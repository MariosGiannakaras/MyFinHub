import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { migrateData } from '../src/lib/domain.js';
import { readStore, writeStore } from '../server/storage.js';
import type { FinanceData } from '../src/types.js';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'updatedAt')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function checksum(data: FinanceData) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex');
}

function counts(data: FinanceData) {
  return {
    accounts: data.seed.accounts.length,
    months: data.seed.months.length,
    transactions: data.seed.transactions.length,
    snapshots: data.seed.snapshots.length,
    recurring: data.seed.recurring.length,
    subscriptions: data.seed.subscriptions.length,
    loans: data.seed.loans.length,
    lending: data.seed.lending.length,
    customTransactions: data.state.customTransactions.length,
    events: data.state.events?.length || 0,
  };
}

const arg = process.argv.slice(2).find((item) => !item.startsWith('--')) || process.env.RHEOMIQ_IMPORT_FILE || 'data/rheomiq-data.json';
const verifyOnly = process.argv.includes('--verify-only');
const file = path.resolve(arg);
const source = migrateData(JSON.parse(await fs.readFile(file, 'utf8')) as FinanceData);

if (!verifyOnly) {
  console.log(`Importing ${file} into Supabase...`);
  await writeStore(source, undefined, true);
}

const stored = (await readStore()).data;
const sourceChecksum = checksum(source);
const storedChecksum = checksum(stored);

console.log('Source counts:', counts(source));
console.log('Stored counts:', counts(stored));
console.log('Source checksum:', sourceChecksum);
console.log('Stored checksum:', storedChecksum);

if (sourceChecksum !== storedChecksum) {
  throw new Error('Migration verification failed: database content differs from the source JSON.');
}

console.log(verifyOnly ? 'Verification passed.' : 'Migration and verification passed.');
