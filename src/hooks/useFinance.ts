import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createBackup, importData, loadData, saveData } from '../lib/api';
import { LatestValueQueue, remoteRevisionAction } from '../lib/persistenceQueue';
import { migrateProductData } from '../lib/productMigration';
import type { FinanceData } from '../types';

export type SaveState = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';
export type ChangeHistoryEntry = { id:string; kind:'change'|'undo'|'redo'; label:string; at:string };
export const SESSION_HISTORY_EVENT = 'myfinhub-session-change-history';

const REVISION_CHANNEL = 'rheomiq-finance-revision';
const MAX_UNDO_STATES = 20;
const MAX_HISTORY_ITEMS = 20;

type RevisionMessage = { type: 'revision'; revision: string };

function productData(input:FinanceData):FinanceData{
  const migrated=migrateProductData(input);
  return {...migrated,state:{...migrated.state,settings:{...migrated.state.settings,motion:'full',textSize:migrated.state.settings.textSize??'normal'}}};
}

function describeChange(current:FinanceData,next:FinanceData){
  const beforeEvents=current.state.events??[];
  const afterEvents=next.state.events??[];
  if(current.state.events!==next.state.events){
    if(afterEvents.length>beforeEvents.length)return 'Νέα οικονομική κίνηση';
    if(afterEvents.length<beforeEvents.length)return 'Διαγραφή οικονομικής κίνησης';
    return 'Επεξεργασία οικονομικής κίνησης';
  }
  if(current.state.scheduled!==next.state.scheduled)return 'Αλλαγή προγραμματισμένης κίνησης';
  if(current.state.budgets!==next.state.budgets)return 'Αλλαγή προϋπολογισμού';
  if(current.state.transactionRules!==next.state.transactionRules)return 'Αλλαγή κανόνα συναλλαγών';
  if(current.state.cards!==next.state.cards||current.state.cardBanks!==next.state.cardBanks)return 'Αλλαγή κάρτας ή τράπεζας';
  if(current.state.customLoans!==next.state.customLoans||current.state.loanOverrides!==next.state.loanOverrides)return 'Αλλαγή δανείου ή δόσης';
  if(current.state.recurringCustom!==next.state.recurringCustom||current.state.recurringOverrides!==next.state.recurringOverrides)return 'Αλλαγή πάγιας κίνησης';
  if(current.state.settings!==next.state.settings)return 'Αλλαγή ρυθμίσεων';
  if(current.state.reviewDecisions!==next.state.reviewDecisions)return 'Αλλαγή απόφασης ελέγχου';
  if(current.state.attentionDecisions!==next.state.attentionDecisions)return 'Αλλαγή στο Χρειάζεται προσοχή';
  return 'Αλλαγή οικονομικών δεδομένων';
}

function publishHistory(items:ChangeHistoryEntry[]){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new CustomEvent<ChangeHistoryEntry[]>(SESSION_HISTORY_EVENT,{detail:items}));
}

