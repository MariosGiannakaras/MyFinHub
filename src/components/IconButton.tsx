import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type IconButtonProps=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-label'>&{
  'aria-label':string;
};

function mergeClasses(...values:Array<string|undefined|false>){return values.filter(Boolean).join(' ')}

export const IconButton=forwardRef<HTMLButtonElement,IconButtonProps>(function IconButton({className,type='button',...props},ref){
  return <button ref={ref} type={type} className={mergeClasses('icon-button',className)} {...props}/>;
});
