export type RemoteRevisionAction = 'ignore' | 'reload' | 'conflict';

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
