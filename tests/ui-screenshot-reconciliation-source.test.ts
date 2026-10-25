import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('owner screenshot reconciliation #630 shared UX source locks',()=>{
  it('uses genuine provider wordmarks and unframed network marks in both card renderers',()=>{
    const debit=read('src/components/InteractivePaymentCard.tsx');
    const credit=read('src/components/CanonicalCreditCardStack.tsx');
    const network=read('src/components/CardNetworkMark.css');
    const creditNetwork=read('src/styles/canonical-credit-card-stack-4.css');
    expect(debit).toContain('role="wordmark" surfaceTone={cardBrandSurfaceTone(card)}');
    expect(credit).toContain("providerBrandUrl(provider,'wordmark',cardBrandSurfaceTone(card.source))");
    for(const css of [network,creditNetwork]){
      expect(css).toContain('background:transparent;');
      expect(css).toContain('box-shadow:none;');
    }
  });
  it('keeps debit card geometry stable on reveal and credit long PAN wrapping',()=>{
    const debit=read('src/components/InteractivePaymentCard.css');
    const credit=read('src/styles/canonical-credit-card-stack-1.css');
    expect(debit).toContain('.prototype-payment-card:has(.card-number.revealed){aspect-ratio:1.586/1;min-height:207px}');
    expect(credit).toContain('.payment-card[data-revealed="true"] .card-number');
    expect(credit).toContain('overflow-wrap:anywhere;');
  });
  it('keeps debit/credit actions quiet without dropping real network artwork or mobile hit areas',()=>{
    const debit=read('src/components/InteractivePaymentCard.css');
    const credit=read('src/styles/canonical-credit-card-stack-1.css');
    expect(debit).not.toContain('.prototype-payment-card .mastercard-symbol');
    expect(debit).not.toContain('.prototype-payment-card.is-large .card-icon-btn{width:37px');
    expect(debit).toContain('.prototype-payment-card .card-icon-btn{width:40px;height:40px;min-width:40px');
    expect(debit).toContain('margin:-9.5px 0 -9.5px -9.5px;padding:0');
    expect(debit).toContain('position:relative;width:40px;height:40px;min-width:40px;min-height:40px');
    expect(credit).toContain('background:transparent;');
  });
  it('preserves 32 digit PAN boundaries and clips no secure form fields',()=>{
    const details=read('src/lib/cardDetails.ts');
    const editor=read('src/styles/card-details-dialog.css');
    expect(details).toContain(".replace(/\\D/g,'').slice(0,32)");
    expect(editor).toContain('.app-card-details-dialog-body .app-control{min-width:0;width:100%;max-width:100%');
  });
  it('compacts taxonomy row composition without removing actions or reducing hit targets',()=>{
    const css=read('src/styles/category-taxonomy-editor.css');
    const page=read('src/components/CategoryIconsWorkspace.tsx');
    expect(css).toContain('.category-taxonomy-card{display:grid;gap:9px;padding:11px;');
    expect(css).toContain('.taxonomy-subcategory-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;padding:7px;');
    expect(css).toContain('.taxonomy-row-actions button{width:40px;height:40px;');
    expect(page).toContain("type:'reorder-subcategory'");
  });
  it('keeps real hover tilt unobstructed and aligns the Dashboard privacy action',()=>{
    const motion=read('src/styles/interaction-motion-states.css');
    const dashboard=read('src/styles/dashboard-desktop-alignment.css');
    expect(motion).toContain('.payment-card:hover{box-shadow:');
    expect(motion).not.toContain('.payment-card:hover{transform:');
    expect(dashboard).toContain('.dashboard-approved-heading .privacy-toggle{min-width:136px;transform:none}');
  });
  it('keeps wider Settings tab-panel geometry and compact category rows',()=>{
    const settings=read('src/pages/SettingsPage.css');
    expect(settings).toContain('.settings-tab-panel{min-width:0;width:min(100%,1800px)');
    expect(settings).toContain('.settings-categories-only .category-taxonomy-card{gap:7px;padding:9px;');
    expect(settings).toContain('@media(min-width:1850px)');
  });
  it('gives transaction detail-row controls real expanded state, keeping finance edit/delete actions',()=>{
    const page=read('src/pages/TransactionsPage.tsx');
    const css=read('src/styles/transactions-approved.css');
    expect(page).toContain('className="row-context-button"');
    expect(page).toContain('aria-expanded={isSelected}');
    expect(page).toContain('if(isSelected){setDetailOpen(false);return}');
    expect(page).toContain('const rowActions=');
    expect(css).toContain('width:100%;margin-inline:0');
  });
});
