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

// Headless Chromium full-page CDP clips can re-rasterize completed entrance
// animation layers as transparent although the ordinary viewport paints them.
// Only AFTER strict live paint readiness, suppress finite entrance animations
// for one screenshot. Do not force opacity, hide rows or change app CSS.
export async function settleTransactionCapture(){
  if(document.querySelector('style[data-transaction-capture-only]'))
    throw new Error('Transactions capture override already installed');
  const rows=document.querySelectorAll('.transactions-approved-table tbody[data-content-entrance="table"] > tr,.mobile-transaction-list[data-content-entrance="list"] > .mobile-transaction-row');
  if(!rows.length)throw new Error('No Transactions rows exist for settled screenshot');
  const style=document.createElement('style');
  style.dataset.transactionCaptureOnly='true';
  style.textContent='.transactions-approved-table tbody[data-content-entrance="table"] > tr,.mobile-transaction-list[data-content-entrance="list"] > .mobile-transaction-row{animation:none!important}';
  document.head.append(style);
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  return rows.length;
}
export function releaseTransactionCapture(){
  const style=document.querySelector('style[data-transaction-capture-only]');
  if(!style)throw new Error('Missing temporary Transactions screenshot style');
  style.remove();
  return true;
}
