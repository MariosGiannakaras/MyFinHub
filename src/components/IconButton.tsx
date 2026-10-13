import { forwardRef, type ButtonHTMLAttributes } from 'react';

type IconButtonVariant='default'|'accent'|'quiet';

type IconButtonProps=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-label'>&{
  'aria-label':string;
  variant?:IconButtonVariant;
};

const variantClass:Record<IconButtonVariant,string|undefined>={
  default:undefined,
  accent:'icon-button-accent',
  quiet:'icon-button-quiet',
};

function mergeClasses(...values:Array<string|undefined|false>){return values.filter(Boolean).join(' ')}

export const IconButton=forwardRef<HTMLButtonElement,IconButtonProps>(function IconButton({className,type='button',variant='default',...props},ref){
  return <button ref={ref} type={type} className={mergeClasses('icon-button',variantClass[variant],className)} {...props}/>;
});
