import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const settings=read('src/pages/SettingsPage.tsx');
const css=read('src/pages/SettingsData.css');

describe('Settings Data source contract',()=>{
  it('preserves the canonical backup and import safety semantics',()=>{
    expect(settings).toContain('MAX_FINANCE_DOCUMENT_BYTES');
    expect(settings).toContain('await onBackup()');
    expect(settings).toContain('const snapshot = await loadData()');
    expect(settings).toContain('downloadJson(snapshot.data)');
    expect(settings).toContain('const receipt = await bridge.saveLocalBackup()');
    expect(settings).not.toContain('downloadJson({...data,state:{...data.state,settings:cloneSettings(draftRef.current)}})');
    expect(settings).toContain('await onImport(JSON.parse(await file.text()))');
    expect(settings).toContain('tone="destructive"');
    expect(settings).toContain('δημιουργεί αυτόματα backup των προηγούμενων δεδομένων');
    expect(settings).toContain('Δεν αναιρείται με Undo.');
    expect(settings).toContain('type="file" accept="application/json,.json" hidden');
    const requestImport=settings.slice(settings.indexOf('const requestImport ='),settings.indexOf('const cancelImport ='));
    expect(requestImport.indexOf("setOperationResult('');")).toBeLessThan(requestImport.indexOf('setPendingImportFile(file);'));
    expect(requestImport).toContain("setOperationResult('Το αρχείο είναι μεγαλύτερο");
    expect(settings).toMatch(/const confirmImport = async \(\) => \{[\s\S]*?setOperationResult\(''\);[\s\S]*?await onImport\(/);

  });

  it('keeps the Data tab focused on backup and restore actions only',()=>{
    expect(settings).toContain('settings-data-action-grid');
    expect(settings).toContain('Δημιουργία αντιγράφου ασφαλείας');
    expect(settings).toContain('Επαναφορά από JSON');
    expect(settings).toContain('Έως 4 MB');
    expect(settings).not.toContain('settings-data-overview');
    expect(settings).not.toContain('settings-data-status-grid');
    expect(settings).not.toContain('settings-data-technical');
    expect(settings).not.toContain('Ασφάλεια & κατάσταση δεδομένων');
    expect(settings).not.toContain('Προέλευση & τεχνικές πληροφορίες');
  });

  it('keeps Data CSS composition-only and touch-safe while leaving reusable control paint to shared styles',()=>{
    expect(settings.match(/<Button className="settings-data-action-button" variant="secondary"/g)).toHaveLength(2);
    expect(css).toContain('.settings-data-action-grid');
    expect(css).not.toContain('.settings-data-status-grid');
    expect(css).not.toContain('.settings-data-technical');
    expect(css).toContain('@media(max-width:720px)');
    expect(css).toContain('.settings-data-action-button{width:100%;min-height:44px;justify-content:center}');
    expect(css).not.toMatch(/\.settings-data[^\{]*button\s*\{[^}]*border:/s);
    expect(css).not.toMatch(/\.settings-data[^\{]*button\s*\{[^}]*background:/s);
    expect(css).not.toMatch(/\.settings-data[^\{]*input\s*\{/s);
  });

  it('downloads only a fresh, database-acknowledged document after serialized backup completes',()=>{
    expect(settings).toContain('await onBackup()');
    expect(settings).toMatch(/await onBackup\(\);[\s\S]*?const snapshot = await loadData\(\);[\s\S]*?downloadJson\(snapshot\.data\)/);
    expect(settings).toContain('if (!receipt.verified) throw new Error');
    expect(settings).toContain('η τοπική αποθήκευση Windows απέτυχε');
    expect(settings).not.toContain('downloadJson({...data,state:{...data.state,settings:cloneSettings(draftRef.current)}})');
  });

});
