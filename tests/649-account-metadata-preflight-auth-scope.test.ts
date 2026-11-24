import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const iban='GR1601101250000000012300695';
const accountId='account-one';
const updatedAt='2026-11-24T00:00:00.000Z';
const record=(revision:number,ibanValue:string|null=null)=>({
  accountId,iban:ibanValue,revision,updatedAt,
});
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{'content-type':'application/json'},
});
const path:string='../src/lib/accountMetadataClient.js';
const activityPath:string='../src/lib/databaseSaveActivity.js';

beforeEach(()=>{
  vi.resetModules();
  vi.stubGlobal('window',new EventTarget());
});
afterEach(()=>vi.unstubAllGlobals());

describe('#649 FP-041 IBAN save cannot cross a newer owner auth scope during catalog preflight',()=>{
  it.each([
    'rheomiq:auth-expired','rheomiq:mfa-required',
    'myfinhub:auth-completed','myfinhub:auth-scope-reset',
  ] as const)('drops an old save waiting on GET after %s without writing the new scope',async boundary=>{
    let finishOld!:(value:Response)=>void;
    const originalGet=new Promise<Response>(done=>{finishOld=done});
    const requests:Array<{method:string;headers:Headers;body:string}>=[];
    let getCount=0,expireEvents=0;
    window.addEventListener('rheomiq:auth-expired',()=>{expireEvents++});
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');
      requests.push({method,headers:new Headers(init?.headers),body:String(init?.body??'')});
      if(method==='GET')return ++getCount===1?originalGet:response({records:[record(8)]});
      if(method!=='PUT')throw new Error('Unexpected IBAN request '+method);
      return response({record:record(9,iban)});
    }));
    const client=await import(path);
    const {getDatabaseSaveSnapshot}=await import(activityPath);
    const previousCompletion=getDatabaseSaveSnapshot().completion;

    // A previous session begins an IBAN change, but its cold catalog GET hangs.
    const staleSave=client.saveAccountMetadata(accountId,iban);
    await vi.waitFor(()=>expect(requests.map(x=>x.method)).toEqual(['GET']));
    window.dispatchEvent(new Event(boundary));
    const expiryCountAfterBoundary=expireEvents;
    // New owner/session reads the fresh catalog while the old GET is in flight.
    const fresh=await client.refreshAccountMetadata(true);
    expect(fresh.records[accountId]).toMatchObject(record(8));
    finishOld(response({records:[record(2)]}));
    await expect(staleSave).rejects.toThrow('Η συνεδρία άλλαξε πριν σταλεί');
    expect(requests.map(x=>x.method)).toEqual(['GET','GET']);
    expect(expireEvents).toBe(expiryCountAfterBoundary);
    expect(client.getAccountMetadataSnapshot().records[accountId]).toMatchObject(record(8));
    expect(getDatabaseSaveSnapshot()).toMatchObject({
      pending:0,failed:true,completion:previousCompletion,
    });
    expect(client.accountMetadataWriteNeedsReview(accountId)).toBe(false);

    // Only a fresh explicit save in the current owner scope may now dispatch.
    await expect(client.saveAccountMetadata(accountId,iban)).resolves.toMatchObject(record(9,iban));
    expect(requests.map(x=>x.method)).toEqual(['GET','GET','PUT']);
    expect(requests[2]?.headers.get('if-match')).toBe('8');
    expect(JSON.parse(requests[2]?.body??'{}')).toEqual({accountId,iban});
    expect(client.getAccountMetadataSnapshot().records[accountId]).toMatchObject(record(9,iban));
  });

  it.each(['401','503','transport-loss'] as const)(
    'does not promote delayed old-session %s GET into a new-session IBAN PUT',async outcome=>{
      let finish!:(value:Response)=>void,reject!:(reason:unknown)=>void;
      const oldGet=new Promise<Response>((done,fail)=>{finish=done;reject=fail});
      const methods:string[]=[];
      let reads=0,expired=0;
      window.addEventListener('rheomiq:auth-expired',()=>{expired++});
      vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
        const method=String(init?.method??'GET');methods.push(method);
        if(method==='PUT')throw new Error('Stale owner PUT is forbidden');
        return ++reads===1?oldGet:response({records:[record(12)]});
      }));
      const client=await import(path);
      const stale=client.saveAccountMetadata(accountId,iban);
      await vi.waitFor(()=>expect(methods).toEqual(['GET']));
      window.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
      await client.refreshAccountMetadata(true);
      if(outcome==='transport-loss')reject(new TypeError('Synthetic old network error'));
      else finish(response({code:'DEVICE_ACCESS_REVOKED',error:'old session'},outcome==='401'?401:503));
      await expect(stale).rejects.toThrow('Η συνεδρία άλλαξε πριν σταλεί');
      expect(methods).toEqual(['GET','GET']);
      expect(expired).toBe(0);
      expect(client.getAccountMetadataSnapshot().records[accountId]).toMatchObject(record(12));
    }
  );

  it('blocks an old save when the auth boundary fires synchronously from shared save activity',async()=>{
    const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');calls.push(method);
      return response({records:[record(4)]});
    }));
    const client=await import(path);
    const {subscribeDatabaseSaves,getDatabaseSaveSnapshot}=await import(activityPath);
    await client.refreshAccountMetadata(true);
    const unsubscribe=subscribeDatabaseSaves(()=>{
      if(getDatabaseSaveSnapshot().pending===1)
        window.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
    });
    try{
      await expect(client.saveAccountMetadata(accountId,iban))
        .rejects.toThrow('Η συνεδρία άλλαξε πριν σταλεί');
    }finally{unsubscribe()}
    expect(calls).toEqual(['GET']);
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:0});
  });
});
