import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_TILT_REST, cardPointerTiltTransform } from '../src/lib/cardPointerTilt.js';

const debit=readFileSync(new URL('../src/components/InteractivePaymentCard.tsx',import.meta.url),'utf8');
const credit=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');

describe('owner-approved card pointer tilt preservation',()=>{
  const rect={left:100,top:200,width:200,height:100};
  it('rotates toward pointer positions with bounded 3D angles and stable center',()=>{
    expect(cardPointerTiltTransform(rect,200,250)).toBe(CARD_TILT_REST);
    expect(cardPointerTiltTransform(rect,100,200)).toBe('perspective(1000px) rotateY(-6.5deg) rotateX(6.5deg)');
    expect(cardPointerTiltTransform(rect,300,300)).toBe('perspective(1000px) rotateY(6.5deg) rotateX(-6.5deg)');
    expect(cardPointerTiltTransform(rect,-100,500)).toBe('perspective(1000px) rotateY(-6.5deg) rotateX(-6.5deg)');
    expect(cardPointerTiltTransform({...rect,width:0},200,250)).toBe(CARD_TILT_REST);
  });
  it('locks both active card renderers to one mouse/pen tilt geometry and reduced-motion boundary',()=>{
    expect(debit).toContain('cardPointerTiltTransform(rect,event.clientX,event.clientY)');
    expect(credit).toContain('cardPointerTiltTransform(baseRect,event.clientX,event.clientY)');
    expect(debit).toContain('tiltRectRef.current=event.currentTarget.getBoundingClientRect()');
    expect(credit).toContain('baseRect=card.getBoundingClientRect()');
    for(const source of [debit,credit]){
      expect(source).toContain('cardPointerTiltAllowed(event.pointerType)');
      expect(source).toContain('CARD_TILT_REST');
      expect(source).toContain('cancelAnimationFrame(');
    }
    expect(debit).toContain('onPointerCancel={resetTilt}');
    expect(credit).toContain("card.addEventListener('pointercancel',reset)");
  });
});
