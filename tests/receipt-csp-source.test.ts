import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

describe('local receipt OCR CSP boundary', () => {
  it('permits WebAssembly without enabling generic JavaScript eval', () => {
    for (const source of [vercel, desktop]) {
      expect(source).toContain("script-src 'self' 'wasm-unsafe-eval'");
      expect(source).toContain("worker-src 'self' blob:");
      expect(source.match(/'wasm-unsafe-eval'/g)).toHaveLength(1);
      expect(source).not.toMatch(/script-src[^;]*\s'unsafe-eval'(?:\s|;)/);
    }
  });

  it('allows only the canonical Supabase provider-image origin beyond self/data/blob', () => {
    for (const source of [vercel, desktop]) {
      expect(source).toContain("img-src 'self' data: blob: https://ahsukppxwaiagampsuzb.supabase.co");
      expect(source).not.toContain('https://upload.wikimedia.org');
      expect(source).not.toContain('https://www.neukunden-rabatt.de');
      expect(source).not.toContain('https://cdn.asp.events');
    }
  });

});
