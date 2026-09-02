import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/AttentionPage.tsx',import.meta.url),'utf8');
const engine=readFileSync(new URL('../src/lib/attention.ts',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/attention-approved-target.css',import.meta.url),'utf8');
const refinement=readFileSync(new URL('../src/styles/attention-approved-refinement.css',import.meta.url),'utf8');
const chain=readFileSync(new URL('../src/styles/part47.css',import.meta.url),'utf8');
const state=readFileSync(new URL('../docs/ui-redesign/references/approved/attention/STATE.md',import.meta.url),'utf8');

describe('approved Needs Attention desktop target boundary',()=>{
  it('keeps the canonical deterministic attention engine and decision paths authoritative',()=>{
    expect(page).toContain('visibleAttentionItems(data,asOf)');
    expect(page).toContain('attentionSnoozeDecision(item,asOf)');
    expect(page).toContain('attentionDismissDecision(item)');
    expect(engine).toContain('export function allAttentionItems');
    expect(engine).toContain('export function visibleAttentionItems');
    expect(page).toContain('onAction(item)');
    expect(page).toContain('data-attention-id={item.id}');
  });

  it('uses canonical items to build the four approved desktop presentation groups',()=>{
    expect(page).toContain('const danger=items.filter');
    expect(page).toContain('const warning=items.filter');
    expect(page).toContain("const notices=info.filter(item=>item.kind==='forecast'||item.kind==='budget')");
    expect(page).toContain("const pending=info.filter(item=>item.kind!=='forecast'&&item.kind!=='budget')");
    expect(page).toContain('title="Επείγοντα"');
    expect(page).toContain('title="Σύντομα"');
    expect(page).toContain('title="Εκκρεμότητες"');
    expect(page).toContain('title="Ενημερώσεις"');
    expect(page).not.toMatch(/48,20|62,00|320,00|620,00|Eurolife|Cosmote/);
  });

  it('preserves truthful actions, privacy, snooze/dismiss and existing route shortcuts',()=>{
    expect(page).toContain('className="attention-actions attention-approved-actions"');
    expect(page).toContain('className="save-button compact"');
    expect(page).toContain('<AnimatedAmount value={item.amount} hidden={!visible}/>');
    expect(page).toContain('aria-pressed={visible}');
    expect(page).toContain("decide(item,'snooze')");
    expect(page).toContain("decide(item,'dismiss')");
    for(const route of ['#/recurring','#/planning','#/loans','#/transactions'])expect(page).toContain(`href="${route}"`);
  });

  it('keeps the approved redesign desktop-only and retains the established mobile surface',()=>{
    expect(page).toContain('className="attention-approved-desktop"');
    expect(page).toContain('className="attention-canonical-mobile"');
    expect(page).toContain('className="attention-summary-grid"');
    expect(page).toContain('className="panel neo-raised attention-list-panel"');
    expect(styles).toContain('@media (min-width:900px)');
    expect(styles).toContain('@media (max-width:899px)');
    expect(refinement).toContain('min-height:40px');
    expect(chain).toContain("@import './attention-approved-target.css';");
    expect(chain).toContain("@import './attention-approved-refinement.css';");
  });

  it('pins the exact approved target identity in durable state',()=>{
    expect(state).toContain('4ae37a0d3b795e97f3cf9f9eae2be3cbe137f666c002e457e18001856a4daa2e');
    expect(state).toContain('Issue: #337');
  });
});
