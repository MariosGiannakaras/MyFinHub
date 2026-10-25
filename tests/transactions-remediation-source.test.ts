import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/TransactionsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/transactions-approved.css',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/transactions-scanability-qa.mjs',import.meta.url),'utf8');

describe('Transactions post-v1.4 remediation contracts',()=>{
  it('guards the owner-approved wide ledger against a hidden 1560px recentering cap',()=>{
    const qa=readFileSync(new URL('../scripts/transactions-scanability-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('wide.shell>=wide.workspace-wide.left-wide.right-2');
    expect(qa).toContain('wide.grid<=wide.shell+1');
    expect(qa).not.toContain('wide.shell<=1561');
  });

  it('uses the available desktop width while retaining readable ledger/detail wrapping',()=>{
    expect(css).toContain('.transactions-approved-shell{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0;width:100%;margin-inline:0}');
    expect(css).toContain('.transactions-approved-table td{height:auto;min-height:48px');
    expect(css).toContain('white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere');
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

  it('renders a progressive continuous ledger without numeric pages or page-size controls',()=>{
    expect(page).toContain('const LEDGER_RENDER_BATCH=28');
    expect(page).toContain('const LEDGER_INITIAL_ROWS=20');
    expect(page).toContain('const [renderLimit,setRenderLimit]=useState(LEDGER_INITIAL_ROWS)');
    expect(page).toContain('Math.max(LEDGER_INITIAL_ROWS,count)+LEDGER_RENDER_BATCH');
    expect(page).toContain('const visibleRows=rows.slice(');
    expect(page).toContain('new IntersectionObserver(');
    expect(page).toContain('desktopLoadRef');
    expect(page).toContain('mobileLoadRef');
    expect(page).toContain('Φόρτωση περισσότερων');
    expect(page).not.toContain('transactions-pagination');
    expect(page).not.toContain('transactions-page-size');
    expect(qa).toContain('continuous ledger reveals additional rows on scroll');
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
