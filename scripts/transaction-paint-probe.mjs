// Browser-side measurement shared by Transactions full-page and focused QA.
// A truthful footer must represent actually painted, non-overlapping rows.
export function transactionPaintState(){
  const mobile=matchMedia('(max-width:680px)').matches;
  const selector=mobile?'.mobile-transaction-row':'.transactions-approved-table tbody tr.transaction-row';
  const footer=document.querySelector(mobile?'.mobile-transaction-progress':'.transactions-ledger-footer');
  const count=(footer?.textContent||'').match(/Εμφανίζονται\s+(\d+)\s+από\s+(\d+)\s+συναλλαγές/);
  const expected=count?Number(count[1]):-1,total=count?Number(count[2]):-1;
  const rows=[...document.querySelectorAll(selector)].filter(node=>{
    const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
    return rect.width>0&&rect.height>0&&style.display!=='none'&&style.visibility!=='hidden';
  });
  const painted=rows.filter(row=>{
    let opacity=1;
    for(let node=row;node;node=node.parentElement){
      const value=Number.parseFloat(getComputedStyle(node).opacity);
      if(Number.isFinite(value))opacity*=value;
    }
    return opacity>=.98;
  }).length;
  const rects=rows.map(row=>row.getBoundingClientRect());
  const overlapping=rects.slice(1).filter((rect,index)=>rect.top<rects[index].bottom-2).length;
  const footerRect=footer?.getBoundingClientRect();
  const footerAfterRows=Boolean(footerRect&&footerRect.height>0&&rects.length&&rects.at(-1).bottom<=footerRect.top+2);
  const ready=expected>=20&&total>=expected&&rows.length===expected&&painted===rows.length&&overlapping===0&&footerAfterRows;
  return {mode:mobile?'mobile':'desktop',expected,total,rendered:rows.length,painted,overlapping,footerAfterRows,ready};
}
