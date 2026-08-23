import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const stack=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');
const hostCss=readFileSync(new URL('../src/styles/canonical-credit-card-host.css',import.meta.url),'utf8');

describe('canonical credit-card stack adoption',()=>{
  it('uses the canonical stack as the active credit-card selector',()=>{
    expect(credit).toContain("const activeCredit=useMemo(()=>allCredit.filter(card=>card.active!==false)");
    expect(credit).toContain("const archivedCredit=useMemo(()=>allCredit.filter(card=>card.active===false)");
    expect(credit).toContain('<CanonicalCreditCardStack cards={activeCredit}');
    expect(credit).toContain('onActiveCardChange={setSelectedCardId}');
    expect(credit).not.toContain('<InteractivePaymentCard');
    expect(credit).not.toContain('credit-card-selector');
  });

  it('keeps archived cards out of the primary deck and in a secondary manager',()=>{
    expect(credit).toContain('Αρχείο πιστωτικών καρτών');
    expect(credit).toContain('card-archive-manager');
    expect(credit).toContain('restoreCard(target)');
    expect(credit).toContain('Ολική διαγραφή');
    expect(credit).toContain('disabled aria-disabled="true"');
  });

  it('keeps the supplied stack interaction model and stable-ID ordering',()=>{
    expect(stack).toContain("orderRef=useRef<string[]>(cards.map(card=>card.id))");
    expect(stack).toContain("event.key==='ArrowUp'");
    expect(stack).toContain("event.key==='ArrowDown'");
    expect(stack).toContain("event.key==='End'");
    expect(stack).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(stack).toContain('revealCardSecret(card.id)');
    expect(stack).toContain('readLocalCvv(card.id)');
  });

  it('uses local canonical logo assets and responsive host containment',()=>{
    expect(stack).toContain("../assets/canonical-credit-card/viva-logo.png");
    expect(stack).toContain("../assets/canonical-credit-card/payzy-logo.png");
    expect(stack).toContain("../assets/canonical-credit-card/payzy-pro-logo.png");
    expect(hostCss).toContain('@media(max-width:680px)');
    expect(hostCss).toContain('.card-archive-row');
  });
});
