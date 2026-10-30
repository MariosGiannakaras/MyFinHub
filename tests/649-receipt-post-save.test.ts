import {describe,expect,it,vi} from 'vitest';
import {saveFinanceThenCleanupReceipt} from '../src/lib/receiptPostSave.js';

describe('#649 receipt post-save second-store boundary',()=>{
  it('never deletes local evidence when the finance commit was rejected',async()=>{
    const save=vi.fn(async()=>{throw new Error('conflict')});
    const cleanup=vi.fn(async()=>undefined),notify=vi.fn();
    await expect(saveFinanceThenCleanupReceipt(save,cleanup,notify)).rejects.toThrow('conflict');
    expect(cleanup).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
  it('reports only failed local cleanup after confirmed finance write; never posts the event twice',async()=>{
    const save=vi.fn(async()=>undefined),cleanup=vi.fn(async()=>{throw new Error('IndexedDB blocked')});
    const notify=vi.fn();
    await expect(saveFinanceThenCleanupReceipt(save,cleanup,notify)).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it('does not convert a confirmed finance save to failure when local cleanup reporting itself throws',async()=>{
    const save=vi.fn(async()=>undefined);
    const cleanup=vi.fn(async()=>{throw new Error('local receipt storage rejected')});
    const notify=vi.fn(()=>{throw new Error('notification UI unavailable')});
    await expect(saveFinanceThenCleanupReceipt(save,cleanup,notify)).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it('removes the local draft once after finance save and does not announce false errors',async()=>{
    const order:string[]=[];
    const save=vi.fn(async()=>{order.push('finance')});
    const cleanup=vi.fn(async()=>{order.push('local')});
    const notify=vi.fn();
    await saveFinanceThenCleanupReceipt(save,cleanup,notify);
    expect(order).toEqual(['finance','local']);
    expect(notify).not.toHaveBeenCalled();
  });
  it('accepts a non-receipt event without touching local storage',async()=>{
    const save=vi.fn(async()=>undefined),notify=vi.fn();
    await saveFinanceThenCleanupReceipt(save,null,notify);
    expect(save).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });
});
