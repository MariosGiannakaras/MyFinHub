import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const component=readFileSync('src/components/AccountManagementSettings.tsx','utf8');
const settings=readFileSync('src/pages/SettingsPage.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');
const qa=readFileSync('src/qa.tsx','utf8');
const rendered=readFileSync('scripts/account-metadata-qa.mjs','utf8');

describe('account-management durable settings/IBAN ordering (DV-FB04/07)',()=>{
  it('locks all account editor and list mutations during unacknowledged durable finance receipt (#649 I16.02)',()=>{
    const settingsDefaultRoles=['εξόδων','εσόδων','πληρωμής δόσεων'];
    for(const role of settingsDefaultRoles)expect(component).toContain('aria-label="Προεπιλεγμένος λογαριασμός '+role+'" disabled={busy}');
    for(const label of ['className="account-management-create" disabled={busy}','className="account-management-edit" disabled={busy}','className="danger-text" disabled={busy}','aria-label="Κατηγορία λογαριασμού" disabled={busy}','<AppTextInput disabled={busy}','<input type="checkbox" disabled={busy}'])
      expect(component).toContain(label);
    expect(qa).toContain("account-save-pending");
    expect(qa).toContain('__myfinhubQaCompleteAccountReceipt');
    expect(rendered).toContain('pending account save locks every editor/default/list control');
    expect(rendered).toContain('account-metadata-pending-locked-mobile-375');
    expect(rendered).toContain('pendingLock.editorCount>=7&&pendingLock.editorDisabled');
    expect(rendered).toContain('pendingLock.iban===pendingBefore&&pendingLock.writeCount===0');
    expect(rendered).toContain("pending account revision acknowledged");
  });
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

  it('checks narrow 320px account editor focus, invalid IBAN error, and no false save receipt (#649 I16.05)',()=>{
    expect(rendered).toContain('320px account editor keeps keyboard, invalid IBAN error and actions contained');
    expect(rendered).toContain('account-metadata-invalid-iban-mobile-320');
    expect(rendered).toContain('narrowBounds.focused');
    expect(rendered).toContain("await press('Tab','Tab',9)");
    expect(rendered).toContain('narrowInvalid.alertVisible&&narrowInvalid.footerVisible&&narrowInvalid.modalBounded');
    expect(rendered).toContain('narrowInvalid.writeCount===narrowBeforeWrites');
    expect(rendered).toContain('320px invalid form preserves unsaved IBAN draft');
    expect(rendered).toContain("await press('Escape','Escape',27)");
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

  it('rechecks latest historical references at confirmation, preventing stale account delete (#649 I16.02)',()=>{
    const confirm=component.slice(component.indexOf('const confirmDelete=async()=>'),component.indexOf('const defaultOptions='));
    const refCheck=confirm.indexOf('const newReferences=accountReferenceReasons(data,id)');
    const commit=confirm.indexOf('await onChangeDurably(next)');
    expect(refCheck).toBeGreaterThan(0);
    expect(commit).toBeGreaterThan(refCheck);
    expect(confirm).toContain('const stillCustom=(settings.customAccounts??[]).some(item=>item.id===id)');
    expect(confirm).toContain('if(!stillCustom||newReferences.length)');
    expect(confirm).toContain("setPendingDelete(null);");
    expect(confirm).toContain("'warning'");
    expect(rendered).toContain('stale delete confirmation cannot erase newly referenced finance account');
    expect(rendered).toContain('account-delete-late-reference-blocked-desktop');
    expect(qa).toContain("__myfinhubQaInjectAccountReference");
    expect(app).not.toContain("__myfinhubQaInjectAccountReference");
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
