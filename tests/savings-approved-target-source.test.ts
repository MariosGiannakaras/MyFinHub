import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/pages/SavingsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/part56.css',import.meta.url),'utf8');
const chain=readFileSync(new URL('../src/styles/part47.css',import.meta.url),'utf8');

describe('approved Savings desktop target source contract',()=>{
  it('keeps the three real savings actions and canonical accounting handlers',()=>{
    expect(source).toContain("source:'pay_and_save'");
    expect(source).toContain("source:'manual_transfer'");
    expect(source).toContain("source:'cash_offset'");
    expect(source).toContain("onQuickAdd({mode:'savings'");
    expect(source).toContain("createEvent({kind:'saving_cash_offset'");
    expect(source).toContain('event.savingSource=source');
    expect(source.match(/\{actionGrid\}/g)).toHaveLength(1);
  });

  it('derives the desktop trend and supported target from canonical monthly savings data',()=>{
    expect(source).toContain('const flow=operationalMonthlyFlow(data,month)');
    expect(source).toContain('const breakdown=savingsBreakdown(data,month)');
    expect(source).toContain('const targetTotal=target>0&&flow.income>0?flow.income*target:0');
    expect(source).toContain('breakdown.rows.reduce');
    expect(source).toContain('className="savings-trend-chart"');
    expect(source).toContain('className="panel neo-raised savings-goals"');
    expect(source).not.toContain('savingsGoals:');
    expect(source).not.toContain('targetAmount:');
  });

  it('keeps the approved desktop composition isolated from the existing responsive layout',()=>{
    expect(source).toContain('className="savings-desktop-target"');
    expect(source).toContain('className="savings-mobile-legacy"');
    expect(source).toContain('className="savings-action-section"');
    expect(css).toContain('.savings-desktop-target{display:none}');
    expect(css).toContain('@media (min-width:1100px)');
    expect(css).toContain('.savings-mobile-legacy{display:none}');
    expect(css).toContain('grid-template-columns:minmax(270px,.88fr) minmax(400px,1.28fr) minmax(290px,.94fr)');
    expect(chain).toContain("@import './part56.css';");
  });
});
