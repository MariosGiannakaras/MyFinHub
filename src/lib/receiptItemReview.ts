import type {ReceiptProposal} from './receiptDrafts.js';

function positiveCents(value:string):number|null{
  const raw=value.trim();
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(raw))return null;
  const [whole,fraction='']=raw.replace(',','.').split('.');
  const cents=Number(whole)*100+Number((fraction+'00').slice(0,2));
  return Number.isSafeInteger(cents)&&cents>0?cents:null;
}

/** Validate owner-reviewed line amounts in integer EUR cents; never book money. */
export function normalizeReceiptLineReview(proposal:ReceiptProposal,amounts:Record<string,string>,totalText:string){
  const source=proposal.items??[];
  const ids=new Set<string>();
  let valid=source.length<=40;
  let sumCents=0;
  const items=source.map(item=>{
    const description=item.description.trim();
    const id=item.id.trim();
    const cents=positiveCents(amounts[item.id]??String(item.amount));
    if(!id||ids.has(id)||!description||description.length>90||cents===null)valid=false;
    ids.add(id);
    if(cents!==null)sumCents+=cents;
    return {...item,description,amount:(cents??0)/100,
      category:item.category?.trim()||undefined,
      subcategory:item.category?(item.subcategory?.trim()||undefined):undefined};
  });
  if(!Number.isSafeInteger(sumCents))valid=false;
  const totalCents=positiveCents(totalText);
  return {items,valid,sumCents,totalCents,balanced:valid&&totalCents!==null&&sumCents===totalCents};
}
