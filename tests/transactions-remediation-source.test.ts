import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/TransactionsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/transactions-approved.css',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/transactions-scanability-qa.mjs',import.meta.url),'utf8');

describe('Transactions post-v1.4 remediation contracts',()=>{
  it('keeps a bounded ledger/detail reading measure without changing the 14-row density',()=>{
    expect(css).toContain('.transactions-approved-shell{display:grid;gap:10px;min-width:0;width:min(100%,1560px);margin-inline:auto}');
    expect(css).toContain('.transactions-approved-table td{height:40px');
    expect(css).toContain('@media(min-width:1400px){.transactions-approved-grid{grid-template-columns:minmax(0,1fr) minmax(320px,340px)}}');
  });

  it('presents desktop row selection as a truthful single-select radio',()=>{
    expect(page).toContain('type="radio" name="desktop-transaction-selection"');
    expect(css).toContain('.transactions-approved-check{appearance:none;width:15px;height:15px;border:1px solid var(--control-border);border-radius:50%');
    expect(css).toContain('.transactions-approved-check:checked{background:var(--accent)');
  });

  it('shows owner-entered multiline comments in the desktop detail rail',()=>{
    expect(page).toContain('transactions-detail-comment-row');
    expect(page).toContain('<span>Σχόλιο</span>');
    expect(page).toContain('noteParts(selected.note).comment');
    expect(css).toContain('.transactions-detail-comment-row b{white-space:pre-line;color:var(--text-secondary)}');
  });

  it('uses a moving pagination window that always includes the active page',()=>{
    expect(page).toContain('const pageWindowSize=Math.min(pageCount,5)');
    expect(page).toContain('const pageWindowStart=Math.max(1,Math.min(safePage-Math.floor(pageWindowSize/2),pageCount-pageWindowSize+1))');
    expect(page).toContain('pageWindowStart+index');
    expect(page).not.toContain('Array.from({length:Math.min(pageCount,5)},(_,index)=>index+1)');
    expect(qa).toContain('active numeric page follows the moving pager window beyond page five');
  });

  it('keeps transaction-count month-over-month movement neutral',()=>{
    expect(page).toContain('<span className="neutral">{countDelta===0?');
    expect(page).not.toContain("countDelta<=0?'positive':'negative'");
    expect(css).toContain('.transactions-summary-copy span.neutral{color:var(--text-secondary)}');
  });

  it('raises dense desktop metadata through shared semantic tokens',()=>{
    expect(css).toContain('font-size:var(--ux-dense-data-size);color:var(--ink-2)');
    expect(css).toContain('color:var(--text-secondary);padding:0 8px;border-bottom:1px solid var(--chart-grid)');
    expect(css).toContain('font-size:var(--ux-dense-label-size);background:var(--surface-inset)');
  });
});
