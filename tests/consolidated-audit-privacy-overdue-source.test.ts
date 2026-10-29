import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const dashboard=read('src/pages/DashboardPage.tsx');
const attention=read('src/pages/AttentionPage.tsx');
const recurring=read('src/pages/RecurringPage.tsx');
const domain=read('src/lib/attention.ts');
const app=read('src/App.tsx');
const qa=read('src/qa.tsx');
describe('consolidated visual and finance privacy regressions (#646)',()=>{
 it('keeps all attention privacy toggles in the shared nonpersisted app/QA session',()=>{
  for(const source of [app,qa]){
   const begin=source.indexOf('<AttentionPage');expect(begin).toBeGreaterThan(-1);
   const tag=source.slice(begin,source.indexOf('/>',begin));
   expect(tag).toContain('privacyVisible={privacyVisible}');
   expect(tag).toContain('onPrivacyVisibleChange={setPrivacyVisible}');
  }
  expect(attention).toContain('const visible=privacyVisible');
  expect(attention).not.toContain('const [visible,setVisible]=useState(false)');
 });
 it('never describes urgent attention as an all-clear status',()=>{
  expect(attention).toContain("counts.danger?'Εκκρεμούν επείγοντα θέματα'");
  expect(attention).toContain('counts.danger?<AlertTriangle/>:activeActionable?<CircleAlert/>:<CheckCircle2/>');
 });
 it('masks the Dashboard amount fields without hiding underlying canonical finance events',()=>{
  expect(dashboard).toContain("privacyVisible?movementAmountLabel(item):'•••••• €'");
  expect(dashboard).toContain('privacyMoney(flow.income)');
  expect(dashboard).toContain('privacyMoney(flow.expense)');
  expect(dashboard).toContain('privacyMoney(category.value)');
  expect(dashboard).toContain('privacyMoney(averageDailyExpense)');
  expect(dashboard).toContain("privacyVisible?signedMoney(savingAmount):'•••••• €'");
  expect(dashboard).toContain('!privacyVisible?<span className="dashboard-private-chart-placeholder"');
  expect(dashboard).toContain('approved-bar-wrap" aria-hidden="true"');
  expect(dashboard).toContain('privacyVisible?(heavyChartsReady?<Suspense fallback={null}><DashboardSummaryChart');
  expect(dashboard).toContain('privacyVisible?(heavyChartsReady?<Suspense fallback={null}><DashboardCategoryChart');
  expect(dashboard).toContain('colors={chartColors}/></Suspense>:null):null}');
  expect(dashboard).toContain("privacyVisible?(flow.expense?safePercent(category.value/flow.expense*100):0):'•••'");
 });
 it('shares Attention overdue truth with Recurring but leaves forecast scheduler unmodified',()=>{
  expect(domain).toContain('export function recurringDue(data:FinanceData,item:RecurringItem,asOf:string)');
  expect(recurring).toContain("import { recurringDue } from '../lib/attention'");
  expect(recurring.match(/className="recurring-overdue"/g)).toHaveLength(2);
  expect(recurring).toContain('Ληξιπρόθεσμο από {shortDate(due.date)}');
 });
});
