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
    const css=read('src/styles/durable-history-controls.css');
    expect(css).toContain('grid-template-rows:auto auto auto minmax(0,1fr) auto');
    expect(css).toContain('.command-palette.change-history-dialog>header p{display:block}');
    expect(css).toContain('.command-palette.change-history-dialog>footer span:first-child{display:flex}');
    expect(browser).toContain('state.introVisible&&state.caveatVisible');
    expect(browser).toContain('history-dialog-');
  });
  it('checks expanded import instructions/schema and privacy warnings in rendered desktop/mobile states',()=>{
    const browser=read('scripts/history-dialog-qa.mjs');
    expect(browser).toContain("guideUrl.searchParams.set('page','settings')");
    expect(browser).toContain("summary.click();summary.scrollIntoView");
    expect(browser).toContain('settings-import-guide-375-dark-warning');
    expect(browser).toContain('settings-import-guide-'+ 'width');
    expect(browser).toContain('guide.summaryHeight>=44');
    expect(browser).toContain('guide.pageOverflow');
  });
  it('tests real-hook cursor receipts, redo invalidation and rejected history on the QA-only database',()=>{
    const qa=read('src/qa.tsx');
    const browser=read('scripts/save-progress-qa.mjs');
    expect(qa).toContain("const QA_HISTORY_HOOK_PROBE=");
    expect(qa).toContain("if(QA_HISTORY_HOOK_PROBE&&url.pathname==='/api/history'&&init?.method==='POST')");
    expect(qa).toContain('snapshots.splice(cursorIndex+1)');
    expect(qa).toContain("headers.get('x-rheomiq-history-generation')===String(revision)");
    expect(qa).toContain('data-persistence-undo');
    expect(qa).toContain('data-persistence-redo');
    expect(browser).toContain('server-backed Undo restores prior synthetic budget');
    expect(browser).toContain('new confirmed write invalidates old Redo branch');
    expect(browser).toContain('rejected history cursor enters conflict');
    expect(browser).toContain('history-real-hook-undo-redo-branch-1440-dark');
    expect(browser).toContain('history-real-hook-undo-conflict-1440-dark');
  });
});
