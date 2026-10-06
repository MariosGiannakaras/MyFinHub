import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/pages/CardsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/cards-approved-surrounding.css',import.meta.url),'utf8');
const legacyCardCss=readFileSync(new URL('../src/styles/cards-prototype-presentation.css',import.meta.url),'utf8');
const interactiveCardCss=readFileSync(new URL('../src/components/InteractivePaymentCard.css',import.meta.url),'utf8');
const cardLayoutCss=readFileSync(new URL('../src/styles/cards-v15-presentation.css',import.meta.url),'utf8');

describe('approved Cards surrounding desktop target source contract',()=>{
  it('keeps the existing bank-by-bank card workspace and card handlers intact',()=>{
    expect(source.match(/className="cards-workspace cards-prototype-workspace surface-raised"/g)).toHaveLength(1);
    expect(source.match(/className="cards-grid cards-prototype-grid"/g)).toHaveLength(1);
    expect(source).toContain('<InteractivePaymentCard');
    expect(source).toContain('onEditCard={editCardProfile} onEditDetails={editCardDetails} onArchive={archive}');
    expect(source).toContain('initialCard={profileCard}');
    expect(source).toContain('<CardDetailsDialog');
    expect(source).toContain('onClick={()=>restore(card)}');
    expect(source).toContain('onClick={()=>setDeleteTarget(card)}');
    expect(source).toContain("allowedKinds={['debit','prepaid']}");
  });

  it('adds only truthful surrounding summaries and canonical account activity',()=>{
    expect(source).toContain('className="cards-surrounding-summary"');
    expect(source).toContain('className="cards-surrounding-recent surface-raised"');
    expect(source).toContain('effectiveLegacyTransactions(data)');
    expect(source).toContain('flowImpactLegacy(data,transaction)');
    expect(source).toContain('flowImpactEvent(event)');
    expect(source).toContain('οι αποθηκευμένες κάρτες δεν δημιουργούν ξεχωριστό ιστορικό συναλλαγών');
    expect(source).not.toContain('Σύνολο ορίου');
    expect(source).not.toContain('Συνολικές χρεώσεις');
    expect(source).not.toContain('Διαθέσιμο υπόλοιπο');
    expect(source).not.toContain('Πληρωμές κάρτας');
  });

  it('keeps active card themes while retiring duplicate legacy card geometry',()=>{
    expect(legacyCardCss).toContain('.r-card-piraeus-yellow{');
    expect(legacyCardCss).toContain('.r-card-revolut-gradient{');
    expect(legacyCardCss).not.toContain('.r-card-inner{');
    expect(legacyCardCss).not.toContain('.r-card-number-line{');
    expect(legacyCardCss).not.toContain('.card-create-backdrop{');
    expect(legacyCardCss).not.toContain('.card-design-grid{');
    expect(interactiveCardCss).toContain('.prototype-payment-card .card-inner{');
    expect(interactiveCardCss).toContain('.prototype-payment-card .card-number{');
  });

  it('uses an explicit discoverable desktop overflow contract and theme-owned foreground variables',()=>{
    expect(cardLayoutCss).toContain('overflow-x:auto');
    expect(cardLayoutCss).toContain('scroll-snap-type:x proximity');
    expect(cardLayoutCss).not.toContain('.cards-workspace{border-radius:23px;padding:18px;min-width:0;overflow:hidden}');
    expect(cardLayoutCss).toContain(':where(.payment-card){--card-text:#fff');
    expect(legacyCardCss).toContain('.r-card-alpha{--card-text:#153a5f');
    expect(legacyCardCss).toContain('.r-card-alpha-sky{--card-text:#153a5f');
    expect(legacyCardCss).toContain('.r-card-payzy-pro{--card-text:#123a45');
  });

  it('does not restyle protected card workspace/card visual selectors',()=>{
    expect(source).toContain("import '../styles/cards-approved-surrounding.css';");
    expect(css).toContain('@media (min-width:1100px)');
    expect(css).toContain('.cards-surrounding-summary');
    expect(css).toContain('.cards-surrounding-recent{display:block');
    expect(css).not.toContain('.cards-workspace');
    expect(css).not.toContain('.cards-grid');
    expect(css).not.toContain('.bank-column');
    expect(css).not.toContain('.bank-stack');
    expect(css).not.toContain('.payment-card');
    expect(css).not.toContain('.interactive-payment-card');
  });
});
