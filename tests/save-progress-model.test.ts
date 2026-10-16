import {describe,expect,it} from 'vitest';
import {getDatabaseSaveSnapshot,subscribeDatabaseSaves,trackDatabaseWrite} from '../src/lib/databaseSaveActivity.js';
import {resolveSaveProgressStatus,transitionSaveProgress} from '../src/lib/saveProgressModel.js';

function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((res,rej)=>{resolve=res;reject=rej});return {promise,resolve,reject}}

describe('receipt-driven top-edge save indicator',()=>{
  it('shows real pending until the database Promise resolves and then true success, not a timed completion',async()=>{
    const hold=deferred<number>(),seen:number[]=[];
    const unsub=subscribeDatabaseSaves(()=>seen.push(getDatabaseSaveSnapshot().pending));
    const write=trackDatabaseWrite(()=>hold.promise);
    expect(resolveSaveProgressStatus('saved',getDatabaseSaveSnapshot())).toBe('saving');
    expect(seen).toContain(1);
    await Promise.resolve();expect(getDatabaseSaveSnapshot().pending).toBe(1);
    hold.resolve(2);expect(await write).toBe(2);
    expect(getDatabaseSaveSnapshot().pending).toBe(0);
    expect(resolveSaveProgressStatus('saved',getDatabaseSaveSnapshot())).toBe('idle');
    expect(transitionSaveProgress('saving','idle')).toBe('idle'); // no new receipt is not success
    expect(transitionSaveProgress('saving','idle',true)).toBe('success');
    unsub();
  });
  it('keeps multiple independent database writes pending until the final response, including failure',async()=>{
    const first=deferred<void>(),second=deferred<void>();
    const a=trackDatabaseWrite(()=>first.promise),b=trackDatabaseWrite(()=>second.promise);
    first.resolve();await a;
    expect(getDatabaseSaveSnapshot().pending).toBe(1);
    expect(resolveSaveProgressStatus('saved',getDatabaseSaveSnapshot())).toBe('saving');
    second.reject(new Error('database rejected'));await expect(b).rejects.toThrow('database rejected');
    expect(getDatabaseSaveSnapshot().pending).toBe(0);
    expect(resolveSaveProgressStatus('saved',getDatabaseSaveSnapshot())).toBe('error');
    expect(transitionSaveProgress('saving','error',true)).toBe('error');
  });
  it('does not show a false green after initial load or after conflict',async()=>{
    expect(transitionSaveProgress('idle','idle')).toBe('idle');
    expect(transitionSaveProgress('error','idle')).toBe('idle');
    expect(resolveSaveProgressStatus('conflict',{pending:0,failed:false,completion:0})).toBe('error');
    expect(resolveSaveProgressStatus('error',{pending:1,failed:false,completion:0})).toBe('error');
    expect(resolveSaveProgressStatus('saved',{pending:0,failed:false,completion:0},true)).toBe('saving');
    expect(resolveSaveProgressStatus('loading',{pending:0,failed:false,completion:0})).toBe('idle');
    expect(transitionSaveProgress('saving','idle',false)).toBe('idle'); // reload cannot fabricate a green bar.
    const recovery=trackDatabaseWrite(async()=>undefined);await recovery;
    expect(getDatabaseSaveSnapshot().failed).toBe(false);
    expect(transitionSaveProgress('error','idle')).toBe('idle');
  });
});
