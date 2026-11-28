import { BellRing, ChevronLeft, ChevronRight } from 'lucide-react';
import { monthOnlyToUtcDate } from '../lib/dateOnly';
import { canAdvanceReportingMonth, shiftReportingMonth } from '../lib/reportingPeriod';
import { IconButton } from './IconButton';
import { Tooltip } from './Tooltip';

function monthLabel(month:string){
  const date=monthOnlyToUtcDate(month);
  if(!date)return month;
  const text=new Intl.DateTimeFormat('el-GR',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  return text.charAt(0).toUpperCase()+text.slice(1);
}

export function PeriodControl({month,asOf,onChange}:{month:string;asOf:string;onChange:(month:string)=>void}){
  const canAdvance=canAdvanceReportingMonth(month,asOf.slice(0,7));
  const nextLabel=canAdvance?'Επόμενος μήνας':'Επόμενος μήνας — δεν υπάρχει μελλοντική περίοδος αναφοράς';
  return <><a className="period-attention-shortcut" href="#/attention" aria-label="Χρειάζεται προσοχή" title="Χρειάζεται προσοχή"><BellRing size={17}/></a><div className="period-control" aria-label="Περίοδος αναφοράς"><Tooltip label="Προηγούμενος μήνας"><IconButton type="button" aria-label="Προηγούμενος μήνας" onClick={()=>onChange(shiftReportingMonth(month,-1))}><ChevronLeft size={17}/></IconButton></Tooltip><span className="period-label">{monthLabel(month)}</span><Tooltip label={nextLabel}><IconButton type="button" aria-label={nextLabel} disabled={!canAdvance} onClick={()=>{if(canAdvance)onChange(shiftReportingMonth(month,1))}}><ChevronRight size={17}/></IconButton></Tooltip></div></>;
}
