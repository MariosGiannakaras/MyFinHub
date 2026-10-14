import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const search=readFileSync('src/lib/commandSearch.ts','utf8');
const cards=readFileSync('src/pages/CardsPage.tsx','utf8');
const interactive=readFileSync('src/components/InteractivePaymentCard.tsx','utf8');
const qa=readFileSync('src/qa.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');
const browser=readFileSync('scripts/command-palette-qa.mjs','utf8');
describe('debit/prepaid exact Command Palette identity',()=>{
 it('keeps vault secrets out of the navigation action and indexes an exact card ID',()=>{
   expect(search).toContain("{type:'debit_card_focus',cardId:card.id}");
   expect(search).toContain("card.kind==='credit'?");
   expect(app).toContain("action.type==='debit_card_focus'");
   expect(qa).toContain("action.type==='debit_card_focus'");
   expect(interactive).toContain('data-command-card-id={card.id} tabIndex={-1}');
 });
 it('focuses a matching existing active card without creating financial mutations',()=>{
   expect(cards).toContain('activeCards.some(card=>card.id===commandCardId)');
   expect(cards).toContain('target.focus({preventScroll:true})');
   expect(browser).toContain('command-exact-prepaid-card');
   expect(browser).toContain('command-exact-debit-card-same-route');
   expect(browser).toContain('second exact debit card focused');
 });
});
