import { describe, expect, it } from 'vitest';
import { bankBrandAsset, bankBrandKey } from '../src/lib/bankBrands.js';

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

  it('maps supported brands to local text marks without third-party image requests',()=>{
    for(const key of ['piraeus','revolut','alpha','payzy','viva'] as const){
      const asset=bankBrandAsset(key);
      expect(asset).not.toBeNull();
      expect(asset?.source).toBe('local-text');
      expect(asset?.mark.length).toBeGreaterThan(2);
      expect(asset?.label.length).toBeGreaterThan(2);
      expect(JSON.stringify(asset)).not.toMatch(/https?:\/\//);
    }
    expect(bankBrandAsset('piraeus')?.mark).toBe('ΠΕΙΡΑΙΩΣ');
  });
});
