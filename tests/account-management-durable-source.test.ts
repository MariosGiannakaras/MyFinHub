import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const component=readFileSync('src/components/AccountManagementSettings.tsx','utf8');
const settings=readFileSync('src/pages/SettingsPage.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');
const qa=readFileSync('src/qa.tsx','utf8');
const rendered=readFileSync('scripts/account-metadata-qa.mjs','utf8');

describe('account-management durable settings/IBAN ordering (DV-FB04/07)',()=>{
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
    expect(editorSave.indexOf('setMessage((editor.source')).toBeGreaterThan(commit);
    expect(editorSave).not.toContain("onChange(next);");
    expect(editorSave).toContain('αλλά η ενημέρωση IBAN απέτυχε');
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
