import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/TransactionsPage.tsx',import.meta.url),'utf8');
const split=readFileSync(new URL('../src/components/TransactionSplitDetails.tsx',import.meta.url),'utf8');
const ledgerQa=readFileSync(new URL('../scripts/ledger-foundations-qa.mjs',import.meta.url),'utf8');
const focusedQa=readFileSync(new URL('../scripts/transactions-scanability-qa.mjs',import.meta.url),'utf8');
const coordinator=readFileSync(new URL('../scripts/run-rendered-qa.mjs',import.meta.url),'utf8');

describe('Transactions scanability source contracts',()=>{
  it('removes routine app provenance and keeps legacy provenance only when it is meaningful',()=>{expect(page).not.toContain("'MyFinHub'");expect(page).toContain("if(row.source!=='legacy')return category");expect(page).toContain("row.overridden?'Ιστορικό · override':'Ιστορικό'")});
  it('keeps desktop table headers semantic and moves filters into a compact owned-control strip',()=>{expect(page).toContain('className="mobile-transaction-filters transaction-filter-controls"');const head=page.match(/<thead>[\s\S]*?<\/thead>/)?.[0]||'';expect(head).not.toContain('AppSelectInput');expect(head).toContain('Ημερομηνία');expect(head).toContain('Περιγραφή');expect(head).toContain('Λογαριασμός');expect(head).toContain('Ποσό')});
  it('keeps split details compact by default with accessible disclosure semantics',()=>{expect(split).toContain('useState(false)');expect(split).toContain('aria-expanded={expanded}');expect(split).toContain('aria-controls={detailsId}');expect(split).toContain('type="button"');expect(split).toContain("expanded?'Απόκρυψη ανάλυσης':`${parts.length} μέρη`");expect(ledgerQa).toContain('split details are compact by default');expect(ledgerQa).toContain('mobile transaction list preserves transfer and compact split disclosure')});
  it('keeps edit/delete parity, shared destructive confirmation and explicit empty state',()=>{expect(page).toContain("compact?'mobile-row-actions':'row-actions'");expect(page).toContain('Επεξεργασία ${title}');expect(page).toContain('Διαγραφή ${title}');expect(page).toContain('<ConfirmDialog');expect(page).toContain('tone="destructive"');expect(page).toContain('transaction-empty-state')});
  it('runs dedicated rendered Transactions coverage through the canonical coordinator',()=>{expect(coordinator).toContain("path:'scripts/transactions-scanability-qa.mjs'");expect(focusedQa).toContain('desktop baseline hierarchy');expect(focusedQa).toContain('filter controls remain functional');expect(focusedQa).toContain('large split disclosure');expect(focusedQa).toContain('mobile hierarchy');expect(focusedQa).toContain('empty state')});
});
