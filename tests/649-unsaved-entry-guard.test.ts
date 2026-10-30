import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contextual=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');
const inbox=readFileSync(new URL('../src/components/ReceiptInbox.tsx',import.meta.url),'utf8');
const contextualQa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
const receiptQa=readFileSync(new URL('../scripts/receipt-local-ocr-qa.mjs',import.meta.url),'utf8');

describe('#649 unsaved Quick Entry/receipt review protection',()=>{
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
    expect(inbox).toContain('disabled={loading || scanning || reviewDirty || reviewSaving}');
    expect(inbox).toContain('disabled={reviewDirty||reviewSaving} capture="environment"');
  });
  it('exercises discard cancellation in both real-browser QA journeys',()=>{
    expect(contextualQa).toContain('unsaved contextual edits confirmation');
    expect(contextualQa).toContain('for(let i=0;i<240;i++)');
    expect(contextualQa).toContain('Chromium exited before the debugging endpoint became ready');
    expect(contextualQa).toContain('cancelling discard preserves actual edited savings account');
    expect(contextualQa).toContain('confirmed contextual discard');
    expect(receiptQa).toContain('receipt unsaved review discard prompt');
    expect(receiptQa).toContain('receipt editor retains unsaved corrections after cancelled discard');
    expect(receiptQa).toContain('dirty review cannot silently replace selected receipt via new capture');
  });
});
