import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const version=readFileSync('visual-qa/current-version.txt','utf8').trim();
const capture=readFileSync('scripts/ui-ux-visual-evidence-qa.mjs','utf8');
const store=readFileSync('scripts/visual-evidence-store.mjs','utf8');
const runner=readFileSync('scripts/run-rendered-qa.mjs','utf8');
const workflow=readFileSync('.github/workflows/visual-qa-snapshots.yml','utf8');
const ci=readFileSync('.github/workflows/ci.yml','utf8');
const docs=readFileSync('visual-qa/README.md','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8')) as {scripts:Record<string,string>};

describe('surface-first latest-only visual QA archive contract',()=>{
  it('keeps version identity in filenames rather than version/run directories',()=>{
    expect(version).toBe('v1.3');
    expect(capture).toContain("resolve(evidenceRoot,page)");
    expect(capture).toContain('${appVersion}__${timestamp}__full-page__${mode}-${width}x${height}.png');
    expect(capture).not.toContain("resolve(versionDir,'runs'");
    expect(capture).not.toContain("resolve(versionDir,'latest'");
    expect(docs).toContain('There are **no version directories, `runs/` directories or `baseline/` directories**');
  });

  it('replaces only the previous evidence from the same page or focused suite',()=>{
    expect(capture).toContain("name.includes('__full-page__')");
    expect(store).toContain('const marker=`__qa-${sanitize(key)}__`');
    expect(store).toContain("name.includes(marker)");
    expect(store).toContain("rmSync(resolve(targetDir,name)");
    expect(store).toContain("layout:'surface-first-latest-only'");
  });

  it('persists every rendered suite through one coordinator and records focused screenshots by object',()=>{
    expect(pkg.scripts['qa:frontend']).toBe('node scripts/run-rendered-qa.mjs');
    for(const script of ['shell-dashboard-hierarchy-qa.mjs','taxonomy-management-qa.mjs','category-icon-adoption-qa.mjs','legacy-transaction-management-qa.mjs','receipt-local-ocr-qa.mjs','final-ux-reconciliation-qa.mjs','ledger-foundations-qa.mjs'])expect(runner).toContain(script);
    expect(runner).toContain('persistSuiteEvidence');
    expect(runner).toContain("surface:'credit'");
    expect(runner).toContain("surface:'dashboard'");
    expect(runner).toContain("surface:'transactions'");
  });

  it('keeps snapshot commits bounded and non-recursive on feature branches',()=>{
    expect(workflow).toContain('branches-ignore:');
    expect(workflow).toContain('- main');
    expect(workflow).toContain('- develop');
    expect(workflow).toContain("- 'visual-qa/**'");
    expect(workflow).toContain('npm run qa:frontend');
    expect(workflow).toContain('git add visual-qa');
    expect(workflow).toContain('git push origin "HEAD:${GITHUB_REF_NAME}"');
    expect(ci).toContain('visual-qa/**/*.png');
    expect(ci).toContain('visual-qa/**/*.json');
  });

  it('blocks QA-only crash instrumentation from visual captures',()=>{
    expect(capture).toContain("document.querySelector('[data-qa-crash]')");
    expect(capture).toContain('QA-only crash control is visible in visual capture');
    expect(docs).toContain('must also be opened and visually inspected');
  });
});
