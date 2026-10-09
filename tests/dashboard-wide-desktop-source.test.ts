import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('Dashboard wide-desktop and provider-artwork contracts',()=>{
  it('bounds and centers the Dashboard while preserving deliberate account gutters',()=>{
    const target=read('src/styles/dashboard-approved-target.css');
    expect(target).toContain('width:min(100%,1880px)');
    expect(target).toContain('margin-inline:auto');
    expect(target).toContain('padding-inline:clamp(6px,.65vw,14px)');
    expect(target).toContain('gap:clamp(12px,.85vw,20px)!important');
  });

  it('uses canonical provider artwork instead of Dashboard-local fake marks or decorative halos',()=>{
    const marks=read('src/styles/dashboard-bankmark-chart-attention.css');
    const alignment=read('src/styles/dashboard-desktop-alignment.css');
    expect(marks).toContain('.approved-account-icon:has(>.bank-brand-mark:is([data-bank-logo-source="local-image"],[data-bank-logo-source="provider-storage"]))');
    expect(marks).toContain('object-fit:contain;object-position:center');
    expect(alignment).not.toContain('bankmark-alpha::before');
    expect(alignment).not.toContain('bankmark-revolut::before');
    expect(alignment).not.toContain('bankmark-national::before');
    expect(alignment).not.toContain('bankmark-eurobank::before');
    expect(alignment).not.toContain('account-tone-0 .approved-account-icon::before');
    expect(alignment).not.toContain('account-tone-2 .approved-account-icon .bank-logo-text::before');
  });

  it('locks focused rendered geometry at standard, wide and large desktop widths',()=>{
    const qa=read('scripts/shell-dashboard-hierarchy-qa.mjs');
    expect(qa).toContain('await viewport(1440,1000,false)');
    expect(qa).toContain('await viewport(1920,1080,false)');
    expect(qa).toContain('await viewport(2560,1440,false)');
    expect(qa).toContain('2560px Dashboard centers a bounded workspace instead of stretching or remaining left-pinned');
    expect(qa).toContain('reporting-period row stays transparent instead of reading as a second header');
    expect(qa).toContain('real provider artwork removes the decorative primary-card wrapper/halo');
  });
});
