import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const source=(relative:string)=>readFileSync(path.join(root,relative),'utf8');
const page=source('src/pages/LendingPage.tsx');
const styles=source('src/styles/lending-approved-target.css');
const chain=source('src/styles/part47.css');

describe('approved Lending desktop target source contract',()=>{
  it('keeps canonical receivable selectors and event creation authoritative',()=>{
    expect(page).toContain('lendingRows(data)');
    expect(page).toContain('lendingHistory(data)');
    expect(page).toContain('lendingOutstandingFor(data,presetPerson)');
    expect(page).toContain('createEvent({kind,date,amount:numeric');
    expect(page).toContain("action:next==='lending'?'lend':'repay'");
    expect(page).toContain('<MoneyInput');
    expect(page).toContain('<AppDateInput');
    expect(page).toContain('<AppSelectInput');
    expect(page).not.toContain('payableDelta');
    expect(page).not.toContain('createPayable');
  });

  it('implements the approved desktop master-detail hierarchy without replacing mobile',()=>{
    expect(page).toContain('lending-approved-desktop');
    expect(page).toContain('lending-approved-layout');
    expect(page).toContain('lending-people-panel');
    expect(page).toContain('lending-selected-panel');
    expect(page).toContain('lending-metric-grid');
    expect(page).toContain('lending-quick-panel');
    expect(page).toContain('lending-selected-history');
    expect(page).toContain('lending-mobile-only');
    expect(page).toContain("startForPerson('repayment',selectedRow.person)");
    expect(page).toContain("startForPerson('lending',selectedRow.person)");
    expect(page).toContain("setHistoryFilter('all')");
  });

  it('scopes the redesign to desktop and preserves the established style chain',()=>{
    expect(styles).toContain('@media (min-width:1100px)');
    expect(styles).toContain('.lending-mobile-only{display:none!important}');
    expect(styles).toContain('grid-template-columns:minmax(320px,.72fr) minmax(0,1.48fr)');
    expect(styles).toContain('.lending-metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(styles).toContain('.lending-quick-actions{display:grid;grid-template-columns:1fr 1fr');
    expect(chain).toContain("@import './part48.css';");
    expect(chain).toContain("@import './part54.css';");
    expect(chain).toContain("@import './credit-approved-target.css';");
    expect(chain).toContain("@import './lending-approved-target.css';");
  });
});
