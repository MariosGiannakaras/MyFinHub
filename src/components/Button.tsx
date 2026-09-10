import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant='primary'|'secondary'|'danger'|'ghost';

export type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{
  variant?:ButtonVariant;
};

const variantClass:Record<ButtonVariant,string>={
  primary:'save-button',
  secondary:'secondary',
  danger:'save-button destructive-action',
  ghost:'text-button',
};

function mergeClasses(...values:Array<string|undefined|false>){return values.filter(Boolean).join(' ')}

export const Button=forwardRef<HTMLButtonElement,ButtonProps>(function Button({variant='secondary',className,type='button',...props},ref){
  const merged=mergeClasses(variantClass[variant],className);
  return <button ref={ref} type={type} className={merged||undefined} {...props}/>;
});
