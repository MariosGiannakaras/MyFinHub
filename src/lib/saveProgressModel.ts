import type { SaveState } from '../hooks/useFinance.js';
import type { DatabaseSaveSnapshot } from './databaseSaveActivity.js';

export type SaveProgressStatus='idle'|'saving'|'error';
export type SaveProgressPhase='idle'|'saving'|'success'|'error';

/** Failure has precedence over pending writes: never color a failed save green. */
export function resolveSaveProgressStatus(finance:SaveState,requests:DatabaseSaveSnapshot):SaveProgressStatus{
  if(finance==='error'||finance==='conflict'||requests.failed)return 'error';
  if(finance==='saving'||requests.pending>0)return 'saving';
  return 'idle';
}
/** Green is reachable only after a previously observed pending operation. */
export function transitionSaveProgress(previous:SaveProgressPhase,now:SaveProgressStatus):SaveProgressPhase{
  if(now==='error')return 'error';
  if(now==='saving')return 'saving';
  if(previous==='saving')return 'success';
  if(previous==='success')return 'success';
  return 'idle';
}
