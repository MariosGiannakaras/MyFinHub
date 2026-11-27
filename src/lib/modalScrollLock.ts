// A shared document scroll lock for overlapping and nested modal roots.
// Final unlock restores the outermost snapshot regardless of React cleanup order.
type OriginalStyle={position:string;top:string;left:string;right:string;width:string;overflow:string};
type ScrollLock={body:HTMLElement;html:HTMLElement;style:OriginalStyle;overscroll:string;x:number;y:number;holders:number};
let active:ScrollLock|null=null;

export function acquireModalScrollLock():()=>{left:number;top:number}|null {
  if(!active){
    const body=document.body;
    const html=document.documentElement;
    active={
      body,html,holders:0,x:window.scrollX,y:window.scrollY,
      style:{
        position:body.style.position,top:body.style.top,left:body.style.left,
        right:body.style.right,width:body.style.width,overflow:body.style.overflow,
      },
      overscroll:html.style.overscrollBehavior,
    };
    body.style.position='fixed';
    body.style.top='-'+active.y+'px';
    body.style.left='-'+active.x+'px';
    body.style.right='0';
    body.style.width='100%';
    body.style.overflow='hidden';
    html.style.overscrollBehavior='none';
  }
  const held=active;
  held.holders++;
  let released=false;
  return()=>{
    if(released)return null;
    released=true;
    if(--held.holders!==0||active!==held)return null;
    active=null;
    const {body,html,style}=held;
    body.style.position=style.position;
    body.style.top=style.top;
    body.style.left=style.left;
    body.style.right=style.right;
    body.style.width=style.width;
    body.style.overflow=style.overflow;
    html.style.overscrollBehavior=held.overscroll;
    return {left:held.x,top:held.y};
  };
}
