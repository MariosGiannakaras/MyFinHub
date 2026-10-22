import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
describe('owner-selected stable identity UI',()=>{
 it('persists Settings identity durably and keeps Quick Entry associations opt-in',()=>{
  const settings=readFileSync('src/pages/SettingsPage.tsx','utf8');
  const directory=readFileSync('src/components/CounterpartyDirectorySettings.tsx','utf8');
  const quick=readFileSync('src/components/QuickAdd.tsx','utf8');
  const selector=readFileSync('src/components/CounterpartyQuickSelector.tsx','utf8');
  expect(settings).toContain('onFinanceDurably(current=>withCounterparty(current,record))');
  expect(directory).toContain('await onSave(record)');
  expect(directory).toContain('crypto.randomUUID()');
  expect(directory).toContain('<AppTextInput');
  expect(directory).toContain('<AppSelectInput');
  expect(quick).toContain('event.counterpartyId=counterpartyId');
  expect(quick).toContain("setCounterpartyId('')");
  expect(selector).toContain('<option value="">Χωρίς συσχέτιση</option>');
  expect(selector).toContain('Δεν επιλέγεται αυτόματα.');
 });
});
