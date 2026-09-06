import { describe, expect, it } from 'vitest';
import { explicitFinanceCategoryIcon } from '../src/lib/categoryFinanceIcon.js';
import type { FinanceSettings } from '../src/types.js';

const settings={
  categoryIcons:{'expense:groceries':'tabler:groceries'},
  subcategoryIcons:{},
} as unknown as FinanceSettings;

describe('category finance icon preferences',()=>{
  it('preserves namespaced icon-pack values through finance icon resolution',()=>{
    expect(explicitFinanceCategoryIcon(settings,'expense','groceries')).toBe('tabler:groceries');
  });
});
