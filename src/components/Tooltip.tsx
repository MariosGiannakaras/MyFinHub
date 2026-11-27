import { cloneElement, isValidElement, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { TooltipSide } from '../lib/tooltipPlacement';

type DescribedElement = ReactElement<{ 'aria-describedby'?: string }>;
export function Tooltip({ label, children, side = 'bottom' }: { label: string; children: ReactNode; side?: TooltipSide }) {
  const id=useId(),anchor=useRef<HTMLSpanElement>(null);
  const [active,setActive]=useState(false);
  useLayoutEffect(()=>{
    if(!active||!anchor.current)return;
    let cancelled=false,release:(()=>void)|undefined;
    void import('../lib/tooltipPlacement').then(module=>{if(!cancelled&&anchor.current)release=module.observeTooltip(anchor.current,side)}).catch(()=>{});
    return()=>{cancelled=true;release?.()};
  },[active,side,label]);
  const child=isValidElement(children)?cloneElement(children as DescribedElement,{'aria-describedby':[(children as DescribedElement).props['aria-describedby'],id].filter(Boolean).join(' ')}):children;
  return <span ref={anchor} className={`app-tooltip app-tooltip-${side}`} onMouseEnter={()=>setActive(true)} onMouseLeave={event=>{if(!event.currentTarget.matches(':focus-within'))setActive(false)}} onFocus={()=>setActive(true)} onBlur={event=>{if(!event.currentTarget.matches(':hover'))setActive(false)}}>
    {child}<span className="app-tooltip-bubble" id={id} role="tooltip">{label}</span>
  </span>;
}
