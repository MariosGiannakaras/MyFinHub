import { Check, ChevronDown, X } from 'lucide-react';
import { Children, isValidElement, useId, useMemo, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '../hooks/useModalFocus';

type OptionProps={value?:string;disabled?:boolean;children?:ReactNode};
type ChangeLike={target:{value:string}};
type OwnedOption={value:string;label:string;disabled:boolean};
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'children'|'readOnly'|'type'> & {value:string;onChange:(event:ChangeLike)=>void;children:ReactNode};

function optionText(value:ReactNode){return typeof value==='string'||typeof value==='number'?String(value):Children.toArray(value).map(child=>typeof child==='string'||typeof child==='number'?String(child):'').join('');}

export function AppSelectInput({value,onChange,children,disabled=false,'aria-label':ariaLabel,className='',...inputProps}:Props){
  const [open,setOpen]=useState(false);const id=useId();const dialogId=`owned-select-${id.replace(/:/g,'')}`;const ref=useModalFocus<HTMLElement>(open,'[aria-selected="true"]',()=>setOpen(false));
  const options=useMemo<OwnedOption[]>(()=>Children.toArray(children).flatMap(child=>{if(!isValidElement(child)||child.type!=='option')return[];const element=child as ReactElement<OptionProps>;const label=optionText(element.props.children);return [{value:String(element.props.value??label),label,disabled:Boolean(element.props.disabled)}]}),[children]);
  const selected=options.find(option=>option.value===value)??options[0];
  const close=()=>setOpen(false);const choose=(next:string)=>{const option=options.find(item=>item.value===next);if(!option||option.disabled)return;onChange({target:{value:next}});close()};
  const move=(event:KeyboardEvent<HTMLElement>)=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const nodes=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')];if(!nodes.length)return;const current=Math.max(0,nodes.indexOf(document.activeElement as HTMLButtonElement));const next=event.key==='Home'?0:event.key==='End'?nodes.length-1:event.key==='ArrowDown'?Math.min(nodes.length-1,current+1):Math.max(0,current-1);nodes[next]?.focus()};
  const portal=open&&typeof document!=='undefined'?createPortal(<div className="owned-popover-backdrop" onMouseDown={close}><section ref={ref} id={dialogId} className="owned-popover owned-select-popover neo-raised" role="dialog" aria-modal="true" aria-label={ariaLabel||'Επιλογή'} tabIndex={-1} onMouseDown={event=>event.stopPropagation()} onKeyDown={move}><header><b>{ariaLabel||'Επιλογή'}</b><button type="button" className="icon-button" aria-label="Κλείσιμο επιλογών" title="Κλείσιμο επιλογών" onClick={close}><X size={17}/></button></header><div className="owned-option-list" role="listbox" aria-label={ariaLabel||'Επιλογές'}>{options.map(option=><button type="button" role="option" aria-selected={option.value===value} disabled={option.disabled} key={option.value} onClick={()=>choose(option.value)}><span>{option.label}</span>{option.value===value?<Check size={16}/>:null}</button>)}</div></section></div>,document.body):null;
  return <><span className={`owned-input-shell owned-select-shell ${className}`.trim()}><input {...inputProps} className="owned-input" readOnly disabled={disabled} value={selected?.label??''} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={dialogId} aria-label={ariaLabel} onClick={()=>!disabled&&setOpen(true)} onKeyDown={event=>{if(disabled)return;if(['Enter',' ','ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setOpen(true)}}}/><ChevronDown size={16} aria-hidden="true"/></span>{portal}</>;
}
