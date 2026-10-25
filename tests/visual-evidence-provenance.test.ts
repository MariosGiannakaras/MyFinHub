import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const store=readFileSync(new URL('../scripts/visual-evidence-store.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/final-visual-qa.yml',import.meta.url),'utf8');

describe('visual evidence provenance',()=>{
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
