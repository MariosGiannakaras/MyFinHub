import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { categoryPath } from '../lib/categories';
import { money } from '../lib/format';
import type { SplitPart } from '../types';

export function TransactionSplitDetails({parts}:{parts:SplitPart[]}){
  const [open,setOpen]=useState(false);
  const contentId=useId();
  if(parts.length<2)return null;
  return <div className={`transaction-split-disclosure${open?' is-open':''}`}>
    <button type="button" className="transaction-split-toggle" aria-expanded={open} aria-controls={contentId} onClick={()=>setOpen(value=>!value)}>
      <span>{parts.length} μέρη</span><small>{open?'Απόκρυψη':'Προβολή ανάλυσης'}</small><ChevronDown size={14} aria-hidden="true"/>
    </button>
    {open?<div id={contentId} className="transaction-split-details" aria-label="Ανάλυση διαχωρισμένης αγοράς">
      {parts.map((part,index)=><span className="transaction-split-part" key={part.id||`${part.category}-${index}`}>
        <span>{part.label?.trim()||categoryPath(part.category,part.subcategory)}</span>
        <small>{categoryPath(part.category,part.subcategory)}</small>
        <b>{money.format(part.amount)}</b>
      </span>)}
    </div>:null}
  </div>;
}
