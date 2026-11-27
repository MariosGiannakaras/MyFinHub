import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextWithFallback } from '../src/lib/copyTextWithFallback.js';

afterEach(()=>vi.unstubAllGlobals());

function legacyCopy(behavior:'ok'|'false'|'throws'){
  class FocusTarget{
    isConnected=true;
    focus=vi.fn();
  }
  const previousFocus=new FocusTarget();
  const field={value:'',readOnly:false,style:{} as Record<string,string>,select:vi.fn(),remove:vi.fn()};
  const appendChild=vi.fn();
  const execCommand=vi.fn(()=>{
    if(behavior==='throws')throw new Error('Clipboard unavailable');
    return behavior==='ok';
  });
  vi.stubGlobal('HTMLElement',FocusTarget);
  vi.stubGlobal('navigator',{clipboard:undefined});
  vi.stubGlobal('document',{
    activeElement:previousFocus,
    createElement:vi.fn(()=>field),
    body:{appendChild},
    execCommand,
  });
  return {previousFocus,field,appendChild,execCommand};
}

describe('owner-initiated clipboard copy and keyboard focus (#649 I20.06)',()=>{
  it('uses the native clipboard path without creating a temporary field',async()=>{
    const writeText=vi.fn(async()=>undefined);
    const createElement=vi.fn();
    vi.stubGlobal('navigator',{clipboard:{writeText}});
    vi.stubGlobal('document',{createElement});
    await expect(copyTextWithFallback('sensitive value')).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('sensitive value');
    expect(createElement).not.toHaveBeenCalled();
  });

  it('restores keyboard focus and clears the temporary field after a successful legacy copy',async()=>{
    const {previousFocus,field,appendChild,execCommand}=legacyCopy('ok');
    await expect(copyTextWithFallback('GR00 1234')).resolves.toBeUndefined();
    expect(appendChild).toHaveBeenCalledOnce();
    expect(field.select).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(field.value).toBe('');
    expect(field.remove).toHaveBeenCalledOnce();
    expect(previousFocus.focus).toHaveBeenCalledTimes(1);
    expect(previousFocus.focus).toHaveBeenCalledWith({preventScroll:true});
  });

  it('does not report a false successful copy when the fallback returns false',async()=>{
    const {previousFocus,field}=legacyCopy('false');
    await expect(copyTextWithFallback('secret')).rejects.toThrow('COPY_FAILED');
    expect(field.value).toBe('');
    expect(field.remove).toHaveBeenCalledOnce();
    expect(previousFocus.focus).toHaveBeenCalledTimes(1);
    expect(previousFocus.focus).toHaveBeenCalledWith({preventScroll:true});
  });

  it('clears the temporary field and restores focus when the fallback throws',async()=>{
    const {previousFocus,field}=legacyCopy('throws');
    await expect(copyTextWithFallback('secret')).rejects.toThrow('Clipboard unavailable');
    expect(field.value).toBe('');
    expect(field.remove).toHaveBeenCalledOnce();
    expect(previousFocus.focus).toHaveBeenCalledTimes(1);
    expect(previousFocus.focus).toHaveBeenCalledWith({preventScroll:true});
  });
});
