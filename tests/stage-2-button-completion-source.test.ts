import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const login=readFileSync(new URL('../src/components/LoginScreen.tsx',import.meta.url),'utf8');
const mfa=readFileSync(new URL('../src/components/MfaScreen.tsx',import.meta.url),'utf8');
const longTerm=readFileSync(new URL('../src/components/LongTermLoanSummary.tsx',import.meta.url),'utf8');
const part1=readFileSync(new URL('../src/styles/part1.css',import.meta.url),'utf8');
const part4=readFileSync(new URL('../src/styles/part4.css',import.meta.url),'utf8');
const theme=readFileSync(new URL('../src/lib/theme.ts',import.meta.url),'utf8');
const ledgerQa=readFileSync(new URL('../scripts/ledger-foundations-qa.mjs',import.meta.url),'utf8');
const receiptQa=readFileSync(new URL('../scripts/receipt-local-ocr-qa.mjs',import.meta.url),'utf8');
const themeQa=readFileSync(new URL('../scripts/theme-system-qa.mjs',import.meta.url),'utf8');
const finalUxQa=readFileSync(new URL('../scripts/final-ux-reconciliation-qa.mjs',import.meta.url),'utf8');
const qaHarness=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');

describe('Stage 2 Button/IconButton completion',()=>{
  it('retires the primary-action compatibility alias from production, CSS, theme and rendered-QA ownership',()=>{
    for(const source of [shell,login,mfa,part1,part4,theme,ledgerQa,receiptQa,themeQa,finalUxQa]){
      expect(source).not.toContain('primary-action');
    }
    expect(shell).toContain('<Button type="button" variant="primary" data-global-quick-entry="desktop"');
    expect(part1).toContain('.save-button{');
    expect(part1).not.toContain('.primary-action');
    expect(part4).toContain('[data-global-quick-entry="desktop"]{font-size:0;width:48px;height:48px;padding:0;margin:auto}');
    expect(theme).toContain('.sidebar nav button.active,.mobile-nav button.active,.save-button{');
  });

  it('keeps rendered QA bound to the semantic desktop Quick Entry hook',()=>{
    expect(ledgerQa.match(/\[data-global-quick-entry=\\?"desktop\\?"\]/g)?.length).toBeGreaterThanOrEqual(2);
    expect(receiptQa).toContain('data-global-quick-entry=\\"desktop\\"');
    expect(themeQa).toContain('data-global-quick-entry=\\"desktop\\"');
    expect(finalUxQa).toContain('data-global-quick-entry=\\"desktop\\"');
  });

  it('uses the shared primary Button for the private-route 404 recovery action',()=>{
    expect(app).toContain("from './components/Button'");
    expect(app).toContain('<Button type="button" variant="primary" onClick={onHome}>Επιστροφή στο Dashboard</Button>');
    expect(app).not.toContain('<button type="button" className="save-button" onClick={onHome}>');
  });

  it('uses shared ghost Buttons for loan navigation while preserving the domain payment control raw',()=>{
    expect(longTerm).toContain("from './Button'");
    expect(longTerm.match(/<Button type="button" variant="ghost"/g)).toHaveLength(2);
    expect(longTerm).toContain('className="linked-loan-open" onClick={onOpenLoans}>Προβολή</Button>');
    expect(longTerm).toContain('className="long-term-loans-open" data-open-loans="true" onClick={onOpenLoans}>');
    expect(longTerm).toContain('<button type="button" className="pay-action save-button linked-loan-pay"');
  });

  it('keeps QA-only crash controls explicitly outside production adoption',()=>{
    expect(qaHarness).toContain('data-qa-crash');
    expect(qaHarness).toContain('className="text-button"');
    expect(qaHarness).toContain('className="text-button qa-crash-floating"');
  });
});
