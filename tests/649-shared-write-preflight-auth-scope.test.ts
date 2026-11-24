import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const providerPath:string='../src/lib/financialProviderClient.js';
const recurringPath:string='../src/lib/recurringServiceAssetClient.js';
const vaultPath:string='../src/lib/cardVaultClient.js';
const activityPath:string='../src/lib/databaseSaveActivity.js';

beforeEach(()=>{
  vi.resetModules();
  vi.stubGlobal('window',new EventTarget());
});
afterEach(()=>vi.unstubAllGlobals());

const operations=[
  ['provider create','POST','financial-providers'],
  ['provider edit','PATCH','financial-providers'],
  ['provider upload','PUT','financial-provider-assets'],
  ['provider binding','PUT','financial-provider-asset-binding'],
  ['recurring upload','PUT','recurring-service-assets'],
  ['recurring release','DELETE','recurring-service-assets'],
  ['vault save','PUT','card-secrets'],
  ['vault delete','DELETE','card-secrets'],
] as const;

describe('#649 FP-041 shared save-activity pre-dispatch authentication provenance',()=>{
  it.each(operations)('aborts retired %s before HTTP and permits a fresh explicit action',async(operation,method,resource)=>{
    const sent:Array<{url:string;method:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
      sent.push({url:String(url),method:String(init?.method??'GET')});
      // A proved rejection is intentionally not a successful write receipt.
      return new Response(JSON.stringify({error:'Synthetic precommit rejection'}),{status:400});
    }));
    const provider=await import(providerPath);
    const recurring=await import(recurringPath);
    const vault=await import(vaultPath);
    const {subscribeDatabaseSaves,getDatabaseSaveSnapshot}=await import(activityPath);
    const file=new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'});
    const metadata={id:'qa-bank',displayName:'QA bank',shortName:'QA',providerKind:'bank',sortOrder:1};
    const run=():Promise<unknown>=>{
      switch(operation){
        case 'provider create':return provider.saveFinancialProvider(metadata,false);
        case 'provider edit':return provider.updateFinancialProvider(metadata,false);
        case 'provider upload':return provider.uploadFinancialProviderAsset({providerId:'qa-bank',role:'logo',variant:'light',file,refreshCatalog:false});
        case 'provider binding':return provider.setFinancialProviderAssetBinding({providerId:'qa-bank',role:'logo',variant:'light',assetKey:null,refreshCatalog:false});
        case 'recurring upload':return recurring.uploadRecurringServiceAsset({recurringId:'qa-recurring',file});
        case 'recurring release':return recurring.deleteRecurringServiceAsset('service-asset-'+'a'.repeat(24));
        case 'vault save':return vault.saveCardSecret('qa-card',{pan:'4111111111111111',expiry:'12/30',cvv:'123'});
        case 'vault delete':return vault.deleteCardSecret('qa-card');
      }
    };
    const before=getDatabaseSaveSnapshot().completion;
    const unsubscribe=subscribeDatabaseSaves(()=>{
      if(getDatabaseSaveSnapshot().pending===1)
        window.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
    });
    try{
      await expect(run()).rejects.toThrow('Η συνεδρία άλλαξε πριν σταλεί');
    }finally{unsubscribe()}
    expect(sent).toEqual([]);
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:false,completion:before});

    // No stale quarantine or lock can prevent a genuinely new action.
    await expect(run()).rejects.toThrow();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe(method);
    expect(sent[0]?.url).toContain(resource);
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:before});
  });

  it.each(['rheomiq:auth-expired','rheomiq:mfa-required','myfinhub:auth-completed','myfinhub:auth-scope-reset'])(
    'does not invoke a retired write callback after %s',async(boundary)=>{
      const {trackDatabaseWrite,subscribeDatabaseSaves,getDatabaseSaveSnapshot}=await import(activityPath);
      const work=vi.fn(async()=>42);
      const unsubscribe=subscribeDatabaseSaves(()=>{
        if(getDatabaseSaveSnapshot().pending===1)window.dispatchEvent(new Event(boundary));
      });
      try{
        await expect(trackDatabaseWrite(work)).rejects.toThrow('Η συνεδρία άλλαξε πριν σταλεί');
      }finally{unsubscribe()}
      expect(work).not.toHaveBeenCalled();
      expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:false,completion:0});
      await expect(trackDatabaseWrite(work)).resolves.toBe(42);
      expect(work).toHaveBeenCalledTimes(1);
      expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:false,completion:1});
    }
  );
});
