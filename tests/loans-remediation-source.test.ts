import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/LoansPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/loans-approved-target.css',import.meta.url),'utf8');

describe('Loans post-v1.4 remediation contracts',()=>{
  it('uses proportional capped progress rather than comparing visual index directly with paid installments',()=>{
    expect(page).toContain('loanVisualInstallmentProgress(loan.installments,paid)');
    expect(page).toContain('data-visual-segments={visualProgress.segments}');
    expect(page).toContain('data-visual-paid={visualProgress.paidSegments}');
    expect(page).not.toContain("Array.from({length:Math.min(loan.installments,60)}");
    expect(page).not.toContain("className={index<paid?'paid':''}");
  });

  it('bounds the internal desktop reading measure without recompressing loan cards',()=>{
    expect(css.match(/width:min\(100%,1320px\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(css).toContain('min-height:208px');
    expect(css).toContain('grid-template-areas:');
    expect(css).toContain('"meta actions"');
  });

  it('raises secondary contrast while keeping zero completed history subordinate',()=>{
    expect(css).toContain('color:var(--text-secondary)');
    expect(css).toContain('.loan-history.is-empty{min-height:52px');
    expect(css).toContain('.loan-history.is-empty>summary b{display:none}');
    expect(page).toContain("loan-history ${completedLoans.length?'':'is-empty'}");
  });

  it('keeps the progress warning explicit without duplicating the full header explanation',()=>{
    expect(page).toContain('Η πρόοδος βασίζεται μόνο σε καταχωρισμένες πληρωμές.');
    expect(page).toContain('Δεν δημιουργούνται αυτόματες πληρωμές ή έξοδα.');
    expect(css).toContain('.loan-progress-note{min-height:48px');
    expect(css).toContain('background:transparent;box-shadow:none');
  });
});
