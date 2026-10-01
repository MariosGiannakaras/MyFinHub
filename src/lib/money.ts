const CENTS=100;
export const MAX_MONEY_ABS=1_000_000_000;

export function moneyToCents(value:number){
  if(!Number.isFinite(value)||Math.abs(value)>MAX_MONEY_ABS)return Number.NaN;
  const cents=Math.round((value+Math.sign(value||1)*Number.EPSILON)*CENTS);
  return Number.isSafeInteger(cents)?cents:Number.NaN;
}

export function centsToMoney(value:number){
  if(!Number.isSafeInteger(value)||Math.abs(value)>MAX_MONEY_ABS*CENTS)return Number.NaN;
  return Number((value/CENTS).toFixed(2));
}

export function isSafeMoneyValue(value:number){
  return Number.isFinite(value)&&Math.abs(value)<=MAX_MONEY_ABS&&Number.isSafeInteger(moneyToCents(value));
}
