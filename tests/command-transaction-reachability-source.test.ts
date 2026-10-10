import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const search=readFileSync('src/lib/commandSearch.ts','utf8');
const app=readFileSync('src/App.tsx','utf8'),qa=readFileSync('src/qa.tsx','utf8');
const ledger=readFileSync('src/pages/TransactionsPage.tsx','utf8');
const browser=readFileSync('scripts/command-palette-qa.mjs','utf8');

describe('Command Palette source-to-selected-ledger reachability (DV-FB02/03)',()=>{
  it('routes individual generic transaction hits with stable identity and date',()=>{
    expect(search).toContain("type:'transaction_focus';id:string;source:'legacy'|'event';date:string");
    expect(search).toContain("type:'transaction_focus',id:tx.id,source:'legacy',date:tx.date");
    expect(search).toContain("type:'transaction_focus',id:event.id,source:'event',date:event.date");
    expect(search).toContain("event.kind==='card_purchase'||event.kind==='card_payment'");
  });
  it('selects the right month in web and synthetic QA, including same-route repeat clicks',()=>{
    expect(app).toContain("setMonth(action.date.slice(0,7));setMonthIsManual(true)");
    expect(qa).toContain("setMonth(action.date.slice(0,7))");
    expect(app).toContain("commandFocusKey={commandFocusKey}");
    expect(qa).toContain("commandFocusKey={commandFocusKey}");
    expect(app).toContain("url.searchParams.set('commandMonth',action.date.slice(0,7))");
    expect(qa).toContain("url.searchParams.set('commandMonth',action.date.slice(0,7))");
    expect(ledger).toContain("focusMonth!==month");
    expect(ledger).toContain("setPage(Math.max(1,Math.floor(index/pageSize)+1))");
    expect(ledger).toContain("setSelectedId(focusId);setDetailOpen(true)");
  });
  it('uses a one-time hint and actionable missing-entry state',()=>{
    expect(ledger).toContain("nextUrl.searchParams.delete('commandTx')");
    expect(ledger).toContain("nextUrl.searchParams.delete('commandMonth')");
    expect(ledger).toContain("Η συναλλαγή δεν είναι πλέον διαθέσιμη");
    expect(browser).toContain('command-exact-historical-transaction');
    expect(browser).toContain('command-exact-transaction-same-route');
  });
});
