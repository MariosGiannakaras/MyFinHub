import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/CardsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/cards-v15-presentation.css',import.meta.url),'utf8');

describe('Cards workspace domain and navigation contracts',()=>{
  it('separates provider choices from visible card-bank columns and makes Add card the primary CTA',()=>{
    expect(page).toContain('const workspaceBanks=useMemo(()=>cardWorkspaceBanks(data,providerCatalog.providers)');
    expect(page).toContain('<small>Τράπεζες με κάρτα</small><strong>{representedBankCount}</strong>');
    expect(page).toContain('variant="secondary"');
    expect(page).toContain('variant="primary" onClick={()=>openCardCreate()}><Plus/> Προσθήκη κάρτας');
    expect(page).toContain('banks={cardBank?[cardBank]:banks}');
    expect(page).toContain('workspaceBanks.map(bank=>');
  });

  it('does not force the legacy 1590px provider-registry strip at standard desktop width',()=>{
    expect(css).not.toContain('min-width:1590px');
    expect(css).toContain('grid-template-columns:repeat(var(--bank-count,1),minmax(310px,360px))');
    expect(css).toContain('width:max-content;min-width:100%');
    expect(css).toContain('.cards-workspace-scroll-hint');
  });

  it('keeps the payment card visually primary while preserving all utility actions',()=>{
    const component=readFileSync(new URL('../src/components/InteractivePaymentCard.tsx',import.meta.url),'utf8');
    const componentCss=readFileSync(new URL('../src/components/InteractivePaymentCard.css',import.meta.url),'utf8');
    expect(component).toContain('card-icon-btn card-icon-reveal');
    expect(component.match(/card-icon-btn card-icon-secondary/g)?.length).toBe(3);
    expect(componentCss).toContain('.card-icon-btn.card-icon-secondary{background:transparent;box-shadow:none;opacity:.72}');
    expect(componentCss).toContain('font-size:var(--ux-dense-label-size);line-height:1;text-transform:uppercase');
    expect(componentCss).not.toContain('font-size:.50rem');
  });

  it('flattens bank shells and constrains recent-transaction scan width with semantic theme colors',()=>{
    const surrounding=readFileSync(new URL('../src/styles/cards-approved-surrounding.css',import.meta.url),'utf8');
    expect(css).toContain('.bank-column{min-width:0;border-radius:17px;padding:12px;background:var(--surface-2);border:1px solid var(--border-subtle);box-shadow:var(--shadow-flat)}');
    expect(css).toContain('color:var(--text-secondary)');
    expect(css).toContain('.bank-empty{min-height:86px;border:1px dashed var(--border-subtle)');
    expect(surrounding).toContain('width:min(100%,1120px);margin-inline:auto');
    expect(surrounding).toContain('font-size:var(--ux-dense-data-size)');
  });
});
