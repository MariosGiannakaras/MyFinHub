/** Cash direction when lending changes a receivable rather than operating income.
 * This reflects the signed *account* leg only; a writeoff has no cash leg. */
export function receivableCashDirection(kind:string): -1|0|1 {
  if(kind==='lending')return -1;
  if(kind==='repayment')return 1;
  return 0;
}
