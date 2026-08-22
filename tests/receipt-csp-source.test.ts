import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

describe('local receipt OCR CSP boundary', () => {
  it('permits WebAssembly without enabling generic JavaScript eval', () => {
    for (const source of [vercel, desktop]) {
      expect(source).toContain("script-src 'self' 'wasm-unsafe-eval'");
      expect(source).toContain("worker-src 'self' blob:");
      expect(source).not.toMatch(/script-src[^;]*\s'unsafe-eval'(?:\s|;)/);
    }
  });
});
