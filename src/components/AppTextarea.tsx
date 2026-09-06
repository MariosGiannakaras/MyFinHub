import { forwardRef, type TextareaHTMLAttributes } from 'react';

type AppTextareaProps=TextareaHTMLAttributes<HTMLTextAreaElement>&{
  invalid?:boolean;
};

export const AppTextarea=forwardRef<HTMLTextAreaElement,AppTextareaProps>(function AppTextarea({invalid=false,className='',...textareaProps},ref){
  return <textarea
    {...textareaProps}
    ref={ref}
    className={`app-control app-textarea ${className}`.trim()}
    aria-invalid={invalid||textareaProps['aria-invalid']||undefined}
  />;
});
