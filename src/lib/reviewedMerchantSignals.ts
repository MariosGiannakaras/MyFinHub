import type {FinanceData} from '../types.js';

/** Untrusted OCR names are normalized locally, never sent to a search service. */
function merchantKey(value:string|undefined){
  return (value??'').normalize('NFD').replace(/\p{M}/gu,'')
    .toLocaleLowerCase('el-GR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

/**
 * Advisory evidence from owner-posted purchases only. Do not infer identity
 * from a substring, silently label prior history or create finance events.
 */
export function suggestReceiptCategory(data:FinanceData,merchant?:string):string|undefined{
  const key=merchantKey(merchant);
  if(key.length<4||key.length>90)return undefined;
  const votes=new Map<string,number>();
  const reviewed=new Set<string>();
  let count=0;
  for(const event of data.state.events??[]){
    if((event.kind!=='expense'&&event.kind!=='card_purchase')||!event.category)continue;
    if(merchantKey(event.note)!==key||reviewed.has(event.id))continue;
    reviewed.add(event.id);
    const category=event.category.trim();
    if(!category)continue;
    votes.set(category,(votes.get(category)??0)+1);
    count++;
  }
  if(count<2)return undefined;
  const sorted=[...votes.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'el-GR'));
  const best=sorted[0];
  if(!best||best[1]/count<.6)return undefined;
  // Old categories are historical facts; never silently propose retired names.
  const configured=data.state.settings;
  if(configured){
    const tree=configured.expenseCategoryTree?.length
      ?configured.expenseCategoryTree.map(row=>row.name)
      :configured.expenseCategories;
    const current=tree?.find(name=>merchantKey(name)===merchantKey(best[0]));
    return current;
  }
  return best[0];
}
