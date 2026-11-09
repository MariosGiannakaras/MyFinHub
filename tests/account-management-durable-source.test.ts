import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const component=readFileSync('src/components/AccountManagementSettings.tsx','utf8');
const settings=readFileSync('src/pages/SettingsPage.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');
const qa=readFileSync('src/qa.tsx','utf8');
const rendered=readFileSync('scripts/account-metadata-qa.mjs','utf8');

describe('account-management durable settings/IBAN ordering (DV-FB04/07)',()=>{
  it('rejects same-tick duplicate account save/delete while preserving revision-first metadata ordering (#649 I19.04)',()=>{
    expect(component).toContain('const mutationInFlight=useRef(false)');
    expect(component).toContain('if(!editor||busy||mutationInFlight.current)return;');
    expect(component).toContain('if(!pendingDelete||busy||mutationInFlight.current)return;');
    expect(component.split('mutationInFlight.current=true;setBusy(true)').length-1).toBe(2);
    expect(component.split('finally{mutationInFlight.current=false;setBusy(false)}').length-1).toBe(2);
    expect(rendered).toContain('same-tick double activation produces one durable account settings revision, not two');
    expect(qa).toContain('qaSettingsDurableWrites');
    expect(app).not.toContain('qaSettingsDurableWrites');
  });

  it('uses accessible account provider radios with Arrow/Home/End roving focus and no save mutation (#649 I16.05/I23.03)',()=>{
    expect(component).toContain('const providerTabStop=providers.find');
    expect(component).toContain("event.key==='ArrowDown'?'ArrowRight':event.key==='ArrowUp'?'ArrowLeft'");
    expect(component).toContain('rovingTabDestination(key,index,providers.length)');
    expect(component).toContain('tabIndex={provider.id===providerTabStop?0:-1}');
    expect(component).toContain('disabled={busy} onKeyDown={event=>onProviderKeyDown(event,index)}');
    expect(rendered).toContain('Account provider radio group supports roving keyboard');
    for(const key of ['ArrowRight','ArrowUp','Home','End'])expect(rendered).toContain("await press('"+key+"'");
    expect(rendered).toContain('state.stops===1');
    expect(rendered).toContain('original provider restored');
  });

  it('routes account create/edit/delete through the existing revisioned finance receipt',()=>{
    expect(app).toContain('onFinanceDurably={finance.updateDurably}');
    expect(settings).toContain('onChangeDurably={(next)=>onFinanceDurably(current=>');
    expect(component).toContain('onChangeDurably:(next:FinanceSettings)=>Promise<void>');
    expect(qa).toContain("get('account-save-failure')==='1'");
    expect(component.match(/await onChangeDurably\(next\)/g)).toHaveLength(2);
    expect(component).toContain('const patch=(next:Partial<FinanceSettings>)=>onChange(');
  });
  it('does not report success or write IBAN before the finance revision is committed',()=>{
    const editorSave=component.slice(component.indexOf('const save=async()=>'),component.indexOf('const requestDelete='));
    const commit=editorSave.indexOf('await onChangeDurably(next)');
    expect(commit).toBeGreaterThan(0);
    expect(editorSave.indexOf('await saveAccountMetadata(')).toBeGreaterThan(commit);
    expect(editorSave.indexOf('notify((editor.source')).toBeGreaterThan(commit);
    expect(editorSave).not.toContain("onChange(next);");
    expect(editorSave).toContain('αλλά η ενημέρωση IBAN απέτυχε');
    expect(editorSave).toContain("ibanWarning?'warning':'success'");
    expect(rendered).toContain('failed finance write did not mutate IBAN metadata');
    expect(rendered).toContain('account-metadata-durable-save-failure');
    expect(rendered).toContain('Οι αλλαγές του λογαριασμού αποθηκεύτηκαν.');
  });
  it('retains the financial delete after its durable receipt even if ancillary IBAN cleanup fails',()=>{
    const deletion=component.slice(component.indexOf('const confirmDelete=async()=>'),component.indexOf('const defaultOptions='));
    expect(deletion.indexOf('await onChangeDurably(next)')).toBeLessThan(deletion.indexOf("await saveAccountMetadata(id,'')"));
    expect(deletion).toContain('metadataWarning');
    expect(deletion).toContain('setPendingDelete(null)');
    expect(deletion).not.toContain("onChange(next);");
  });
});
