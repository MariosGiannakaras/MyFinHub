import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const server=readFileSync(new URL('../server/index.ts',import.meta.url),'utf8');
const vercel=readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
const providerFixture=readFileSync(new URL('../src/qaFinancialProviders.ts',import.meta.url),'utf8');
const canonicalOrigin='https://ahsukppxwaiagampsuzb.supabase.co';

describe('provider asset CSP contract',()=>{
  it('allows the canonical Supabase Storage origin in web and desktop image policy',()=>{
    expect(providerFixture).toContain(canonicalOrigin);
    expect(server).toContain(`img-src 'self' data: blob: ${canonicalOrigin}`);
    expect(vercel).toContain(`img-src 'self' data: blob: ${canonicalOrigin}`);
  });

  it('keeps Supabase direct browser connectivity closed while allowing only provider images',()=>{
    const config=JSON.parse(vercel) as {headers:Array<{headers:Array<{key:string;value:string}>}>};
    const csp=config.headers.flatMap(row=>row.headers).find(header=>header.key==='Content-Security-Policy')?.value??'';
    expect(csp).toContain(`img-src 'self' data: blob: ${canonicalOrigin}`);
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain(`connect-src 'self' ${canonicalOrigin}`);
  });
});
