import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const load=(path:string)=>readFileSync(path,'utf8');
const css=load('src/styles/content-entrance-motion.css');
const baseMotion=load('src/styles/interaction-motion-states.css');
const runner=load('scripts/run-rendered-qa.mjs');
const rendered=load('scripts/content-entrance-qa.mjs');
const routes=['Dashboard','Transactions','Savings','Cards','CreditCard','Loans','Lending','Recurring','Planning','Attention','Reports'];
describe('bounded shared collection motion contract DV-M01–M06',()=>{
  it('uses one opt-in owner across populated routes instead of wrapper-heavy page-local variants',()=>{
    for(const name of routes)expect(load(`src/pages/${name}Page.tsx`)).toContain('data-content-entrance=');
    expect(load('src/pages/SettingsPage.tsx')).not.toContain('data-content-entrance=');
    expect(load('src/styles/root-compat.css')).toContain("@import './content-entrance-motion.css'");
    expect(css).toContain('[data-content-entrance="grid"] > *');
    expect(css).toContain('[data-content-entrance="list"] > *');
    expect(css).toContain('table[data-content-entrance="table"] tbody > tr');
  });
  it('does not move finance table layout or delay populated content under reduced motion',()=>{
    expect(css).toContain('animation:rh-backdrop-in');
    expect(baseMotion).toContain('@keyframes rh-bank-in{from{opacity:0;transform:translateY(7px)}');
    expect(baseMotion).toContain('@keyframes rh-backdrop-in{from{opacity:0}');
    expect(baseMotion).toContain('from{opacity:0}');
    expect(css).not.toMatch(/height:\s*0|width:\s*0|display:\s*none/);
    expect(css).toContain('nth-child(n+3)');
    expect(css).toContain('animation-delay:90ms');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('animation:none!important');
    expect(css).not.toContain('transition:all');
    expect(css).not.toContain('filter:blur');
  });
  it('runs focused motion evidence on the CI primary Chromium with actionable startup diagnostics',()=>{
    const workflow=load('.github/workflows/motion-focused-rendered-qa.yml');
    expect(workflow).toContain('MYFINHUB_QA_PRIMARY_BROWSER=$PRIMARY_BROWSER');
    expect(workflow).toContain('scripts/content-entrance-qa.mjs');
    expect(rendered).toContain('process.env.MYFINHUB_QA_PRIMARY_BROWSER');
    expect(rendered).toContain('Browser bootstrap exited before CDP was ready');
    expect(rendered).toContain('browserDiagnostics');
  });
  it('waits for animated action cards to become visible before CRUD interaction',()=>{
    const functional=load('scripts/completion-functional-crud-qa.mjs');
    expect(functional).toContain("'visible Savings transfer action'");
    expect(functional).toContain("Number(style.opacity)>=.99");
    expect(functional).toContain("await clickText('.savings-action','Μεταφορά στην άκρη')");
    expect(functional).toContain("'manual savings contextual transfer editor'");
    expect(functional).toContain("const entered=");
    expect(functional).toContain("'.row-context-button','filtered modern event details access'");
    expect(functional).toContain("'.transactions-detail-actions button','Επεξεργασία'");
    expect(functional).toContain("'filtered modern event detail panel'");
    expect(functional).toContain("const clickVisibleRowAction=async(");
    expect(functional).toContain("parent.matches?.('[data-content-entrance] > *')");
    const guardedActions=functional.split('\n').filter(line=>line.includes('await clickVisibleRowAction('));
    for(const caseLabel of [
      'filtered modern event details access',
      'saved loan exposes edit',
      'self-loan exposes return action',
      'self-loan exposes forgiveness',
      'saved recurring item exposes edit',
      'recurring item can be paused',
      'paused recurring item can be reactivated',
      'reactivated recurring item can be stopped',
      'lifecycle card exposes archive action',
    ]) expect(guardedActions.some(line=>line.includes(caseLabel))).toBe(true);
  });
    it('retains route-shaped skeletons, explicit normal/reduced tests, midframe captures and CLS limits',()=>{
    expect(load('src/App.tsx')).toContain("<Suspense fallback={<PageLoading/>}>");
    expect(load('src/qa.tsx')).toContain('<PageSkeleton/>');
    expect(runner).toContain('scripts/content-entrance-qa.mjs');
    expect(rendered).toContain("for(const theme of ['light','dark'])");
    expect(rendered).toContain("mod.applyThemePreference('${theme}')");
    expect(rendered).toContain("mod.themeTokens('${theme}')['--canvas']");
    expect(rendered).toContain('appliedTheme.theme===theme&&appliedTheme.canvas===appliedTheme.expectedCanvas');
    expect(rendered).not.toContain("document.documentElement.dataset.theme='${theme}'");
    expect(rendered).toContain("['first',0],['mid',90],['settled',600]");
    expect(rendered).toContain("value:'reduce'");
    expect(rendered).toContain('cls<=0.10');
    expect(rendered).toContain("const pages=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings']");
  });
});
