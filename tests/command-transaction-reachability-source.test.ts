import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const search=readFileSync('src/lib/commandSearch.ts','utf8');
const app=readFileSync('src/App.tsx','utf8'),qa=readFileSync('src/qa.tsx','utf8');
const ledger=readFileSync('src/pages/TransactionsPage.tsx','utf8');
const credit=readFileSync('src/pages/CreditCardPage.tsx','utf8');
const browser=readFileSync('scripts/command-palette-qa.mjs','utf8');

describe('Command Palette source-to-selected-ledger reachability (DV-FB02/03)',()=>{
  it('selects exact credit card search hits, including repeated choices on the same route',()=>{
    expect(search).toContain("type:'credit_card_focus';cardId:string");
    expect(search).toContain("type:'credit_card_focus',cardId:card.id");
    expect(app).toContain("setCommandCardId(action.cardId);setCommandCardKey(key=>key+1);navigate('credit')");
    expect(qa).toContain("setCommandCardId(action.cardId);setCommandCardKey(key=>key+1);setPage('credit')");
    expect(app).toContain('commandCardId={commandCardId} commandCardKey={commandCardKey}');
    expect(qa).toContain('commandCardId={commandCardId} commandCardKey={commandCardKey}');
    expect(credit).toContain('setSelectedCardId(commandCardId)');
    expect(credit).toContain('processedCommandCardKey.current===commandCardKey');
    expect(browser).toContain('command-exact-credit-card-selection');
  });
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
    expect(ledger).toContain("setRenderLimit(Math.max(LEDGER_RENDER_BATCH,index+1))");
    expect(ledger).toContain("const selectedIndex=rows.findIndex(row=>row.id===selectedId)");
    expect(ledger).toContain("setSelectedId(focusId);setDetailOpen(true)");
    // StrictMode replays mount effects. A one-time command URL must survive
    // that replay until the selected month/detail can be committed together.
    expect(qa).toContain('<StrictMode><QaApp/></StrictMode>');
    expect(ledger).toContain('const frame=requestAnimationFrame(()=>{');
    expect(ledger).toContain('return()=>cancelAnimationFrame(frame)');
    expect(ledger.indexOf("history.replaceState(history.state,'',current.toString())"))
      .toBeGreaterThan(ledger.indexOf('const frame=requestAnimationFrame(()=>{'));
    expect(ledger).toContain("current.searchParams.get('commandTx')!==focusId");
  });
  it('uses a one-time hint and actionable missing-entry state',()=>{
    expect(ledger).toContain("current.searchParams.delete('commandTx')");
    expect(ledger).toContain("current.searchParams.delete('commandMonth')");
    expect(ledger).toContain("Η συναλλαγή δεν είναι πλέον διαθέσιμη");
    expect(browser).toContain('command-exact-historical-transaction');
    expect(browser).toContain('command-exact-transaction-same-route');
  });
});
