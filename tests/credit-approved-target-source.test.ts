import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/credit-approved-target.css',import.meta.url),'utf8');
const stack=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');
const approvedChain=readFileSync(new URL('../src/styles/part47.css',import.meta.url),'utf8');

describe('approved Credit Card desktop target boundary',()=>{
  it('keeps canonical credit finance selectors and handlers',()=>{
    expect(page).toContain('creditDebtForCard(data,card.id,asOf)');
    expect(page).toContain('creditLimitForCard(data,card)');
    expect(page).toContain('creditEventsForCard(data,card.id)');
    expect(page).toContain('creditStatementViews(data,card.id,asOf)');
    expect(page).toContain('recommendedPayableStatement(data,card.id,asOf)');
    expect(page).toContain('onPayCard(card.id,payableStatement?.id)');
    expect(page).toContain('onArchiveCard(target)');
  });

  it('keeps the canonical card stack as the one card surface',()=>{
    expect(page).toContain('<CanonicalCreditCardStack');
    expect(stack).toContain('revealCardSecret(card.id)');
    expect(stack).toContain('readLocalCvv(card.id)');
    expect(stack).toContain('archiveRef.current(card.source)');
  });

  it('uses the canonical drag/restack interaction instead of rendering competing host navigation',()=>{
    expect(stack).toContain("top.addEventListener('pointerdown',startDrag)");
    expect(stack).toContain('animateRestack');
    expect(stack).toContain('activeChangeRef.current?.(active)');
    expect(page).toContain('onActiveCardChange={setSelectedCardId}');
    expect(styles).toContain('.credit-card-view-controls{display:none}');
  });

  it('keeps the original full card stack on mobile',()=>{
    expect(page).toContain('<CanonicalCreditCardStack cards={activeCredit}');
    expect(page).not.toMatch(/CanonicalCreditCardStack cards=\{cardDeckMode/);
    expect(styles).toContain('@media (max-width:1099px)');
    expect(styles).toContain('.credit-card-view-controls{display:none}');
  });

  it('places real card activity before statement detail without faking a shared sort',()=>{
    expect(styles).toContain(':has(.credit-purchases-table){order:3}');
    expect(styles).toContain(':has(.credit-payments-table){order:4}');
    expect(styles).toContain('.credit-card-redesign-page>[data-credit-statements]{order:5}');
    expect(styles).not.toContain('content:"Κινήσεις πιστωτικής"');
    expect(styles).not.toContain(':has(.credit-payments-table)>.panel-head{display:none');
  });

  it('limits approved target CSS to surrounding composition and protects mobile touch targets',()=>{
    expect(styles).toContain('@media (min-width:1100px)');
    expect(styles).toContain('.credit-card-redesign-page>.credit-card-stage');
    expect(styles).toContain('.credit-card-view-controls{display:none}');
    expect(styles).toContain('@media (max-width:1099px)');
    expect(styles).toContain('.credit-cycle-link{min-height:44px');
    expect(styles).not.toMatch(/\.payment-card\b/);
    expect(styles).not.toMatch(/\.card-inner\b/);
    expect(styles).not.toMatch(/\.card-number\b/);
    expect(styles).not.toMatch(/\.card-fields\b/);
    expect(styles).not.toMatch(/\.card-toolbar\b/);
    expect(approvedChain).toContain("@import './credit-approved-target.css';");
  });
});
