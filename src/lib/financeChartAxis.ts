/** Finance chart display only: never round ledger values or fabricate an axis maximum. */
const currencyAxis=new Intl.NumberFormat('el-GR',{
  style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:2,
});

export function formatFinanceAxisEuro(value:number):string{
  return Number.isFinite(value)?currencyAxis.format(value):'—';
}

/** Extents include zero so signed finance flows keep a truthful shared baseline. */
export function zeroAnchoredFinanceAxis(values:readonly number[]){
  const finite=values.filter(Number.isFinite);
  const minimum=Math.min(0,...finite);
  const maximum=Math.max(0,...finite);
  const range=maximum-minimum;
  // A 1-cent span cannot fit a readable distinct midpoint with cent labels.
  const ticks=range===0?[0]:range<0.04?[minimum,maximum]:[minimum,minimum+range/2,maximum];
  return {
    minimum,maximum,ticks,
    ratio:(value:number)=>range===0?0:(value-minimum)/range,
  };
}
