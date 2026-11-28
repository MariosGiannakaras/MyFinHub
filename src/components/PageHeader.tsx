import { useEffect, useRef, type ReactNode } from 'react';

type PageHeaderProps={
  eyebrow?:ReactNode;
  title:ReactNode;
  description?:ReactNode;
  leading?:ReactNode;
  actions?:ReactNode;
  trailing?:ReactNode;
  className?:string;
  id?:string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  leading,
  actions,
  trailing,
  className='',
  id,
}:PageHeaderProps){
  const headingRef=useRef<HTMLHeadingElement>(null);
  // Focus the actual mounted route heading, not a departing or lazy placeholder.
  useEffect(()=>{
    const heading=headingRef.current;
    const frame=requestAnimationFrame(()=>{
      if(!heading?.isConnected||!heading.closest('#main-workspace')||heading.closest('[inert]'))return;
      const active=document.activeElement;
      if(active===document.body||active?.closest('.sidebar nav,.mobile-nav,.brand-home-button'))
        heading.focus({ preventScroll: true });
    });
    return ()=>cancelAnimationFrame(frame);
  },[]);
  const classes=['page-heading',className].filter(Boolean).join(' ');
  return <section id={id} className={classes}>
    {leading}
    <div>
      {eyebrow?<span className="eyebrow">{eyebrow}</span>:null}
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      {description}
    </div>
    {actions?<div className="heading-actions">{actions}</div>:trailing}
  </section>;
}
