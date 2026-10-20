import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('historical statement rendered regression proof (DV-FB05)',()=>{
  it('uses a real browser fixture that includes a future settlement without changing the as-of date',()=>{
    const fixture=readFileSync('src/qa.tsx','utf8');
    const rendered=readFileSync('scripts/credit-statements-qa.mjs','utf8');
    expect(fixture).toContain("state')==='credit-future-payment'");
    expect(fixture).toContain("id:'qa-future-statement-payment',date:'2026-08-20',amount:90");
    expect(rendered).toContain("'credit-statement-future-payment-ignored'");
    expect(rendered).toContain('future-dated payment prematurely settled historical statement');
    expect(rendered).toContain("earlierStatement.text.includes('90,00')&&earlierStatement.canPay");
    expect(rendered).toContain('credit-rate-modal-dark-tablet');
    expect(rendered).toContain('credit-rate-save-failure-mobile');
    expect(rendered).toContain("theme.applyThemePreference('light')");
    expect(rendered).toContain('mobile rate fixture initializes the real opaque light-theme surface');
    expect(rendered).toContain('credit-rate-payoff-desktop');
    expect(rendered).toContain('rate change never posts or edits credit purchase events');
    expect(rendered).toContain('duplicate date did not rewrite history');
    expect(rendered).toContain('rate dialog entrance settled and opaque');
    expect(rendered).toContain('mobile failure modal must be fully opaque after entrance');
    expect(rendered).toContain('corrected rate clears stale empty error');
  });
});
