import { createElement, type HTMLAttributes } from 'react';

export type SurfaceVariant='raised'|'flat'|'inset';
export type SurfaceElement='div'|'section'|'article'|'aside';

type SurfaceProps=HTMLAttributes<HTMLElement>&{
  as?:SurfaceElement;
  variant?:SurfaceVariant;
};

export function Surface({as='div',variant='raised',className='',...props}:SurfaceProps){
  const surfaceClassName=[className,`neo-${variant}`].filter(Boolean).join(' ');
  return createElement(as,{...props,className:surfaceClassName});
}
