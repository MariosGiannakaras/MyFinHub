import { BellRing, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { canAdvanceReportingMonth, localMonthKey, shiftReportingMonth } from '../lib/reportingPeriod';
import '../styles/part53.css';
import { Tooltip } from './Tooltip';

function monthLabel(month:string){
  const [year,rawMonth]=month.split('-').map(Number);
  const text=new Intl.DateTimeFormat('el-GR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,rawMonth-1,1)));
  return text.charAt(0).toUpperCase()+text.slice(1);
}

export function PeriodControl({month,onChange}:{month:string;onChange:(month:string)=>void}){
  const [currentMonth,setCurrentMonth]=useState(()=>localMonthKey());
  useEffect(()=>{
    const refresh=()=>setCurrentMonth(localMonthKey());
    const timer=window.setInterval(refresh,60_000);
    return()=>window.clearInterval(timer);
  },[]);
  const canAdvance=canAdvanceReportingMonth(month,currentMonth);
  const nextLabel=canAdvance?'Επόμενος μήνας':'Επόμενος μήνας — δεν υπάρχει μελλοντική περίοδος αναφοράς';
  return <><a className="period-attention-shortcut" href="#/attention" aria-label="Χρειάζεται προσοχή" title="Χρειάζεται προσοχή"><BellRing size={17}/></a><div className="period-control" aria-label="Περίοδος αναφοράς"><Tooltip label="Προηγούμενος μήνας"><button type="button" aria-label="Προηγούμενος μήνας" onClick={()=>onChange(shiftReportingMonth(month,-1))}><ChevronLeft size={17}/></button></Tooltip><span>{monthLabel(month)}</span><Tooltip label={nextLabel}><button type="button" aria-label={nextLabel} disabled={!canAdvance} onClick={()=>{if(canAdvance)onChange(shiftReportingMonth(month,1))}}><ChevronRight size={17}/></button></Tooltip></div></>;
}
