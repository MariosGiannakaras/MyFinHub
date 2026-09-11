import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source=fs.readFileSync(path.join(process.cwd(),'src/pages/SavingsPage.tsx'),'utf8');

describe('Savings shared Button ownership',()=>{
  it('moves the canonical generic action hooks to shared Button and IconButton',()=>{
    expect(source).toContain("from '../components/Button'");
    expect(source).toContain("from '../components/IconButton'");
    expect(source.match(/<Button\b/g)).toHaveLength(6);
    expect(source.match(/<IconButton\b/g)).toHaveLength(1);
    expect(source.match(/<Button[^>]+variant=\"primary\"/g)).toHaveLength(2);
    expect(source.match(/<Button[^>]+variant=\"secondary\"/g)).toHaveLength(4);
    expect(source).not.toContain('className="save-button"');
    expect(source).not.toContain('className="secondary"');
    expect(source).not.toContain('className="icon-button"');
  });

  it('preserves savings target and dialog action ownership',()=>{
    expect(source).toContain('<Button type="button" variant="secondary" onClick={cancelTargetEdit}>Ακύρωση</Button>');
    expect(source).toContain('<Button type="button" variant="primary" onClick={saveTarget}>Αποθήκευση στόχου</Button>');
    expect(source.match(/<Button type=\"button\" variant=\"secondary\" aria-label=\"Αλλαγή στόχου αποταμίευσης\"/g)).toHaveLength(2);
    expect(source).toContain('<IconButton type="button" aria-label="Κλείσιμο αποταμίευσης" onClick={close}>');
    expect(source).toContain('<Button type="button" variant="secondary" onClick={close}>Ακύρωση</Button>');
    expect(source).toContain('<Button type="button" variant="primary" onClick={submit}>Καταχώριση αποταμίευσης</Button>');
  });

  it('keeps savings behavior and modal focus contracts unchanged',()=>{
    expect(source).toContain("useModalFocus<HTMLElement>(open,'[data-autofocus=\"true\"]',()=>setOpen(false))");
    expect(source).toContain('onSavingsTargetChange(numeric/100)');
    expect(source).toContain("createEvent({kind:'saving_cash_offset'");
    expect(source).toContain('event.savingSource=source');
    expect(source).toContain("onQuickAdd({mode:'savings',fromAccountId:defaultFrom,toAccountId:defaultTo,note:'',savingSource:'manual_transfer'})");
  });

  it('retains savings mode cards as raw domain controls',()=>{
    expect(source).toContain('const actionGrid=<div className="savings-action-grid">');
    expect(source).toContain('<button type="button" className="panel neo-raised savings-action"');
    expect(source).toContain('aria-label={`Νέα αποταμίευση: ${action.title}`}');
  });
});
