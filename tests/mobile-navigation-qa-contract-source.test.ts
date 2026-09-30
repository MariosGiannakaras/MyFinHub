import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('mobile navigation QA contracts',()=>{
  const shell=read('src/components/AppShell.tsx');
  const frontend=read('scripts/frontend-qa.mjs');
  const owned=read('scripts/owned-controls-qa.mjs');
  const receipt=read('scripts/receipt-local-ocr-qa.mjs');
  const dialogGeometry=read('scripts/completion-dialog-geometry-qa.mjs');
  const geometry=read('scripts/completion-geometry-qa.mjs');

  it('keeps concise visible phone labels with full accessible page names',()=>{
    expect(shell).toContain("mobileNavLabel:Partial<Record<PageId,string>>={dashboard:'Αρχική',transactions:'Κινήσεις',savings:'Στόχοι',cards:'Κάρτες'}");
    expect(shell).toContain('aria-label={item.label}');
    expect(shell).toContain('data-global-quick-entry="mobile"');
    expect(shell).toContain('<span>Νέα</span>');
    expect(shell).toContain('<span>Άλλα</span>');
  });

  it('keeps rendered QA coupled to accessible navigation names rather than presentation labels',()=>{
    expect(frontend).toContain("clickAria('Συναλλαγές')");
    expect(frontend).toContain("clickAria('Αποταμίευση')");
    expect(frontend).toContain("clickAria('Κάρτες')");
    expect(frontend).not.toContain("clickText('.mobile-nav button','Συναλλαγές')");
    expect(frontend).not.toContain("clickText('.mobile-nav button','Αποταμίευση')");
    expect(owned).toContain("clickAria('Συναλλαγές')");
    expect(owned).not.toContain("clickText('.mobile-nav button','Συναλλαγές')");
  });

  it('keeps every completion/OCR harness off the retired floating Quick Entry selector',()=>{
    expect(receipt).not.toContain('.mobile-quick-action');
    expect(dialogGeometry).not.toContain('.mobile-quick-action');
    expect(geometry).not.toContain('.mobile-quick-action');
    expect(receipt).toContain("querySelectorAll('[data-global-quick-entry]')");
    expect(dialogGeometry).toContain('[data-global-quick-entry="mobile"]');
  });
});
