import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(name:string)=>readFileSync(name,'utf8');
describe('account management search identity to canonical settings (DV-FB02/03)',()=>{
 const index=read('src/lib/commandSearch.ts'),app=read('src/App.tsx'),qa=read('src/qa.tsx');
 const settings=read('src/pages/SettingsPage.tsx'),accounts=read('src/components/AccountManagementSettings.tsx');
 const browser=read('scripts/command-palette-qa.mjs');
 it('keeps the existing account Quick Entry separate from exact management result',()=>{
   expect(index).toContain("action:{type:'account_focus',accountId:account.id}");
   expect(index).toContain("action:{type:'quick_add',kind:'expense',accountId:account.id}");
 });
 it('routes the stable identity to the owned Settings tab without data mutation',()=>{
   expect(app).toContain("navigateSettingsTab('accounts');return");
   expect(qa).toContain("setSettingsTab('accounts');setPage('settings');return");
   expect(settings).toContain('focusAccountId={accountFocusId}');
   expect(accounts).toContain('data-account-id={account.id}');
   expect(accounts).toContain("row?.focus({preventScroll:true})");
   expect(accounts).toContain('return()=>cancelAnimationFrame(frame)');
 });
 it('requires a browser proof for two exact accounts and no unintended Quick Entry',()=>{
   expect(browser).toContain("document.activeElement?.dataset.accountId==='piraeus-payroll'");
   expect(browser).toContain("document.activeElement?.dataset.accountId==='piraeus-savings'");
   expect(browser).toContain('command-exact-account-same-route');
   expect(browser).toContain('repeated account selection does not launch an editor');
 });
});
