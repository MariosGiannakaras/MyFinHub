import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const quickAdd=fs.readFileSync(path.join(root,'src/components/QuickAdd.tsx'),'utf8');

describe('QuickAdd shared action primitive ownership',()=>{
  it('moves generic dialog and split-part text actions to shared primitives',()=>{
    expect(quickAdd).toContain("from './Button'");
    expect(quickAdd).toContain("from './IconButton'");
    expect(quickAdd.match(/<Button/g)).toHaveLength(4);
    // The new funding-row action reuses the existing ghost primitive.
    expect(quickAdd.match(/<Button[^>]+variant="ghost"/g)).toHaveLength(2);
    expect(quickAdd).toContain('disabled={fundingRows.length>=12}');
    expect(quickAdd).toContain('>+ Προσθήκη πηγής</Button>');
    expect(quickAdd.match(/<IconButton/g)).toHaveLength(1);
    expect(quickAdd.match(/<Button[^>]+variant="primary"/g)).toHaveLength(1);
    expect(quickAdd.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(1);
    expect(quickAdd.match(/<Button[^>]+variant="ghost"/g)).toHaveLength(1);
    expect(quickAdd).toContain('<IconButton type="button" aria-label="Κλείσιμο καταχώρισης" disabled={saving} onClick={requestClose}>');
    expect(quickAdd).toContain('<Button type="button" variant="secondary" disabled={saving} onClick={requestClose}>Ακύρωση</Button>');
    expect(quickAdd).toContain('<Button type="button" variant="primary" disabled={saving} onClick={()=>void submit()}>');
    expect(quickAdd).toContain('<Button type="button" variant="ghost" onClick={()=>{setParts(');
    expect(quickAdd).not.toContain('className="icon-button"');
    expect(quickAdd).not.toContain('className="secondary"');
    expect(quickAdd).not.toContain('className="save-button"');
  });

  it('keeps QuickAdd domain and composite choices raw',()=>{
    expect(quickAdd.match(/<button/g)).toHaveLength(4);
    // Funding-row removal is a domain choice, not another custom button style.
    expect(quickAdd).toContain('aria-label={`Αφαίρεση πηγής ${index+1}`}');
    expect(quickAdd).toContain('disabled={fundingRows.length<=2}');
    expect(quickAdd).toContain('className="kind-grid generic-kind-grid"');
    expect(quickAdd).toContain('genericKinds.map(k=><button type="button"');
    expect(quickAdd).toContain('className="frequent-strip"');
    expect(quickAdd).toContain('frequent.slice(0,6).map(f=><button type="button"');
    expect(quickAdd).toContain('aria-label={`Αφαίρεση μέρους ${i+1}`}');
    expect(quickAdd).not.toContain('<button type="button" className="text-button"');
  });

  it('retains dirty-close and nested modal focus behavior through DialogShell',()=>{
    expect(quickAdd).toContain("from './DialogShell'");
    expect(quickAdd).toContain('<DialogShell open={open}');
    expect(quickAdd).toContain("preferredFocus='[data-autofocus=\"true\"]'");
    expect(quickAdd).toContain('focusActive={!discardOpen}');
    expect(quickAdd).toContain('onRequestClose={requestClose}');
    expect(quickAdd).not.toContain('useModalFocus');
    expect(quickAdd).toContain('const requestClose=()=>{if(saving)return;if(dirty){setDiscardOpen(true);return}onClose()}');
    expect(quickAdd).toContain('busy={saving}');
    expect(quickAdd).toContain('inert={saving}');
    expect(quickAdd).toContain('<ConfirmDialog open={discardOpen}');
    expect(quickAdd).toContain("document.getElementById('quick-add-title')?.closest<HTMLElement>('[role=\"dialog\"]')");
    expect(quickAdd).toContain('await onCreate(event);');
    expect(quickAdd).toContain('reset();onClose();');
    expect(quickAdd.indexOf('await onCreate(event);')).toBeLessThan(quickAdd.indexOf('reset();onClose();'));
    expect(quickAdd).toContain('finally{setSaving(false)}');
  });
});
