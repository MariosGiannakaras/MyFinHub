import type { ReactNode } from 'react';

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
  const classes=['page-heading',className].filter(Boolean).join(' ');
  return <section id={id} className={classes}>
    {leading}
    <div>
      {eyebrow?<span className="eyebrow">{eyebrow}</span>:null}
      <h1>{title}</h1>
      {description}
    </div>
    {actions?<div className="heading-actions">{actions}</div>:trailing}
  </section>;
}
