import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quick=readFileSync('src/components/QuickAdd.tsx','utf8');
const receiptAware=readFileSync('src/components/ReceiptAwareQuickAdd.tsx','utf8');
const css=readFileSync('src/styles/quick-entry-desktop-composition.css','utf8');
const popovers=readFileSync('src/styles/owned-entry-popovers.css','utf8');
const runner=readFileSync('scripts/run-rendered-qa.mjs','utf8');
const rendered=readFileSync('scripts/quick-entry-reference-qa.mjs','utf8');

describe('Quick Entry owner-reference contract',()=>{
  it('keeps the production flow on the existing shared React controls',()=>{
    for(const primitive of ['MoneyInput','AppTextInput','AppSelectInput','AppDateInput','CategorySelectInput','DialogShell'])expect(quick).toContain(primitive);
    expect(quick).not.toMatch(/<select\b/);
    expect(quick).not.toMatch(/<input\b[^>]*type=["']date["']/);
    expect(quick).toContain('className="quick-field"');
    expect(quick).toContain('data-filled=');
  });

  it('keeps frequent actions transient rather than selected controls',()=>{
    const frequent=quick.slice(quick.indexOf("kind==='expense'?<div className=\"frequent-strip\""),quick.indexOf('<div className="form-grid">'));
    expect(frequent).toContain('onClick=');
    expect(frequent).not.toContain('aria-pressed');
    expect(frequent).not.toContain("className={");
    expect(css).toContain('.frequent-strip button:active');
    expect(rendered).toContain("does not retain selection state");
  });

  it('matches the owner reference composition at desktop, tablet and phone breakpoints',()=>{
    expect(css).toContain('width:min(1020px,calc(100vw - 40px))');
    expect(css).toContain('grid-template-columns:repeat(4,minmax(0,1fr))');
    expect(css).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(css).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(css).toContain('@media(max-width:980px)');
    expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(css).toContain('@media(max-width:680px)');
    expect(css).toContain('flex:0 0 140px');
    expect(css).toContain('grid-template-columns:1fr');
    expect(css).toContain('padding:max(8px,env(safe-area-inset-top)) 7px max(8px,env(safe-area-inset-bottom))');
  });

  it('keeps the receipt action in the footer with the reference subtitle and responsive alignment',()=>{
    expect(receiptAware).toContain('<small>Σάρωση & αυτόματη συμπλήρωση</small>');
    expect(css).toContain('min-width:280px;min-height:46px');
    expect(css).toContain('order:-1;width:100%;min-width:0;min-height:48px');
    expect(css).toContain('.receipt-quick-launch>small{display:none}');
  });

  it('keeps shared owned popovers crisp, keyboard-visible and reduced-motion safe',()=>{
    expect(popovers).toContain('border:1px solid var(--border-strong)!important');
    expect(popovers).toContain('[role="option"]:focus-visible');
    expect(popovers).toContain('[role="gridcell"]:focus-visible');
    expect(popovers).toContain('border-radius:20px 20px 0 0');
    expect(popovers).toContain('@media(prefers-reduced-motion:reduce)');
    expect(popovers).toContain('html[data-motion="reduced"]');
  });

  it('registers a focused rendered visual regression pass',()=>{
    expect(runner).toContain("scripts/quick-entry-reference-qa.mjs");
    expect(rendered).toContain("for(const theme of ['light','dark'])");
    expect(rendered).toContain('1440,1000');
    expect(rendered).toContain('820,900');
    expect(rendered).toContain('375,812');
    expect(rendered).toContain('quick-entry-date-mobile');
  });
});