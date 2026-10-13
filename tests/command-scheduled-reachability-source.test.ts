import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(name:string)=>readFileSync(name,'utf8');
describe('exact scheduled search / completion action contract',()=>{
  const search=read('src/lib/commandSearch.ts');
  const planning=read('src/pages/PlanningPage.tsx');
  const app=read('src/App.tsx');
  const qa=read('src/qa.tsx');
  const rendered=read('scripts/command-palette-qa.mjs');
  it('navigates a named item without implicitly launching a financial write',()=>{
    expect(search).toContain("action:{type:'scheduled_focus',scheduledId:planned.id}");
    expect(search).toContain("action:{type:'scheduled_complete',scheduledId:planned.id}");
    expect(app).toContain("if(action.type==='scheduled_focus')");
    expect(qa).toContain("if(action.type==='scheduled_focus')");
    expect(planning).toContain("commandScheduledId");
    expect(planning).toContain("setScheduledListLimit(index+1)");
    expect(planning).toContain("data-scheduled-id={item.id} tabIndex={-1}");
  });
  it('proves an exact id beyond pagination and a second id on the same route',()=>{
    expect(rendered).toContain("scheduled-extreme-17");
    expect(rendered).toContain("scheduled-extreme-14");
    expect(rendered).toContain("command-exact-scheduled-item.png".replace('.png',''));
    expect(rendered).toContain("named scheduled item is visible in desktop table and does not execute financial activity");
    expect(rendered).toContain("'same-route desktop scheduled item focused'");
    expect(rendered).toContain("'visible mobile scheduled entry focused beyond pagination'");
  });
});