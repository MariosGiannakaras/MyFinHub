type RemoteRevisionAction = 'ignore' | 'reload' | 'conflict';

export function shouldWarnBeforeUnload(hasWork:boolean,lastSaveFailed:boolean){
  return hasWork||lastSaveFailed;
}

function parseRevision(value: string) {
  if (!/^\d+$/.test(value)) return null;
  try { return BigInt(value); }
  catch { return null; }
}

export function remoteRevisionAction(
  localRevision: string,
  remoteRevision: string,
  hasLocalWork: boolean,
  lastSaveFailed: boolean,
): RemoteRevisionAction {
  if (!remoteRevision || remoteRevision === localRevision) return 'ignore';

  const local = parseRevision(localRevision);
  const remote = parseRevision(remoteRevision);
  if (local !== null && remote !== null && remote <= local) return 'ignore';

  return hasLocalWork || lastSaveFailed ? 'conflict' : 'reload';
}

/**
 * Runs one async write at a time while retaining only the newest value queued
 * behind the in-flight write. Failures stop the current drain and drop the
 * pending automatic write; a later explicit enqueue starts a fresh drain.
 */
export class LatestValueQueue<T> {
  private pending: T | undefined;
  private running = false;
  private idlePromise: Promise<void> = Promise.resolve();

  constructor(private readonly run: (value: T) => Promise<void>) {}

  enqueue(value: T) {
    this.pending = value;
    if (this.running) return;
    this.running = true;
    this.idlePromise = this.drain();
  }

  hasWork() {
    return this.running || this.pending !== undefined;
  }

  whenIdle() {
    return this.idlePromise;
  }

  private async drain() {
    try {
      while (this.pending !== undefined) {
        const value = this.pending;
        this.pending = undefined;
        try {
          await this.run(value);
        } catch {
          // Never automatically retry a failed finance write. Any value queued
          // while the failed write was in flight is deliberately discarded.
          this.pending = undefined;
          break;
        }
      }
    } finally {
      this.running = false;
    }
  }
}

/**
 * Durable history cannot coalesce distinct user mutations: every accepted
 * mutation must become exactly one server history point. This queue therefore
 * preserves FIFO order while still failing closed and dropping dependent
 * pending writes after the first failed persistence operation.
 */
type SequentialQueueEntry<T> = {
  value:T;
  resolve?:()=>void;
  reject?:(error:unknown)=>void;
};

export class SequentialQueue<T> {
  private pending: SequentialQueueEntry<T>[] = [];
  private running = false;
  private idlePromise: Promise<void> = Promise.resolve();

  constructor(private readonly run:(value:T)=>Promise<void>){}

  // Keep the existing fire-and-forget path free of rejecting Promises.
  enqueue(value:T){this.schedule({value})}

  // The receipt belongs to this exact FIFO mutation, not to a later idle state.
  enqueueWithReceipt(value:T):Promise<void>{
    return new Promise<void>((resolve,reject)=>this.schedule({value,resolve,reject}));
  }

  private schedule(entry:SequentialQueueEntry<T>){
    this.pending.push(entry);
    if(this.running)return;
    this.running=true;
    this.idlePromise=this.drain();
  }

  hasWork(){return this.running||this.pending.length>0}
  whenIdle(){return this.idlePromise}

  private async drain(){
    try{
      while(this.pending.length){
        const entry=this.pending.shift()!;
        try{
          await this.run(entry.value);
          entry.resolve?.();
        }catch(error){
          // Dependent writes were never run. Reject their receipts as well;
          // otherwise callers could await forever or clean up an in-use asset.
          entry.reject?.(error);
          for(const dropped of this.pending.splice(0))dropped.reject?.(error);
          break;
        }
      }
    }finally{this.running=false}
  }
}
