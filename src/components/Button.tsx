import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant='primary'|'secondary'|'danger'|'text';

const variantClass:Record<ButtonVariant,string>={
  primary:'save-button',
  secondary:'secondary',
  danger:'save-button destructive-action',
  text:'text-button',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>{
  variant?:ButtonVariant;
}

export const Button=forwardRef<HTMLButtonElement,ButtonProps>(function Button({variant='secondary',className='',type='button',...props},ref){
  return <button ref={ref} type={type} className={`${variantClass[variant]} ${className}`.trim()} data-button-variant={variant} {...props}/>;
});
