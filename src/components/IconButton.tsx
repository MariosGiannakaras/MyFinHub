import { forwardRef, type ButtonHTMLAttributes } from 'react';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-label'>{
  label:string;
}

export const IconButton=forwardRef<HTMLButtonElement,IconButtonProps>(function IconButton({label,className='',type,...props},ref){
  return <button ref={ref} type={type} className={`icon-button ${className}`.trim()} aria-label={label} data-button-variant="icon" {...props}/>;
});
