import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const cards=readFileSync(new URL('../src/pages/CardsPage.tsx',import.meta.url),'utf8');
const createDialog=readFileSync(new URL('../src/components/CardCreateDialog.tsx',import.meta.url),'utf8');
const stack=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');
const bankBrands=readFileSync(new URL('../src/lib/bankBrands.ts',import.meta.url),'utf8');
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
    expect(cardDomain).toContain("card?.kind==='credit'");
    expect(cardDomain).toContain('card.active===false');
    expect(cardDomain).toContain('creditDebtForCard(data,cardId,asOf)<=0.005');
  });

  it('keeps credit profile edits separate from encrypted card details',()=>{
    expect(credit).toContain('openCardProfile');
    expect(credit).toContain('openCardDetails');
    expect(credit).toContain('saveCreditCardProfile');
    expect(credit).toContain('initialCard={profileCard} kindLock="credit"');
    expect(credit).toContain('<CardDetailsDialog open={Boolean(detailsCard)}');
    expect(credit).toContain('onEditCard={openCardProfile}');
    expect(credit).toContain('onEditDetails={openCardDetails}');
    expect(stack).toContain('Επεξεργασία κάρτας');
    expect(stack).toContain('Ασφαλή στοιχεία');
  });

  it('bounds growing credit ledgers while preserving explicit progressive access',()=>{
    expect(credit).toContain('const [purchaseLimit,setPurchaseLimit]=useState(25)');
    expect(credit).toContain('const [paymentLimit,setPaymentLimit]=useState(25)');
    expect(credit).toContain('purchases.slice(0,purchaseLimit)');
    expect(credit).toContain('payments.slice(0,paymentLimit)');
    expect(credit).toContain('{visiblePurchases.map(event=>');
    expect(credit).toContain('{visiblePayments.map(event=>');
    expect(credit).toContain('Προβολή περισσότερων αγορών');
    expect(credit).toContain('Προβολή περισσότερων αποπληρωμών');
    expect(hostCss).toContain('.credit-history-more');
  });

  it('keeps debit/prepaid cards out of the credit finance domain',()=>{
    expect(cards).toContain("allowedKinds={['debit','prepaid']}");
    expect(cards).toContain('Οι συναλλαγές καταχωρούνται στους αντίστοιχους λογαριασμούς, όχι στις κάρτες.');
    expect(cards).toContain('Οριστική διαγραφή');
    expect(cards).not.toContain('Νέα αγορά');
    expect(cards).not.toContain('Αποπληρωμή');
    expect(createDialog).toContain('allowedKinds?:CardKind[]');
  });

  it('keeps one canonical card-switching model and restores populated add-card reachability',()=>{
    expect(credit).toContain('Προσθήκη πιστωτικής');
    expect(credit).toContain('onClick={()=>setCreateOpen(true)}');
    expect(credit).not.toContain("type CardDeckMode='horizontal'|'stack'");
    expect(credit).not.toContain('credit-card-view-controls');
    expect(credit).not.toContain('credit-card-horizontal-nav');
    expect(credit).not.toContain('selectRelativeCard');
  });

  it('keeps profile and secure-detail editing on the active canonical card only',()=>{
    expect(credit).toContain('onEditCard={openCardProfile}');
    expect(credit).toContain('onEditDetails={openCardDetails}');
    expect(stack).toContain('const management=stackIndex===0?');
    expect(stack).toContain('edit-profile-btn');
    expect(stack).toContain('edit-details-btn');
    expect(stack).toContain('editCardRef.current?.(card.source)');
    expect(stack).toContain('editDetailsRef.current?.(card.source)');
  });

  it('disables deck choreography and pagination semantics for a single active card',()=>{
    expect(stack).toContain('if(orderRef.current.length<2||deleteMode||swiping');
    expect(stack).toContain("stage.classList.toggle('single-card',orderedCards.length===1)");
    expect(stack).toContain("dots.innerHTML=cardsRef.current.length>1?");
    expect(stack).toContain("const multiCard=cards.length>1");
    expect(stack).toContain("multiCard?'multi-card-mode':'single-card-mode'");
    expect(stack).toContain('tabIndex={multiCard?0:-1}');
  });

  it('keeps the supplied stack interaction model and stable-ID ordering',()=>{
    expect(stack).toContain("orderRef=useRef<string[]>(cards.map(card=>card.id))");
    expect(stack).toContain("event.key==='ArrowUp'");
    expect(stack).toContain("event.key==='ArrowDown'");
    expect(stack).toContain("case 'End':next=1");
    expect(stack).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(stack).toContain('revealCardSecret(card.id)');
    expect(stack).not.toContain('readLocalCvv(card.id)');
  });

  it('maps the canonical remove gesture to reversible archive semantics',()=>{
    expect(stack).toContain('aria-label="Αρχειοθέτηση κάρτας"');
    expect(stack).toContain('ΣΥΡΕ ΓΙΑ ΑΡΧΕΙΟΘΕΤΗΣΗ');
    expect(stack).toContain('await archiveRef.current(card.source)');
    expect(stack).toContain("announce('Η κάρτα αρχειοθετήθηκε')");
    expect(stack).not.toContain('Η ενέργεια δεν αναιρείται');
    expect(stack).not.toContain('Σύρε για οριστική διαγραφή');
  });

  it('preserves the owner-approved flexible PAN policy when card secrets are revealed',()=>{
    expect(stack).toContain("function formatPan(value:string){return value.replace(/\\D/g,'').replace(/(.{4})/g,'$1 ').trim();}");
    expect(stack).not.toContain('.slice(0,16)');
  });

  it('uses local canonical assets through the shared registry and keeps a readable mobile credit-history presentation',()=>{
    expect(stack).toContain("from '../lib/bankBrands'");
    expect(stack).toContain("../assets/canonical-credit-card/payzy-pro-logo.png");
    expect(stack).not.toContain("../assets/canonical-credit-card/viva-logo.png");
    expect(stack).not.toContain("../assets/canonical-credit-card/payzy-logo.png");
    expect(bankBrands).toContain("../assets/canonical-credit-card/viva-logo.png");
    expect(bankBrands).toContain("../assets/canonical-credit-card/payzy-logo.png");
    expect(bankBrands).not.toMatch(/https?:\/\//);
    expect(hostCss).toContain('@media(max-width:680px)');
    expect(hostCss).toContain('.card-archive-row');
    expect(hostCss).toContain('.credit-card-redesign-page .semantic-table tr');
    expect(hostCss).toContain('.credit-purchases-table td:nth-child(5)::before');
    expect(hostCss).toContain('.credit-payments-table td:nth-child(4)::before');
    expect(hostCss).toContain('.deleted-credit-history .semantic-table td:nth-child(4)::before');
    const mobileRows=hostCss.slice(hostCss.indexOf('.credit-card-redesign-page .semantic-table tr{'),hostCss.indexOf('.credit-card-redesign-page .semantic-table td{'));
    expect(mobileRows).toContain('border:1px solid var(--border-subtle)');
    expect(mobileRows).toContain('background:var(--surface-2)');
    expect(mobileRows).toContain('color:var(--ink)');
    expect(mobileRows).not.toMatch(/#dce5ef|rgba\(249,252,255/);
  });
});
