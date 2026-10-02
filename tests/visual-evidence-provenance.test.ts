import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const store=readFileSync(new URL('../scripts/visual-evidence-store.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/final-visual-qa.yml',import.meta.url),'utf8');

describe('visual evidence provenance',()=>{
  it('records the actual checked-out commit before the pull-request merge event SHA',()=>{
    expect(store).toContain("const sourceSha=(gitValue('rev-parse','HEAD')||process.env.GITHUB_SHA||'local').trim()");
    expect(store).not.toContain("const sourceSha=(process.env.GITHUB_SHA||gitValue('rev-parse','HEAD')||'local').trim()");
  });

  it('refuses to persist screenshots when the branch advanced during capture',()=>{
    expect(workflow).toContain('EXPECTED_HEAD_SHA:');
    expect(workflow).toContain('github.event.pull_request.head.sha');
    expect(workflow).toContain('if [ "$REMOTE_SHA" != "$EXPECTED_HEAD_SHA" ]');
    expect(workflow).toContain('refusing stale evidence commit');
  });
});
