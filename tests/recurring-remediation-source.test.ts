import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/RecurringPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/recurring-approved-target.css',import.meta.url),'utf8');

describe('Recurring post-v1.4 remediation contracts',()=>{
  it('bounds the approved desktop summary and obligations workspace',()=>{
    expect(css.match(/width:min\(100%,1500px\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(css).toContain('margin:-3px auto 0');
    expect(css).toContain('margin:0 auto -14px');
  });

  it('gives AnimatedAmount the same summary-value hierarchy as the date metric',()=>{
    expect(css).toContain('.recurring-summary-card>div>b .animated-amount{font:inherit;letter-spacing:inherit}');
    expect(css).toContain('font-size:27px');
  });

  it('keeps Payment primary while management/navigation controls stay secondary',()=>{
    expect(page).toContain('className="pay-action"');
    expect(page).toContain('variant="primary"');
    expect(page.match(/<IconButton type="button" aria-label=/g)?.length).toBeGreaterThanOrEqual(5);
    expect(css).toContain('.recurring-workspace-table .recurring-actions button:not(.save-button){--control-gradient:transparent;--control-border:transparent;--ink:var(--text-secondary);--shadow-soft:none;');
    expect(css).toContain('.recurring-actions .pay-action{min-width:84px;min-height:38px');
    expect(css).not.toContain('.recurring-actions .pay-action{--control-gradient:');
    expect(css).toContain('.linked-loan-open{color:var(--text-secondary)}');
  });

  it('removes repeated cadence from the next-payment helper while preserving schedule facts',()=>{
    expect(page).toContain("filter(Boolean).join(' · ')||'Χωρίς πρόσθετα στοιχεία'");
    const desktopNext=page.slice(page.indexOf('recurringGroups.map'),page.indexOf('desktop-recurring-more'));
    expect(desktopNext.match(/recurringCadenceLabel\(item\)/g)?.length).toBe(1);
    expect(desktopNext).toContain('Συνήθης ημέρα');
    expect(desktopNext).toContain('Τελευταία');
    expect(desktopNext).toContain('Λήξη/ανανέωση');
  });

  it('makes zero inactive history visually subordinate and improves secondary contrast',()=>{
    expect(page).toContain("inactive-recurring ${inactive.length?'':'is-empty'}");
    expect(css).toContain('.inactive-recurring.is-empty{min-height:50px');
    expect(css).toContain('.inactive-recurring.is-empty>summary{min-height:48px;margin-bottom:0}');
    expect(css).toContain('.inactive-recurring.is-empty>summary small{display:none}');
    expect(css).toContain('color:var(--text-secondary)');
  });
  it('keeps management chrome off the shared primary payment button',()=>{
    expect(css).toContain('.recurring-actions button:not(.save-button)');
    expect(css).toContain('.recurring-actions .pay-action{min-width:84px;min-height:38px');
    expect(css).not.toContain('.recurring-actions .pay-action{--control-gradient:');
  });
});
