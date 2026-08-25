import { describe, expect, it } from 'vitest';
import { normalizeMoneyInputText } from '../src/lib/moneyInput.js';

describe('MoneyInput',()=>{
  it('normalizes comma decimal separators without changing the entered numeric intent',()=>{
    expect(normalizeMoneyInputText('12,34')).toBe('12.34');
    expect(normalizeMoneyInputText('12.34')).toBe('12.34');
    expect(normalizeMoneyInputText('')).toBe('');
  });

  it('does not apply finance-domain validation inside the shared presentation primitive',()=>{
    expect(normalizeMoneyInputText('-5,50')).toBe('-5.50');
    expect(normalizeMoneyInputText('0,00')).toBe('0.00');
  });
});
