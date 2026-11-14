import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { assertSyntheticVisualQaUrl } = require('../scripts/visual-evidence-store.mjs') as {assertSyntheticVisualQaUrl:(value:string)=>string};

const store=readFileSync(new URL('../scripts/visual-evidence-store.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/final-visual-qa.yml',import.meta.url),'utf8');
const finalCapture=readFileSync(new URL('../scripts/final-screenshots-qa.mjs',import.meta.url),'utf8');

describe('visual evidence provenance',()=>{
  it('captures final screenshot evidence only from the isolated loopback synthetic QA route (#649 I22.07)',()=>{
    expect(assertSyntheticVisualQaUrl('http://127.0.0.1:5173/qa.html')).toBe('http://127.0.0.1:5173/qa.html');
    expect(assertSyntheticVisualQaUrl('http://127.0.0.1:4173/qa.html')).toBe('http://127.0.0.1:4173/qa.html');
    for(const url of [
      'https://myfinhub.example/qa.html',
      'http://myfinhub.example/qa.html',
      'http://localhost:5173/qa.html',
      'http://127.0.0.1:5173/',
      'http://127.0.0.1:5173/api/data',
      'http://127.0.0.1:5173/qa.html?access_token=synthetic',
      'http://127.0.0.1:5173/qa.html#secret',
      'http://user:pass@127.0.0.1:5173/qa.html',
      'file:///tmp/qa.html',
      'invalid-url',
    ])expect(()=>assertSyntheticVisualQaUrl(url),url).toThrow(/synthetic|loopback/i);
    expect(finalCapture).toContain('const baseUrl=assertSyntheticVisualQaUrl(');
    expect(finalCapture.indexOf('const baseUrl=assertSyntheticVisualQaUrl(')).toBeLessThan(finalCapture.indexOf('rmSync(evidenceRoot'));
    expect(workflow).toContain('http://127.0.0.1:5173/qa.html');
  });


  it('records the actual checked-out commit before the pull-request merge event SHA',()=>{
    expect(store).toContain("const sourceSha=(gitValue('rev-parse','HEAD')||process.env.GITHUB_SHA||'local').trim()");
    expect(store).not.toContain("const sourceSha=(process.env.GITHUB_SHA||gitValue('rev-parse','HEAD')||'local').trim()");
  });

  it('keeps final screenshots bound to the actual workflow SHA without mutating Git history',()=>{
    expect(workflow).toContain('workflow_call:');
    expect(workflow).toContain('actions/checkout@');
    expect(workflow).toContain('myfinhub-final-screenshots-${{ github.sha }}');
    expect(workflow).toContain('if [ "$COUNT" -ne 216 ]');
    expect(workflow).toContain('actions/upload-artifact@');
    expect(workflow).not.toContain('git push');
    expect(workflow).not.toContain('git commit');
    expect(workflow).not.toContain('contents: write');
  });
});
