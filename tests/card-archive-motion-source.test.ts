import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const debit=readFileSync(new URL('../src/components/InteractivePaymentCard.tsx',import.meta.url),'utf8');
const debitCss=readFileSync(new URL('../src/components/InteractivePaymentCard.css',import.meta.url),'utf8');
const credit=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');

describe('card archive exit-motion regression #570',()=>{
  it('animates debit/prepaid only after confirmed slide or keyboard activation and before the reversible archive callback',()=>{
    expect(debit).toContain('async function playArchiveShred(card:HTMLElement)');
    expect(debit).toContain('if(cardRef.current)await playArchiveShred(cardRef.current);');
    const commit=debit.slice(debit.indexOf('  const commitArchive=async()=>'),debit.indexOf('  const pointerMove='));
    expect(commit.indexOf('await playArchiveShred')).toBeLessThan(commit.indexOf('await onArchive(card)'));
    expect(commit).toContain('if(!onArchive||archiveDisabled||archivingRef.current)return;');
    expect(commit).toContain('archivingRef.current=false');
    expect(commit).toContain('catch{');
    expect(debit).toContain('if(deleteProgress>=.92)');
    expect(debit).toContain('if(e.detail===0)void commitArchive()');
  });

  it('uses nine hidden decorative card slices, cleans them up and never duplicates revealed secrets',()=>{
    expect(debit).toContain('index<9');
    expect(debit).toContain("layer.setAttribute('aria-hidden','true')");
    expect(debit).toContain("snapshot.querySelector('.delete-confirm')?.remove()");
    expect(debit).toContain("snapshot.querySelectorAll('button').forEach(button=>button.remove())");
    expect(debit).toContain("snapshot.querySelectorAll('.card-number,.card-field-value')");
    expect(debit).toContain('await Promise.all(animations.map(animation=>animation.finished))');
    expect(debit).toContain('layer.remove()');
    expect(debitCss).toContain('.prototype-card-slot .r-card-archive-shred');
    expect(debitCss).toContain('pointer-events:none');
  });

  it('retains OS/app reduced-motion paths and the existing credit-card shred without altering finance deletion',()=>{
    expect(debit).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(debit).toContain("document.documentElement.dataset.motion==='reduced'");
    expect(debitCss).toContain('@media(prefers-reduced-motion:reduce)');
    expect(credit).toContain("layer.className='shred-layer'");
    expect(credit).toContain('await archiveRef.current(card.source)');
    expect(debit).not.toContain('onDeleteCard');
  });
});
