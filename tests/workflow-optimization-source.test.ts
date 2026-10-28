import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const ci=read('.github/workflows/ci.yml');
const codeql=read('.github/workflows/codeql.yml');
const cross=read('.github/workflows/cross-engine-smoke.yml');
const performance=read('.github/workflows/performance-smoke.yml');
const windows=read('.github/workflows/desktop-windows.yml');
const firstRun=read('.github/workflows/desktop-first-run.yml');
const release=read('.github/workflows/desktop-publish-release.yml');
const cleanLaunch=read('.github/workflows/desktop-clean-launch.yml');
const production=read('.github/workflows/production-smoke.yml');
const desktopPackage=JSON.parse(read('desktop/package.json')) as {scripts:Record<string,string>};
const agents=read('AGENTS.md');
const projectRules=read('PROJECT_RULES.md');

describe('CI workflow optimization contracts',()=>{
  it('has one cancellable PR/develop CI entrypoint with a fail-closed aggregator',()=>{
    expect(ci).toContain('cancel-in-progress: true');
    expect(ci).toContain('types: [opened, synchronize, reopened, ready_for_review, labeled, unlabeled]');
    expect(ci).toContain("if: github.event_name != 'pull_request' || github.event.pull_request.draft == false");
    expect(ci).toContain('  gate:');
    expect(ci).toContain('if: always()');
    expect(ci).toContain('require_success validate "$VALIDATE"');
    expect(ci).toContain('require_success codeql "$CODEQL"');
    expect(ci).toContain('require_success windows "$WINDOWS"');
    expect(ci).toContain('require_success webkit "$WEBKIT"');
    expect(ci).toContain('require_success performance "$PERFORMANCE"');
    expect(ci).toContain('require_success windows-first-run "$FIRST_RUN"');
    expect(ci).toContain('require_success windows-clean-launch "$CLEAN_LAUNCH"');
    expect(ci).toContain('require_success final-visual "$FINAL_VISUAL"');
    expect(ci).toContain('if [ "$failures" -gt 0 ]; then exit 1; fi');
  });

  it('uses original pinned CodeQL and browser jobs as reusable, without duplicate PR/push triggers',()=>{
    expect(ci).toContain('uses: ./.github/workflows/codeql.yml');
    expect(ci).toContain('uses: ./.github/workflows/cross-engine-smoke.yml');
    expect(ci).toContain('uses: ./.github/workflows/performance-smoke.yml');
    expect(codeql).toContain('workflow_call:');
    expect(codeql).toContain("cron: '17 4 * * 1'");
    expect(codeql).toContain('security-events: write');
    expect(codeql).toContain('  pull_request:');
    expect(codeql).toContain('    branches: [main, develop]');
    for(const reusable of [cross,performance]){
      expect(reusable).toContain('workflow_call:');
      expect(reusable).not.toContain('  pull_request:');
      expect(reusable).not.toContain('    branches: [main, develop]');
    }
    // Official pinned Playwright image includes WebKit OS deps and executable:
    // never depend on a timeout-prone apt mirror or skip the actual smoke.
    expect(cross).toContain('runs-on: ubuntu-24.04');
    expect(cross).toContain('mcr.microsoft.com/playwright:v1.62.1-noble@sha256:');
    expect(cross).toContain('timeout-minutes: 20');
    // GitHub container steps default to /bin/sh; the smoke includes pipefail
    // and brace-expansion and must use the same Bash semantics as runner jobs.
    expect(cross).toContain('shell: bash');
    expect(cross).not.toContain('install --with-deps webkit');
    expect(cross).toContain('webkit.executablePath()');
    expect(cross).toContain('playwright@1.62.1');
    expect(cross).toContain('scripts/webkit-smoke.mjs');
    expect(performance).toContain('lighthouse@13.4.1');
    expect(performance).toContain('node scripts/performance-audit.mjs');
    expect(performance).toContain('node scripts/loading-shift-audit.mjs');
  });

  it('preserves Windows release tag safety and every original lifecycle test in reusable jobs',()=>{
    for(const reusable of [windows,firstRun,cleanLaunch]){
      expect(reusable).toContain('workflow_call:');
      expect(reusable).not.toContain('  pull_request:');
      expect(reusable).not.toMatch(/^\s*npm run check\s*$/m);
    }
    expect(ci).toContain('uses: ./.github/workflows/desktop-windows.yml');
    expect(ci).toContain('uses: ./.github/workflows/desktop-first-run.yml');
    expect(ci).toContain('uses: ./.github/workflows/desktop-clean-launch.yml');
    expect(release).toContain("tags: ['myfinhub-v*']");
    expect(release).toContain("startsWith(github.ref, 'refs/tags/myfinhub-v')");
    expect(release).toContain('git merge-base --is-ancestor $env:GITHUB_SHA origin/main');
    expect(release).toContain('uses: ./.github/workflows/desktop-windows.yml');
    expect(release).toContain('contents: write');
    expect(windows).not.toContain('contents: write');
    expect(windows).toMatch(/^\s*npm run desktop:check\s*$/m);
    expect(firstRun).toMatch(/^\s*npm run desktop:check:source\s*$/m);
    expect(cleanLaunch).toContain('run: npm run desktop:check:source');
    expect(firstRun).not.toMatch(/^\s*npm run desktop:check\s*$/m);
    expect(cleanLaunch).not.toMatch(/^\s*run: npm run desktop:check\s*$/m);
    expect(desktopPackage.scripts.check).toBe('npm run audit && npm run check:source');
    expect(windows).toContain('run: npm run build');
    expect(windows).toContain('run: npm run desktop:pack:from-dist');
    expect(windows).toContain('run: npm run desktop:dist:from-dist');
    expect(windows).not.toMatch(/^\s*run: npm run desktop:pack\s*$/m);
    expect(windows).not.toMatch(/^\s*run: npm run desktop:dist\s*$/m);
  });

  it('targets the canonical production origin and preserves deployment-status gating',()=>{
    expect(production).toContain('BASE_URL: https://mgfinhub.vercel.app');
    expect(production).not.toContain('rheom-iq-vert.vercel.app');
    expect(production).toContain("github.event.deployment_status.environment == 'Production'");
    expect(production).toContain("github.event.deployment_status.creator.login == 'vercel[bot]'");
  });

  it('uses one execution contract and one progress-counter vocabulary',()=>{
    expect(agents).toContain('canonical version-controlled repository execution contract');
    expect(agents).toContain('Implementations x/y · Sub-implementations x/y');
    expect(agents).not.toContain('Tasks x/y · Subtasks x/y');
    expect(projectRules).toContain('AGENTS.md');
    expect(projectRules).toContain('durable owner/product decisions');
    expect(projectRules).not.toContain('canonical mutable source of truth');
  });
});
