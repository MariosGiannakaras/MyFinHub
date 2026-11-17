import { describe, expect, it } from 'vitest';
import { normalizeMoneyInputText, parseMoneyInputAmount, sumValidMoneyInputAmounts } from '../src/lib/moneyInput.js';

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

describe('truthful multi-source input subtotal (#649 I19.01)',()=>{
  it('sums exact cents without floating-point drift',()=>{
    expect(sumValidMoneyInputAmounts(['0,10','0.20'])).toBe(0.3);
    expect(sumValidMoneyInputAmounts(['10.05','20.95'])).toBe(31);
    expect(sumValidMoneyInputAmounts(['00001','2'])).toBe(3);
  });
  it.each([
    ['exponent',['1e3','2']],['hex',['0x10','2']],
    ['overprecision',['1.234','2']],['empty source',['1','']],
    ['zero source',['1','0']],['negative source',['1','-2']],
    ['thousands separators',['1.000,25','2']],
    ['overflow',['90071992547409.91','90071992547409.91']],
  ])('does not display a bogus financial total for %s',(_label,sources)=>{
    expect(sumValidMoneyInputAmounts(sources)).toBeNull();
  });
});
