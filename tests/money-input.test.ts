import { describe, expect, it } from 'vitest';
import { normalizeMoneyInputText, parseMoneyInputAmount } from '../src/lib/moneyInput.js';

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

describe('strict Euro amount parsing (#649 I19.01)',()=>{
  it.each([
    ['0',0],['0,00',0],['0.01',0.01],['12,34',12.34],
    ['00012.30',12.3],[' 42.10 ',42.1],['999999.99',999999.99],
  ])('preserves explicit cent-exact amount %s',(input,expected)=>{
    expect(parseMoneyInputAmount(input)).toBe(expected);
  });
  it.each(['',' ','1e3','1E+3','0x10','0b10','+12','1,234','1.234','1.000,20',
    '1,000.20','Infinity','NaN','.50','2.','--2','2+3','1/2'])(
    'rejects ambiguous or nondecimal Euro notation %s',input=>{
      expect(parseMoneyInputAmount(input)).toBeNull();
    });
  it('permits signed reconciliation only when explicitly enabled',()=>{
    expect(parseMoneyInputAmount('-12,34',true)).toBe(-12.34);
    expect(parseMoneyInputAmount('-0',true)).toBe(-0);
    expect(parseMoneyInputAmount('-12,34')).toBeNull();
    expect(parseMoneyInputAmount('-1e3',true)).toBeNull();
    expect(parseMoneyInputAmount('-0.001',true)).toBeNull();
  });
});
