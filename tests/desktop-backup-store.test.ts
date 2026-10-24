import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDesktopBackupStore } = require('../desktop/backup-store.cjs') as {
  createDesktopBackupStore: (paths: { userData: string; documents: string }) => {
    initialize: () => unknown;
    save: (snapshot: { data: unknown; revision: string }) => { verified: boolean; name: string };
    status: () => { folder:string; backups: Array<{ valid: boolean; revision: string; name: string }>; lastValidBackupAt: string | null; lastFailureAt: string | null };
    restoreCandidate: (name: string) => unknown;
    setFolder: (path: string) => unknown;
    reportFailure: () => void;
  };
};

const roots: string[] = [];
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myfinhub-backup-'));
  roots.push(root);
  const store = createDesktopBackupStore({ userData: path.join(root, 'private'), documents: path.join(root, 'documents') });
  return { root, store };
}
const data = { app: 'RheomIQ', schemaVersion: 3, updatedAt: '2026-10-24T10:00:00Z', seed: { accounts: [], months: [], transactions: [], snapshots: [], recurring: [], subscriptions: [], loans: [], lending: [], stats: {} }, state: { settings: {}, events: [] } };

afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('desktop automatic backup store', () => {
  it('creates an empty local catalog on first install, idempotently', () => {
    const { store } = setup();
    const first = store.initialize();
    expect(store.status().backups).toEqual([]);
    store.initialize();
    expect(store.status().backups).toEqual([]);
    expect(first).toMatchObject({ intervalHours: 24, retentionDays: 30 });
  });

  it('atomically writes a server-revisioned JSON snapshot and verifies its integrity', () => {
    const { store } = setup();
    store.initialize();
    const receipt = store.save({ data, revision: '465' });
    expect(receipt.verified).toBe(true);
    expect(store.status().backups).toMatchObject([{ revision: '465', valid: true }]);
    expect(store.restoreCandidate(receipt.name)).toEqual(data);
  });

  it('reports damaged files as invalid and refuses restore', () => {
    const { store } = setup();
    store.initialize();
    const receipt = store.save({ data, revision: '465' });
    fs.appendFileSync(path.join(store.status().folder, receipt.name), '\ncorrupt');
    expect(store.status().backups[0].valid).toBe(false);
    expect(store.status().lastValidBackupAt).toBeNull();
    expect(() => store.restoreCandidate(receipt.name)).toThrow();
  });

  it('records a failed attempt across restarts and clears it only after verified success', () => {
    const { root, store } = setup();
    store.initialize();
    store.reportFailure();
    const failedAt = store.status().lastFailureAt;
    expect(failedAt).toMatch(/^20\\d\\d-/);
    const restarted = createDesktopBackupStore({ userData: path.join(root, 'private'), documents: path.join(root, 'documents') });
    expect(restarted.status().lastFailureAt).toBe(failedAt);
    restarted.save({ data, revision: '465' });
    expect(restarted.status().lastFailureAt).toBeNull();
  });

  it('rejects unsafe names, invalid revisions and malformed finance data', () => {
    const { store } = setup();
    store.initialize();
    expect(() => store.save({ data, revision: '../../123' })).toThrow();
    expect(() => store.save({ data: { app: 'RheomIQ', state: {} }, revision: '465' })).toThrow();
    expect(() => store.restoreCandidate('../secret.json')).toThrow();
    expect(store.status().backups).toEqual([]);
  });

  it('switches to an explicitly selected folder without erasing old backups', () => {
    const { root, store } = setup();
    store.initialize();
    const first = store.save({ data, revision: '464' });
    const oldDir = store.status().folder;
    store.setFolder(path.join(root, 'chosen'));
    expect(store.status().backups).toEqual([]);
    const second = store.save({ data, revision: '465' });
    expect(store.restoreCandidate(second.name)).toEqual(data);
    expect(fs.existsSync(path.join(oldDir, first.name))).toBe(true);
  });
});
