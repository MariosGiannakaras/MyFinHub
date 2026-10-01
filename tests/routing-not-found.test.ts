import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pageHash, resolveHashRoute } from '../src/lib/routing.js';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
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
  });

  it('uses the dedicated privacy-safe React 404 and exposes it to rendered QA',()=>{
    expect(app).toContain('<NotFoundPage');
    expect(qa).toContain("screen==='404'");
    expect(finalScreenshots).toContain("const utilityScreens=['404']");
    expect(finalScreenshots).toContain('screenshots.length!==66');
    expect(finalWorkflow).toContain('Expected 66 final PNGs');
  });

  it('serves only the hash-routed app entry at root and returns a real static 404 for unknown HTTP paths',()=>{
    expect(server).toContain("express.static(dist, { index: 'index.html'");
    expect(server).toContain("const notFoundHtml=readFileSync(path.join(dist,'404.html'),'utf8')");
    expect(server).toContain("res.status(404).type('html').send(notFoundHtml)");
    expect(server).not.toContain("res.sendFile(path.join(dist, 'index.html'))");
    expect(static404).toContain('<title>404 · MyFinHub</title>');
    expect(static404).toContain('Χάσαμε τη διαδρομή, όχι τα δεδομένα σου.');
    expect(static404).toContain('href="/#/dashboard"');
    expect(static404.toLowerCase()).not.toContain('<script');
  });
});
