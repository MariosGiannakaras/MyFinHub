import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const hook=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');
const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const notice=readFileSync(new URL('../src/components/PersistenceNotice.tsx',import.meta.url),'utf8');
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
  it('renders partial success as warning with reload, never a destructive import retry',()=>{
    expect(settings).toContain("result.status==='committed-history-unverified'");
    expect(settings).toContain("δεν επαληθεύτηκε το ιστορικό αλλαγών");
    expect(settings).toContain('Μην εισαγάγεις ξανά το αρχείο.');
    expect(settings).toContain("έκδοση πριν συνεχίσεις.','warning'");
    expect(notice).toContain("errorMessage?'Χρειάζεται επαλήθευση της αποθήκευσης'");
    expect(notice).toContain('Φόρτωση τελευταίας έκδοσης');
  });
});
