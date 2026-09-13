import { createElement, type ComponentPropsWithoutRef, type ElementType, type ReactElement } from 'react';

export type SurfaceVariant='raised'|'flat'|'inset';

type SurfaceOwnProps<T extends ElementType>={
  as?:T;
  variant?:SurfaceVariant;
  className?:string;
};

type SurfaceProps<T extends ElementType>=SurfaceOwnProps<T>&Omit<ComponentPropsWithoutRef<T>,keyof SurfaceOwnProps<T>>;

export function Surface<T extends ElementType='div'>({
  as,
  variant='raised',
  className='',
  ...props
}:SurfaceProps<T>):ReactElement{
  const component=(as??'div') as ElementType;
  const surfaceClassName=[className,`neo-${variant}`].filter(Boolean).join(' ');
  return createElement(component,{...props,className:surfaceClassName});
}
