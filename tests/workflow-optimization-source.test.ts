import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const ci=read('.github/workflows/ci.yml');
const codeql=read('.github/workflows/codeql.yml');
const cross=read('.github/workflows/cross-engine-smoke.yml');
const performance=read('.github/workflows/performance-smoke.yml');
const windows=read('.github/workflows/desktop-windows.yml');
const firstRun=read('.github/workflows/desktop-first-run.yml');
const cleanLaunch=read('.github/workflows/desktop-clean-launch.yml');
const production=read('.github/workflows/production-smoke.yml');
const desktopPackage=JSON.parse(read('desktop/package.json')) as {scripts:Record<string,string>};
const agents=read('AGENTS.md');
const projectRules=read('PROJECT_RULES.md');

describe('CI workflow optimization contracts',()=>{
  it('keeps core CI and CodeQL cancellable while deferring rendered QA until review-ready',()=>{
    expect(ci).toContain('cancel-in-progress: true');
    expect(codeql).toContain('cancel-in-progress: true');
    expect(ci).toContain('types: [opened, synchronize, reopened, ready_for_review]');
    expect(ci).toContain("if: github.event_name != 'pull_request' || github.event.pull_request.draft == false");
    expect(codeql).toContain('pull_request:');
  });

  it('cancels superseded performance runs and scopes expensive browser gates to relevant paths',()=>{
    expect(performance).toContain('branches: [main, develop]');
    expect(performance).toContain('group: performance-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}');
    expect(performance).toContain('cancel-in-progress: true');
    expect(performance).toContain("if: github.event_name != 'pull_request' || github.event.pull_request.draft == false");
    expect(performance).toContain("- 'scripts/performance-audit.mjs'");
    expect(performance).not.toContain('paths-ignore:');
    expect(cross).toContain('types: [opened, synchronize, reopened, ready_for_review]');
    expect(cross).toContain("if: github.event_name != 'pull_request' || github.event.pull_request.draft == false");
    expect(cross).toContain("- 'scripts/webkit-smoke.mjs'");
    expect(cross).not.toContain('paths-ignore:');
  });

  it('keeps Windows lifecycle gates review-ready, owns dependency audit once, and avoids duplicate root builds',()=>{
    for(const workflow of [windows,firstRun,cleanLaunch]){
      expect(workflow).toContain('types: [opened, synchronize, reopened, ready_for_review]');
      expect(workflow).toContain("if: github.event_name != 'pull_request' || github.event.pull_request.draft == false");
      expect(workflow).not.toMatch(/^\s*npm run check\s*$/m);
    }
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
