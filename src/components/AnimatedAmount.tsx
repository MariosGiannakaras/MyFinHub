import { useEffect, useRef, useState } from 'react';
import { money } from '../lib/format';

export function AnimatedAmount({value,hidden=false,className='',duration=360}:{value:number;hidden?:boolean;className?:string;duration?:number}){
  const previous=useRef(value);
  const [display,setDisplay]=useState(value);

  useEffect(()=>{
    if(hidden){previous.current=value;setDisplay(value);return;}
    const from=previous.current;
    const to=value;
    previous.current=value;
    if(!Number.isFinite(from)||!Number.isFinite(to)||from===to){setDisplay(to);return;}
    const started=performance.now();
    let frame=0;
    const tick=(now:number)=>{
      const raw=Math.min(1,(now-started)/duration);
      const eased=1-Math.pow(1-raw,3);
      setDisplay(from+(to-from)*eased);
      if(raw<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[value,hidden,duration]);

  if(hidden)return <span className={`animated-amount masked ${className}`.trim()} aria-label="Κρυφό ποσό">••••••</span>;
  return <span className={`animated-amount ${className}`.trim()}>{money.format(display)}</span>;
}
