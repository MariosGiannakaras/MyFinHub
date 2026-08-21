import { categoryPath } from '../lib/categories';
import { money } from '../lib/format';
import type { SplitPart } from '../types';

export function TransactionSplitDetails({parts}:{parts:SplitPart[]}){
  if(parts.length<2)return null;
  return <div className="transaction-split-details" aria-label="Ανάλυση διαχωρισμένης αγοράς">
    {parts.map((part,index)=><span className="transaction-split-part" key={part.id||`${part.category}-${index}`}>
      <span>{part.label?.trim()||categoryPath(part.category,part.subcategory)}</span>
      <small>{categoryPath(part.category,part.subcategory)}</small>
      <b>{money.format(part.amount)}</b>
    </span>)}
  </div>;
}
