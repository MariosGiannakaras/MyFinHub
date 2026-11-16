import {afterEach, describe, expect, it, vi} from 'vitest';
import {acquireModalScrollLock} from '../src/lib/modalScrollLock.js';

type Style={position:string;top:string;left:string;right:string;width:string;overflow:string;overscrollBehavior:string};
function setup(){
  const body={style:{position:'relative',top:'3px',left:'2px',right:'auto',width:'88%',overflow:'auto'} as Style};
  const html={style:{overscrollBehavior:'contain'} as Style};
  vi.stubGlobal('document',{body,documentElement:html});
  vi.stubGlobal('window',{scrollX:19,scrollY:145,scrollTo:vi.fn()});
  return {body,html,original:{...body.style}};
}
afterEach(()=>vi.unstubAllGlobals());

describe('shared modal scroll lock (#649 nested Quick Entry discard)',()=>{
  it('retains parent lock on child close and restores exact original style on final close',()=>{
    const {body,html,original}=setup();
    const parent=acquireModalScrollLock();
    const child=acquireModalScrollLock();
    expect(body.style).toMatchObject({position:'fixed',top:'-145px',left:'-19px',overflow:'hidden'});
    expect(html.style.overscrollBehavior).toBe('none');
    expect(child()).toBeNull();
    expect(body.style.position).toBe('fixed');
    expect(parent()).toEqual({left:19,top:145});
    expect(body.style).toMatchObject(original);
    expect(html.style.overscrollBehavior).toBe('contain');
  });

  it('handles parent-first cleanup when both dialogs discard in one React commit',()=>{
    const {body,html}=setup();
    const parent=acquireModalScrollLock();
    const child=acquireModalScrollLock();
    expect(parent()).toBeNull();
    expect(body.style.position).toBe('fixed');
    expect(child()).toEqual({left:19,top:145});
    expect(body.style.position).toBe('relative');
    expect(html.style.overscrollBehavior).toBe('contain');
  });

  it('never releases a later modal from an earlier stale or duplicate cleanup',()=>{
    const {body,html}=setup();
    const first=acquireModalScrollLock();
    expect(first()).toEqual({left:19,top:145});
    const later=acquireModalScrollLock();
    expect(first()).toBeNull();
    expect(body.style.position).toBe('fixed');
    expect(later()).toEqual({left:19,top:145});
    expect(later()).toBeNull();
    expect(body.style.position).toBe('relative');
    expect(html.style.overscrollBehavior).toBe('contain');
  });

  it('keeps independent overlapping dialogs locked until the last holder exits',()=>{
    const {body}=setup();
    const one=acquireModalScrollLock(),two=acquireModalScrollLock(),three=acquireModalScrollLock();
    expect(two()).toBeNull();
    expect(one()).toBeNull();
    expect(body.style.position).toBe('fixed');
    expect(three()).toEqual({left:19,top:145});
    expect(body.style.position).toBe('relative');
  });
});
