import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/TransactionsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/transactions-approved.css',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/transactions-scanability-qa.mjs',import.meta.url),'utf8');

describe('Transactions post-v1.4 remediation contracts',()=>{
  it('keeps action buttons immediately after the selected transaction hero, before long details',()=>{
    const hero=page.indexOf('transactions-detail-hero');
    const actions=page.indexOf('transactions-detail-actions');
    const details=page.indexOf('transactions-detail-list');
    expect(hero).toBeGreaterThan(0);
    expect(actions).toBeGreaterThan(hero);
    expect(details).toBeGreaterThan(actions);
    const css=readFileSync(new URL('../src/styles/transactions-approved.css',import.meta.url),'utf8');
    expect(css).toContain('.transactions-detail-actions{margin:12px 0 4px;padding:0;');
    expect(css).toContain('.transactions-detail-actions button{min-height:44px;');
  });
  it('keeps the desktop filtered-row details button a truthful open/close toggle',()=>{
    const crudQa=readFileSync(new URL('../scripts/completion-functional-crud-qa.mjs',import.meta.url),'utf8');
    expect(page).toContain("if(isSelected){setDetailOpen(false);return}setSelectedId(r.id);setDetailOpen(true)");
    expect(crudQa).toContain('deferred Freddo search has settled in the visible ledger');
    expect(crudQa).toContain('selected modern event details close and expose collapsed ARIA state');
    expect(crudQa).toContain('filtered modern event detail panel reopens for edit');
    expect(crudQa).toContain("shot('transactions-filtered-details-toggle')");
  });
  it('guards the owner-approved wide ledger against a hidden 1560px recentering cap',()=>{
    const qa=readFileSync(new URL('../scripts/transactions-scanability-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('wide.shell>=wide.workspace-wide.left-wide.right-2');
    expect(qa).toContain('wide.grid<=wide.shell+1');
    expect(qa).not.toContain('wide.shell<=1561');
  });

  it('keeps the functional last-column details affordance visible at 1280–1599px',()=>{
    expect(css).toContain('@media(min-width:1181px) and (max-width:1599px)');
    expect(css).toContain('.transactions-approved-table{min-width:0;table-layout:fixed}');
    expect(css).toContain('.transactions-approved-table td:last-child{width:48px}');
    expect(qa).toContain('visibleActions.scrollWidth<=visibleActions.wrapWidth+2');
    expect(qa).toContain('visibleActions.buttonRight<=visibleActions.wrapRight+1');
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

  it('locks actual browser end-date/category filters and aligned semantic/footer counts (#649 I05.05)',()=>{
    expect(qa).toContain('Transactions QA: dated and categorized ledger filters');
    expect(qa).toContain('end-date filter preserves exact filtered/semantic rows');
    expect(qa).toContain('exact persisted category option selected');
    expect(qa).toContain('transactions-date-range-filter-desktop');
    expect(qa).toContain('transactions-category-filter-desktop');
    expect(qa).toContain("'category filter reset'");
    const workflow=readFileSync(new URL('../.github/workflows/fb-focused-rendered-qa.yml',import.meta.url),'utf8');
    expect(workflow).toContain('<!-- run-649-transactions-filter-qa -->');
    expect(workflow).toContain("'transactions-scanability command-palette' ||");
    expect(page).toContain('Εμφανίζονται {visibleRows.length} από {rows.length} συναλλαγές');
  });

  it('shares category/date controls across desktop and mobile with reset and narrow-screen QA (#649 I05.05)',()=>{
    expect(page).toContain('const categoryControl=()=>');
    expect(page).toContain('const datePicker=(boundary:');
    expect(page).toContain('dateRangeControl(true)');
    const ownedDate=readFileSync(new URL('../src/components/AppDateInput.tsx',import.meta.url),'utf8');
    expect(ownedDate).toContain("displayFormat='short'");
    expect(ownedDate).toContain("displayFormat==='numeric'?compactGreekDate:greekDate");
    expect(page).toContain("displayFormat={compact?'numeric':'short'}");
    expect(page).toContain("datePicker('start',true)");
    expect(page).toContain("gridTemplateColumns:'repeat(auto-fit,minmax(min(158px,100%),1fr))'");
    expect(page).toContain('<span>Από</span>');
    expect(page).toContain('<span>Έως</span>');
    expect(qa).toContain("Transactions QA 320px date text:");
    expect(qa).toContain("narrowMobile.controls.every(item=>item.fits)");
    expect(page).toContain('dateRangeControl(false)');
    expect(page).toContain('mobile-transaction-filter-reset');
    expect(page).toContain("if(dateEnd&&next>dateEnd)setDateEnd(next)");
    expect(page).toContain("if(dateStart&&next<dateStart)setDateStart(next)");
    expect(page).toContain('className="mobile-transaction-date" role="group"');
    expect(page).toContain('className="transactions-approved-date"');
    expect(page).toContain("'--ux-dense-label-size':'16px'");
    expect(qa).toContain('mobileDate.fonts.length===2&&mobileDate.fonts.every(size=>size>=15.9)');
    expect(qa).toContain('narrowMobile.fonts.length===2&&narrowMobile.fonts.every(size=>size>=15.9)');
    expect(css).toContain('.transactions-approved-date{height:42px;');
    expect(qa).toContain('Transactions QA: mobile category/date parity and explicit reset');
    expect(qa).toContain('transactions-mobile-category-filter-375');
    expect(qa).toContain('transactions-mobile-date-filter-375');
    expect(qa).toContain('transactions-mobile-date-filter-320');
    expect(qa).toContain('320px date controls remain readable without horizontal overflow');
  });

  it('restores keyboard focus on the exact visible command-selected transaction on desktop and mobile',()=>{
    expect(page).toContain('const [pendingCommandFocus,setPendingCommandFocus]');
    expect(page).toContain('setPendingCommandFocus({id:focusId,source:focusSource})');
    expect(page).toContain('target.focus({preventScroll:true})');
    expect(page).toContain("target.scrollIntoView({block:'center',inline:'nearest'})");
    expect(page).toContain('data-transaction-id={r.id}');
    expect(page).toContain('role="listitem" tabIndex={-1}');
    const commandQa=readFileSync(new URL('../scripts/command-palette-qa.mjs',import.meta.url),'utf8');
    expect(commandQa).toContain('exact historic transaction receives keyboard focus');
    expect(commandQa).toContain('exact historic mobile transaction receives keyboard focus');
    expect(commandQa).toContain('command-exact-transaction-focus-mobile');
    expect(commandQa).toContain('focused mobile transaction clears persistent bottom navigation');
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
