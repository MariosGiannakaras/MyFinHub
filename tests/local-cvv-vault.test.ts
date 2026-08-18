import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeLocalCvv } from '../src/lib/localCvvFormat.js';

describe('local-only CVV vault',()=>{
  it('accepts only 3 or 4 numeric digits',()=>{
    expect(normalizeLocalCvv('123')).toBe('123');
    expect(normalizeLocalCvv(' 1234 ')).toBe('1234');
    expect(()=>normalizeLocalCvv('12')).toThrow('INVALID_CVV');
    expect(()=>normalizeLocalCvv('12a')).toThrow('INVALID_CVV');
    expect(()=>normalizeLocalCvv('12345')).toThrow('INVALID_CVV');
  });

  it('keeps CVV storage browser-local and authenticated-encrypted by construction',()=>{
    const source=readFileSync(new URL('../src/lib/localCvvVault.ts',import.meta.url),'utf8');
    expect(source).toContain("const DB_NAME = 'rheomiq-local-card-vault'");
    expect(source).toContain("name: 'AES-GCM'");
    expect(source).toContain("length: 256");
    expect(source).toContain("false,\n    ['encrypt', 'decrypt']");
    expect(source).toContain('crypto.getRandomValues(new Uint8Array(IV_BYTES))');
    expect(source).toContain('additionalData: aad(cardId)');
    expect(source).toContain('indexedDB.open');
  });

  it('contains no network or plaintext web-storage persistence path',()=>{
    const source=readFileSync(new URL('../src/lib/localCvvVault.ts',import.meta.url),'utf8');
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain('XMLHttpRequest');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });
});
