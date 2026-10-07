import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quick=readFileSync('src/components/QuickAdd.tsx','utf8');
const receiptAware=readFileSync('src/components/ReceiptAwareQuickAdd.tsx','utf8');
const css=readFileSync('src/styles/quick-entry-desktop-composition.css','utf8');
const popovers=readFileSync('src/styles/owned-entry-popovers.css','utf8');
const runner=readFileSync('scripts/run-rendered-qa.mjs','utf8');
const rendered=readFileSync('scripts/quick-entry-reference-qa.mjs','utf8');

describe('Quick Entry owner-reference contract',()=>{
  it('keeps the production flow on shared React controls',()=>{
    for(const primitive of ['MoneyInput','AppTextInput','AppSelectInput','AppDateInput','CategorySelectInput','DialogShell'])expect(quick).toContain(primitive);
    expect(quick).not.toMatch(/<select\b/);
    expect(quick).not.toMatch(/<input\b[^>]*type=["']date["']/);
    expect(quick).toContain('className="generic-quick-modal"');
    expect(quick).toContain('className="quick-field"');
    expect(quick).toContain('data-filled=');
  });
  it('keeps frequent actions transient rather than selected controls',()=>{
    const frequent=quick.slice(quick.indexOf("kind==='expense'?<div className=\"frequent-strip\""),quick.indexOf('<div className="form-grid">'));
    expect(frequent).toContain('onClick=');expect(frequent).not.toContain('aria-pressed');
    expect(css).toContain('.frequent-strip button:active');
    expect(rendered).toContain('does not retain selection state');
  });
  it('matches owner desktop/tablet composition and floating-field grammar',()=>{
    expect(css).toContain('width:min(1020px,calc(100vw - 40px))');
    expect(css).toContain('grid-template-columns:repeat(4,minmax(0,1fr))');
    expect(css).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(css).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(css).toContain('@media(min-width:981px) and (max-width:1099px)');
    expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(css).toContain('.quick-field[data-filled="true"]:not(:focus-within)>span:first-child');
    expect(css).toContain('padding:15px 39px 4px 11px!important');
  });
  it('keeps receipt action semantic and responsive',()=>{
    expect(receiptAware).toContain('<small>Σάρωση & αυτόματη συμπλήρωση</small>');
    expect(css).toContain('min-width:280px;min-height:46px');
  });
  it('keeps owned popovers shared and viewport-safe',()=>{
    expect(popovers).toContain('max-height:min(72dvh,620px)');
    expect(popovers).toContain('border-radius:20px 20px 0 0');
    expect(popovers).toContain('@media(prefers-reduced-motion:reduce)');
  });
  it('registers focused rendered visual regression',()=>{
    expect(runner).toContain('scripts/quick-entry-reference-qa.mjs');
    expect(rendered).toContain("for(const theme of ['light','dark'])");
    expect(rendered).toContain('1440,1000');expect(rendered).toContain('820,900');expect(rendered).toContain('375,812');
  });
});