import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BankBrandMark, bankBrandAsset, bankBrandKey } from '../src/components/BankBrandMark.js';

describe('bank brand identity',()=>{
  it('resolves supported banks from account ids and names',()=>{
    expect(bankBrandKey('piraeus-payroll','Μισθοδοσίας')).toBe('piraeus');
    expect(bankBrandKey('revolut','Revolut')).toBe('revolut');
    expect(bankBrandKey('alpha-main','Alpha Bank')).toBe('alpha');
    expect(bankBrandKey('payzy','payzy')).toBe('payzy');
    expect(bankBrandKey('viva','Viva.com')).toBe('viva');
  });

  it('keeps safe cash and unknown-account fallbacks',()=>{
    expect(bankBrandKey('cash','Μετρητά')).toBe('cash');
    expect(bankBrandKey('custom-bank','CUSTOM')).toBe('generic');
  });

  it('maps supported brands to real HTTPS image assets',()=>{
    for(const key of ['piraeus','revolut','alpha','payzy','viva'] as const){
      const asset=bankBrandAsset(key);
      expect(asset).not.toBeNull();
      expect(asset?.src).toMatch(/^https:\/\//);
      expect(asset?.label.length).toBeGreaterThan(2);
    }
  });

  it('renders a real logo image for a supported bank account',()=>{
    const markup=renderToStaticMarkup(createElement(BankBrandMark,{id:'piraeus-payroll',name:'Μισθοδοσίας'}));
    expect(markup).toContain('data-bank-brand="piraeus"');
    expect(markup).toContain('class="bank-logo-image"');
    expect(markup).toContain('Piraeus_Bank_2024_logo.svg');
  });
});
