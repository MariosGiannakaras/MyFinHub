import { ChevronLeft, ChevronRight } from 'lucide-react';

function shiftMonth(month:string,delta:number){
  const [year,rawMonth]=month.split('-').map(Number);
  const date=new Date(Date.UTC(year,rawMonth-1+delta,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

function monthLabel(month:string){
  const [year,rawMonth]=month.split('-').map(Number);
  const text=new Intl.DateTimeFormat('el-GR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,rawMonth-1,1)));
  return text.charAt(0).toUpperCase()+text.slice(1);
}

export function PeriodControl({month,onChange}:{month:string;onChange:(month:string)=>void}){
  return <div className="period-control" aria-label="Περίοδος αναφοράς"><button type="button" aria-label="Προηγούμενος μήνας" onClick={()=>onChange(shiftMonth(month,-1))}><ChevronLeft size={17}/></button><span>{monthLabel(month)}</span><button type="button" aria-label="Επόμενος μήνας" onClick={()=>onChange(shiftMonth(month,1))}><ChevronRight size={17}/></button></div>;
}
