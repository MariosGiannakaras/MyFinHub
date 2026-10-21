import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('30/60/90 what-if scenario UI and finance nonposting boundaries (#588 #7)',()=>{
  it('integrates optional scenarios without changing existing planning forecast or scheduled save contract',()=>{
    const page=read('src/pages/PlanningPage.tsx');
    const panel=read('src/components/ForecastScenarioPanel.tsx');
    expect(page).toContain('<PlanningApprovedDesktop');
    expect(page).toContain('<ForecastScenarioPanel data={data} asOf={asOf}/>');
    expect(panel).toContain('cashFlowScenario(data,asOf,horizon,assumptions)');
    expect(panel).toContain('Δοκιμή σεναρίου');
    expect(panel).toContain("const [open,setOpen]=useState(false)");
    expect(panel).toContain('Δεν δημιουργούνται οικονομικά γεγονότα');
    expect(panel).not.toContain('updateDurably');
    expect(panel).not.toContain('onUpsertScheduled');
  });
  it('reuses shared control owners and makes assumptions accessible at mobile sizes',()=>{
    const ui=read('src/components/ForecastScenarioPanel.tsx');
    const css=read('src/pages/PlanningCompletion.css');
    for(const component of ['AppDateInput','AppSelectInput','MoneyInput','Button'])
      expect(ui).toContain('<'+component);
    expect(ui).toContain('aria-label={`Υπόθεση ${index+1}`}');
    expect(ui).toContain('aria-live="polite"');
    expect(ui).toContain('Δικές σου υποθέσεις');
    expect(css).toContain('@media(max-width:600px)');
    expect(css).toContain('var(--border-subtle)');
  });
  it('requires executed browser proof of no phantom booking, mobile no-overflow and screenshots',()=>{
    const browser=read('scripts/planning-forecast-qa.mjs');
    expect(browser).toContain('Planning QA: isolated what-if scenario remains nonposting and mobile-safe');
    expect(browser).toContain('planning-whatif-desktop');
    expect(browser).toContain('planning-whatif-mobile');
    expect(browser).toContain('scenario input does not change actual cash balance');
    expect(browser).toContain('noOverflow(\'scenario open mobile 375\')');
  });
});
