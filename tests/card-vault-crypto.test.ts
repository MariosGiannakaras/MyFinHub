import { describe, expect, it } from 'vitest';
import { decryptCardSecrets, encryptCardSecrets, normalizeCardSecrets } from '../server/cardVaultCrypto.js';

const key=Buffer.alloc(32,7).toString('base64');

describe('card secret crypto',()=>{
  it('round-trips PAN, expiry and CVV with authenticated encryption',()=>{
    const encrypted=encryptCardSecrets({pan:'4111 1111 1111 1111',expiry:'09/2030',cvv:'123'},'owner-1','card-1',key,'3');
    expect(encrypted.ciphertext).not.toContain('4111111111111111');
    expect(encrypted.ciphertext).not.toContain('123');
    expect(encrypted.keyVersion).toBe(3);
    expect(decryptCardSecrets(encrypted,'owner-1','card-1',key)).toEqual({pan:'4111111111111111',expiry:'09/30',cvv:'123'});
  });

  it('keeps older PAN/expiry-only payloads backwards compatible',()=>{
    const encrypted=encryptCardSecrets({pan:'4111111111111111',expiry:'09/2030'},'owner-1','card-legacy',key,'1');
    expect(decryptCardSecrets(encrypted,'owner-1','card-legacy',key)).toEqual({pan:'4111111111111111',expiry:'09/30',cvv:undefined});
  });

  it('normalizes digits without issuer-length or Luhn validation',()=>{
    expect(normalizeCardSecrets({pan:'1234 567 890',expiry:'12/30',cvv:'1234'})).toEqual({pan:'1234567890',expiry:'12/30',cvv:'1234'});
    expect(normalizeCardSecrets({pan:'9999-0000-1111-2222-3333'})).toEqual({pan:'99990000111122223333',expiry:undefined,cvv:undefined});
  });

  it('binds ciphertext to owner and card id',()=>{
    const encrypted=encryptCardSecrets({pan:'4111111111111111'},'owner-1','card-1',key,'1');
    expect(()=>decryptCardSecrets(encrypted,'owner-1','card-2',key)).toThrow('CARD_VAULT_DECRYPT_FAILED');
    expect(()=>decryptCardSecrets(encrypted,'owner-2','card-1',key)).toThrow('CARD_VAULT_DECRYPT_FAILED');
  });

  it('fails closed without a 256-bit encryption key',()=>{
    expect(()=>encryptCardSecrets({pan:'4111111111111111'},'owner-1','card-1',undefined,'1')).toThrow('CARD_VAULT_KEY_NOT_CONFIGURED');
    expect(()=>encryptCardSecrets({pan:'4111111111111111'},'owner-1','card-1','bad','1')).toThrow('CARD_VAULT_KEY_INVALID');
  });

  it('rejects invalid CVV and PAN values without any digits',()=>{
    expect(()=>normalizeCardSecrets({pan:'4111111111111111',cvv:'12'})).toThrow('INVALID_CARD_CVV');
    expect(()=>normalizeCardSecrets({cvv:'12ab'})).toThrow('INVALID_CARD_CVV');
    expect(()=>normalizeCardSecrets({pan:'not-a-number'})).toThrow('INVALID_CARD_PAN');
  });
});
