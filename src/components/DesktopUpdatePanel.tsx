import { CheckCircle2, Download, MonitorCog, RefreshCw, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import packageJson from '../../package.json';
import type { DesktopBackupBridge } from '../lib/desktopBackups';
import { Button } from './Button';
import { Surface } from './Surface';

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'installing' | 'error' | 'unsupported';
type UpdateState = { sequence?: number; supported: boolean; currentVersion: string; status: UpdateStatus; availableVersion: string | null; progress: number; message: string };
type DesktopInfo = { productName: string; version: string; packaged: boolean };
type DesktopBridge = DesktopBackupBridge & {
  getInfo: () => Promise<DesktopInfo>;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateState>;
  downloadUpdate: (version: string | null) => Promise<UpdateState>;
  installUpdate: (version: string | null) => Promise<UpdateState>;
  onUpdateState: (listener: (state: UpdateState) => void) => () => void;
};

declare global { interface Window { myFinHubDesktop?: DesktopBridge } }

const idleState: UpdateState = { supported: false, currentVersion: '', status: 'idle', availableVersion: null, progress: 0, message: '' };
const busyStatuses = new Set<UpdateStatus>(['checking', 'downloading', 'installing']);

function statusLabel(state: UpdateState) {
  if (state.status === 'checking') return 'Έλεγχος ενημερώσεων';
  if (state.status === 'available') return `Νέα έκδοση ${state.availableVersion ?? ''}`.trim();
  if (state.status === 'downloading') return `Λήψη ${state.progress}%`;
  if (state.status === 'ready') return `Έτοιμη ${state.availableVersion ?? ''}`.trim();
  if (state.status === 'installing') return 'Εγκατάσταση & επανεκκίνηση';
  if (state.status === 'up-to-date') return 'Ενημερωμένη';
  if (state.status === 'error') return 'Χρειάζεται επανάληψη';
  return state.supported?'Έτοιμη για έλεγχο':'Μη διαθέσιμος έλεγχος';
}

export function DesktopUpdatePanel() {
  const bridge = typeof window === 'undefined' ? undefined : window.myFinHubDesktop;
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  const [state, setState] = useState<UpdateState>(idleState);
  const [localError, setLocalError] = useState('');
  const [pending, setPending] = useState(false);
  const actionPending = useRef(false);
  const currentState = useRef(idleState);
  const lifecycle = useRef(0);
  const eventVersion = useRef(0);
  const acceptState = useCallback((next: UpdateState) => {
    if (next.sequence !== undefined && currentState.current.sequence !== undefined && next.sequence < currentState.current.sequence) return;
    currentState.current = next;
    setState(next);
    setLocalError('');
  }, []);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    lifecycle.current += 1;
    currentState.current = idleState;
    const initialEvent = eventVersion.current;
    const unsubscribe = bridge.onUpdateState((next) => {
      if (alive) {
        eventVersion.current += 1;
        acceptState(next);
      }
    });
    void Promise.all([bridge.getInfo(), bridge.getUpdateState()])
      .then(([nextInfo, nextState]) => {
        if (!alive) return;
        setInfo(nextInfo);
        if (eventVersion.current === initialEvent && !actionPending.current) acceptState(nextState);
      })
      .catch(() => {
        if (alive && eventVersion.current === initialEvent && !actionPending.current) setLocalError('Δεν ήταν δυνατή η ανάγνωση της κατάστασης ενημερώσεων.');
      });
    return () => {
      alive = false;
      lifecycle.current += 1;
      actionPending.current = false;
      unsubscribe();
    };
  }, [bridge, acceptState]);

  const desktop = Boolean(bridge);
  const busy = pending || busyStatuses.has(state.status);
  const productName = info?.productName || 'MyFinHub';
  const currentVersion = info?.version || state.currentVersion || packageJson.version;
  const run = async (action: () => Promise<UpdateState>) => {
    if (actionPending.current || busyStatuses.has(currentState.current.status)) return;
    actionPending.current = true;
    const generation = lifecycle.current;
    const eventAtStart = ++eventVersion.current;
    setPending(true);
    setLocalError('');
    try {
      const result = await action();
      if (generation === lifecycle.current && (result.sequence !== undefined || eventVersion.current === eventAtStart)) acceptState(result);
    } catch {
      if (generation === lifecycle.current && eventVersion.current === eventAtStart) setLocalError('Η ενέργεια ενημέρωσης δεν επιβεβαιώθηκε. Έλεγξε την τρέχουσα κατάσταση πριν συνεχίσεις.');
    } finally {
      if (generation === lifecycle.current) {
        actionPending.current = false;
        setPending(false);
      }
    }
  };

  const action = !bridge
    ? null
    : state.status === 'available'
      ? <Button variant="primary" type="button" disabled={busy} onClick={() => void run(() => bridge.downloadUpdate(state.availableVersion))}><Download size={16} /> Λήψη ενημέρωσης</Button>
      : state.status === 'ready'
        ? <Button variant="primary" type="button" disabled={busy} onClick={() => void run(() => bridge.installUpdate(state.availableVersion))}><RotateCcw size={16} /> Εγκατάσταση & επανεκκίνηση</Button>
        : <Button variant="secondary" type="button" disabled={busy || state.status === 'installing'} onClick={() => void run(bridge.checkForUpdates)}><RefreshCw size={16} className={state.status === 'checking' ? 'is-spinning' : ''} /> Έλεγχος τώρα</Button>;

  const statusMessage = !desktop
    ? 'Ο έλεγχος και η εγκατάσταση ενημερώσεων είναι διαθέσιμα μόνο στην εφαρμογή MyFinHub για Windows.'
    : localError || state.message || 'Έτοιμο για ασφαλή έλεγχο ενημερώσεων.';

  return (
    <Surface as="article" variant="raised" className="panel desktop-update-panel settings-general-app" aria-labelledby="desktop-update-title">
      <div className="panel-head">
        <div>
          <span id="desktop-update-title">Εφαρμογή & Ενημερώσεις</span>
          <small>Έκδοση εφαρμογής και ενημερώσεις Windows.</small>
        </div>
        <MonitorCog size={19} />
      </div>

      <div className="settings-app-list">
        <div><span>Προϊόν</span><b>{productName}</b></div>
        <div><span>Έκδοση</span><b>{currentVersion}</b></div>
        <div><span>Πλατφόρμα</span><b>{desktop ? 'Windows Desktop' : 'Web'}</b></div>
        {desktop?<div><span>Κατάσταση ενημερώσεων</span><b>{statusLabel(state)}</b></div>:null}
        {desktop && state.availableVersion ? <div><span>Διαθέσιμη έκδοση</span><b>{state.availableVersion}</b></div> : null}
      </div>

      {desktop && (state.status === 'downloading' || state.status === 'ready' || state.status === 'installing') ? (
        <div className="desktop-update-progress" role="progressbar" aria-label="Πρόοδος ενημέρωσης" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress}>
          <i style={{ width: `${Math.max(0, Math.min(100, state.progress))}%` }} />
        </div>
      ) : null}

      <div className={`desktop-update-message ${state.status === 'error' || localError ? 'error' : ''}`} role="status" aria-live="polite">
        {state.status === 'error' || localError
          ? <TriangleAlert size={16} />
          : state.status === 'up-to-date' || state.status === 'ready'
            ? <CheckCircle2 size={16} />
            : <ShieldCheck size={16} />}
        <span>{statusMessage}</span>
      </div>

      {action ? <div className="desktop-update-actions">{action}</div> : null}
    </Surface>
  );
}
