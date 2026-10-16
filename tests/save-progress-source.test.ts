import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('top-edge save feedback ownership',()=>{
  it('uses durable finance queue receipts and guards against queued-race false saved states',()=>{
    const finance=read('src/hooks/useFinance.ts');
    expect(finance).toContain("setCurrentSaveState('saving')");
    expect(finance).toContain("if(!coordinator.hasWork()&&saveStateRef.current==='saving'");
    expect(finance).toContain('historyMatchesRevision(res.history,res.revision)');
    expect(finance).toContain("setCurrentSaveState('conflict')");
    expect(finance).toContain("setCurrentSaveState('error')");
  });
  it('has one top-edge indicator and no redundant normal success/saving toast or sidebar copy',()=>{
    const shell=read('src/components/AppShell.tsx');
    const notice=read('src/components/PersistenceNotice.tsx');
    const bar=read('src/components/SaveProgressBar.tsx');
    const css=read('src/styles/save-progress-bar.css');
    expect(shell).toContain('<SaveProgressBar saveState={saveState} reducedMotion={reduce}/>');
    expect(shell).not.toContain("?'Αποθηκεύτηκε'");
    expect(notice).not.toContain('persistence-toast saving');
    expect(notice).not.toContain('Αποθηκεύτηκε');
    expect(notice).toContain('Φόρτωση τελευταίας έκδοσης');
    expect(bar).toContain('role="progressbar"');
    expect(bar).toContain('aria-valuenow={phase===\'success\'?100:undefined}');
    expect(css).toContain('position:fixed;inset:0 0 auto');
    expect(css).toContain('prefers-reduced-motion:reduce');
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
