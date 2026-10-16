import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('top-edge save feedback ownership',()=>{
  it('uses durable finance queue receipts and guards against queued-race false saved states',()=>{
    const finance=read('src/hooks/useFinance.ts');
    expect(finance).toContain("setCurrentSaveState('saving')");
    expect(finance).toContain("if(coordinator.hasWork())return;");
    expect(finance).toContain('setSavePending(false)');
    expect(finance).toContain('setSaveReceiptCount(count=>count+1)');
    expect(finance).toContain('historyMatchesRevision(res.history,res.revision)');
    expect(finance).toContain("setCurrentSaveState('conflict')");
    expect(finance).toContain("setCurrentSaveState('error')");
  });
  it('has one top-edge indicator and no redundant normal success/saving toast or sidebar copy',()=>{
    const shell=read('src/components/AppShell.tsx');
    const notice=read('src/components/PersistenceNotice.tsx');
    const bar=read('src/components/SaveProgressBar.tsx');
    const css=read('src/styles/save-progress-bar.css');
    expect(shell).toContain('<SaveProgressBar saveState={saveState} savePending={savePending} saveReceiptCount={saveReceiptCount} reducedMotion={reduce}/>');
    expect(shell).not.toContain("?'Αποθηκεύτηκε'");
    expect(notice).not.toContain('persistence-toast saving');
    expect(notice).not.toContain('Αποθηκεύτηκε');
    expect(notice).toContain('Φόρτωση τελευταίας έκδοσης');
    expect(bar).toContain('role="progressbar"');
    expect(bar).toContain('confirmedReceipts=saveReceiptCount+requests.completion');
    expect(bar).toContain('transitionSaveProgress(previous,status,newlyConfirmed)');
    expect(bar).toContain('aria-valuenow={phase===\'success\'?100:undefined}');
    expect(css).toContain('position:fixed;inset:0 0 auto');
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
  it('includes real sequential-finance browser probes for pending, success, error, conflict and rapid save sequences',()=>{
    const qa=read('scripts/save-progress-qa.mjs');
    const fixtures=read('src/qa.tsx');
    const runner=read('scripts/run-rendered-qa.mjs');
    expect(qa).toContain('save-progress-pending-375-light');
    expect(qa).toContain('save-progress-success-375-light');
    expect(qa).toContain('save-progress-error-1440-dark');
    expect(qa).toContain('save-progress-conflict-1440-dark');
    expect(qa).toContain('Emulation.setEmulatedMedia');
    expect(qa).toContain('double queued save');
    expect(fixtures).toContain('__myfinhubQaReleaseSave');
    expect(runner).toContain("scripts/save-progress-qa.mjs");
  });
  it('tracks auxiliary independent saves without treating secret reveal or refresh as persistence',()=>{
    const vault=read('src/lib/cardVaultClient.ts');
    expect(vault).toContain("trackDatabaseWrite(()=>request<{saved:true");
    expect(vault).toContain("trackDatabaseWrite(()=>request<{deleted:true");
    expect(vault).toContain("payload=await request<typeof payload>('POST'");
    expect(read('src/lib/accountMetadataClient.ts')).toContain('return trackDatabaseWrite(async()=>{');
    expect(read('src/lib/financialProviderClient.ts')).toContain('return trackDatabaseWrite(async()=>{');
    expect(read('src/lib/recurringServiceAssetClient.ts')).toContain('return trackDatabaseWrite(async()=>{');
  });
});
