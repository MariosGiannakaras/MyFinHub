import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const reports=readFileSync(new URL('../src/pages/ReportsPage.tsx',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8')) as {name:string;short_name:string;start_url:string;display:string;icons:Array<{src:string;sizes:string;type:string}>};
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')) as {scripts:Record<string,string>};
const budget=readFileSync(new URL('../scripts/bundle-budget.mjs',import.meta.url),'utf8');

describe('release-readiness source contracts',()=>{
  it('keeps large feature pages route-lazy and chart code out of the eager app shell',()=>{
    const lazyPages=[...app.matchAll(/const\s+\w+Page\s*=\s*lazy\(\(\)\s*=>\s*import\('\.\/pages\//g)];
    expect(lazyPages.length).toBeGreaterThanOrEqual(13);
    expect(app).toContain("const ReportsPage = lazy(() => import('./pages/ReportsPage')");
    expect(app).not.toContain("from 'recharts'");
    expect(reports).toContain("from 'recharts'");
  });

  it('enforces explicit main, chart and CSS bundle budgets after every production build',()=>{
    expect(pkg.scripts.build).toContain('node scripts/bundle-budget.mjs');
    expect(budget).toContain("label:'main application JS'");
    expect(budget).toContain("label:'chart JS'");
    expect(budget).toContain("label:'application CSS'");
  });

  it('keeps browser/PWA identity consistently MyFinHub with resolvable install icons',()=>{
    expect(manifest.name).toBe('MyFinHub');
    expect(manifest.short_name).toBe('MyFinHub');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(index).toContain('<title>MyFinHub</title>');
    expect(index).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(index).toContain('rel="apple-touch-icon" href="/brand/icon-light-192.png"');
    for(const icon of manifest.icons){
      expect(icon.src.startsWith('/brand/')).toBe(true);
      expect(existsSync(new URL(`../public${icon.src}`,import.meta.url))).toBe(true);
    }
    expect(manifest.icons.some(icon=>icon.sizes==='192x192'&&icon.type==='image/png')).toBe(true);
    expect(manifest.icons.some(icon=>icon.sizes==='512x512'&&(icon.type==='image/png'||icon.type==='image/svg+xml'))).toBe(true);
    const svg=readFileSync(new URL('../public/brand/icon-512.svg',import.meta.url),'utf8');
    expect(svg).toContain('width="512"');
    expect(svg).toContain('height="512"');
    expect(svg).toContain('viewBox="0 0 512 512"');
  });
});
