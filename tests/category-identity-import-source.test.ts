import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const importSource=readFileSync(new URL('../api/import.ts',import.meta.url),'utf8');
const stateValidationSource=readFileSync(new URL('../server/stateValidation.ts',import.meta.url),'utf8');
const completeValidationSource=readFileSync(new URL('../server/financeDataValidation.ts',import.meta.url),'utf8');
const storageSource=readFileSync(new URL('../server/storage.ts',import.meta.url),'utf8');

describe('complete finance persistence validation wiring',()=>{
  it('uses a complete full-document boundary and scoped mutable-state validators',()=>{
    expect(completeValidationSource).toContain("validateCardStateExtensions(data.state)");
    expect(completeValidationSource).toContain("validateCategoryIdentityState(data.state)");
    expect(completeValidationSource).toContain("validateRecurringCadenceData(data)");
    expect(completeValidationSource).toContain("validateCompleteFinanceSemantics(data)");
    expect(stateValidationSource).toContain("validateCardStateExtensions(state)");
    expect(stateValidationSource).toContain("validateCategoryIdentityState(state)");
    expect(stateValidationSource).toContain("validateRecurringCadenceState(state)");
    expect(stateValidationSource).toContain("validateFinanceStateSemantics(state)");
    expect(stateValidationSource).not.toContain("validateCompleteFinanceData");
    expect(importSource).toContain("import { validateCompleteFinanceData } from '../server/financeDataValidation.js'");
    expect(importSource).toContain('validateCompleteFinanceData(body);');
    expect(storageSource).toContain("import { validateCompleteFinanceData } from './financeDataValidation.js'");
    expect(storageSource).toContain('validateCompleteFinanceData(migrated);');
    expect(storageSource).toContain('validateCompleteFinanceData(data);');
    expect(storageSource).toContain('validateCompleteFinanceData(next);');
  });
});
