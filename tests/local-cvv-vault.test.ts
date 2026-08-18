import { describe, expect, it } from 'vitest';
import { decryptLocalCvvValue, encryptLocalCvvValue, normalizeLocalCvv } from '../src/lib/localCvvVault.js';

async function key(){
  return crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']) as Promise<CryptoKey>;
}

describe('local-only CVV vault',()=>{
  it('accepts only 3 or 4 numeric digits',()=>{
    expect(normalizeLocalCvv('123')).toBe('123');
    expect(normalizeLocalCvv(' 1234 ')).toBe('1234');
    expect(()=>normalizeLocalCvv('12')).toThrow('INVALID_CVV');
    expect(()=>normalizeLocalCvv('12a')).toThrow('INVALID_CVV');
    expect(()=>normalizeLocalCvv('12345')).toThrow('INVALID_CVV');
  });

  it('round-trips with a non-extractable AES-GCM key without plaintext storage',async()=>{
    const cryptoKey=await key();
    expect(cryptoKey.extractable).toBe(false);
    const encrypted=await encryptLocalCvvValue('card-1','123',cryptoKey);
    expect(new TextDecoder().decode(encrypted.ciphertext)).not.toContain('123');
    await expect(decryptLocalCvvValue('card-1',encrypted,cryptoKey)).resolves.toBe('123');
  });

  it('binds ciphertext to the card id',async()=>{
    const cryptoKey=await key();
    const encrypted=await encryptLocalCvvValue('card-1','987',cryptoKey);
    await expect(decryptLocalCvvValue('card-2',encrypted,cryptoKey)).rejects.toThrow('LOCAL_CVV_DECRYPT_FAILED');
  });
});