export function useFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [revision, setRevision] = useState('');
  const [filePath, setFilePath] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [changeHistory,setChangeHistory]=useState<ChangeHistoryEntry[]>([]);
  const revisionRef = useRef('');
  const dataRef = useRef<FinanceData | null>(null);
  const exclusiveOperation = useRef(false);
  const lastSaveFailed = useRef(false);
  const saveStateRef = useRef<SaveState>('loading');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const remoteReloading = useRef(false);
  const coordinatorRef = useRef<LatestValueQueue<FinanceData> | null>(null);
  const undoStackRef = useRef<FinanceData[]>([]);
  const redoStackRef = useRef<FinanceData[]>([]);
  const historySequenceRef=useRef(0);
  const changeHistoryRef=useRef<ChangeHistoryEntry[]>([]);

  const assignData = useCallback((next: FinanceData | null) => { dataRef.current = next; setData(next); }, []);
  const setCurrentSaveState=useCallback((next:SaveState)=>{saveStateRef.current=next;setSaveState(next)},[]);
  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    historySequenceRef.current=0;
    changeHistoryRef.current=[];
    setUndoDepth(0);
    setRedoDepth(0);
    setChangeHistory([]);
    publishHistory([]);
  }, []);
  const recordHistory=useCallback((kind:ChangeHistoryEntry['kind'],label:string)=>{
    const entry:ChangeHistoryEntry={id:`history-${Date.now()}-${++historySequenceRef.current}`,kind,label,at:new Date().toISOString()};
    const next=[entry,...changeHistoryRef.current].slice(0,MAX_HISTORY_ITEMS);
    changeHistoryRef.current=next;
    setChangeHistory(next);
    publishHistory(next);
  },[]);

  const applyEnvelope = useCallback((res: Awaited<ReturnType<typeof loadData>>) => {
    const migrated = productData(res.data);
    assignData(migrated);
    revisionRef.current = res.revision;
    setRevision(res.revision);
    setFilePath(res.filePath);
    setLastSavedAt(res.lastSavedAt);
    lastSaveFailed.current = false;
    clearHistory();
    setCurrentSaveState('saved');
  }, [assignData, clearHistory,setCurrentSaveState]);

  const reload = useCallback(async () => {
    setCurrentSaveState('loading');
    try {
      applyEnvelope(await loadData());
      return true;
    } catch {
      setCurrentSaveState('error');
      return false;
    }
  }, [applyEnvelope,setCurrentSaveState]);

  if (!coordinatorRef.current) {
    coordinatorRef.current = new LatestValueQueue<FinanceData>(async (stamped) => {
      try {
        const res = await saveData(stamped, revisionRef.current);
        revisionRef.current = res.revision;
        setRevision(res.revision);
        setFilePath(res.filePath);
        setLastSavedAt(res.lastSavedAt);
        lastSaveFailed.current = false;
        setCurrentSaveState('saved');
        channelRef.current?.postMessage({ type: 'revision', revision: res.revision } satisfies RevisionMessage);
      } catch (error) {
        lastSaveFailed.current = true;
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) setCurrentSaveState('conflict');
        else setCurrentSaveState('error');
        throw error;
      }
    });
  }
  const coordinator = coordinatorRef.current!;

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
        setCurrentSaveState('conflict');
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
  }, [coordinator, reload,setCurrentSaveState]);

  const persist = useCallback((next: FinanceData) => {
    const stamped = { ...next, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() };
    assignData(stamped);
    setCurrentSaveState('saving');
    coordinator.enqueue(stamped);
    return stamped;
  }, [assignData, coordinator,setCurrentSaveState]);

  const pushBounded = useCallback((stack: FinanceData[], current: FinanceData) => {
    stack.push(current);
    if (stack.length > MAX_UNDO_STATES) stack.splice(0, stack.length - MAX_UNDO_STATES);
  }, []);

  const update = useCallback((recipe: (current: FinanceData) => FinanceData) => {
    const current = dataRef.current;
    const state = saveStateRef.current;
    if (!current || state === 'conflict' || state === 'error' || state === 'loading' || exclusiveOperation.current) return;
    const next = recipe(current);
    if (next === current) return;
    pushBounded(undoStackRef.current, current);
    setUndoDepth(undoStackRef.current.length);
    redoStackRef.current = [];
    setRedoDepth(0);
    recordHistory('change',describeChange(current,next));
    persist(next);
  }, [persist, pushBounded,recordHistory]);

  const undo = useCallback(() => {
    const state = saveStateRef.current;
    const current = dataRef.current;
    if (!current || state === 'conflict' || state === 'error' || state === 'loading' || exclusiveOperation.current) return false;
    const previous = undoStackRef.current.pop();
    if (!previous) return false;
    pushBounded(redoStackRef.current, current);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    recordHistory('undo','Αναίρεση τελευταίας αλλαγής');
    persist(previous);
    return true;
  }, [persist, pushBounded,recordHistory]);

  const redo = useCallback(() => {
    const state = saveStateRef.current;
    const current = dataRef.current;
    if (!current || state === 'conflict' || state === 'error' || state === 'loading' || exclusiveOperation.current) return false;
    const next = redoStackRef.current.pop();
    if (!next) return false;
    pushBounded(undoStackRef.current, current);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    recordHistory('redo','Επαναφορά τελευταίας αναιρεμένης αλλαγής');
    persist(next);
    return true;
  }, [persist, pushBounded,recordHistory]);

  const doImport = useCallback(async (incoming: FinanceData) => {
    if (exclusiveOperation.current) throw new Error('Υπάρχει ήδη λειτουργία αποθήκευσης σε εξέλιξη.');
    exclusiveOperation.current = true;
    setCurrentSaveState('saving');
    try {
      await coordinator.whenIdle();
      try {
        const res = await importData(productData(incoming));
        applyEnvelope(res);
        channelRef.current?.postMessage({ type: 'revision', revision: res.revision } satisfies RevisionMessage);
      } catch (error) {
        lastSaveFailed.current = true;
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) setCurrentSaveState('conflict');
        else setCurrentSaveState('error');
        throw error;
      }
    } finally {
      exclusiveOperation.current = false;
    }
  }, [applyEnvelope, coordinator,setCurrentSaveState]);

  const doBackup = useCallback(async () => {
    await coordinator.whenIdle();
    if (lastSaveFailed.current) {
      throw new Error('Το backup ακυρώθηκε επειδή υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί επιτυχώς.');
    }
    return createBackup();
  }, [coordinator]);

  const canUndo = undoDepth > 0 && saveState !== 'conflict' && saveState !== 'error' && saveState !== 'loading';
  const canRedo = redoDepth > 0 && saveState !== 'conflict' && saveState !== 'error' && saveState !== 'loading';

  return useMemo(() => ({ data, revision, filePath, lastSavedAt, saveState, update, reload, undo, redo, canUndo, canRedo, undoDepth, redoDepth, changeHistory, importData: doImport, createBackup: doBackup }), [data, revision, filePath, lastSavedAt, saveState, update, reload, undo, redo, canUndo, canRedo, undoDepth, redoDepth, changeHistory, doImport, doBackup]);
}