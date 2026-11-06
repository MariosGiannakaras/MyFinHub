import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {ApiError,importOutcomeMayBeCommitted} from '../src/lib/api.js';

const hook=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');
const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const notice=readFileSync(new URL('../src/components/PersistenceNotice.tsx',import.meta.url),'utf8');
const fixture=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/save-progress-qa.mjs',import.meta.url),'utf8');
const importPath=hook.slice(hook.indexOf('const doImport = useCallback'),hook.indexOf('const doBackup = useCallback'));

describe('#649 I18.04 import receipt with unverified history',()=>{
  it('recognizes committed finance before checking history and does not silently claim full success',()=>{
    const receipt=importPath.indexOf('const res = await importData');
    expect(receipt).toBeGreaterThan(-1);
    expect(importPath.indexOf('applyDataEnvelope(res)')).toBeGreaterThan(receipt);
    expect(importPath.indexOf('const nextHistory=await loadHistory().catch(()=>null)')).toBeGreaterThan(receipt);
    expect(importPath).toContain('historyMatchesRevision(nextHistory,res.revision)');
    expect(importPath).toContain("return verified?{status:'complete' as const}:{status:'committed-history-unverified' as const}");
    expect(importPath).toContain("setCurrentSaveState('conflict')");
    expect(importPath).toContain("setSaveErrorMessage('Η εισαγωγή επιβεβαιώθηκε στη βάση");
    expect(importPath.indexOf('if(verified){')).toBeLessThan(importPath.indexOf('setSaveReceiptCount(count=>count+1)'));
  });
  it('fails closed on missing or divergent history without stale Undo/Redo',()=>{
    expect(importPath).toContain('const consistent=nextHistory!==null&&historyMatchesRevision(nextHistory,res.revision)');
    expect(importPath).toContain('available:false,generation:historyGenerationRef.current,financeRevision:res.revision');
    expect(importPath).toContain('currentPointId:null,canUndo:false,canRedo:false,undoDepth:0,redoDepth:0,points:[]');
    expect(importPath).toContain('applyHistory(verified?nextHistory!:unavailableHistory)');
  });
  it('tests real-hook post-import history failure and revision mismatch in Chromium',()=>{
    expect(fixture).toContain('__myfinhubQaImportHistoryCase');
    expect(fixture).toContain('QA_HISTORY_READ_UNAVAILABLE');
    expect(fixture).toContain('financeRevision:String(revision+1)');
    expect(fixture).toContain('data-persistence-import-outcome');
    expect(browser).toContain("for(const historyFailure of ['read-failure','revision-mismatch'])");
    expect(browser).toContain('history-committed-import-');
    expect(browser).toContain('committed import keeps finance revision, blocks stale history');
    expect(browser).toContain('recovery preserves acknowledged import without reposting finance');
  });
  it('proves real-hook rejected imports do not commit, replay or unlock stale history',()=>{
    const handler=fixture.slice(fixture.indexOf("if(url.pathname==='/api/import'"),fixture.indexOf("if(url.pathname==='/api/history'"));
    expect(handler).toContain("if(QA_HISTORY_HOOK_PROBE&&rejected)");
    expect(handler.indexOf("if(QA_HISTORY_HOOK_PROBE&&rejected)")).toBeLessThan(handler.indexOf("backend=JSON.parse"));
    expect(fixture).toContain('__myfinhubQaRejectNextImport');
    expect(fixture).toContain('__myfinhubQaImportAttemptCount');
    expect(fixture).toContain('__myfinhubQaImportCommitCount');
    expect(browser).toContain("for(const preCommitFailure of ['conflict','unavailable'])");
    expect(browser).toContain('const waitFor=async(fn,label,args=[])=>');
    expect(browser).toContain('if(await c.call(fn,args))return;');
    expect(browser).toContain("'rejected import never reports a confirmed receipt',[expectedState]");
    // CDP function strings are opaque to node --check; compile the actual
    // rejected-import projection before relying on a costly browser job.
    const rejectedProjection=browser.match(/const rejected=await c\.call\("([^"]+)"\)/)?.[1];
    expect(rejectedProjection).toBeDefined();
    expect(()=>new Function('return ('+rejectedProjection+')')()).not.toThrow();
    expect(browser).toContain('history-rejected-import-');
    expect(browser).toContain('pre-commit rejection preserves exact confirmed finance without false success');
    expect(browser).toContain('read-only recovery preserves prior finance and never replays rejected import');
  });
  it('classifies lost or 5xx import replies as unknown, but 4xx rejection as definitive',()=>{
    expect(importOutcomeMayBeCommitted(new ApiError('timeout',0,'NETWORK_TIMEOUT'))).toBe(true);
    expect(importOutcomeMayBeCommitted(new ApiError('unavailable',503,'DATA_UNAVAILABLE'))).toBe(true);
    expect(importOutcomeMayBeCommitted(new ApiError('gateway timeout',504,'DATA_TIMEOUT'))).toBe(true);
    expect(importOutcomeMayBeCommitted(new ApiError('revision conflict',409,'REVISION_CONFLICT'))).toBe(false);
    expect(importOutcomeMayBeCommitted(new ApiError('invalid payload',400,'INVALID_DATA'))).toBe(false);
  });
  it('makes committed import response loss require reload instead of replay or false green',()=>{
    expect(fixture).toContain('__myfinhubQaLoseNextImportReceipt');
    expect(fixture.indexOf('importCommits+=1')).toBeLessThan(fixture.indexOf("throw new TypeError('Synthetic network loss after committed import')"));
    expect(browser).toContain('history-committed-import-response-lost-1440-dark');
    expect(browser).toContain('uncertain.attempts===1&&uncertain.commits===1');
    expect(browser).toContain('response-loss recovery must never replay import');
    expect(importPath).toContain('importOutcomeMayBeCommitted(error)');
    expect(importPath).toContain('Μην επαναλάβεις την εισαγωγή');
    expect(settings).toContain('if(importOutcomeMayBeCommitted(error))');
    expect(settings).toContain("Φόρτωσε την τελευταία αποθηκευμένη έκδοση και έλεγξε τα δεδομένα πριν συνεχίσεις.','warning'");
  });
  it('renders partial success as warning with reload, never a destructive import retry',()=>{
    expect(settings).toContain("result.status==='committed-history-unverified'");
    expect(settings).toContain("δεν επαληθεύτηκε το ιστορικό αλλαγών");
    expect(settings).toContain('Μην εισαγάγεις ξανά το αρχείο.');
    expect(settings).toContain("έκδοση πριν συνεχίσεις.','warning'");
    expect(notice).toContain("errorMessage?'Χρειάζεται επαλήθευση της αποθήκευσης'");
    expect(notice).toContain('Φόρτωση τελευταίας έκδοσης');
  });
});
