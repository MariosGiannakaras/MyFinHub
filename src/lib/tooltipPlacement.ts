export type TooltipSide='top'|'right'|'bottom'|'left';

export function observeTooltip(node:HTMLSpanElement,side:TooltipSide){
  const bubble=node.querySelector<HTMLElement>('.app-tooltip-bubble');
  if(!bubble)return ()=>{};
  const place=()=>{
    delete bubble.dataset.positioned;
    delete bubble.dataset.placedSide;
    if(node.dataset.tooltipDismissed||!bubble.getClientRects().length)return;
    const a=node.getBoundingClientRect(),gap=8;
    let left=gap,top=gap,right=document.documentElement.clientWidth-gap,bottom=document.documentElement.clientHeight-gap;
    // The viewport already represents root scrolling; only real inner scrollports clip this anchor.
    for(let parent=node.parentElement;parent&&parent!==document.body&&parent!==document.documentElement;parent=parent.parentElement){
      const style=getComputedStyle(parent),r=parent.getBoundingClientRect();
      const x=r.left+parent.clientLeft,y=r.top+parent.clientTop;
      if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,x+gap);right=Math.min(right,x+parent.clientWidth-gap)}
      if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,y+gap);bottom=Math.min(bottom,y+parent.clientHeight-gap)}
    }
    if(right-left<36||bottom-top<20)return;
    bubble.style.maxWidth=Math.min(260,right-left)+'px';
    const {width:w,height:h}=bubble.getBoundingClientRect();
    const x=(a.left+a.right-w)/2,y=(a.top+a.bottom-h)/2;
    const positions={top:[x,a.top-gap-h],bottom:[x,a.bottom+gap],left:[a.left-gap-w,y],right:[a.right+gap,y]};
    const opposite={top:'bottom',bottom:'top',left:'right',right:'left'} as const;
    const candidates=[side,opposite[side],...(['bottom','top','right','left'] as const)];
    const chosen=candidates.find(key=>key==='top'?positions.top[1]>=top:key==='bottom'?positions.bottom[1]+h<=bottom:key==='left'?positions.left[0]>=left:positions.right[0]+w<=right);
    if(!chosen||w>right-left||h>bottom-top)return;
    const [px,py]=positions[chosen];
    bubble.style.left=(Math.max(left,Math.min(right-w,px))-a.left)+'px';
    bubble.style.top=(Math.max(top,Math.min(bottom-h,py))-a.top)+'px';
    bubble.dataset.placedSide=chosen;
    bubble.dataset.positioned='true';
  };
  // Supplementary content stays dismissible without moving focus or
  // intercepting the enclosing dialog's own Escape handling. Keep this
  // lifecycle in the already lazy placement chunk, not the eager shell.
  const dismiss=(event:KeyboardEvent)=>{
    if(event.key!=='Escape')return;
    node.dataset.tooltipDismissed='true';
    delete bubble.dataset.positioned;
    delete bubble.dataset.placedSide;
  };
  const activate=()=>{delete node.dataset.tooltipDismissed;place()};
  const stopClick=(event:MouseEvent)=>event.stopPropagation();
  node.addEventListener('mouseenter',activate);
  node.addEventListener('focusin',activate);
  bubble.addEventListener('click',stopClick);
  window.addEventListener('keydown',dismiss,true);
  place();
  const observer=new ResizeObserver(place);observer.observe(node);observer.observe(bubble);
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{
    observer.disconnect();
    node.removeEventListener('mouseenter',activate);
    node.removeEventListener('focusin',activate);
    bubble.removeEventListener('click',stopClick);
    window.removeEventListener('keydown',dismiss,true);
    window.removeEventListener('resize',place);
    window.removeEventListener('scroll',place,true);
    delete node.dataset.tooltipDismissed;
    delete bubble.dataset.positioned;
    delete bubble.dataset.placedSide;
    bubble.style.removeProperty('left');
    bubble.style.removeProperty('top');
    bubble.style.removeProperty('max-width');
  };
}
