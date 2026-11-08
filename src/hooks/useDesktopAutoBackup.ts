import { useEffect, useRef } from 'react';
import { desktopBackupBridge } from '../lib/desktopBackups';
import type { SaveState } from './useFinance';

// Local snapshots are collected only after owner+AAL2 /api/data succeeds,
// never from an optimistic unsaved React state or unauthenticated timer.
const INTERVAL_MS = 60 * 60 * 1000;
const DAILY_MS = 24 * INTERVAL_MS;

// A future timestamp after a clock adjustment must never indefinitely block
// the next authenticated and checksum-verified Windows snapshot.
export function desktopBackupIsRecent(lastValidBackupAt:string|null,now=Date.now()):boolean {
  const last=lastValidBackupAt?Date.parse(lastValidBackupAt):NaN;
  const age=now-last;
  return Number.isFinite(last)&&age>=0&&age<DAILY_MS;
}

export function useDesktopAutoBackup(saveState: SaveState) {
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  useEffect(() => {
    const bridge = desktopBackupBridge();
    if (!bridge) return;
    let disposed = false;
    let busy = false;
    const run = async () => {
      if (disposed || busy || saveStateRef.current !== 'saved') return;
      busy = true;
      try {
        const status = await bridge.getBackupStatus();
        if (disposed || saveStateRef.current !== 'saved') return;
        if (desktopBackupIsRecent(status.lastValidBackupAt)) return;
        // Native main fetches the authoritative document through the owner+AAL2 backend.
        await bridge.saveLocalBackup();
      } catch {
        // Do not expose auth/network exception contents in local files or UI.
        // A failed attempt remains failed and is retried on the next scheduled check.
        if (!disposed) void bridge.reportBackupFailure?.().catch(() => undefined);
      } finally { busy = false; }
    };
    void run();
    const timer = window.setInterval(() => { void run(); }, INTERVAL_MS);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [saveState === 'saved']);
}
