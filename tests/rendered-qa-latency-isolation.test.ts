import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('rendered QA strict latency isolation',()=>{
  it('isolates browser wall-clock suites from concurrent Chromium load',()=>{
    const source=readFileSync('scripts/run-rendered-qa.mjs','utf8');
    const isolated=source.match(/const resourceIsolatedSuites=new Set\(\[([\s\S]*?)\]\);/)?.[1]??'';
    expect(isolated).toContain("'scripts/transactions-scanability-qa.mjs'");
    expect(isolated).toContain("'scripts/large-data-boundaries-qa.mjs'");
    expect(source).toContain('scripts.filter(item=>!resourceIsolatedSuites.has(item.path))');
    expect(source).toContain('for(const item of isolatedScripts)await runRenderedItem(item)');
    expect(source.indexOf('await Promise.all(Array.from')).toBeLessThan(source.indexOf('for(const item of isolatedScripts)'));
  });
  it('preserves strict real-world mutation latency and data checks',()=>{
    const scan=readFileSync('scripts/transactions-scanability-qa.mjs','utf8');
    expect(scan).toContain('state=large');
    expect(scan).toContain('mutationLatency<2000');
    expect(scan).toContain('Large dataset mutation latency target');
    expect(scan).toContain('large-data mutation visible after save');
  });
});
