import type { ReactNode } from 'react';

type AppInputShellProps={
  leading?:ReactNode;
  trailing?:ReactNode;
  children:ReactNode;
  className?:string;
  invalid?:boolean;
};

export function AppInputShell({leading,trailing,children,className='',invalid=false}:AppInputShellProps){
  return <span className={`app-input-shell ${className}`.trim()} data-invalid={invalid?'true':undefined}>
    {leading?<span className="app-input-shell-leading" aria-hidden="true">{leading}</span>:null}
    {children}
    {trailing?<span className="app-input-shell-trailing">{trailing}</span>:null}
  </span>;
}
