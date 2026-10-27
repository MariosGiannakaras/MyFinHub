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
  it('waits for Framer-scaled dialog entrance before strict cross-breakpoint Quick Entry geometry',()=>{
    const reference=load('scripts/quick-entry-reference-qa.mjs');
    const workflow=load('.github/workflows/motion-focused-rendered-qa.yml');
    expect(reference).toContain("'Quick Entry Framer modal entrance settles'");
    expect(reference).toContain("Math.abs(r.width-modal.offsetWidth)<=1");
    expect(reference).toContain("Number(s.opacity)>=.995");
    expect(reference).toContain("await openQuick()");
    expect(reference).toContain("approx(desktop.modal.width,1020,2)");
    expect(reference).toContain("mobile.modal.width>=359&&mobile.modal.width<=362");
    expect(workflow).toContain("scripts/quick-entry-reference-qa.mjs");
  });
  it('waits for genuinely visible and unscaled Quick Entry before strict dialog geometry audit',()=>{
    const suite=load('scripts/completion-dialog-geometry-qa.mjs');
    expect(suite).toContain('${label} visible and entrance settled');
    expect(suite).toContain("selector==='.quick-modal'");
    expect(suite).toContain('Number(style.opacity)>=.995');
    expect(suite).toContain('Math.abs(rect.width-node.offsetWidth)<=1');
    expect(suite).toContain('Math.abs(rect.height-node.offsetHeight)<=1');
    expect(suite).toContain("await inspect('.quick-modal',`${viewport.name} Quick Entry`)");
    expect(suite).toContain("assert(result.left>=-1&&result.right<=result.viewportWidth+1");
    expect(suite).toContain("assert(result.unnamedControls.length===0");
    expect(suite).toContain("assert(result.scrollWidth<=result.clientWidth+1");
    expect(suite).toContain("{name:'virtual-keyboard',width:375,height:500}");
  });
  it('atomically records transient page skeleton route and overflow before refresh resolves',()=>{
    expect(rendered).toContain("const key='__MYFINHUB_MOTION_SKELETON_QA__'");
    expect(rendered).toContain('const observer=new MutationObserver(sample)');
    expect(rendered).toContain("record.snapshot={page:skeleton.dataset.skeletonPage||'',overflow:");
    expect(rendered).toContain("assert(transition.page===page");
    expect(rendered).toContain("assert(transition.overflow<=1");
    expect(rendered).toContain("observer?.disconnect?.()");
    expect(rendered).not.toContain("document.querySelector('.qa-loading-route .page-skeleton')?.dataset.skeletonPage||''");
    expect(rendered).toContain("assert(cls<=0.10");
    expect(rendered).toContain("['first',0],['mid',90],['settled',600]");
    expect(rendered).toContain("value:'reduce'");
  });
  it('waits for animated action cards to become visible before CRUD interaction',()=>{
    const functional=load('scripts/completion-functional-crud-qa.mjs');
    expect(functional).toContain("'visible Savings transfer action'");
    expect(functional).toContain("Number(style.opacity)>=.99");
    expect(functional).toContain("await clickText('.savings-action','Μεταφορά στην άκρη')");
    expect(functional).toContain("'manual savings contextual transfer editor'");
    expect(functional).toContain("const entered=");
    expect(functional).toContain("'.row-context-button','hide the selected modern event details'");
    expect(functional).toContain("'.row-context-button','reopen the selected modern event details'");
    expect(functional).toContain("'selected modern event details close and expose collapsed ARIA state'");
    expect(functional).toContain("'.transactions-detail-actions button','Επεξεργασία'");
    expect(functional).toContain("'filtered modern event detail panel is genuinely expanded'");
    expect(functional).toContain("'exactly one settled modern event in the primary ledger'");
    expect(functional).toContain("'.transactions-approved-table tbody [data-transaction-source=\"event\"]'");
    expect(functional).toContain("'.transactions-detail-actions button','Διαγραφή'");
    expect(functional).not.toContain("const modernCopies=");
    expect(functional).toContain("const clickVisibleRowAction=async(");
    expect(functional).toContain("parent.matches?.('[data-content-entrance] > *')");
    const guardedActions=functional.split('\n').filter(line=>line.includes('await clickVisibleRowAction('));
    for(const caseLabel of [
      'hide the selected modern event details',
      'reopen the selected modern event details',
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
