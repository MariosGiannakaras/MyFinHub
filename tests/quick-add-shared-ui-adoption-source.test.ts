import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const quickAdd=fs.readFileSync(path.join(root,'src/components/QuickAdd.tsx'),'utf8');

describe('QuickAdd shared action primitive ownership',()=>{
  it('moves only the generic close/cancel/submit actions to shared primitives',()=>{
    expect(quickAdd).toContain("from './Button'");
    expect(quickAdd).toContain("from './IconButton'");
    expect(quickAdd.match(/<Button/g)).toHaveLength(2);
    expect(quickAdd.match(/<IconButton/g)).toHaveLength(1);
    expect(quickAdd.match(/<Button[^>]+variant="primary"/g)).toHaveLength(1);
    expect(quickAdd.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(1);
    expect(quickAdd).toContain('<IconButton type="button" aria-label="Κλείσιμο καταχώρισης" onClick={requestClose}>');
    expect(quickAdd).toContain('<Button type="button" variant="secondary" onClick={requestClose}>Ακύρωση</Button>');
    expect(quickAdd).toContain('<Button type="button" variant="primary" onClick={submit}>');
    expect(quickAdd).not.toContain('className="icon-button"');
    expect(quickAdd).not.toContain('className="secondary"');
    expect(quickAdd).not.toContain('className="save-button"');
  });

  it('keeps QuickAdd domain and composite choices raw',()=>{
    expect(quickAdd.match(/<button/g)).toHaveLength(4);
    expect(quickAdd).toContain('className="kind-grid generic-kind-grid"');
    expect(quickAdd).toContain('genericKinds.map(k=><button type="button"');
    expect(quickAdd).toContain('className="frequent-strip"');
    expect(quickAdd).toContain('frequent.slice(0,6).map(f=><button type="button"');
    expect(quickAdd).toContain('aria-label={`Αφαίρεση μέρους ${i+1}`}');
    expect(quickAdd).toContain('<button type="button" className="text-button"');
  });

  it('retains dirty-close and nested modal focus behavior through DialogShell',()=>{
    expect(quickAdd).toContain("from './DialogShell'");
    expect(quickAdd).toContain('<DialogShell open={open}');
    expect(quickAdd).toContain("preferredFocus='[data-autofocus=\"true\"]'");
    expect(quickAdd).toContain('focusActive={!discardOpen}');
    expect(quickAdd).toContain('onRequestClose={requestClose}');
    expect(quickAdd).not.toContain('useModalFocus');
    expect(quickAdd).toContain('const requestClose=()=>{if(dirty){setDiscardOpen(true);return}onClose()}');
    expect(quickAdd).toContain('<ConfirmDialog open={discardOpen}');
    expect(quickAdd).toContain("document.getElementById('quick-add-title')?.closest<HTMLElement>('[role=\"dialog\"]')");
    expect(quickAdd).toContain('onCreate(event); reset(); onClose();');
  });
});
