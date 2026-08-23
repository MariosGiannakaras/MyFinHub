import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const version = readFileSync('visual-qa/current-version.txt', 'utf8').trim();
const capture = readFileSync('scripts/ui-ux-visual-evidence-qa.mjs', 'utf8');
const approve = readFileSync('scripts/approve-visual-baseline.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/visual-qa-snapshots.yml', 'utf8');
const docs = readFileSync('visual-qa/README.md', 'utf8');

describe('versioned visual QA archive contract', () => {
  it('keeps the active implementation evidence isolated under v1.3', () => {
    expect(version).toBe('v1.3');
    expect(capture).toContain("'visual-qa/current-version.txt'");
    expect(capture).toContain("resolve(versionDir,'runs',runId)");
    expect(capture).toContain("resolve(versionDir,'latest')");
  });

  it('makes capture identity visible in screenshot names and metadata', () => {
    expect(capture).toContain("process.env.MYFINHUB_QA_TIME_ZONE||'Europe/Athens'");
    expect(capture).toContain('${appVersion}__${timestamp}__${page}__${mode}-${width}x${height}__NEW.png');
    expect(capture).toContain('source:{sha:sourceSha,shortSha,branch:sourceBranch}');
    expect(capture).toContain("writeFileSync(resolve(latestDir,'manifest.json')");
  });

  it('separates approved old baseline from current new captures', () => {
    expect(approve).toContain("replace(/__NEW\\.png$/,'__BASELINE.png')");
    expect(approve).toContain("state:'BASELINE'");
    expect(docs).toContain('baseline/');
    expect(docs).toContain('latest/');
    expect(docs).toContain('runs/');
  });

  it('persists snapshots only back to non-release feature branches', () => {
    expect(workflow).toContain('branches-ignore:');
    expect(workflow).toContain('- main');
    expect(workflow).toContain('- develop');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('git push origin "HEAD:${GITHUB_REF_NAME}"');
  });
});
