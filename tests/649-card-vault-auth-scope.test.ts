import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';

const {readLocalCvvMock}=vi.hoisted(()=>({readLocalCvvMock:vi.fn()}));
vi.mock('../src/lib/localCvvVault.js',()=>({readLocalCvv:readLocalCvvMock}));

beforeEach(()=>{
  vi.resetModules();
  vi.stubGlobal('window',new EventTarget());
});
afterEach(()=>{
  vi.unstubAllGlobals();
  readLocalCvvMock.mockReset();
});

function deferred<T>(){
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(done=>{resolve=done});
  return {promise,resolve};
}
const payload=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{'content-type':'application/json'},
});
const boundary=()=>window.dispatchEvent(new Event('myfinhub:auth-scope-reset'));

describe('#649 I22.02 Card Vault auth scope and stale receipt isolation',()=>{
  it('rejects stale PAN/expiry/CVV readback while a new owner session can read its own result',async()=>{
    const old=deferred<Response>();
    let count=0;
    vi.stubGlobal('fetch',vi.fn(async()=>{
      if(++count===1)return old.promise;
      return payload({pan:'4222222222222222',expiry:'11/30',cvv:'321'});
    }));
    const clientPath:string='../src/lib/cardVaultClient.js';
    const {revealCardSecret}=await import(clientPath);
    const stale=revealCardSecret('synthetic-card');
    boundary();
    const fresh=await revealCardSecret('synthetic-card');
    expect(fresh).toEqual({pan:'4222222222222222',expiry:'11/30',cvv:'321'});
    old.resolve(payload({pan:'4111111111111111',expiry:'12/30',cvv:'123'}));
    await expect(stale).rejects.toMatchObject({
      name:'CardVaultClientError',code:'CARD_VAULT_AUTH_SCOPE_CHANGED',
    });
    expect(count).toBe(2);
  });

  it('discards an older 401 without expiring a newer authenticated browser session',async()=>{
    const old=deferred<Response>();
    let count=0,expiryEvents=0;
    window.addEventListener('rheomiq:auth-expired',()=>{expiryEvents++});
    vi.stubGlobal('fetch',vi.fn(async()=>{
      if(++count===1)return old.promise;
      return payload({pan:'4222222222222222',expiry:null,cvv:null});
    }));
    const clientPath:string='../src/lib/cardVaultClient.js';
    const {revealCardSecret}=await import(clientPath);
    const stale=revealCardSecret('synthetic-card');
    boundary();
    await expect(revealCardSecret('synthetic-card'))
      .resolves.toEqual({pan:'4222222222222222',expiry:undefined,cvv:undefined});
    old.resolve(payload({code:'DEVICE_ACCESS_REVOKED',error:'Old device revoked'},401));
    await expect(stale).rejects.toMatchObject({code:'CARD_VAULT_AUTH_SCOPE_CHANGED'});
    expect(expiryEvents).toBe(0);
  });

  it('keeps the current-scope definite 401 classification and one auth-expiry event',async()=>{
    let expiryEvents=0;
    window.addEventListener('rheomiq:auth-expired',()=>{expiryEvents++});
    vi.stubGlobal('fetch',vi.fn(async()=>payload({
      code:'DEVICE_ACCESS_REVOKED',error:'Revoked device',
    },401)));
    const clientPath:string='../src/lib/cardVaultClient.js';
    const {revealCardSecret}=await import(clientPath);
    await expect(revealCardSecret('synthetic-card')).rejects.toMatchObject({
      name:'CardVaultClientError',status:401,code:'DEVICE_ACCESS_REVOKED',
    });
    expect(expiryEvents).toBe(1);
  });

  it('does not accept a response whose body completes only after auth changed',async()=>{
    const body=deferred<unknown>();
    const entered=deferred<void>();
    vi.stubGlobal('fetch',vi.fn(async()=>{
      const response=payload({});
      vi.spyOn(response,'json').mockImplementation(async()=>{
        entered.resolve();
        return body.promise;
      });
      return response;
    }));
    const clientPath:string='../src/lib/cardVaultClient.js';
    const {revealCardSecret}=await import(clientPath);
    const stale=revealCardSecret('synthetic-card');
    await entered.promise;
    boundary();
    body.resolve({pan:'4111111111111111',expiry:'12/30',cvv:'123'});
    await expect(stale).rejects.toMatchObject({code:'CARD_VAULT_AUTH_SCOPE_CHANGED'});
  });

  it.each(['PUT','DELETE'] as const)(
    'does not mark previous-session %s as successfully committed in the new auth scope',async method=>{
      const old=deferred<Response>();
      let count=0;
      vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
        expect(init?.method).toBe(method);
        if(++count===1)return old.promise;
        return method==='PUT'?payload({saved:true,last4:'1111'}):payload({deleted:true});
      }));
      const clientPath:string='../src/lib/cardVaultClient.js';
      const activityPath:string='../src/lib/databaseSaveActivity.js';
      const {saveCardSecret,deleteCardSecret}=await import(clientPath);
      const {getDatabaseSaveSnapshot}=await import(activityPath);
      const initial=getDatabaseSaveSnapshot().completion;
      const action=()=>method==='PUT'
        ?saveCardSecret('synthetic-card',{pan:'4111111111111111',expiry:'12/30'})
        :deleteCardSecret('synthetic-card');
      const stale=action();
      boundary();
      old.resolve(method==='PUT'?payload({saved:true,last4:'1111'}):payload({deleted:true}));
      await expect(stale).rejects.toMatchObject({
        name:'UnverifiedCardVaultWrite',operation:method==='PUT'?'save':'delete',
      });
      expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:initial});
      // No implicit retry of the old request; this new request is explicitly
      // initiated after the real auth scope changes.
      await expect(action()).resolves.toBeDefined();
      expect(count).toBe(2);
    }
  );

  it('never reveals a legacy local CVV when its IndexedDB read finishes in a retired auth scope',async()=>{
    const oldCvv=deferred<string>();
    vi.stubGlobal('indexedDB',{});
    readLocalCvvMock.mockImplementation(async()=>oldCvv.promise);
    vi.stubGlobal('fetch',vi.fn(async()=>payload({code:'CARD_SECRET_NOT_FOUND'},404)));
    const clientPath:string='../src/lib/cardVaultClient.js';
    const {revealCardSecret}=await import(clientPath);
    const stale=revealCardSecret('synthetic-legacy-card');
    // Wait until the fallback genuinely began before retiring the session.
    await vi.waitFor(()=>expect(readLocalCvvMock).toHaveBeenCalledTimes(1));
    boundary();
    oldCvv.resolve('123');
    await expect(stale).rejects.toMatchObject({code:'CARD_VAULT_AUTH_SCOPE_CHANGED'});
  });

  it('guards the actual Chromium stale-owner read and screenshot evidence',()=>{
    const qa=readFileSync('scripts/card-vault-runtime-qa.mjs','utf8');
    expect(qa).toContain('Card Vault runtime QA: stale owner auth-scope read');
    expect(qa).toContain("'fresh Cards owner fixture for stale auth read'");
    expect(qa).toContain('Card Vault stale-auth preflight (no secrets):');
    expect(qa).toContain("window.dispatchEvent(new Event('myfinhub:auth-scope-reset'))");
    expect(qa).toContain("await screenshot('card-vault-stale-auth-scope-read-desktop')");
    expect(qa).toContain("error announced to screen readers");
    expect(qa).toContain("staleResult.reads===1");
  });

  it('keeps the Card Vault scope-change message generic, without showing PAN or CVV',async()=>{
    const clientPath:string='../src/lib/cardVaultClient.js';
    const {CardVaultClientError,cardVaultErrorMessage}=await import(clientPath);
    const message=cardVaultErrorMessage(new CardVaultClientError(
      409,'CARD_VAULT_AUTH_SCOPE_CHANGED','raw secret 4111111111111111 / 123',
    ));
    expect(message).toContain('σύνδεση άλλαξε');
    expect(message).not.toContain('4111111111111111');
    expect(message).not.toContain('123');
    const source=readFileSync('src/lib/cardVaultClient.ts','utf8');
    expect(source).toContain('if(epoch!==authEpoch())throw staleVaultScope();');
  });
});
