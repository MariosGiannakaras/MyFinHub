import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('history focused rendered regression ownership',()=>{
  it('has an opt-in Draft-only browser job with diagnostic artifacts, no full Ready matrix',()=>{
    const workflow=read('.github/workflows/history-focused-rendered-qa.yml');
    expect(workflow).toContain('<!-- run-history-focused-qa -->');
    expect(workflow).toContain("github.event.pull_request.draft == true");
    expect(workflow).toContain('scripts/history-dialog-qa.mjs');
    expect(workflow).toContain('scripts/save-progress-qa.mjs');
    expect(workflow).toContain('history-focused/screenshots/*.png');
  });
  it('covers viewport/theme matrix and actual snapshot cursor through the shared HistoryDialog',()=>{
    const qa=read('src/qa.tsx');
    const browser=read('scripts/history-dialog-qa.mjs');
    expect(qa).toContain("historyCursorFixture=params.get('state')==='history-cursor'");
    expect(qa).toContain("id:'qa-redo-point',parentId:'qa-current-point'");
    expect(qa).toContain('undoDepth={undoStack.length} redoDepth={redoStack.length}');
    expect(browser).toContain("['error','conflict']");
    expect(browser).not.toContain('scripts/history-dialog-qa.mjs');
    expect(browser).toContain("height>=44");
    expect(browser).toContain("Escape");
    expect(browser).toContain('b?.focus({preventScroll:true})');
    expect(browser).toContain('History backdrop and modal entrance settled');
    expect(browser).toContain('state.opacity>=0.99&&state.backdropOpacity>=0.99');
    expect(browser).toContain('history-dialog-');
  });
});
