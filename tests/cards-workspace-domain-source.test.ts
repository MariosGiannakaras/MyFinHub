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
});
