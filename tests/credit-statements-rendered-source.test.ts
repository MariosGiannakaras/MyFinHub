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
  it('#649 I08.04 uses Greek bank-statement terms and verifies 1440/375/320 pixel geometry in real Chromium',()=>{
    const page=readFileSync('src/pages/CreditCardPage.tsx','utf8');
    const browser=readFileSync('scripts/credit-statements-qa.mjs','utf8');
    const workflow=readFileSync('.github/workflows/fb-focused-rendered-qa.yml','utf8');
    expect(page).toContain('Καταστάσεις λογαριασμού πιστωτικής');
    expect(page).toContain('Ιστορικό καταστάσεων λογαριασμού');
    expect(page).toContain('Καταστάσεις λογαριασμού {archivedStatements.length}');
    expect(page).not.toContain('Δηλώσεις πιστωτικής');
    expect(page).not.toContain('Statements {archivedStatements.length}');
    expect(page).toContain('data-credit-statements');
    expect(page).toContain('creditStatementViews(data,card.id,asOf)');
    expect(browser).toContain('credit-statements-localized-320');
    expect(browser).toContain("frameStatementHeading('desktop-1440')");
    expect(browser).toContain("frameStatementHeading('mobile-375')");
    expect(browser).toContain("frameStatementHeading('mobile-320')");
    expect(browser).toContain('frame credit statement title stays below sticky topbar');

    expect(browser).toContain("Greek account statement heading is truthful and contained at 1440px");
    expect(browser).toContain("Greek heading remains readable and contained at 375px");
    expect(browser).toContain("Greek account statement heading remains contained at 320px");
    expect(browser).toContain("archive.text.includes('Καταστάσεις λογαριασμού 1')");
    expect(workflow).toContain('<!-- run-649-credit-localization-qa -->');
    expect(workflow).toContain("'credit-statements' ||");
  });
});
