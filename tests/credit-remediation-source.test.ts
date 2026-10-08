import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const stack=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');
const stackOne=readFileSync(new URL('../src/styles/canonical-credit-card-stack-1.css',import.meta.url),'utf8');
const stackTwo=readFileSync(new URL('../src/styles/canonical-credit-card-stack-2.css',import.meta.url),'utf8');
const stackThree=readFileSync(new URL('../src/styles/canonical-credit-card-stack-3.css',import.meta.url),'utf8');
const host=readFileSync(new URL('../src/styles/credit-approved-target.css',import.meta.url),'utf8');

describe('Credit post-v1.4 remediation contracts',()=>{
  it('keeps one canonical stack navigation model and populated create reachability',()=>{
    expect(page).toContain('<Plus/> Προσθήκη πιστωτικής');
    expect(page).not.toContain('CardDeckMode');
    expect(page).not.toContain('credit-card-view-controls');
    expect(page).not.toContain('credit-card-horizontal-nav');
    expect(page).not.toContain('Προηγούμενη πιστωτική κάρτα');
  });

  it('keeps management editing on the active physical card using existing dialogs',()=>{
    expect(page).toContain('onEditCard={openCardProfile}');
    expect(page).toContain('onEditDetails={openCardDetails}');
    expect(page).toContain('initialCard={profileCard} kindLock="credit"');
    expect(page).toContain('<CardDetailsDialog open={Boolean(detailsCard)}');
    expect(stack).toContain("const management=stackIndex===0?");
    expect(stack).toContain('editCardRef.current?.(card.source)');
    expect(stack).toContain('editDetailsRef.current?.(card.source)');
  });

  it('treats one active card as a stable card rather than a simulated stack',()=>{
    expect(stack).toContain('if(orderRef.current.length<2||deleteMode||swiping');
    expect(stack).toContain("stage.classList.toggle('single-card',orderedCards.length===1)");
    expect(stack).toContain("dots.innerHTML=cardsRef.current.length>1?");
    expect(stack).toContain("multiCard?'multi-card-mode':'single-card-mode'");
    expect(stackOne).toContain('#myfinhub-card-stack.single-card-mode .stack-stage');
    expect(stackOne).toContain('touch-action:pan-y');
  });

  it('contains pagination and exposes drag discovery without restoring host navigation',()=>{
    expect(stack).toContain("scrollIntoView({inline:'center',block:'nearest'");
    expect(stack).toContain('Σύρε κάθετα για αλλαγή κάρτας');
    expect(stackTwo).toContain('width:min(100%,280px)');
    expect(stackTwo).toContain('overflow-x:auto');
    expect(stackTwo).toContain('flex:0 0 auto');
    expect(stackTwo).toContain('.stack-drag-hint');
  });

  it('bounds dynamic provider artwork and keeps the canonical card dominant',()=>{
    expect(stackThree).toContain('.provider-brand-img');
    expect(stackThree).toContain('max-width:112px');
    expect(stackThree).toContain('max-height:24px');
  });

  it('flattens redundant desktop host surfaces and raises host-data readability',()=>{
    expect(host).toContain('background:transparent;box-shadow:none;display:grid;place-items:center');
    expect(host).toContain('border:0;border-left:1px solid var(--line);border-radius:0;background:transparent;box-shadow:none');
    expect(host).toContain('.semantic-table{font-size:var(--ux-dense-data-size)}');
    expect(host).toContain('font-size:var(--ux-dense-label-size);color:var(--text-secondary)');
  });
});
