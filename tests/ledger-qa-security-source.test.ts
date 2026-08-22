import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ledgerQa=readFileSync(new URL('../scripts/ledger-foundations-qa.mjs',import.meta.url),'utf8');

describe('ledger rendered-QA security contract',()=>{
  it('passes route headings as CDP arguments instead of constructing callback source',()=>{
    expect(ledgerQa).toContain('const waitFor=async(fn,label,args=[])');
    expect(ledgerQa).toContain('function(heading){return (document.querySelector');
    expect(ledgerQa).toContain('heading,[heading]');
    expect(ledgerQa).not.toContain('JSON.stringify(heading)');
  });
});
