import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createBackup, importData, loadData, saveData } from '../lib/api';
import { migrateData } from '../lib/domain';
import { LatestValueQueue, remoteRevisionAction } from '../lib/persistenceQueue';
import type { FinanceData } from '../types';

export type SaveState = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';

const REVISION_CHANNEL = 'rheomiq-finance-revision';
const MAX_UNDO_STATES = 20;

type RevisionMessage = { type: 'revision'; revision: string };

function productData(input:FinanceData):FinanceData{
  const migrated=migrateData(input);
  return {...migrated,state:{...migrated.state,settings:{...migrated.state.settings,motion:'full'}}};
}

export function useFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [revision, setRevision] = useState('');
  const [filePath, setFilePath] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [undoDepth, setUndoDepth] = useState(0);
  const revisionRef = useRef('');
  const dataRef = useRef<FinanceData | null>(null);
  const exclusiveOperation = useRef(false);
  const lastSaveFailed = useRef(false);
  const saveStateRef = useRef<SaveState>('loading');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const remoteReloading = useRef(false);
  const coordinatorRef = useRef<LatestValueQueue<FinanceData> | null>(null);
  const undoStackRef = useRef<FinanceData[]>([]);

  const assignData = useCallback((next: FinanceData | null) => { dataRef.current = next; setData(next); }, []);
  const clearUndo = useCallback(() => { undoStackRef.current = []; setUndoDepth(0); }, []);

  const applyEnvelope = useCallback((res: Awaited<ReturnType<typeof loadData>>) => {
    const migrated = productData(res.data);
    assignData(migrated);
    revisionRef.current = res.revision;
    setRevision(res.revision);
    setFilePath(res.filePath);
    setLastSavedAt(res.lastSavedAt);
    lastSaveFailed.current = false;
    clearUndo();
    setSaveState('saved');
  }, [assignData, clearUndo]);

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

  if (!coordinatorRef.current) {
    coordinatorRef.current = new LatestValueQueue<FinanceData>(async (stamped) => {
      try {
        const res = await saveData(stamped, revisionRef.current);
        revisionRef.current = res.revision;
        setRevision(res.revision);
        setFilePath(res.filePath);
        setLastSavedAt(res.lastSavedAt);
        lastSaveFailed.current = false;
        setSaveState('saved');
        channelRef.current?.postMessage({ type: 'revision', revision: res.revision } satisfies RevisionMessage);
      } catch (error) {
        lastSaveFailed.current = true;
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) setSaveState('conflict');
        else setSaveState('error');
        throw error;
      }
    });
  }
  const coordinator = coordinatorRef.current!;

  useEffect(() => { saveStateRef.current = saveState; }, [saveState]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(REVISION_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<RevisionMessage>) => {
      const message = event.data;
      if (!message || message.type !== 'revision' || typeof message.revision !== 'string') return;
      const action = remoteRevisionAction(
        revisionRef.current,
        message.revision,
        coordinator.hasWork() || exclusiveOperation.current || saveStateRef.current === 'saving' || saveStateRef.current === 'loading',
        lastSaveFailed.current,
      );
      if (action === 'conflict') {
        setSaveState('conflict');
        return;
      }
      if (action === 'reload' && !remoteReloading.current) {
        remoteReloading.current = true;
        void reload().finally(() => { remoteReloading.current = false; });
      }
    };
    return () => {
      if (channelRef.current === channel) channelRef.current = null;
      channel.close();
    };
  }, [coordinator, reload]);

  const persist = useCallback((next: FinanceData) => {
    const stamped = { ...next, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() };
    assignData(stamped);
    setSaveState('saving');
    coordinator.enqueue(stamped);
    return stamped;
  }, [assignData, coordinator]);

  const pushUndo = useCallback((current: FinanceData) => {
    const stack = undoStackRef.current;
    stack.push(current);
    if (stack.length > MAX_UNDO_STATES) stack.splice(0, stack.length - MAX_UNDO_STATES);
    setUndoDepth(stack.length);
  }, []);

  const update = useCallback((recipe: (current: FinanceData) => FinanceData) => {
    const current = dataRef.current;
    const state = saveStateRef.current;
    if (!current || state === 'conflict' || state === 'error' || state === 'loading' || exclusiveOperation.current) return;
    const next = recipe(current);
    if (next === current) return;
    pushUndo(current);
    persist(next);
  }, [persist, pushUndo]);

  const undo = useCallback(() => {
    const state = saveStateRef.current;
    if (state === 'conflict' || state === 'error' || state === 'loading' || exclusiveOperation.current) return false;
    const previous = undoStackRef.current.pop();
    if (!previous) return false;
    setUndoDepth(undoStackRef.current.length);
    persist(previous);
    return true;
  }, [persist]);

  const doImport = useCallback(async (incoming: FinanceData) => {
    if (exclusiveOperation.current) throw new Error('Υπάρχει ήδη λειτουργία αποθήκευσης σε εξέλιξη.');
    exclusiveOperation.current = true;
    setSaveState('saving');
    try {
      await coordinator.whenIdle();
      try {
        const res = await importData(productData(incoming));
        applyEnvelope(res);
        channelRef.current?.postMessage({ type: 'revision', revision: res.revision } satisfies RevisionMessage);
      } catch (error) {
        lastSaveFailed.current = true;
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) setSaveState('conflict');
        else setSaveState('error');
        throw error;
      }
    } finally {
      exclusiveOperation.current = false;
    }
  }, [applyEnvelope, coordinator]);

  const doBackup = useCallback(async () => {
    await coordinator.whenIdle();
    if (lastSaveFailed.current) {
      throw new Error('Το backup ακυρώθηκε επειδή υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί επιτυχώς.');
    }
    return createBackup();
  }, [coordinator]);

  const canUndo = undoDepth > 0 && saveState !== 'conflict' && saveState !== 'error' && saveState !== 'loading';

  return useMemo(() => ({ data, revision, filePath, lastSavedAt, saveState, update, reload, undo, canUndo, importData: doImport, createBackup: doBackup }), [data, revision, filePath, lastSavedAt, saveState, update, reload, undo, canUndo, doImport, doBackup]);
}
