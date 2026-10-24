import { useEffect, useRef } from 'react';
import { loadData } from '../lib/api';
import { desktopBackupBridge } from '../lib/desktopBackups';
import type { SaveState } from './useFinance';

// Local snapshots are collected only after owner+AAL2 /api/data succeeds,
// never from an optimistic unsaved React state or unauthenticated timer.
const INTERVAL_MS = 60 * 60 * 1000;
const DAILY_MS = 24 * INTERVAL_MS;

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
        const last = status.lastValidBackupAt ? Date.parse(status.lastValidBackupAt) : 0;
        if (Number.isFinite(last) && Date.now() - last < DAILY_MS) return;
        const snapshot = await loadData(); // Backend requires owner + AAL2 and returns server revision.
        if (disposed || saveStateRef.current !== 'saved') return;
        await bridge.saveLocalBackup({ data: snapshot.data, revision: snapshot.revision });
      } catch {
        // Reattempt on the next scheduled check. Settings displays actual verified files;
        // a failed attempt must not be reported as a successful backup.
      } finally { busy = false; }
    };
    void run();
    const timer = window.setInterval(() => { void run(); }, INTERVAL_MS);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [saveState === 'saved']);
}
