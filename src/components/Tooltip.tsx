import { cloneElement, isValidElement, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { TooltipSide } from '../lib/tooltipPlacement';

type DescribedElement = ReactElement<{ 'aria-describedby'?: string }>;
export function Tooltip({ label, children, side = 'bottom' }: { label: string; children: ReactNode; side?: TooltipSide }) {
  const id=useId(),anchor=useRef<HTMLSpanElement>(null);
  const [active,setActive]=useState(false);
  const [dismissed,setDismissed]=useState(false);
  const activate=()=>{setDismissed(false);setActive(true)};
  useLayoutEffect(()=>{
    if(!active||dismissed||!anchor.current)return;
    // Dismiss supplementary content without moving focus or intercepting
    // an enclosing dialog's established Escape behavior.
    const dismiss=(event:KeyboardEvent)=>{if(event.key==='Escape')setDismissed(true)};
    window.addEventListener('keydown',dismiss,true);
    let cancelled=false,release:(()=>void)|undefined;
    void import('../lib/tooltipPlacement').then(module=>{if(!cancelled&&anchor.current)release=module.observeTooltip(anchor.current,side)}).catch(()=>{});
    return()=>{cancelled=true;release?.();window.removeEventListener('keydown',dismiss,true)};
  },[active,dismissed,side,label]);
  const child=isValidElement(children)?cloneElement(children as DescribedElement,{'aria-describedby':[(children as DescribedElement).props['aria-describedby'],id].filter(Boolean).join(' ')}):children;
  return <span ref={anchor} className={`app-tooltip app-tooltip-${side}`} data-tooltip-dismissed={dismissed?'true':undefined} onMouseEnter={activate} onMouseLeave={event=>{if(!event.currentTarget.matches(':focus-within'))setActive(false)}} onFocus={activate} onBlur={event=>{if(!event.currentTarget.matches(':hover'))setActive(false)}}>
    {child}<span className="app-tooltip-bubble" id={id} role="tooltip" onClick={event=>event.stopPropagation()}>{label}</span>
  </span>;
}
