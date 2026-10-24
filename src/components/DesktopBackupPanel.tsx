import { CheckCircle2, FolderOpen, HardDriveDownload, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { desktopBackupBridge, type LocalBackupStatus } from '../lib/desktopBackups';
import type { FinanceData } from '../types';
import { Button } from './Button';
import { Surface } from './Surface';

// Desktop-only management; actual restore always passes through existing import confirmation.
export function DesktopBackupPanel({
  refreshToken, onPrepareRestore,
}: {
  refreshToken: number;
  onPrepareRestore: (data:FinanceData) => void;
}) {
  const bridge = desktopBackupBridge();
  const [status, setStatus] = useState<LocalBackupStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    void bridge.getBackupStatus().then(next => { if (live) { setStatus(next); setError(''); } })
      .catch(() => { if (live) setError('Δεν ήταν δυνατή η ανάγνωση των τοπικών αντιγράφων.'); });
    return () => { live = false; };
  }, [bridge, refreshToken]);
  if (!bridge) return null;

  const action = async (run:()=>Promise<unknown>, after?:()=>void) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await run();
      setStatus(await bridge.getBackupStatus());
      after?.();
    } catch {
      setError('Η ενέργεια δεν ολοκληρώθηκε. Τα υπάρχοντα backups δεν τροποποιήθηκαν.');
    } finally { setBusy(false); }
  };

  return (
    <Surface as="section" variant="raised" className="panel desktop-backup-panel" aria-labelledby="desktop-backup-title">
      <div className="panel-head">
        <div>
          <span id="desktop-backup-title">Αυτόματα τοπικά αντίγραφα Windows</span>
          <small>Αρχικοποιούνται κατά την πρώτη εκκίνηση και δημιουργούνται κάθε 24 ώρες όσο είσαι συνδεδεμένος με ενεργό MFA και έχει ολοκληρωθεί η αποθήκευση.</small>
        </div>
        <HardDriveDownload size={20} />
      </div>
      <div className="settings-app-list">
        <div><span>Φάκελος</span><b className="desktop-backup-path">{status?.folder || 'Έλεγχος…'}</b></div>
        <div><span>Διατήρηση</span><b>30 ημέρες · έως 45 αρχεία</b></div>
        <div><span>Τελευταίο επαληθευμένο</span><b>{status?.lastValidBackupAt ? new Date(status.lastValidBackupAt).toLocaleString('el-GR') : 'Δεν υπάρχει ακόμη'}</b></div>
      </div>
      <div className="desktop-backup-controls">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void action(bridge.chooseBackupFolder)}>
          <FolderOpen size={16}/> Αλλαγή φακέλου
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void action(bridge.openBackupFolder)}>
          Άνοιγμα φακέλου
        </Button>
      </div>
      {status?.backups.length ? (
        <div className="desktop-backup-list">
          <strong>Αποθηκευμένα αντίγραφα ({status.backups.length})</strong>
          {status.backups.map(item => (
            <div className="desktop-backup-entry" key={item.name}>
              <div>
                <span>{item.valid ? <CheckCircle2 size={16} aria-label="Επαληθευμένο"/> : <TriangleAlert size={16} aria-label="Μη έγκυρο"/>} {new Date(item.createdAt).toLocaleString('el-GR')}</span>
                <small>Revision {item.revision} · {Math.ceil(item.bytes / 1024)} KB · {item.valid ? 'Checksum OK' : 'Αποτυχία επαλήθευσης'}</small>
              </div>
              <Button type="button" variant="secondary" disabled={busy || !item.valid} onClick={() => void action(
                async () => { onPrepareRestore(await bridge.getRestoreCandidate(item.name)); },
              )}>Επαναφορά</Button>
            </div>
          ))}
        </div>
      ) : <p className="desktop-backup-empty">Δεν υπάρχει τοπικό αντίγραφο ακόμη. Θα δημιουργηθεί μετά την επιτυχή σύνδεση και ανάγνωση της βάσης.</p>}
      <p className="desktop-backup-note">Αυτά είναι αντίγραφα των οικονομικών δεδομένων εφαρμογής, όχι πλήρη PostgreSQL dumps. Δεν περιλαμβάνουν Card Vault, κωδικούς ή αρχεία Storage. Η επαναφορά απαιτεί ρητή επιβεβαίωση και TOTP.</p>
      {status?.lastFailureAt ? (
        <p role="alert" className="desktop-backup-error"><TriangleAlert size={16}/>Η τελευταία προσπάθεια αυτόματου backup απέτυχε ({new Date(status.lastFailureAt).toLocaleString('el-GR')}). Θα γίνει νέα προσπάθεια κατά τον επόμενο έλεγχο.</p>
      ) : null}
      {status?.backups.length && status.lastValidBackupAt &&
        Date.now() - Date.parse(status.lastValidBackupAt) > 36 * 60 * 60 * 1000 ? (
          <p role="alert" className="desktop-backup-error"><TriangleAlert size={16}/>Δεν υπάρχει επαληθευμένο backup των τελευταίων 36 ωρών. Άφησε την εφαρμογή συνδεδεμένη και έλεγξε τη σύνδεση και τον φάκελο.</p>
        ) : null}
      {error ? <p role="alert" className="desktop-backup-error"><TriangleAlert size={16}/>{error}</p> : null}
    </Surface>
  );
}
