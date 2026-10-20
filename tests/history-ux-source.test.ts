import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
describe('durable Do/Undo/Redo UI and reload safety',()=>{
 it('shows real snapshot position, count and actionable guidance without duplicate save toast',()=>{
  const shell=read('src/components/AppShell.tsx');
  const dialog=read('src/components/HistoryDialog.tsx');
  expect(shell).toContain("const HistoryDialog=lazy(()=>import('./HistoryDialog'))");
  expect(dialog).toContain('classifyHistoryPoints(history.slice(0,100))');
  expect(dialog).toContain('historyAvailabilityMessage({state:saveState,pending:savePending,available:historyAvailable,undoDepth,redoDepth})');
  expect(dialog).toContain('data-history-state={entry.position}');
  expect(dialog).toContain('data-history-selectable={selectable');
  expect(dialog).toContain('className="history-row-choice"');
  expect(dialog).toContain('history-jump-confirm');
  expect(dialog).toContain('Κάθε βήμα αποθηκεύεται χωριστά');
  expect(shell).toContain('onNavigate={onNavigateHistory}');
  expect(read('src/hooks/useFinance.ts')).toContain('const goToHistoryPoint=useCallback(');
  expect(dialog).toContain('Η εισαγωγή αρχείου δεν αναιρείται μέσω Undo/Redo');
  expect(dialog).not.toContain('Η εισαγωγή αρχείου παραμένει ξεχωριστή λειτουργία και δεν εντάσσεται αυτόματα');
  expect(shell).toContain("disabled={saveState==='loading'||saveState==='saving'||savePending}");
  const css=read('src/styles/durable-history-controls.css');
  expect(css).toContain('.history-actions button{min-height:44px}');
 });
 it('shows usable import instructions, validated shape and explicit irreversible boundary',()=>{
  const page=read('src/pages/SettingsPage.tsx');
  const css=read('src/pages/SettingsData.css');
  for(const x of ['Οδηγίες χρήσης και δομή αρχείου JSON','Πώς γίνεται η εισαγωγή','Δομή JSON MyFinHub','<code>schemaVersion</code>','<code>seed</code>','<code>state</code>','δεν συγχωνεύει','δεν περιλαμβάνεται στο JSON backup'])expect(page).toContain(x);
  expect(page).toContain('χειροποίητο JSON με μόνο αυτά τα πεδία δεν αρκεί');
  expect(css).toContain('.settings-import-guide-fields');
  expect(css).toContain('.settings-import-guide>summary:focus-visible');
 });
 it('blocks refresh while a queued/optimistic save is in flight',()=>{
  const finance=read('src/hooks/useFinance.ts');
  expect(finance).toContain("if(coordinator.hasWork()||exclusiveOperation.current||saveStateRef.current==='saving')return false");
  expect(finance).toContain('const requestId=++reloadRequestRef.current');
  expect(finance).toContain('if(!isCurrent())return false;');
  expect(finance).toContain('mutationEpochRef.current+=1;');
  expect(finance).toContain('canApplyFinanceReload(');
  expect(finance).toContain('parentId:point.parentId');
  expect(read('src/App.tsx')).toContain('undoDepth={finance.undoDepth} redoDepth={finance.redoDepth}');
  const qa=read('src/qa.tsx'),browser=read('scripts/save-progress-qa.mjs');
  expect(qa).toContain('__myfinhubQaHoldNextRead');
  expect(qa).toContain('__myfinhubQaReleaseRead');
  expect(qa).toContain("Synthetic stale finance GET failure");
  expect(browser).toContain('obsolete database GET error cannot replace a confirmed import');
  expect(qa).toContain("if(url.pathname==='/api/import'&&init?.method==='POST')");
  expect(browser).toContain('old database GET cannot overwrite a newer successful import');
 });
});
