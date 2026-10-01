import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const importSource=readFileSync(new URL('../api/import.ts',import.meta.url),'utf8');
const stateValidationSource=readFileSync(new URL('../server/stateValidation.ts',import.meta.url),'utf8');
const completeValidationSource=readFileSync(new URL('../server/financeDataValidation.ts',import.meta.url),'utf8');
const storageSource=readFileSync(new URL('../server/storage.ts',import.meta.url),'utf8');

describe('complete finance persistence validation wiring',()=>{
  it('uses one extension-complete boundary for mutable writes, full imports and stored reads',()=>{
    expect(completeValidationSource).toContain("validateCardStateExtensions(data.state)");
    expect(completeValidationSource).toContain("validateCategoryIdentityState(data.state)");
    expect(completeValidationSource).toContain("validateRecurringCadenceData(data)");
    expect(stateValidationSource).toContain("import { validateCompleteFinanceData } from './financeDataValidation.js'");
    expect(stateValidationSource).toContain('validateCompleteFinanceData({');
    expect(importSource).toContain("import { validateCompleteFinanceData } from '../server/financeDataValidation.js'");
    expect(importSource).toContain('validateCompleteFinanceData(body);');
    expect(storageSource).toContain("import { validateCompleteFinanceData } from './financeDataValidation.js'");
    expect(storageSource).toContain('validateCompleteFinanceData(migrated);');
    expect(storageSource).toContain('validateCompleteFinanceData(data);');
    expect(storageSource).toContain('validateCompleteFinanceData(next);');
  });
});
