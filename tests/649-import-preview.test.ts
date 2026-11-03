import {describe,expect,it} from 'vitest';
import {previewFinanceImport} from '../src/lib/importPreview';
import {qaFinanceData} from '../src/qaFixture';
import {readFileSync} from 'node:fs';

const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/settings-tabs-qa.mjs',import.meta.url),'utf8');

describe('#649 I18.04 non-destructive import preview',()=>{
  it('previews a genuine finance document without mutating it or posting',()=>{
    const original=qaFinanceData();
    const snapshot=structuredClone(original);
    const preview=previewFinanceImport(original);
    expect(preview).toEqual({
      schemaVersion:3,
      updatedAt:original.updatedAt,
      accountCount:original.seed.accounts.length,
      legacyTransactionCount:original.seed.transactions.length,
      eventCount:original.state.events?.length??0,
    });
    expect(original).toEqual(snapshot);
  });
  it('rejects malformed, incomplete and future-version JSON locally without claiming full server validation',()=>{
    const data=qaFinanceData();
    expect(()=>previewFinanceImport(null)).toThrow('βασική δομή');
    expect(()=>previewFinanceImport({...data,seed:undefined})).toThrow('βασική δομή');
    expect(()=>previewFinanceImport({...data,seed:{...data.seed,accounts:undefined}})).toThrow('βασική δομή');
    expect(()=>previewFinanceImport({...data,schemaVersion:99})).toThrow('έκδοση');
    expect(()=>previewFinanceImport({...data,updatedAt:'not-a-timestamp'})).toThrow('ημερομηνία');
    expect(()=>previewFinanceImport({...data,state:{...data.state,events:{}}})).toThrow('βασική δομή');
    expect(previewFinanceImport({...data,state:{...data.state,events:undefined}}).eventCount).toBe(0);
  });
  it('checks file text before opening destructive confirmation and retains server authority',()=>{
    expect(settings.indexOf('previewFinanceImport(JSON.parse(await file.text()))')).toBeLessThan(settings.indexOf('setPendingImportFile(file)'));
    expect(settings).toContain('role="status"><strong>Προεπισκόπηση επιλεγμένου JSON');
    expect(settings).toContain('Προκαταρκτικός έλεγχος');
    expect(settings).toContain('Η πλήρης επικύρωση πραγματοποιείται από τη βάση');
    expect(settings).toContain('const result=await onImport(JSON.parse(await file.text()))');
    expect(browser).toContain('settings-json-import-malformed-error-desktop');
    expect(browser).toContain('malformed JSON rejected before confirmation');
    expect(browser).toContain('mobile import shows the same bounded preview before confirmation');
  });
});
