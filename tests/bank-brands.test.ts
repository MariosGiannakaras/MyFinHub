import { describe, expect, it } from 'vitest';
import { bankBrandAsset, bankBrandFallbackMark, bankBrandKey } from '../src/lib/bankBrands.js';

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

  it('keeps current supported marks local while allowing a shared local-image asset contract',()=>{
    for(const key of ['piraeus','revolut','alpha','payzy','viva'] as const){
      const asset=bankBrandAsset(key);
      expect(asset).not.toBeNull();
      expect(asset?.label.length).toBeGreaterThan(2);
      expect(JSON.stringify(asset)).not.toMatch(/https?:\/\//);
      if(asset){
        expect(bankBrandFallbackMark(asset).length).toBeGreaterThan(2);
        if(asset.source==='local-image')expect(asset.src.startsWith('/')).toBe(true);
      }
    }
    const piraeus=bankBrandAsset('piraeus');
    expect(piraeus&&bankBrandFallbackMark(piraeus)).toBe('ΠΕΙΡΑΙΩΣ');
  });
});
