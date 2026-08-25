import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createBackup, importData, loadData, loadHistory, moveHistory, saveData, type HistoryEnvelope } from '../lib/api';
import { describeFinanceChange } from '../lib/changeHistory';
import { SequentialQueue, remoteRevisionAction } from '../lib/persistenceQueue';
import { migrateProductData } from '../lib/productMigration';
import type { FinanceData } from '../types';

export type SaveState = 'loading' | 'saved' | 'saving' | 'error' | 'conflict';
export type ChangeHistoryEntry = { id:string; kind:'change'|'undo'|'redo'; label:string; at:string; current?:boolean };
// Kept as a compatibility export for AppShell and rendered QA. Its payload is now
// server-authoritative cross-session history rather than a session-only stack.
export const SESSION_HISTORY_EVENT = 'myfinhub-durable-change-history';

const REVISION_CHANNEL = 'rheomiq-finance-revision';
const MAX_CONSISTENT_RELOAD_ATTEMPTS = 3;
type RevisionMessage = { type: 'revision'; revision: string };
type QueuedMutation = { data:FinanceData; label:string };

function productData(input:FinanceData):FinanceData{
  const migrated=migrateProductData(input);
  return {...migrated,state:{...migrated.state,settings:{...migrated.state.settings,motion:'full',textSize:migrated.state.settings.textSize??'normal'}}};
}

export function financeChangeLabel(current:FinanceData,next:FinanceData){return describeFinanceChange(current,next)}

function publishHistory(items:ChangeHistoryEntry[]){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new CustomEvent<ChangeHistoryEntry[]>(SESSION_HISTORY_EVENT,{detail:items}));
}

function historyMatchesRevision(history:HistoryEnvelope,revision:string){return history.financeRevision===revision}

