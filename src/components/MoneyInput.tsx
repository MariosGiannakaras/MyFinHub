import type { InputHTMLAttributes } from 'react';

type MoneyInputProps=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'inputMode'|'value'|'onChange'>&{
  value:string;
  onValueChange:(value:string)=>void;
  currency?:string;
  invalid?:boolean;
  wrapperClassName?:string;
};

export function normalizeMoneyInputText(value:string){return value.replace(/,/g,'.')}

export function MoneyInput({value,onValueChange,currency='€',invalid=false,wrapperClassName='',className='',...inputProps}:MoneyInputProps){
  return <span className={`money-input ${wrapperClassName}`.trim()}>
    <b aria-hidden="true">{currency}</b>
    <input
      {...inputProps}
      className={className}
      type="text"
      inputMode="decimal"
      value={value}
      aria-invalid={invalid||undefined}
      onChange={event=>onValueChange(normalizeMoneyInputText(event.target.value))}
    />
  </span>;
}
