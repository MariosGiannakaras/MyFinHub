import { isSafeMoneyValue } from './money.js';

export function normalizeMoneyInputText(value:string){return value.replace(/,/g,'.')}

/** Reject exponent/hex/grouping and overprecision rather than silently coercing money. */
export function parseMoneyInputAmount(value:string,allowNegative=false):number|null{
  const trimmed=value.trim();
  const pattern=allowNegative?/^-?\d+(?:[.,]\d{1,2})?$/:/^\d+(?:[.,]\d{1,2})?$/;
  if(!pattern.test(trimmed))return null;
  const amount=Number(trimmed.replace(',','.'));
  return isSafeMoneyValue(amount)?amount:null;
}
