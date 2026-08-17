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
  const saveQueue = useRef(Promise.resolve());

  const assignData = useCallback((next: FinanceData | null) => { dataRef.current = next; setData(next); }, []);

  useEffect(() => {
    let cancelled = false;
    loadData().then((res) => {
      if (cancelled) return;
      const migrated = migrateData(res.data);
      assignData(migrated); setRevision(res.revision); revisionRef.current = res.revision;
      setFilePath(res.filePath); setLastSavedAt(res.lastSavedAt); setSaveState('saved');
    }).catch(() => { if (!cancelled) setSaveState('error'); });
    return () => { cancelled = true; };
  }, [assignData]);

  const persist = useCallback((next: FinanceData) => {
    const stamped = { ...next, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() };
    assignData(stamped); setSaveState('saving');
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const res = await saveData(stamped, revisionRef.current);
        revisionRef.current = res.revision; setRevision(res.revision); setFilePath(res.filePath); setLastSavedAt(res.lastSavedAt); setSaveState('saved');
      } catch (error) {
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) setSaveState('conflict');
        else setSaveState('error');
        throw error;
      }
    }).catch(() => undefined);
    return stamped;
  }, [assignData]);

  const update = useCallback((recipe: (current: FinanceData) => FinanceData) => {
    const current = dataRef.current;
    if (!current || saveState === 'conflict') return;
    persist(recipe(current));
  }, [persist, saveState]);

  const doImport = useCallback(async (incoming: FinanceData) => {
    setSaveState('saving');
    try {
      const res = await importData(migrateData(incoming));
      revisionRef.current = res.revision; setRevision(res.revision); assignData(migrateData(res.data)); setFilePath(res.filePath); setLastSavedAt(res.lastSavedAt); setSaveState('saved');
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) setSaveState('conflict');
      else setSaveState('error');
      throw error;
    }
  }, [assignData]);

  return useMemo(() => ({ data, revision, filePath, lastSavedAt, saveState, update, importData: doImport, createBackup }), [data, revision, filePath, lastSavedAt, saveState, update, doImport]);
}
