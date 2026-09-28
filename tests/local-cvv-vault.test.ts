import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeLocalCvv } from '../src/lib/localCvvFormat.js';

function vaultSource(){return readFileSync(new URL('../src/lib/localCvvVault.ts',import.meta.url),'utf8').replace(/\r\n/g,'\n')}

describe('local-only CVV vault',()=>{
  it('accepts only 3 or 4 numeric digits',()=>{
    expect(normalizeLocalCvv('123')).toBe('123');
    expect(normalizeLocalCvv(' 1234 ')).toBe('1234');
    expect(()=>normalizeLocalCvv('12')).toThrow('INVALID_CVV');
    expect(()=>normalizeLocalCvv('12a')).toThrow('INVALID_CVV');
    expect(()=>normalizeLocalCvv('12345')).toThrow('INVALID_CVV');
  });

  it('keeps legacy local CVV reads authenticated and browser-local while new writes stay out of this compatibility vault',()=>{
    const source=vaultSource();
    expect(source).toContain("const DB_NAME = 'rheomiq-local-card-vault'");
    expect(source).toContain("name: 'AES-GCM'");
    expect(source).toContain("length: 256");
    expect(source).toContain('crypto.subtle.decrypt');
    expect(source).toContain('additionalData: aad(cardId)');
    expect(source).toContain('indexedDB.open');
    expect(source).toContain('export async function readLocalCvv');
    expect(source).toContain('export async function deleteLocalCvv');
    expect(source).not.toContain('crypto.subtle.encrypt');
    expect(source).not.toContain('saveLocalCvv');
  });

  it('contains no network or plaintext web-storage persistence path',()=>{
    const source=vaultSource();
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain('XMLHttpRequest');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });
});