export function useFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [revision, setRevision] = useState('');
  const [filePath, setFilePath] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [changeHistory,setChangeHistory]=useState<ChangeHistoryEntry[]>([]);
  const [historyAvailable,setHistoryAvailable]=useState(true);
  const revisionRef = useRef('');
  const historyGenerationRef=useRef('0');
  const historyAvailableRef=useRef(true);
  const dataRef = useRef<FinanceData | null>(null);
  const exclusiveOperation = useRef(false);
  const lastSaveFailed = useRef(false);
  const saveStateRef = useRef<SaveState>('loading');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const remoteReloading = useRef(false);
  const coordinatorRef = useRef<SequentialQueue<QueuedMutation> | null>(null);
  const changeHistoryRef=useRef<ChangeHistoryEntry[]>([]);
  const initialLoadStartedRef=useRef(false);

  const assignData = useCallback((next: FinanceData | null) => { dataRef.current = next; setData(next); }, []);
  const setCurrentSaveState=useCallback((next:SaveState)=>{saveStateRef.current=next;setSaveState(next)},[]);
  const applyHistory=useCallback((history:HistoryEnvelope)=>{
    historyGenerationRef.current=history.generation;
    historyAvailableRef.current=history.available;
    setHistoryAvailable(history.available);
    const next:ChangeHistoryEntry[]=history.available?history.points.map(point=>({id:point.id,kind:'change',label:point.label,at:point.createdAt,current:point.current})):[];
    changeHistoryRef.current=next;
    setChangeHistory(next);
    setUndoDepth(history.available?history.undoDepth:0);
    setRedoDepth(history.available?history.redoDepth:0);
    publishHistory(next);
  },[]);

  const applyDataEnvelope = useCallback((res: Awaited<ReturnType<typeof loadData>>) => {
    const migrated = productData(res.data);
    assignData(migrated);
    revisionRef.current = res.revision;
    setRevision(res.revision);
    setFilePath(res.filePath);
    setLastSavedAt(res.lastSavedAt);
    lastSaveFailed.current = false;
  }, [assignData]);

  if (!coordinatorRef.current) {
    coordinatorRef.current = new SequentialQueue<QueuedMutation>(async ({data:stamped,label}) => {
      try {
        const res = await saveData(stamped, revisionRef.current, historyGenerationRef.current, label);
        if(!historyMatchesRevision(res.history,res.revision))throw new ApiError('Το ιστορικό αλλαγών δεν συμφωνεί με την τελευταία αποθήκευση.',409,'HISTORY_CURSOR_CONFLICT');
        revisionRef.current = res.revision;
        setRevision(res.revision);
        setFilePath(res.filePath);
        setLastSavedAt(res.lastSavedAt);
        applyHistory(res.history);
        lastSaveFailed.current = false;
        channelRef.current?.postMessage({ type: 'revision', revision: res.revision } satisfies RevisionMessage);
      } catch (error) {
        lastSaveFailed.current = true;
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT' || error.code === 'HISTORY_CURSOR_CONFLICT')) setCurrentSaveState('conflict');
        else setCurrentSaveState('error');
        throw error;
      }
    });
  }
  const coordinator = coordinatorRef.current!;

  const reload = useCallback(async () => {
    setCurrentSaveState('loading');
    try {
      for(let attempt=0;attempt<MAX_CONSISTENT_RELOAD_ATTEMPTS;attempt+=1){
        const nextData=await loadData();
        const nextHistory=await loadHistory();
        if(!historyMatchesRevision(nextHistory,nextData.revision)){
          if(attempt<MAX_CONSISTENT_RELOAD_ATTEMPTS-1)continue;
          applyDataEnvelope(nextData);
          applyHistory({...nextHistory,available:false});
          setCurrentSaveState('conflict');
          return false;
        }
        applyDataEnvelope(nextData);
        applyHistory(nextHistory);
        setCurrentSaveState(nextHistory.available?'saved':'conflict');
        return nextHistory.available;
      }
      setCurrentSaveState('conflict');
      return false;
    } catch {
      setCurrentSaveState('error');
      return false;
    }
  }, [applyDataEnvelope,applyHistory,setCurrentSaveState]);

  useEffect(() => {
    if(initialLoadStartedRef.current)return;
    initialLoadStartedRef.current=true;
    void reload();
  }, [reload]);

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

  const persist = useCallback((next: FinanceData,label:string) => {
    const stamped = { ...next, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() };
    assignData(stamped);
    setCurrentSaveState('saving');
    coordinator.enqueue({data:stamped,label});
    const idle=coordinator.whenIdle();
    void idle.then(()=>{
      if(!lastSaveFailed.current&&!exclusiveOperation.current&&historyAvailableRef.current)setCurrentSaveState('saved');
    });
    return stamped;
  }, [assignData, coordinator,setCurrentSaveState]);

  const update = useCallback((recipe: (current: FinanceData) => FinanceData) => {
    const current = dataRef.current;
    const state = saveStateRef.current;
    if (!current || !historyAvailableRef.current || state === 'conflict' || state === 'error' || state === 'loading' || exclusiveOperation.current) return;
    const next = recipe(current);
    if (next === current) return;
    persist(next,financeChangeLabel(current,next));
  }, [persist]);

  const move=useCallback(async(direction:'undo'|'redo')=>{
    const current=dataRef.current;
    const state=saveStateRef.current;
    const allowed=direction==='undo'?undoDepth>0:redoDepth>0;
    if(!current||!allowed||!historyAvailableRef.current||state!=='saved'||exclusiveOperation.current||coordinator.hasWork())return false;
    exclusiveOperation.current=true;
    setCurrentSaveState('saving');
    try{
      await coordinator.whenIdle();
      const res=await moveHistory(direction,revisionRef.current,historyGenerationRef.current);
      if(!historyMatchesRevision(res.history,res.revision))throw new ApiError('Το ιστορικό αλλαγών δεν συμφωνεί με την οικονομική κατάσταση.',409,'HISTORY_CURSOR_CONFLICT');
      applyDataEnvelope(res);
      applyHistory(res.history);
      setCurrentSaveState('saved');
      channelRef.current?.postMessage({type:'revision',revision:res.revision} satisfies RevisionMessage);
      return true;
    }catch(error){
      lastSaveFailed.current=true;
      if(error instanceof ApiError&&(error.status===409||error.code==='REVISION_CONFLICT'||error.code==='HISTORY_CURSOR_CONFLICT'||error.code==='HISTORY_UNAVAILABLE'))setCurrentSaveState('conflict');
      else setCurrentSaveState('error');
      return false;
    }finally{exclusiveOperation.current=false}
  },[applyDataEnvelope,applyHistory,coordinator,redoDepth,setCurrentSaveState,undoDepth]);

  const undo=useCallback(()=>move('undo'),[move]);
  const redo=useCallback(()=>move('redo'),[move]);

  const doImport = useCallback(async (incoming: FinanceData) => {
    if (exclusiveOperation.current) throw new Error('Υπάρχει ήδη λειτουργία αποθήκευσης σε εξέλιξη.');
    exclusiveOperation.current = true;
    setCurrentSaveState('saving');
    try {
      await coordinator.whenIdle();
      try {
        const res = await importData(productData(incoming));
        applyDataEnvelope(res);
        const nextHistory=await loadHistory();
        const consistent=historyMatchesRevision(nextHistory,res.revision);
        applyHistory(consistent?nextHistory:{...nextHistory,available:false});
        setCurrentSaveState(consistent&&nextHistory.available?'saved':'conflict');
        channelRef.current?.postMessage({ type: 'revision', revision: res.revision } satisfies RevisionMessage);
      } catch (error) {
        lastSaveFailed.current = true;
        if (error instanceof ApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT' || error.code === 'HISTORY_CURSOR_CONFLICT')) setCurrentSaveState('conflict');
        else setCurrentSaveState('error');
        throw error;
      }
    } finally {
      exclusiveOperation.current = false;
    }
  }, [applyDataEnvelope,applyHistory, coordinator,setCurrentSaveState]);

  const doBackup = useCallback(async () => {
    await coordinator.whenIdle();
    if (lastSaveFailed.current) {
      throw new Error('Το backup ακυρώθηκε επειδή υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί επιτυχώς.');
    }
    return createBackup();
  }, [coordinator]);

  const canUndo = historyAvailable && undoDepth > 0 && saveState === 'saved' && !coordinator.hasWork();
  const canRedo = historyAvailable && redoDepth > 0 && saveState === 'saved' && !coordinator.hasWork();

  return useMemo(() => ({ data, revision, filePath, lastSavedAt, saveState, update, reload, undo, redo, canUndo, canRedo, undoDepth, redoDepth, changeHistory, historyAvailable, importData: doImport, createBackup: doBackup }), [data, revision, filePath, lastSavedAt, saveState, update, reload, undo, redo, canUndo, canRedo, undoDepth, redoDepth, changeHistory, historyAvailable, doImport, doBackup]);
}