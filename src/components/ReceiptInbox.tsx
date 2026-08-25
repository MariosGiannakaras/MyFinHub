import { Camera, Check, FileImage, LoaderCircle, ReceiptText, ScanLine, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { useModalFocus } from '../hooks/useModalFocus';
import { money } from '../lib/format';
import { normalizeReceiptFile } from '../lib/receiptImage';
import type { ReceiptOcrProgress } from '../lib/receiptOcr';
import { suggestReceiptCategory } from '../lib/receiptParser';
import {
  createReceiptDraft,
  deleteReceiptDraft,
  deleteReceiptDrafts,
  listReceiptDrafts,
  markReceiptDraftError,
  saveReceiptProposal,
  type ReceiptDraft,
  type ReceiptProposal,
} from '../lib/receiptDrafts';
import type { FinanceData } from '../types';

type ReceiptOcrModule = typeof import('../lib/receiptOcr');
type DeleteRequest={mode:'one';draft:ReceiptDraft}|{mode:'many';ids:string[]};
let receiptOcrModulePromise: Promise<ReceiptOcrModule> | null = null;

const loadReceiptOcr = () => {
  receiptOcrModulePromise ??= import('../lib/receiptOcr');
  return receiptOcrModulePromise;
};

const disposeReceiptOcrIfLoaded = async () => {
  const current = receiptOcrModulePromise;
  receiptOcrModulePromise = null;
  if (!current) return;
  try {
    const module = await current;
    await module.disposeReceiptOcr();
  } catch {
    // Closing the inbox must not fail because an optional OCR worker was already stopping.
  }
};

function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) { setUrl(''); return; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

function ReceiptThumb({ draft }: { draft: ReceiptDraft }) {
  const url = useBlobUrl(draft.image);
  return url ? <img src={url} alt="Μικρογραφία απόδειξης σε αναμονή"/> : <ReceiptText aria-hidden="true"/>;
}

function ReceiptPreview({ draft }: { draft: ReceiptDraft }) {
  const url = useBlobUrl(draft.image);
  return url ? <img src={url} alt="Προεπισκόπηση απόδειξης"/> : null;
}

const capturedLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Τοπικό πρόχειρο' : date.toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });
};

const confidenceLabel = (value?: number) => {
  if (typeof value !== 'number') return '—';
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return `${pct}%`;
};

const statusLabel = (draft: ReceiptDraft) => draft.status === 'ready' ? 'Έτοιμη για έλεγχο' : draft.status === 'error' ? 'Χρειάζεται έλεγχο' : 'Σε αναμονή';

function scanErrorMessage(reason: unknown) {
  const code = reason instanceof Error ? reason.message : '';
  if (code === 'OCR_TIMEOUT') return 'Η τοπική σάρωση άργησε πολύ και σταμάτησε. Μπορείς να ξαναδοκιμάσεις ή να συνεχίσεις χειροκίνητα.';
  if (code === 'OCR_NO_USEFUL_FIELDS') return 'Διαβάστηκε κείμενο, αλλά δεν βρέθηκαν αρκετά αξιόπιστα στοιχεία απόδειξης. Συνέχισε χειροκίνητα ή δοκίμασε καθαρότερη φωτογραφία.';
  if (code === 'OCR_CANCELLED') return '';
  return 'Δεν ολοκληρώθηκε η τοπική OCR σάρωση. Η φωτογραφία παραμένει αποθηκευμένη στη συσκευή και μπορείς να δοκιμάσεις ξανά.';
}

