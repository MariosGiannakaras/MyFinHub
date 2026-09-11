import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const contextual=fs.readFileSync(path.join(root,'src/components/ContextualQuickAdd.tsx'),'utf8');
const taxonomy=fs.readFileSync(path.join(root,'src/components/CategoryIconsWorkspace.tsx'),'utf8');
const receipts=fs.readFileSync(path.join(root,'src/components/ReceiptInbox.tsx'),'utf8');

describe('consolidated Stage 2 shared action adoption',()=>{
  it('moves ContextualQuickAdd generic dialog actions to shared primitives only',()=>{
    expect(contextual).toContain("from './Button'");
    expect(contextual).toContain("from './IconButton'");
    expect(contextual.match(/<Button/g)).toHaveLength(2);
    expect(contextual.match(/<IconButton/g)).toHaveLength(1);
    expect(contextual.match(/<Button[^>]+variant="primary"/g)).toHaveLength(1);
    expect(contextual.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(1);
    expect(contextual).toContain('<IconButton type="button" aria-label="Κλείσιμο contextual καταχώρισης" onClick={onClose}>');
    expect(contextual).toContain('<Button type="button" variant="secondary" onClick={onClose}>Ακύρωση</Button>');
    expect(contextual).toContain('<Button type="button" variant="primary" onClick={submit}>');
    expect(contextual).not.toContain('className="icon-button"');
    expect(contextual).not.toContain('className="secondary"');
    expect(contextual).not.toContain('className="save-button"');
  });

  it('preserves ContextualQuickAdd focus and finance completion semantics',()=>{
    expect(contextual).toContain("useModalFocus<HTMLElement>(true,'[data-autofocus=\"true\"]',onClose)");
    expect(contextual).toContain("event=scheduledToEvent(data,scheduled,{date,amount:numeric,accountId,fromAccountId,toAccountId})");
    expect(contextual).toContain("onCompleteScheduled(transitionScheduled(scheduled,'completed',event.id),event);onClose();return;");
    expect(contextual).toContain('onCreate(event);onClose();');
    expect(contextual).toContain("event.savingSource=context.savingSource??'manual_transfer'");
  });

  it('moves nine taxonomy form/editor actions while retaining raw taxonomy composites',()=>{
    expect(taxonomy).toContain("from './Button'");
    expect(taxonomy.match(/<Button/g)).toHaveLength(9);
    expect(taxonomy.match(/<Button[^>]+variant="primary"/g)).toHaveLength(4);
    expect(taxonomy.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(5);
    expect(taxonomy).not.toContain('className="save-button"');
    expect(taxonomy).not.toContain('className="secondary"');
    expect(taxonomy).toContain('CATEGORY_ICON_PACKS.map(item=><button type="button"');
    expect(taxonomy).toContain('className="segmented-control"');
    expect(taxonomy).toContain('className="taxonomy-row-actions"');
    expect(taxonomy).toContain("type:'reorder-category'");
    expect(taxonomy).toContain("type:'reorder-subcategory'");
    expect(taxonomy).toContain("type:'retire-category'");
    expect(taxonomy).toContain("type:'retire-subcategory'");
  });

  it('retains taxonomy keyboard/edit and stable-identity operation behavior',()=>{
    expect(taxonomy).toContain("if(event.key==='Enter'){event.preventDefault();addCategory()}");
    expect(taxonomy).toContain("if(event.key==='Enter'){event.preventDefault();saveEdit()}if(event.key==='Escape')setEditing(null)");
    expect(taxonomy).toContain("type:'move-subcategory'");
    expect(taxonomy).toContain('taxonomyRetirementDependencies(snapshot,operation,asOf)');
    expect(taxonomy).toContain('<ConfirmDialog');
  });

  it('moves six ReceiptInbox generic actions plus the close action to shared primitives',()=>{
    expect(receipts).toContain("from './Button'");
    expect(receipts).toContain("from './IconButton'");
    expect(receipts.match(/<Button/g)).toHaveLength(6);
    expect(receipts.match(/<IconButton/g)).toHaveLength(1);
    expect(receipts.match(/<Button[^>]+variant="primary"/g)).toHaveLength(2);
    expect(receipts.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(4);
    expect(receipts).toContain('<IconButton type="button" aria-label="Κλείσιμο αποδείξεων σε αναμονή" onClick={onClose}>');
    expect(receipts).toContain('variant="primary" disabled={loading || scanning}');
    expect(receipts).toContain('variant="secondary" disabled={loading || scanning}');
    expect(receipts).toContain('variant="primary" disabled={scanning}');
    expect(receipts).not.toContain('className="save-button"');
    expect(receipts).not.toContain('className="icon-button"');
  });

  it('keeps ReceiptInbox destructive/domain controls raw and async OCR semantics intact',()=>{
    expect(receipts).toContain('className="text-button danger"');
    expect(receipts).toContain('className="secondary danger"');
    expect(receipts).toContain('className="receipt-draft-open"');
    expect(receipts).toContain('await module.cancelReceiptOcr()');
    expect(receipts).toContain('await saveReceiptProposal(draft.id, proposal)');
    expect(receipts).toContain('await deleteReceiptDrafts(request.ids)');
    expect(receipts).toContain('<ConfirmDialog open={Boolean(deleteRequest)}');
  });
});
