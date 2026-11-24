/**
 * Shared activity for database-backed writes that bypass useFinance's revision queue.
 * A request is successful only after its domain client has parsed/accepted the
 * server response. No progress percentage or timer is used for persistence.
 */
import { watchAuthScope } from './authScopedCache.js';
const authEpoch=watchAuthScope(()=>{});

export type DatabaseSaveSnapshot = Readonly<{pending:number;failed:boolean;completion:number}>;
let current:DatabaseSaveSnapshot={pending:0,failed:false,completion:0};
const listeners=new Set<()=>void>();
export function getDatabaseSaveSnapshot(){return current}
export function subscribeDatabaseSaves(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
function publish(next:DatabaseSaveSnapshot){current=next;for(const listener of listeners)listener()}
/** Write receipts exist, but the aggregate post-write readback is unverified.
 * Preserve recorded completions while surfacing an error until a new attempt.
 */
export function markDatabaseSaveUnverified(){publish({...current,failed:true})}
export async function trackDatabaseWrite<T>(work:()=>Promise<T>):Promise<T>{
  const epoch=authEpoch();
  publish({pending:current.pending+1,failed:current.pending>0&&current.failed,completion:current.completion});
  try{
    // A synchronous progress subscriber can retire the initiating auth scope.
    // Abort before the callback can dispatch using a newer session's cookie.
    if(epoch!==authEpoch())throw new Error('Η συνεδρία άλλαξε πριν σταλεί η ενημέρωση.');
    const result=await work();
    const pending=current.pending-1;
    publish({pending,failed:current.failed,completion:pending===0&&!current.failed?current.completion+1:current.completion});
    return result;
  }catch(error){
    publish({pending:current.pending-1,failed:true,completion:current.completion});
    throw error;
  }
}
