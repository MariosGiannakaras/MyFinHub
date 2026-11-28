// Timestamps are instants, unlike ledger calendar dates. Render local time with an explicit year.
export function formatLocalTimestamp(value:string|null|undefined):string{
  const time=value?Date.parse(value):NaN;
  return Number.isFinite(time)?new Date(time).toLocaleString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'Μη διαθέσιμη ημερομηνία';
}
