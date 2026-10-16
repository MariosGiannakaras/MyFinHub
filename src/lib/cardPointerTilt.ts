/** Shared pointer-driven 3D card motion geometry for debit/prepaid and credit renderers.
 * The rectangle must be captured before the card rotates so its changing bounds
 * cannot feed back into the next pointer calculation. This module never owns card state.
 */
export const CARD_TILT_REST='perspective(1000px) rotateY(0deg) rotateX(0deg)';

export function cardPointerTiltTransform(
  rect:Pick<DOMRectReadOnly,'left'|'top'|'width'|'height'>,
  clientX:number,
  clientY:number,
):string{
  if(rect.width<=0||rect.height<=0)return CARD_TILT_REST;
  const x=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
  const y=Math.max(0,Math.min(1,(clientY-rect.top)/rect.height));
  const ry=Math.max(-6.5,Math.min(6.5,(x-.5)*13));
  const rx=Math.max(-6.5,Math.min(6.5,-(y-.5)*13));
  return `perspective(1000px) rotateY(${ry}deg) rotateX(${rx}deg)`;
}

export function cardPointerTiltAllowed(pointerType:string):boolean{
  return (pointerType==='mouse'||pointerType==='pen')&&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches&&
    document.documentElement.dataset.motion!=='reduced';
}
