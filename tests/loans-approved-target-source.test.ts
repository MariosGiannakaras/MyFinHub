import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/pages/LoansPage.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/loans-approved-target.css',import.meta.url),'utf8');
const baseStyles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const approvedChain=readFileSync(new URL('../src/styles/part47.css',import.meta.url),'utf8');

describe('approved Loans desktop target source contract',()=>{
  it('keeps canonical loan calculations and existing handlers intact',()=>{
    expect(source).toContain('loanOutstanding(data,loan)');
    expect(source).toContain('loanPaidCount(data,loan)');
    expect(source).toContain('loanRemainingInstallments(data,loan)');
    expect(source).toContain('typicalLoanPaymentDay(data,loan)');
    expect(source).toContain('loanPaymentEvents(data,loan)');
    expect(source).toContain('onPayLoan(loan.id)');
    expect(source).toContain('onUpsertLoan(normalized)');
    expect(source).toContain('onCreateSelfLoan(normalized,event)');
    expect(source).toContain('forgivenAmount:Number(current.forgivenAmount||0)+remaining');
  });

  it('preserves semantic segmented progress and makes color supplemental',()=>{
    expect(source).toContain('className="installment-segments"');
    expect(source).toContain('role="progressbar"');
    expect(source).toContain('aria-valuemin={0}');
    expect(source).toContain('aria-valuemax={loan.installments}');
    expect(source).toContain('aria-valuenow={paid}');
    expect(styles).toContain('linear-gradient(90deg,#1287ff 0%,#20a4f3 24%,#6657e8 56%,#8b5cf6 72%,#22c55e 100%)');
    expect(styles).toContain('flex:1 1 0!important');
    expect(styles).toContain('width:auto!important');
    expect(styles).toContain('max-width:none!important');
    expect(styles).toContain('.loan-list-row .installment-segments i.paid{background:transparent!important}');
    expect(styles).toContain('background:color-mix(in srgb,var(--line) 76%,var(--surface))!important');
  });

  it('keeps the approved progress explanation visible and semantic',()=>{
    expect(source).toContain('className="logic-note loan-progress-note"');
    expect(source).toContain('Σημείωση για την πρόοδο δόσεων');
    expect(source).toContain('Η πρόοδος δείχνει μόνο πραγματικές πληρωμές που έχεις καταχωρίσει.');
    expect(source).toContain('Το προκαθορισμένο ποσό είναι αφετηρία και μπορεί να αλλάξει κατά την πληρωμή.');
    expect(styles).toContain('.loan-progress-note{min-height:72px');
  });

  it('extends the established approved-style chain without mutating the base chain',()=>{
    expect(styles).toContain('@media (min-width:1100px)');
    expect(baseStyles.trimEnd()).toMatch(/part46\.css';$/);
    expect(approvedChain).toContain("@import './loans-approved-target.css';");
    expect(styles).not.toContain('@media (max-width');
  });
});
