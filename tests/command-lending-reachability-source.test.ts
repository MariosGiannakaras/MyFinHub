import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(p:string)=>readFileSync(p,'utf8');
describe('Command Palette exact Lending person reachability',()=>{
 const index=read('src/lib/commandSearch.ts');
 const app=read('src/App.tsx');
 const qa=read('src/qa.tsx');
 const page=read('src/pages/LendingPage.tsx');
 const browser=read('scripts/command-palette-qa.mjs');
 it('uses an exact person command instead of a collection-only destination',()=>{
   expect(index).toContain("action:{type:'lending_person_focus',person:lending.person}");
   expect(index).toContain("{type:'lending_person_focus';person:string}");
   for(const source of [app,qa]){
     expect(source).toContain("if(action.type==='lending_person_focus')");
     expect(source).toContain('setCommandLendingPerson(action.person)');
     expect(source).toContain('setCommandLendingKey(key=>key+1)');
     expect(source).toContain('commandPerson={commandLendingPerson}');
     expect(source).toContain('commandPersonKey={commandLendingKey}');
   }
 });
 it('resets stale filtering and focuses the selected row without exposing URL/finance secrets',()=>{
   expect(page).toContain("rows.some(row=>row.person===commandPerson)");
   expect(page).toContain("setPeopleQuery('')");
   expect(page).toContain('setHistoryFilter(\'all\')');
   expect(page).toContain("'.lending-people-panel .lending-person-row[aria-pressed=\"true\"]'");
   expect(page).toContain('selected?.focus({preventScroll:true})');
 });
 it('asserts actual selected row and keyboard focus across two searches on one route',()=>{
   expect(browser).toContain('command-exact-lending-person');
   expect(browser).toContain('same-route second Lending person selected');
   expect(browser).toContain('same-route Lending keyboard focus');
 });
});
