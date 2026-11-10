import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contextual=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');
const generic=readFileSync(new URL('../src/components/QuickAdd.tsx',import.meta.url),'utf8');
const receiptAware=readFileSync(new URL('../src/components/ReceiptAwareQuickAdd.tsx',import.meta.url),'utf8');
const inbox=readFileSync(new URL('../src/components/ReceiptInbox.tsx',import.meta.url),'utf8');
const contextualQa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
const receiptQa=readFileSync(new URL('../scripts/receipt-local-ocr-qa.mjs',import.meta.url),'utf8');
const budgetQa=readFileSync(new URL('../scripts/budget-rules-qa.mjs',import.meta.url),'utf8');

describe('#649 unsaved Quick Entry/receipt review protection',()=>{
  it('keeps the mobile generic and contextual finance entry sheet opaque in every theme (#649 I19.07)',()=>{
    const mobile=readFileSync(new URL('../src/styles/mobile-reports-settings-editors.css',import.meta.url),'utf8');
    const opaque='background:var(--surface-elevated,var(--surface))';
    expect(mobile.split(opaque).length-1).toBe(3);
    expect(mobile).not.toContain('background:var(--surface-translucent)');
    expect(budgetQa).toContain('contextual Quick Entry opaque ancestor and surface paint settled');
    expect(budgetQa).toContain('savings-bank-typed-target-contextual-mobile');
    expect(budgetQa).toContain('surfaceProof.right<=surfaceProof.viewportWidth+1');
    expect(budgetQa).toContain('surfaceProof.bottom<=surfaceProof.viewportHeight+1');
    expect(budgetQa).not.toContain('surfaceProof.right<=innerWidth+1');
  });

  it('captures contextual mobile only after full surface/ancestor opacity and 320px large-text generic layout (#649 I19.07)',()=>{
    const referenceQa=readFileSync(new URL('../scripts/quick-entry-reference-qa.mjs',import.meta.url),'utf8');
    expect(budgetQa).toContain('contextual Quick Entry opaque ancestor and surface paint settled');
    expect(budgetQa).toContain('opacity>=.995&&alpha>=.995');
    expect(referenceQa).toContain('320px large-text mobile guard');
    expect(referenceQa).toContain('quick-entry-large-text-mobile-320');
    expect(referenceQa).toContain('narrow.actions.every(rect=>rect.height>=44)');
    expect(referenceQa).toContain('await noOverflow(`${theme} 320px large-text Quick Entry`)');
  });

  it('locks both finance submission owners before any async import or React repaint (#649 I19.02)',()=>{
    for(const owner of [generic,contextual]){
      const start=owner.indexOf('const submit=async()=>{');
      const lock=owner.indexOf('submitInFlight.current=true;setSaving(true);',start);
      const firstAwait=owner.indexOf('await ',start);
      expect(owner).toContain('const submitInFlight=useRef(false)');
      expect(owner).toContain('if(saving||submitInFlight.current)return;');
      expect(lock).toBeGreaterThan(start);
      expect(lock).toBeLessThan(firstAwait);
      expect(owner).toContain('finally{submitInFlight.current=false;setSaving(false)}');
    }
    expect(budgetQa).toContain('same-turn generic Quick Entry starts exactly one durable finance write');
    expect(contextualQa).toContain('same-turn contextual Quick Entry starts exactly one scheduled finance write');
  });

  it('focuses the actual rejection alert in generic and contextual Quick Entry without making it a Tab stop (#649 I19.05)',()=>{
    const formError=readFileSync(new URL('../src/components/FormError.tsx',import.meta.url),'utf8');
    expect(formError).toContain('role="alert" aria-live="assertive" tabIndex={-1}');
    expect(generic).toContain("if(open&&error)document.getElementById('quick-add-error')?.focus({preventScroll:true})");
    expect(contextual).toContain("if(error)document.getElementById('context-quick-error')?.focus({preventScroll:true})");
    expect(budgetQa).toContain('rejected Quick Entry focuses the visible error without losing draft');
    expect(generic).toContain('<FormError id="quick-add-error">{error}</FormError>');
    expect(contextual).toContain('<FormError id="context-quick-error">{error}</FormError>');
  });

  it('guards contextual cancel, header, escape and backdrop without altering confirmed saves',()=>{
    expect(contextual).toContain('const [discardOpen,setDiscardOpen]=useState(false)');
    expect(contextual).toContain('if(dirty){setDiscardOpen(true);return}');
    expect(contextual).toContain('focusActive={!discardOpen}');
    expect(contextual).toContain('onRequestClose={requestClose}');
    expect(contextual).toContain('onClick={requestClose}');
    expect(contextual).toContain('onConfirm={()=>{setDiscardOpen(false);onClose()}}');
    expect(contextual).not.toContain('onClick={onClose}');
    expect(contextual.match(/setDirty\(true\)/g)?.length).toBeGreaterThanOrEqual(12);
    expect(contextual).toContain('onClose();return;');
    expect(contextual).toMatch(/const submit=async\(\)=>\{\s*if\(saving\|\|submitInFlight\.current\)return;[\s\S]*?setError\(''\);\s*try\{/);
    expect(contextual).toContain("onValueChange={value=>{setAmount(value);setWriteoffConfirmed(false);setDirty(true);setError('')}}");

  });
  it('confirms a dirty Quick Entry draft before switching to the local receipt inbox',()=>{
    expect(generic).toContain('onDraftDirtyChange?.(open&&dirty)');
    expect(generic).toContain('focusActive={!discardOpen&&!externalConfirmationOpen}');
    expect(receiptAware).toContain('onDraftDirtyChange={setQuickDirty}');
    expect(receiptAware).toContain('externalConfirmationOpen={receiptSwitchConfirmOpen}');
    expect(receiptAware).toContain('if (quickDirty) { setReceiptSwitchConfirmOpen(true); return; }');
    expect(receiptAware).toContain('onClick={requestReceiptOpen}');
    expect(receiptAware).toContain('<ConfirmDialog open={receiptSwitchConfirmOpen}');
    expect(receiptAware).toContain('onCancel={() => setReceiptSwitchConfirmOpen(false)}');
    expect(receiptAware).toContain('onConfirm={launchReceipt}');
    expect(receiptAware).toContain('setReceiptOpen(true);');
    expect(receiptQa).toContain('dirty Quick Entry receipt-switch confirmation preserves edited draft on cancel');
    expect(receiptQa).toContain('receipt-local-mobile-switch-unsaved-confirm');
  });
  it('keeps Quick Entry portalled receipt launch inert and retry errors honest until acknowledged finance receipt',()=>{
    expect(generic).toMatch(/const submit=async\(\)=>\{\s*if\(saving\|\|submitInFlight\.current\)return;[\s\S]*?setError\(''\);\s*try\{/);
    expect(generic).toContain('<footer inert={saving}>');
    expect(generic).toContain('await onCreate(event);');
    expect(generic).toContain('reset();onClose();');
    expect(generic.indexOf('await onCreate(event);')).toBeLessThan(generic.indexOf('reset();onClose();'));
    expect(budgetQa).toContain('rejected finance receipt cannot create a finance write or unlock synthetic Undo');
    expect(budgetQa).toContain('pending generic finance receipt locks portalled receipt launch');
    expect(budgetQa).toContain('real Chromium pointer cannot open receipt capture during pending finance save');
    expect(budgetQa).toContain('only the acknowledged synthetic finance event becomes available to Undo');
  });
  it('prevents review dismissal, selection switch and manual handoff from silently dropping edits',()=>{
    for(const kind of ['close','select','manual']) expect(inbox).toContain("setDiscardTarget({kind:'"+kind+"'");
    expect(inbox).toContain('onMouseDown={requestClose}');
    expect(inbox).toContain('onClick={requestClose}');
    expect(inbox).toContain('onClick={() => chooseDraft(draft.id)}');
    expect(inbox).toContain('onClick={() => requestManualApply(selected.id)}');
    expect(inbox).toContain('onConfirm={confirmDiscard}');
    expect(inbox).toContain('onCancel={()=>setDiscardTarget(null)}');
    expect(inbox).toContain('disabled={reviewDirty||reviewSaving} onClick={() => void scan(selected)}');
    expect(inbox).toContain("if(target.kind==='select'){setSelectedId(target.id);");
    expect(inbox).toContain('await saveReceiptProposal(selected.id,reviewedSplit)');
    expect(inbox).toContain('if(reviewDirty||reviewSaving){setError(');
    expect(inbox).toContain('disabled={loading || scanning || reviewDirty || reviewSaving || deleting}');
    expect(inbox).toContain('disabled={reviewDirty||reviewSaving||deleting||loading||Boolean(scanningId)} capture="environment"');
  });
  it('uses the confirmed local receipt row instead of a failing second IndexedDB read',()=>{
    const association=inbox.slice(inbox.indexOf('const setPurchaseAssociation='),inbox.indexOf('const splitProposal='));
    const review=inbox.slice(inbox.indexOf('const saveReview=async'),inbox.indexOf('if (!open) return null;'));
    expect(inbox).toContain('const reflectSavedDraft=(saved:ReceiptDraft)=>');
    expect(inbox).toContain('setDrafts(current=>current.map(draft=>draft.id===saved.id?saved:draft))');
    expect(association).toContain('const saved=await saveReceiptProposal(selected.id,{...normalized,reviewedSplit:false,matchedPurchase:link})');
    expect(association).toContain('reflectSavedDraft(saved);');
    expect(review).toContain('const saved=await saveReceiptProposal(selected.id,reviewedSplit)');
    expect(review).toContain('reflectSavedDraft(saved);');
    expect(association).not.toContain('await refresh(selected.id)');
    expect(review).not.toContain('await refresh(selected.id)');
    expect(receiptQa).toContain('QA_UNEXPECTED_READ_AFTER_LOCAL_WRITE_COMMIT');
    expect(receiptQa).toContain('receipt-local-review-save-without-secondary-read-desktop');
    expect(receiptQa).toContain('successful local review must reconcile confirmed write with zero redundant read');
    expect(receiptQa).toContain("prefill.notes[0]==='QA προϊόν χωρίς δεύτερη ανάγνωση'");
  });
  it('locks receipt review while asynchronous local saves, deletes and image capture are pending',()=>{
    // A local IndexedDB save can be slow: edits or draft switching during the await
    // must not be accepted then lost by the subsequent refresh.
    expect(inbox).toContain('className="receipt-inbox-layout" inert={loading||reviewSaving||deleting} aria-busy={loading||reviewSaving||deleting}');
    expect(inbox).toContain('disabled={reviewSaving||deleting||loading} onClick={requestClose}');
    expect(inbox).toContain('disabled={reviewDirty||reviewSaving||deleting||loading||Boolean(scanningId)} capture="environment"');
    expect(inbox).toContain('disabled={loading || scanning || reviewDirty || reviewSaving || deleting}');
    expect(inbox).toContain('if(deleting||loading||scanningId)return;');
    expect(inbox).toContain('if(reviewSaving||deleting||loading)return;');
    expect(inbox).toContain('setReviewSaving(true);setError(\'\');');
    expect(inbox).toContain('finally{setReviewSaving(false)}');
    expect(inbox).toContain('Αποθήκευση διορθώσεων απόδειξης στη συσκευή…');
    expect(inbox).toContain('Διαγραφή τοπικών αποδείξεων…');
  });
  it('exercises discard cancellation in both real-browser QA journeys',()=>{
    expect(contextualQa).toContain('unsaved contextual edits confirmation');
    expect(contextualQa).toContain('for(let i=0;i<240;i++)');
    expect(contextualQa).toContain('Chromium exited before the debugging endpoint became ready');
    expect(contextualQa).toContain('cancelling discard preserves actual edited savings account');
    expect(contextualQa).toContain('confirmed contextual discard');
    expect(receiptQa).toContain('receipt unsaved review discard prompt');
    expect(receiptQa).toContain('receipt editor retains unsaved corrections after cancelled discard');
    expect(receiptQa).toContain('receipt-local-review-save-inflight-locked');
    expect(receiptQa).toContain('window.__qaReceiptWriteGate');
    expect(receiptQa).toContain("local OCR review save held by IndexedDB open gate");
    expect(receiptQa).toContain('pendingReview.focusBlocked');
    expect(receiptQa).toContain('receipt editors and close re-enabled after local save');
    expect(receiptQa).toContain('dirty review cannot silently replace selected receipt via new capture');
    expect(budgetQa).toContain('contextual-quick-invalid-corrected-save-rejected-desktop');
    expect(budgetQa).toContain('corrected contextual amount removes stale validation message');
    expect(budgetQa).toContain('rejected contextual finance receipt leaves corrected draft editable without false success');

  });
});
