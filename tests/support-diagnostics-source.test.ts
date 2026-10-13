import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/SupportDiagnosticsPanel.tsx',import.meta.url),'utf8');

describe('support diagnostics privacy',()=>{
  it('keeps diagnostics outside normal production settings unless an explicit dev/support gate is active',()=>{
    expect(settings).not.toContain('runtimeEnv?.DEV');
    expect(settings).toContain("VITE_MYFINHUB_SUPPORT_DIAGNOSTICS==='1'");
    expect(settings).toContain("get('support-diagnostics')==='1'");
    expect(settings).toContain('supportDiagnosticsEnabled?<SupportDiagnosticsPanel');
  });

  it('uses a strict metadata/count whitelist instead of copying raw finance or secret fields',()=>{
    const lower=panel.toLowerCase();
    for(const forbidden of ['cardvault','accesstoken','refreshtoken','authorization','pan:','cvv:','note:','amount:','description:']){
      expect(lower).not.toContain(forbidden);
    }
    expect(panel).toContain('schemaVersion:data.schemaVersion');
    expect(panel).toContain('accounts:allAccounts(data).length');
    expect(panel).toContain('transactions:effectiveLegacyTransactions(data).length');
    expect(panel).toContain('JSON.stringify(snapshot,null,2)');
  });
});
