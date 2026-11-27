import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/LendingPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/lending-approved-target.css',import.meta.url),'utf8');

describe('Lending post-v1.4 remediation contracts',()=>{
  it('wraps Greek names and raises the 320px history minimum text size, with real focused browser evidence (#649 I10.01/.05)',()=>{
    const mobile=readFileSync(new URL('../src/pages/LendingCompletion.css',import.meta.url),'utf8');
    const qa=readFileSync(new URL('../scripts/lending-remediation-qa.mjs',import.meta.url),'utf8');
    const focused=readFileSync(new URL('../.github/workflows/fb-focused-rendered-qa.yml',import.meta.url),'utf8');
    expect(mobile).toContain('.mobile-lending-history-head b{overflow-wrap:anywhere;font-size:13px');
    expect(mobile).toContain('.mobile-lending-history-meta>span:last-child{min-width:0;overflow-wrap:anywhere;font-size:12px');
    expect(mobile).toContain('.mobile-lending-history-head small{font-size:12px');
    expect(mobile).toContain('.mobile-lending-history-row p{margin:0;padding:7px 8px;border-radius:9px;background:var(--surface-soft);font-size:12px');
    expect(mobile).toContain('.mobile-lending-history-balance span{font-size:12px');
    expect(qa).toContain('lending-mobile-history-long-greek-320');
    expect(qa).toContain('label.fontSize>=12');
    expect(qa).toContain('stressedMobile.overflow<=1&&stressedMobile.visible');
    expect(focused).toContain('<!-- run-649-lending-qa -->');
    expect(focused).toContain("'lending-remediation'");
  });

  it('bounds the approved desktop master/detail composition on wide screens',()=>{
    expect(css).toContain('width:min(100%,1500px);margin-inline:auto');
    expect(css).toContain('grid-template-columns:minmax(300px,380px) minmax(0,1fr)');
    expect(css).toContain('width:min(100%,1120px);margin-inline:auto;min-width:760px');
  });

  it('makes sparse people states deliberate without collapsing the approved model',()=>{
    expect(page).toContain("filteredPeople.length<=2?'is-sparse':''");
    expect(css).toContain('.lending-people-panel{padding:11px 10px 10px;min-height:390px');
    expect(css).toContain('.lending-people-panel.is-sparse{background:linear-gradient');
  });

  it('masks avatar initials together with identity text when privacy is hidden',()=>{
    expect(page).toContain("privacyVisible?(personInitials(row.person)||<UserRound size={18}/>):<UserRound size={18}/>");
    expect(page).toContain("privacyVisible?(personInitials(selectedRow.person)||<UserRound size={22}/>):<UserRound size={22}/>");
    expect(page).toContain("className={!privacyVisible?'private-text':''}");
  });

  it('uses directional accent semantics for ordinary lending instead of danger/error styling',()=>{
    expect(css).toContain('.lending-quick-action.lending{background:var(--accent-soft)');
    expect(css).toContain('color:var(--accent)');
    expect(css).toContain('.lending-approved-table .receivable-action.lent{background:var(--accent-soft);color:var(--accent)}');
    expect(css).not.toContain('.lending-quick-action.lending{background:var(--error-bg)');
    expect(css).not.toContain('.receivable-action.lent{background:var(--error-bg)');
  });

  it('raises dense secondary text to the semantic shared contrast token',()=>{
    expect(css).toContain('color:var(--text-secondary)');
    expect(css).not.toContain('color:var(--muted)');
  });
});
