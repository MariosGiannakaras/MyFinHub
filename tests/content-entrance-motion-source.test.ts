import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const load=(path:string)=>readFileSync(path,'utf8');
const css=load('src/styles/content-entrance-motion.css');
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
    expect(css).toContain('animation:myfinhub-content-table-enter');
    expect(css).toContain('from{opacity:0}');
    expect(css).not.toMatch(/height:\s*0|width:\s*0|display:\s*none/);
    expect(css).toContain('nth-child(n+6)');
    expect(css).toContain('--content-entrance-delay:110ms');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
    expect(css).toContain('animation:none!important');
    expect(css).not.toContain('transition:all');
    expect(css).not.toContain('filter:blur');
  });
  it('retains route-shaped skeletons, explicit normal/reduced tests, midframe captures and CLS limits',()=>{
    expect(load('src/App.tsx')).toContain("<Suspense fallback={<PageLoading/>}>");
    expect(load('src/qa.tsx')).toContain('<PageSkeleton/>');
    expect(runner).toContain('scripts/content-entrance-qa.mjs');
    expect(rendered).toContain("for(const theme of ['light','dark'])");
    expect(rendered).toContain("['first',0],['mid',90],['settled',600]");
    expect(rendered).toContain("value:'reduce'");
    expect(rendered).toContain('cls<=0.10');
    expect(rendered).toContain("const pages=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings']");
  });
});
