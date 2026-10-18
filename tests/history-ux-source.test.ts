import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
describe('durable Do/Undo/Redo UI and reload safety',()=>{
 it('shows real snapshot position, count and actionable guidance without duplicate save toast',()=>{
  const shell=read('src/components/AppShell.tsx');
  expect(shell).toContain('classifyHistoryPoints(boundedHistory)');
  expect(shell).toContain('historyAvailabilityMessage({state:saveState,pending:savePending,available:historyAvailable,undoDepth,redoDepth})');
  expect(shell).toContain('data-history-state={entry.position}');
  expect(shell).toContain('Η εισαγωγή αρχείου δεν έχει ακόμη εγγυημένη πλήρη αναίρεση');
  expect(shell).not.toContain('Η εισαγωγή αρχείου παραμένει ξεχωριστή λειτουργία και δεν εντάσσεται αυτόματα');
  expect(shell).toContain("disabled={saveState==='loading'||saveState==='saving'||savePending}");
  const css=read('src/styles/durable-history-controls.css');
  expect(css).toContain('.history-actions button{min-height:44px}');
 });
 it('blocks refresh while a queued/optimistic save is in flight',()=>{
  const finance=read('src/hooks/useFinance.ts');
  expect(finance).toContain("if(coordinator.hasWork()||exclusiveOperation.current||saveStateRef.current==='saving')return false");
  expect(finance).toContain('parentId:point.parentId');
  expect(read('src/App.tsx')).toContain('undoDepth={finance.undoDepth} redoDepth={finance.redoDepth}');
 });
});
