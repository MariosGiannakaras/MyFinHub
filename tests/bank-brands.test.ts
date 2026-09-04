import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bankBrandAsset, bankBrandCardMark, bankBrandFallbackMark, bankBrandKey } from '../src/lib/bankBrands.js';

const root=process.cwd();
const source=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

describe('bank brand identity',()=>{
  it('resolves supported banks from account ids and names',()=>{
    expect(bankBrandKey('piraeus-payroll','Μισθοδοσίας')).toBe('piraeus');
    expect(bankBrandKey('revolut','Revolut')).toBe('revolut');
    expect(bankBrandKey('alpha-main','Alpha Bank')).toBe('alpha');
    expect(bankBrandKey('national-main','Εθνική Τράπεζα')).toBe('national');
    expect(bankBrandKey('nbg-main','National Bank of Greece')).toBe('national');
    expect(bankBrandKey(undefined,'Εθνική Τράπεζα')).toBe('national');
    expect(bankBrandKey('eurobank-main','Eurobank')).toBe('eurobank');
    expect(bankBrandKey(undefined,'Eurobank')).toBe('eurobank');
    expect(bankBrandKey('payzy','payzy')).toBe('payzy');
    expect(bankBrandKey('viva','Viva.com')).toBe('viva');
  });

  it('keeps safe cash and unknown-account fallbacks',()=>{
    expect(bankBrandKey('cash','Μετρητά')).toBe('cash');
    expect(bankBrandKey('custom-bank','CUSTOM')).toBe('generic');
  });

  it('uses only verified local brand assets and deliberately falls back for unverified bank artwork',()=>{
    for(const key of ['revolut','payzy','viva'] as const){
      const asset=bankBrandAsset(key);
      expect(asset).not.toBeNull();
      expect(asset?.label.length).toBeGreaterThan(2);
      expect(JSON.stringify(asset)).not.toMatch(/https?:\/\//);
      if(asset){
        expect(bankBrandFallbackMark(asset).length).toBeGreaterThan(2);
        expect(bankBrandCardMark(asset).length).toBeGreaterThan(2);
        if(asset.source==='local-image'){
          expect(asset.src.length).toBeGreaterThan(3);
          expect(asset.src).not.toMatch(/^https?:\/\//);
        }
      }
    }
    for(const key of ['piraeus','alpha','national','eurobank'] as const){
      expect(bankBrandAsset(key)).toBeNull();
    }
    expect(bankBrandAsset('payzy')?.source).toBe('local-image');
    expect(bankBrandAsset('viva')?.source).toBe('local-image');
  });

  it('keeps Dashboard, card preview and both rendered card implementations on one registry contract',()=>{
    const dashboard=source('src/pages/DashboardPage.tsx');
    const createDialog=source('src/components/CardCreateDialog.tsx');
    const paymentCard=source('src/components/InteractivePaymentCard.tsx');
    const canonicalStack=source('src/components/CanonicalCreditCardStack.tsx');
    expect(dashboard).toContain('<BankBrandMark');
    expect(createDialog).toContain('<BankBrandMark');
    expect(paymentCard).toContain('<BankBrandMark id={bank.id} name={bank.name} compact={false}/>');
    expect(paymentCard).not.toContain('piraeus-slashes');
    expect(paymentCard).not.toContain('revolut-wordmark');
    expect(paymentCard).not.toContain('>ALPHA BANK<');
    expect(paymentCard).toContain('aria-label={`${cardLabel(card)} · ${bank.name}`}');
    expect(canonicalStack).toContain("from '../lib/bankBrands'");
    expect(canonicalStack).toContain('bankBrandKey(card.bankId,label)');
    expect(canonicalStack).toContain('bankBrandCardMark(asset)');
    expect(canonicalStack).not.toContain("import vivaLogo from '../assets/canonical-credit-card/viva-logo.png'");
    expect(canonicalStack).not.toContain("import payzyLogo from '../assets/canonical-credit-card/payzy-logo.png'");
  });
});
