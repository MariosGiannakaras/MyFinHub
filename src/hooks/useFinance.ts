import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createBackup, importData, loadData, saveData } from '../lib/api';
import { migrateData } from '../lib/domain';
import type { FinanceData } from '../types';

export type SaveState = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';

export function useFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [revision, setRevision] = useState('');
  const [filePath, setFilePath] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const revisionRef = useRef('');
  const dataRef = useRef<FinanceData | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const exclusiveOperation = useRef(false);
  const lastSaveFailed = useRef(false);

  const assignData = useCallback((next: FinanceData | null) => { dataRef.current = next; setData(next); }, []);

  const applyEnvelope = useCallback((res: Awaited<ReturnType<typeof loadData>>) => {
    const migrated = migrateData(res.data);
    assignData(migrated);
    revisionRef.current = res.revision;
    setRevision(res.revision);
    setFilePath(res.filePath);
    setLastSavedAt(res.lastSavedAt);
    lastSaveFailed.current = false;
    setSaveState('saved');
  }, [assignData]);

  const reload = useCallback(async () => {
    setSaveState('loading');
    try {
      applyEnvelope(await loadData());
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [applyEnvelope]);

  useEffect(() => { void reload(); }, [reload]);

  const persist = useCallback((next: FinanceData) => {
    const stamped = { ...next, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() };
    assignData(stamped);
    setSaveState('saving');
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const res = await saveData(stamped, revisionRef.current);
        revisionRef.current = res.revision;
        setRevision(res.revision);
        setFilePath(res.filePath);
        setLastSavedAt(res.lastSavedAt);
        lastSaveFailed.current = false;
        setSaveState('saved');
      } catch (error) {
        lastSaveFailed.current = true;
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) setSaveState('conflict');
        else setSaveState('error');
        throw error;
      }
    }).catch(() => undefined);
    return stamped;
  }, [assignData]);

  const update = useCallback((recipe: (current: FinanceData) => FinanceData) => {
    const current = dataRef.current;
    if (!current || saveState === 'conflict' || exclusiveOperation.current) return;
    persist(recipe(current));
  }, [persist, saveState]);

  const doImport = useCallback(async (incoming: FinanceData) => {
    if (exclusiveOperation.current) throw new Error('Υπάρχει ήδη λειτουργία αποθήκευσης σε εξέλιξη.');
    exclusiveOperation.current = true;
    setSaveState('saving');
    const operation = saveQueue.current.then(async () => {
      try {
        const res = await importData(migrateData(incoming));
        applyEnvelope(res);
      } catch (error) {
        lastSaveFailed.current = true;
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) setSaveState('conflict');
        else setSaveState('error');
        throw error;
      }
    });
    saveQueue.current = operation.then(() => undefined, () => undefined);
    try {
      await operation;
    } finally {
      exclusiveOperation.current = false;
    }
  }, [applyEnvelope]);

  const doBackup = useCallback(async () => {
    await saveQueue.current;
    if (lastSaveFailed.current) {
      throw new Error('Το backup ακυρώθηκε επειδή υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί επιτυχώς.');
    }
    return createBackup();
  }, []);

  return useMemo(() => ({ data, revision, filePath, lastSavedAt, saveState, update, reload, importData: doImport, createBackup: doBackup }), [data, revision, filePath, lastSavedAt, saveState, update, reload, doImport, doBackup]);
}
