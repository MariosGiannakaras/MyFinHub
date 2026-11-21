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

/** No financial subtotal may be displayed from unverified lexical inputs. */
export function sumValidMoneyInputAmounts(values:readonly string[]):number|null{
  let cents=0;
  for(const text of values){
    const amount=parseMoneyInputAmount(text);
    if(amount===null||amount<=0)return null;
    cents+=Math.round(amount*100);
    if(!Number.isSafeInteger(cents))return null;
  }
  return cents/100;
}
