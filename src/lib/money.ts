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

export function isSafeMoneyValue(value:number){
  return Number.isFinite(value)&&Number.isSafeInteger(moneyToCents(value));
}
