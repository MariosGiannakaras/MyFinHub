import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pageHash, resolveHashRoute, settingsHash } from '../src/lib/routing.js';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const notFoundPage=readFileSync(new URL('../src/pages/NotFoundPage.tsx',import.meta.url),'utf8');
const notFoundStyles=readFileSync(new URL('../src/styles/not-found-page.css',import.meta.url),'utf8');
const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
const server=readFileSync(new URL('../server/index.ts',import.meta.url),'utf8');
const finalScreenshots=readFileSync(new URL('../scripts/final-screenshots-qa.mjs',import.meta.url),'utf8');
const finalWorkflow=readFileSync(new URL('../.github/workflows/final-visual-qa.yml',import.meta.url),'utf8');
const static404=readFileSync(new URL('../public/404.html',import.meta.url),'utf8');

describe('routing and 404 contract',()=>{
  it('resolves valid, legacy and invalid hash routes without silently treating unknown routes as Dashboard',()=>{
    expect(resolveHashRoute('')).toEqual({page:'dashboard',notFound:false});
    expect(resolveHashRoute('#/transactions')).toEqual({page:'transactions',notFound:false});
    expect(resolveHashRoute('#review')).toEqual({page:'attention',notFound:false,redirectHash:'#/attention'});
    expect(resolveHashRoute('#/does-not-exist')).toEqual({page:'dashboard',notFound:true});
    expect(resolveHashRoute('#/%2Fweird')).toEqual({page:'dashboard',notFound:true});
    expect(pageHash('reports')).toBe('#/reports');
    expect(resolveHashRoute('#/settings')).toEqual({page:'settings',notFound:false,settingsTab:'general'});
    expect(resolveHashRoute('#/settings/accounts')).toEqual({page:'settings',notFound:false,settingsTab:'accounts'});
    expect(resolveHashRoute('#/settings/rules')).toEqual({page:'settings',notFound:false,settingsTab:'rules'});
    expect(resolveHashRoute('#/settings/nope')).toEqual({page:'dashboard',notFound:true});
    expect(settingsHash('general')).toBe('#/settings');
    expect(settingsHash('data')).toBe('#/settings/data');
    expect(resolveHashRoute('#/transactions/')).toEqual({page:'dashboard',notFound:true});
    expect(resolveHashRoute('#/transactions?source=external')).toEqual({page:'dashboard',notFound:true});
    expect(resolveHashRoute('#//transactions')).toEqual({page:'dashboard',notFound:true});
    expect(resolveHashRoute('#/%E0%A4%A')).toEqual({page:'dashboard',notFound:true});
    expect(resolveHashRoute('#/<script>alert(1)</script>')).toEqual({page:'dashboard',notFound:true});
  });

  it('uses the dedicated privacy-safe React 404 and exposes it to rendered QA',()=>{
    expect(app).toContain('<NotFoundPage');
    expect(qa).toContain("screen==='404'");
    expect(finalScreenshots).toContain("const utilityScreens=['404']");
    expect(finalScreenshots).toContain('const settingsNestedStateCount=8');
    expect(finalScreenshots).toContain("provider-editor-details");
    expect(finalScreenshots).toContain("provider-asset-picker");
    expect(finalScreenshots).toContain("account-editor-new");
    expect(finalScreenshots).toContain("category-rename-editor");
    expect(finalScreenshots).toContain("icon-selection-editor");
    expect(finalScreenshots).toContain("rule-editor-new");
    expect(finalScreenshots).toContain("data-import-confirmation");
    expect(finalWorkflow).toContain('Expected 216 final PNGs');
    expect(finalScreenshots).toContain("{screen:'auth-unavailable',state:'auth-unavailable'}");
    expect(finalScreenshots).toContain("{screen:'session-revoked',state:'session-revoked'}");
    expect(finalScreenshots).toContain("{screen:'mfa-error',state:'mfa-error'}");
  });

  it('serves only the hash-routed app entry at root and returns a real static 404 for unknown HTTP paths',()=>{
    expect(server).toContain("app.get(['/', '/index.html']");
    expect(server).toContain("const indexDocument = readFileSync(indexFile, 'utf8')");
    expect(server).toContain("const notFoundDocument = readFileSync(notFoundFile, 'utf8')");
    expect(server).toContain("res.type('html').send(indexDocument)");
    expect(server).toContain("res.status(404).type('html').send(notFoundDocument)");
    expect(server).not.toContain("res.sendFile(indexFile)");
    expect(server).not.toContain("res.status(404).sendFile(notFoundFile)");
    expect(server).not.toContain("app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')))");
    expect(static404).toContain('<title>404 · MyFinHub</title>');
    expect(static404).toContain('Χάσαμε τη διαδρομή, όχι τα δεδομένα σου.');
    expect(static404).toContain('href="/#/dashboard"');
    expect(static404.toLowerCase()).not.toContain('<script');
    const notFoundCss=readFileSync(new URL('../src/styles/not-found-page.css',import.meta.url),'utf8');
    expect(notFoundCss).toContain('.not-found-copy h1:focus,.not-found-copy h1:focus-visible{outline:none!important;box-shadow:none!important}');
  });

  it('keeps known local API routes on 405 before the unknown-route JSON 404 fallback',()=>{
    expect(server).toContain("knownMethodFallback('/api/health', ['GET'])");
    expect(server).toContain("knownMethodFallback('/api/data', ['GET', 'PUT'])");
    expect(server).toContain("knownMethodFallback('/api/history', ['GET', 'POST'])");
    expect(server).toContain("knownMethodFallback('/api/import', ['POST'])");
    expect(server.indexOf("knownMethodFallback('/api/data'")).toBeLessThan(server.indexOf("app.all('/api/{*splat}'"));
  });


  it('keeps browser history recovery and focus behavior explicit for valid routes and 404 recovery',()=>{
    expect(app).toContain("history.pushState(null, '', hash)");
    expect(app).toContain("window.addEventListener('hashchange', sync)");
    expect(app).toContain("window.addEventListener('popstate', sync)");
    expect(app).toContain("heading.focus({ preventScroll: true })");
    expect(app).toContain("onBack={() => { if (history.length > 1) history.back(); else navigate('dashboard', true); }}");
    expect(notFoundPage).toContain("titleRef.current?.focus({ preventScroll: true })");
    expect(notFoundPage).toContain('tabIndex={-1}');
    expect(notFoundPage).toContain('onClick={onBack}');
    expect(notFoundStyles).toMatch(/\.not-found-copy h1:focus\s*,\s*\.not-found-copy h1:focus-visible\s*\{[^}]*outline\s*:\s*none\s*!important[^}]*box-shadow\s*:\s*none\s*!important[^}]*\}/);
  });

});
