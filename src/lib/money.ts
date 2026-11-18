const CENTS=100;

export function moneyToCents(value:number){
  if(!Number.isFinite(value))return Number.NaN;
  const cents=Math.round((value+Math.sign(value||1)*Number.EPSILON)*CENTS);
  return Number.isSafeInteger(cents)?cents:Number.NaN;
}

export function centsToMoney(value:number){
  if(!Number.isSafeInteger(value))return Number.NaN;
  return Number((value/CENTS).toFixed(2));
}

/** For newly confirmed positive finance drafts. Never round a non-cent into a booked amount. */
export function isPositiveCentExactMoneyValue(value:number){
  const cents=moneyToCents(value);
  return Number.isFinite(value)&&Number.isSafeInteger(cents)&&cents>0&&
    Math.abs(value*CENTS-cents)<=1e-6;
}

export function isSafeMoneyValue(value:number){
  return Number.isFinite(value)&&Number.isSafeInteger(moneyToCents(value));
}