export function ReceiptInbox({
  open,
  data,
  onClose,
  onApply,
}: {
  open: boolean;
  data: FinanceData;
  onClose: () => void;
  onApply: (draftId: string, proposal: ReceiptProposal) => void;
}) {
  const [drafts, setDrafts] = useState<ReceiptDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteSelection, setDeleteSelection] = useState<Set<string>>(new Set());
  const [deleteRequest,setDeleteRequest]=useState<DeleteRequest|null>(null);
  const [deleting,setDeleting]=useState(false);
  const [loading, setLoading] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReceiptOcrProgress | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanToken = useRef(0);
  const modalRef = useModalFocus<HTMLElement>(open&&!deleteRequest, 'button', onClose);

  const selected = useMemo(() => drafts.find((draft) => draft.id === selectedId) ?? null, [drafts, selectedId]);

  const refresh = async (preferId?: string) => {
    try {
      const rows = await listReceiptDrafts();
      setDrafts(rows);
      const candidate = preferId ?? selectedId;
      if (candidate && rows.some((row) => row.id === candidate)) setSelectedId(candidate);
      else setSelectedId(rows[0]?.id ?? null);
    } catch {
      setError('Δεν ήταν δυνατή η ανάγνωση των τοπικών αποδείξεων σε αναμονή.');
    }
  };

  useEffect(() => {
    if (!open) {
      scanToken.current += 1;
      setScanningId(null);
      setProgress(null);
      setDeleteRequest(null);
      setDeleting(false);
      void disposeReceiptOcrIfLoaded();
      return;
    }
    setError('');
    setMessage('');
    void refresh();
  }, [open]);

  const capture = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const normalized = await normalizeReceiptFile(file);
      const draft = await createReceiptDraft(normalized);
      await refresh(draft.id);
      setMessage('Αποθηκεύτηκε για αργότερα. Μπορείς να κλείσεις τώρα την εφαρμογή ή να κάνεις τοπική σάρωση.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Δεν αποθηκεύτηκε η απόδειξη.');
    } finally {
      setLoading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const scan = async (draft: ReceiptDraft) => {
    const token = ++scanToken.current;
    setScanningId(draft.id);
    setProgress({ status: 'Προετοιμασία εικόνας', progress: 0 });
    setError('');
    setMessage('');
    try {
      const { scanReceiptLocally } = await loadReceiptOcr();
      if (token !== scanToken.current) return;
      const extracted = await scanReceiptLocally(draft.image, setProgress);
      if (token !== scanToken.current) return;
      const category = suggestReceiptCategory(data, extracted.merchant);
      const proposal = category ? { ...extracted, category } : extracted;
      await saveReceiptProposal(draft.id, proposal);
      await refresh(draft.id);
      setMessage('Η τοπική σάρωση ολοκληρώθηκε. Έλεγξε τα προτεινόμενα στοιχεία πριν τα χρησιμοποιήσεις.');
    } catch (reason) {
      if (token !== scanToken.current) return;
      const readable = scanErrorMessage(reason);
      if (readable) {
        await markReceiptDraftError(draft.id, 'ocr-failed');
        await refresh(draft.id);
        setError(readable);
      }
    } finally {
      if (token === scanToken.current) {
        setScanningId(null);
        setProgress(null);
      }
    }
  };

  const cancelScan = async () => {
    scanToken.current += 1;
    setScanningId(null);
    setProgress(null);
    setMessage('Η σάρωση σταμάτησε. Η απόδειξη παραμένει αποθηκευμένη για αργότερα.');
    const module = await loadReceiptOcr();
    await module.cancelReceiptOcr();
  };

  const requestRemoveOne=(draft:ReceiptDraft)=>setDeleteRequest({mode:'one',draft});
  const requestRemoveSelected=()=>{const ids=[...deleteSelection];if(ids.length)setDeleteRequest({mode:'many',ids})};
  const confirmRemove=async()=>{
    const request=deleteRequest;if(!request||deleting)return;setDeleting(true);
    try{
      if(request.mode==='one'){
        if(scanningId===request.draft.id)await cancelScan();
        await deleteReceiptDraft(request.draft.id);
        setDeleteSelection((current)=>{const next=new Set(current);next.delete(request.draft.id);return next});
        await refresh();
        setMessage('Η τοπική απόδειξη διαγράφηκε.');
      }else{
        if(scanningId&&request.ids.includes(scanningId))await cancelScan();
        await deleteReceiptDrafts(request.ids);
        setDeleteSelection(new Set());
        await refresh();
        setMessage('Οι επιλεγμένες τοπικές αποδείξεις διαγράφηκαν.');
      }
      setDeleteRequest(null);
    }finally{setDeleting(false)}
  };

  const toggleDelete = (id: string) => setDeleteSelection((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (!open) return null;

  const proposal = selected?.proposal;
  const nonEur = Boolean(proposal?.currency && proposal.currency !== 'EUR');
  const scanning = Boolean(scanningId);
  const deleteCount=deleteRequest?.mode==='many'?deleteRequest.ids.length:1;

  return <>
  <div className="modal-backdrop receipt-inbox-backdrop" onMouseDown={onClose}>
    <section ref={modalRef} className="receipt-inbox neo-raised" role="dialog" aria-modal="true" aria-labelledby="receipt-inbox-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <header className="receipt-inbox-header"><div><small>LOCAL-ONLY OCR</small><h2 id="receipt-inbox-title"><ReceiptText size={21}/> Αποδείξεις σε αναμονή</h2><p>Η φωτογραφία αποθηκεύεται μόνο σε αυτή τη συσκευή. Μπορείς να τη σαρώσεις τώρα ή αργότερα και να κλείσεις την εφαρμογή μόλις επιβεβαιωθεί η αποθήκευση.</p></div><button type="button" className="icon-button" aria-label="Κλείσιμο αποδείξεων σε αναμονή" onClick={onClose}><X/></button></header>

      <div className="receipt-capture-actions">
        <input ref={cameraRef} className="receipt-file-input" type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => void capture(event.target.files?.[0])}/>
        <input ref={fileRef} className="receipt-file-input" type="file" accept="image/jpeg,image/png" onChange={(event) => void capture(event.target.files?.[0])}/>
        <button type="button" className="save-button" disabled={loading || scanning} onClick={() => cameraRef.current?.click()}><Camera size={17}/> Φωτογράφιση</button>
        <button type="button" className="secondary" disabled={loading || scanning} onClick={() => fileRef.current?.click()}><FileImage size={17}/> Επιλογή εικόνας</button>
        <small>JPG/PNG · έως 12 MB · έως 30 πρόχειρες αποδείξεις / 60 MB τοπικά</small>
      </div>

      {loading ? <div className="receipt-live-state" role="status"><LoaderCircle className="is-spinning" size={17}/> Αποθήκευση φωτογραφίας στη συσκευή…</div> : null}
      {message ? <div className="receipt-live-state receipt-success" role="status" aria-live="polite"><Check size={17}/> {message}</div> : null}
      {error ? <div className="form-error" role="alert" aria-live="assertive">{error}</div> : null}

      <div className="receipt-inbox-layout">
        <aside className="receipt-draft-list" aria-label="Τοπικές αποδείξεις σε αναμονή">
          <div className="receipt-list-head"><span>{drafts.length} σε αναμονή</span>{deleteSelection.size ? <button type="button" className="text-button danger" onClick={requestRemoveSelected}><Trash2 size={14}/> Διαγραφή ({deleteSelection.size})</button> : null}</div>
          {drafts.length ? drafts.map((draft) => <div key={draft.id} className={`receipt-draft-row ${selectedId === draft.id ? 'active' : ''}`}>
            <label className="receipt-select-check" title="Επιλογή για διαγραφή"><input type="checkbox" checked={deleteSelection.has(draft.id)} onChange={() => toggleDelete(draft.id)}/><span className="sr-only">Επιλογή απόδειξης</span></label>
            <button type="button" className="receipt-draft-open" onClick={() => { setSelectedId(draft.id); setError(''); setMessage(''); }}>
              <span className="receipt-thumb"><ReceiptThumb draft={draft}/></span>
              <span><b>{statusLabel(draft)}</b><small>{capturedLabel(draft.capturedAt)}</small><small>{Math.max(1, Math.round(draft.bytes / 1024))} KB</small></span>
            </button>
          </div>) : <div className="receipt-empty"><ReceiptText size={22}/><b>Δεν υπάρχουν αποδείξεις σε αναμονή</b><span>Τράβηξε μια φωτογραφία και θα αποθηκευτεί τοπικά πριν γίνει οποιαδήποτε σάρωση.</span></div>}
        </aside>

        <div className="receipt-review-pane">
          {selected ? <>
            <div className="receipt-preview"><ReceiptPreview draft={selected}/><div><span>{statusLabel(selected)}</span><small>{capturedLabel(selected.capturedAt)}</small></div></div>
            {scanningId === selected.id ? <div className="receipt-scan-progress" role="status" aria-live="polite"><div><LoaderCircle className="is-spinning" size={18}/><b>Τοπική OCR σάρωση</b><span>{Math.round((progress?.progress ?? 0) * 100)}%</span></div><progress max="1" value={progress?.progress ?? 0}/><small>{progress?.status || 'Αναγνώριση κειμένου στη συσκευή…'}</small><button type="button" className="secondary" onClick={() => void cancelScan()}>Διακοπή</button></div> : null}
            {proposal ? <div className="receipt-proposal" aria-label="Προτεινόμενα στοιχεία απόδειξης"><h3>Πρόταση OCR</h3><dl><div><dt>Κατάστημα</dt><dd>{proposal.merchant || '—'} <small>{confidenceLabel(proposal.confidence?.merchant)}</small></dd></div><div><dt>Ημερομηνία</dt><dd>{proposal.date || '—'} <small>{confidenceLabel(proposal.confidence?.date)}</small></dd></div><div><dt>Σύνολο</dt><dd>{typeof proposal.total === 'number' ? money.format(proposal.total) : '—'} <small>{confidenceLabel(proposal.confidence?.total)}</small></dd></div><div><dt>Νόμισμα</dt><dd>{proposal.currency || 'Δεν εντοπίστηκε'} <small>{confidenceLabel(proposal.confidence?.currency)}</small></dd></div>{proposal.category ? <div><dt>Προτεινόμενη κατηγορία</dt><dd>{proposal.category}<small>από προηγούμενες κινήσεις</small></dd></div> : null}</dl>{nonEur ? <div className="receipt-currency-warning" role="alert">Η απόδειξη φαίνεται να είναι σε {proposal.currency}. Το MyFinHub παραμένει EUR-only, οπότε το ποσό δεν θα συμπληρωθεί αυτόματα.</div> : null}</div> : <div className="receipt-proposal receipt-proposal-empty"><ScanLine size={22}/><b>Δεν έχει γίνει ακόμη OCR</b><span>Η φωτογραφία είναι ήδη ασφαλώς αποθηκευμένη τοπικά. Η σάρωση είναι προαιρετική και μπορεί να γίνει αργότερα.</span></div>}
            <div className="receipt-review-actions">
              <button type="button" className="secondary danger" disabled={scanning} onClick={() => requestRemoveOne(selected)}><Trash2 size={16}/> Διαγραφή</button>
              {!scanning ? <button type="button" className="secondary" onClick={() => void scan(selected)}><ScanLine size={16}/> {selected.status === 'ready' ? 'Νέα σάρωση' : 'Σάρωση τώρα'}</button> : null}
              <button type="button" className="secondary" disabled={scanning} onClick={() => onApply(selected.id, {})}>Χειροκίνητη καταχώριση</button>
              {proposal ? <button type="button" className="save-button" disabled={scanning} onClick={() => onApply(selected.id, proposal)}><Check size={16}/> Χρήση στη Γρήγορη Κίνηση</button> : null}
            </div>
          </> : <div className="receipt-empty receipt-empty-main"><ReceiptText size={28}/><b>Γρήγορη λήψη, έλεγχος αργότερα</b><span>Η αποθήκευση είναι ανεξάρτητη από το OCR. Μόλις εμφανιστεί «Αποθηκεύτηκε για αργότερα», μπορείς να κλείσεις την εφαρμογή.</span></div>}
        </div>
      </div>
    </section>
  </div>
  <ConfirmDialog open={Boolean(deleteRequest)} title={deleteRequest?.mode==='many'?`Διαγραφή ${deleteCount} αποδείξεων;`:'Διαγραφή τοπικής απόδειξης;'} description={deleteRequest?.mode==='many'?'Οι επιλεγμένες τοπικές αποδείξεις θα διαγραφούν από αυτή τη συσκευή. Δεν θα δημιουργηθεί καμία συναλλαγή.':'Η τοπική απόδειξη θα διαγραφεί από αυτή τη συσκευή. Δεν θα δημιουργηθεί συναλλαγή.'} confirmLabel="Διαγραφή" tone="destructive" busy={deleting} motionMode={data.state.settings.motion} onConfirm={()=>void confirmRemove()} onCancel={()=>{if(!deleting)setDeleteRequest(null)}}/>
  </>;
}