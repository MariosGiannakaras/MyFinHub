import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const importSource=readFileSync(new URL('../api/import.ts',import.meta.url),'utf8');
const stateValidationSource=readFileSync(new URL('../server/stateValidation.ts',import.meta.url),'utf8');

describe('category identity persistence validation wiring',()=>{
  it('validates category identity extensions on both mutable writes and full imports',()=>{
    expect(stateValidationSource).toContain("import { validateCategoryIdentityState } from './categoryIdentityValidation.js'");
    expect(stateValidationSource).toContain('validateCategoryIdentityState(value);');
    expect(importSource).toContain("import { validateCategoryIdentityState } from '../server/categoryIdentityValidation.js'");
    expect(importSource).toContain('validateFinanceData(body);');
    expect(importSource).toContain('validateCategoryIdentityState(body.state);');
  });
});
