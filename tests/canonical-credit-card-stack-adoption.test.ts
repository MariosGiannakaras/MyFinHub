import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const cards=readFileSync(new URL('../src/pages/CardsPage.tsx',import.meta.url),'utf8');
const createDialog=readFileSync(new URL('../src/components/CardCreateDialog.tsx',import.meta.url),'utf8');
const stack=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');
const hostCss=readFileSync(new URL('../src/styles/canonical-credit-card-host.css',import.meta.url),'utf8');
const cardDomain=readFileSync(new URL('../src/lib/cards.ts',import.meta.url),'utf8');

describe('canonical credit-card stack adoption',()=>{
  it('uses the canonical stack as the active credit-card selector',()=>{
    expect(credit).toContain("const activeCredit=useMemo(()=>allCredit.filter(card=>card.active!==false)");
    expect(credit).toContain("const archivedCredit=useMemo(()=>allCredit.filter(card=>card.active===false)");
    expect(credit).toContain('<CanonicalCreditCardStack cards={activeCredit}');
    expect(credit).toContain('onActiveCardChange={setSelectedCardId}');
    expect(credit).not.toContain('<InteractivePaymentCard');
    expect(credit).not.toContain('credit-card-selector');
  });

  it('keeps archived credit cards in secondary management with approved A deletion semantics',()=>{
    expect(credit).toContain('Αρχείο πιστωτικών καρτών');
    expect(credit).toContain('card-archive-manager');
    expect(credit).toContain('restoreCard(target)');
    expect(credit).toContain('Ολική διαγραφή');
    expect(credit).toContain('const canDelete=canPermanentlyDeleteCreditCard(data,archived.id,asOf)');
    expect(credit).toContain('disabled={!canDelete}');
    expect(credit).toContain('κανόνα A');
    expect(credit).toContain('Διαγραμμένη κάρτα');
    expect(cardDomain).toContain('export function canPermanentlyDeleteCreditCard');
    expect(cardDomain).toContain("if(card.active!==false)return false");
    expect(cardDomain).toContain('return creditDebtForCard(data,cardId,asOf)<=.005');
  });

  it('keeps debit/prepaid cards out of the credit finance domain',()=>{
    expect(cards).toContain("allowedKinds={['debit','prepaid']}");
    expect(cards).toContain('Οι συναλλαγές καταχωρούνται στους αντίστοιχους λογαριασμούς, όχι στις κάρτες.');
    expect(cards).toContain('Οριστική διαγραφή');
    expect(cards).not.toContain('Νέα αγορά');
    expect(cards).not.toContain('Αποπληρωμή');
    expect(createDialog).toContain('allowedKinds?:CardKind[]');
  });

  it('keeps the supplied stack interaction model and stable-ID ordering',()=>{
    expect(stack).toContain("orderRef=useRef<string[]>(cards.map(card=>card.id))");
    expect(stack).toContain("event.key==='ArrowUp'");
    expect(stack).toContain("event.key==='ArrowDown'");
    expect(stack).toContain("case 'End':next=1");
    expect(stack).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(stack).toContain('revealCardSecret(card.id)');
    expect(stack).toContain('readLocalCvv(card.id)');
  });

  it('maps the canonical remove gesture to reversible archive semantics',()=>{
    expect(stack).toContain('aria-label="Αρχειοθέτηση κάρτας"');
    expect(stack).toContain('ΣΥΡΕ ΓΙΑ ΑΡΧΕΙΟΘΕΤΗΣΗ');
    expect(stack).toContain('await archiveRef.current(card.source)');
    expect(stack).toContain("announce('Η κάρτα αρχειοθετήθηκε')");
    expect(stack).not.toContain('Η ενέργεια δεν αναιρείται');
    expect(stack).not.toContain('Σύρε για οριστική διαγραφή');
  });

  it('uses local canonical logo assets and responsive host containment',()=>{
    expect(stack).toContain("../assets/canonical-credit-card/viva-logo.png");
    expect(stack).toContain("../assets/canonical-credit-card/payzy-logo.png");
    expect(stack).toContain("../assets/canonical-credit-card/payzy-pro-logo.png");
    expect(hostCss).toContain('@media(max-width:680px)');
    expect(hostCss).toContain('.card-archive-row');
  });
});
