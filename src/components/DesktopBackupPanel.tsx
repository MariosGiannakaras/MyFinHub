import { CheckCircle2, FolderOpen, HardDriveDownload, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { desktopBackupBridge, type LocalBackupStatus } from '../lib/desktopBackups';
import type { FinanceData } from '../types';
import { Button } from './Button';
import { Surface } from './Surface';

const HOUR_MS = 60 * 60 * 1000;
const STATUS_REFRESH_MS = 5 * 60 * 1000;
const dateLabel = (value:string) => new Date(value).toLocaleString('el-GR');

export function DesktopBackupPanel({
  refreshToken, onPrepareRestore,
}: {
  refreshToken: number;
  onPrepareRestore: (data:FinanceData) => void;
}) {
  const bridge = desktopBackupBridge();
  const [status, setStatus] = useState<LocalBackupStatus | null>(null);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<'folder' | 'open' | 'restore' | 'refresh' | null>(null);
  const busy = operation !== null;

  useEffect(() => {
    if (!bridge) return;
    let live = true;
    const refresh = async () => {
      try {
        const current = await bridge.getBackupStatus();
        if (live) { setStatus(current); setError(''); }
      } catch {
        // Do not continue presenting an obsolete result as current after auth expires.
        if (live) { setStatus(null); setError('Η κατάσταση των τοπικών αντιγράφων δεν είναι διαθέσιμη. Έλεγξε τη σύνδεση και προσπάθησε ξανά.'); }
      }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, STATUS_REFRESH_MS);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [bridge, refreshToken]);

  if (!bridge) return null;

  const action = async (kind:NonNullable<typeof operation>, run:()=>Promise<unknown>) => {
    if (busy) return;
    setOperation(kind);
    setError('');
    try {
      await run();
      setStatus(await bridge.getBackupStatus());
    } catch {
      setStatus(null);
      setError('Η ενέργεια ή η επιβεβαίωσή της δεν ολοκληρώθηκε. Επανέλεγξε την κατάσταση πριν συνεχίσεις.');
    } finally { setOperation(null); }
  };

  const lastValid = status?.lastValidBackupAt ? Date.parse(status.lastValidBackupAt) : NaN;
  const newestFailure = status?.lastFailureAt ? Date.parse(status.lastFailureAt) : NaN;
  const failed = Number.isFinite(newestFailure) && (!Number.isFinite(lastValid) || newestFailure > lastValid);
  const overdue = Number.isFinite(lastValid) && Date.now() - lastValid > 36 * HOUR_MS;
  const stateText = !status ? 'Έλεγχος κατάστασης' : failed
    ? 'Η τελευταία προσπάθεια απέτυχε'
    : !Number.isFinite(lastValid)
      ? 'Αναμονή πρώτου αντιγράφου'
      : overdue ? 'Απαιτείται νέο αντίγραφο' : 'Υπάρχει επαληθευμένο αντίγραφο';
  const statusAttention = failed || overdue;
  const nextEligible = Number.isFinite(lastValid)
    ? Date.now() >= lastValid + 24 * HOUR_MS
      ? 'Έτοιμο για νέο backup όταν η εφαρμογή είναι συνδεδεμένη'
      : `Μετά τις ${dateLabel(new Date(lastValid + 24 * HOUR_MS).toISOString())}`
    : 'Μόλις συνδεθείς και ολοκληρωθεί η ανάγνωση της βάσης';

  return (
    <Surface as="section" variant="raised" className="panel desktop-backup-panel" aria-labelledby="desktop-backup-title" aria-busy={busy}>
      <div className="panel-head">
        <div>
          <b id="desktop-backup-title">Αυτόματα τοπικά αντίγραφα Windows</b>
          <small>Το MyFinHub δημιουργεί αντίγραφο από τα αποθηκευμένα δεδομένα της βάσης κάθε 24 ώρες, εφόσον είναι ανοιχτό και έχεις συνδεθεί με TOTP. Ελέγχει κάθε ώρα αν χρειάζεται νέο αντίγραφο.</small>
        </div>
        <HardDriveDownload size={20} aria-hidden="true" />
      </div>
      <div className={`desktop-backup-health${statusAttention ? ' is-warning' : ''}`} role="status" aria-live="polite">
        {statusAttention ? <TriangleAlert size={18} aria-hidden="true"/> : <CheckCircle2 size={18} aria-hidden="true"/>}
        <div>
          <strong>{stateText}</strong>
          <small>{status ? (status.lastValidBackupAt ? `Τελευταίο επιβεβαιωμένο: ${dateLabel(status.lastValidBackupAt)}` : 'Δεν έχει δημιουργηθεί ακόμη τοπικό backup.') : 'Φόρτωση στοιχείων ή μη διαθέσιμη σύνδεση.'}</small>
        </div>
      </div>
      <div className="settings-app-list desktop-backup-facts">
        <div><span>Φάκελος αποθήκευσης</span><b className="desktop-backup-path">{status?.folder || 'Μη διαθέσιμος'}</b></div>
        <div><span>Επόμενο αυτόματο backup</span><b>{status ? nextEligible : '—'}</b></div>
        <div><span>Διατήρηση</span><b>Έως 30 ημέρες / 45 αρχεία</b></div>
        <div><span>Έλεγχος εγκυρότητας</span><b>SHA-256 σε κάθε αντίγραφο</b></div>
      </div>
      <div className="desktop-backup-controls">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void action('folder', bridge.chooseBackupFolder)}>
          <FolderOpen size={16} aria-hidden="true"/> {operation === 'folder' ? 'Επιλογή φακέλου…' : 'Αλλαγή φακέλου'}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void action('open', bridge.openBackupFolder)}>
          {operation === 'open' ? 'Άνοιγμα…' : 'Άνοιγμα φακέλου'}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void action('refresh', bridge.getBackupStatus)}>
          <RefreshCw size={16} aria-hidden="true"/> {operation === 'refresh' ? 'Ανανέωση…' : 'Ανανέωση κατάστασης'}
        </Button>
      </div>
      <p className="desktop-backup-note">Για άμεσο αντίγραφο, πάτησε το <strong>«Backup & λήψη»</strong> παραπάνω. Η αλλαγή φακέλου δεν μετακινεί τα παλιά αντίγραφα.</p>
      {status?.backups.length ? (
        <div className="desktop-backup-list">
          <strong>Ιστορικό τοπικών αντιγράφων ({status.backups.length})</strong>
          {status.backups.map(item => (
            <div className="desktop-backup-entry" key={item.name}>
              <div>
                <span>{item.valid ? <CheckCircle2 size={16} aria-hidden="true"/> : <TriangleAlert size={16} aria-hidden="true"/>} {dateLabel(item.createdAt)}</span>
                <small>Revision {item.revision} · {Math.ceil(item.bytes / 1024)} KB · {item.valid ? 'Επαληθευμένο (SHA-256)' : 'Μη έγκυρο αρχείο — απαγορεύεται η επαναφορά'}</small>
              </div>
              <Button type="button" variant="secondary" disabled={busy || !item.valid} aria-label={undefined} onClick={() => void action(
                'restore', async () => { onPrepareRestore(await bridge.getRestoreCandidate(item.name)); },
              )}>{operation === 'restore' ? 'Έλεγχος…' : 'Επαναφορά'}</Button>
            </div>
          ))}
        </div>
      ) : status ? <p className="desktop-backup-empty">Δεν υπάρχουν τοπικά αντίγραφα στον επιλεγμένο φάκελο. Θα δημιουργηθεί το πρώτο όταν είναι δυνατή η ανάγνωση της βάσης με ενεργή σύνδεση.</p> : null}
      <p className="desktop-backup-note">Τα αρχεία περιλαμβάνουν οικονομικά δεδομένα εφαρμογής και αποθηκεύονται τοπικά χωρίς πρόσθετη κρυπτογράφηση. Δεν περιλαμβάνουν μυστικά Card Vault, PIN, αρχεία Supabase Storage ή πλήρες αντίγραφο PostgreSQL. <strong>Η επαναφορά αντικαθιστά τα τρέχοντα οικονομικά δεδομένα</strong> μόνο μετά από νέα επιβεβαίωση και έλεγχο TOTP.</p>
      {failed && status?.lastFailureAt ? (
        <p role="alert" className="desktop-backup-error"><TriangleAlert size={16} aria-hidden="true"/>Τελευταία αποτυχημένη προσπάθεια: {dateLabel(status.lastFailureAt)}. Θα επανελεγχθεί όσο το MyFinHub είναι ανοιχτό και συνδεδεμένο.</p>
      ) : null}
      {overdue && !failed ? (
        <p role="alert" className="desktop-backup-error"><TriangleAlert size={16} aria-hidden="true"/>Πέρασαν πάνω από 36 ώρες από το τελευταίο επαληθευμένο backup. Έλεγξε τη σύνδεση, τον φάκελο και τη διαθέσιμη χωρητικότητα.</p>
      ) : null}
      {error ? <p role="alert" className="desktop-backup-error"><TriangleAlert size={16} aria-hidden="true"/>{error}</p> : null}
    </Surface>
  );
}
