import type { DatabaseSaveSnapshot } from './databaseSaveActivity.js';

// Pure model, structurally compatible with the finance hook but no React import.
type SaveState='loading'|'saved'|'saving'|'error'|'conflict';
type SaveProgressStatus='idle'|'saving'|'error';
export type SaveProgressPhase='idle'|'saving'|'success'|'error';

/** Never mark completed while the finance queue, an exclusive write or auxiliary DB write remains pending. */
export function resolveSaveProgressStatus(finance:SaveState,requests:DatabaseSaveSnapshot,financePending=false):SaveProgressStatus{
  if(finance==='error'||finance==='conflict'||requests.failed)return 'error';
  if(finance==='saving'||financePending||requests.pending>0)return 'saving';
  return 'idle';
}
/** A green bar REQUIRES a *new* confirmed server receipt, not simply an idle state or a timeout. */
export function transitionSaveProgress(previous:SaveProgressPhase,now:SaveProgressStatus,newConfirmedReceipt=false):SaveProgressPhase{
  if(now==='error')return 'error';
  if(now==='saving')return 'saving';
  if(previous==='saving'&&newConfirmedReceipt)return 'success';
  if(previous==='success')return 'success';
  return 'idle';
}
