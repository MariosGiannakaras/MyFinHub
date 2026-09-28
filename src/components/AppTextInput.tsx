import { forwardRef, type InputHTMLAttributes } from 'react';

type AppTextInputProps=InputHTMLAttributes<HTMLInputElement>&{
  invalid?:boolean;
};

export const AppTextInput=forwardRef<HTMLInputElement,AppTextInputProps>(function AppTextInput({invalid=false,className='',...inputProps},ref){
  return <input
    {...inputProps}
    ref={ref}
    className={`app-control app-text-input ${className}`.trim()}
    aria-invalid={invalid||inputProps['aria-invalid']||undefined}
  />;
});
