import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUpstream } from '../server/upstream.js';
import { readStore, writeStore } from '../server/storage.js';
import { readAccountMetadata } from '../server/accountMetadataStore.js';
import { readCardSecrets } from '../server/cardVaultStore.js';
import { migrateProductData } from '../src/lib/productMigration.js';
import type { FinanceData } from '../src/types.js';
import { readFileSync } from 'node:fs';

const useFinanceSource=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');

function response(status:number,body:unknown={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
}

function legacyDocument(schemaVersion:1|2|3=2):FinanceData{
  return {
    app:'RheomIQ',
    schemaVersion,
    updatedAt:'2026-08-17T00:00:00.000Z',
    seed:{accounts:[],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
    state:{
      customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
      loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
      settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:[],incomeCategories:[],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'',defaultIncomeAccount:'',defaultLoanAccount:''},
      events:[],reviewDecisions:{},
    },
  } as FinanceData;
}

describe('backend outage and rate-limit contracts',()=>{
  const originalUrl=process.env.SUPABASE_URL;
  const originalKey=process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  });

  afterEach(()=>{
    vi.unstubAllGlobals();
    if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=originalKey;
  });

  it('maps data/auth transport failures to stable 503 public contracts',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('socket contains private upstream detail')));
    await expect(fetchUpstream('https://project.example/data',{},'DATA',50))
      .rejects.toMatchObject({status:503,code:'DATA_UNAVAILABLE',expose:true});
    await expect(fetchUpstream('https://project.example/auth',{},'AUTH',50))
      .rejects.toMatchObject({status:503,code:'AUTH_UNAVAILABLE',expose:true});
  });

  it('recovers on an explicit later read after a temporary data outage without replaying the failed request',async()=>{
    const current=legacyDocument(3);
    const fetchMock=vi.fn()
      .mockRejectedValueOnce(new TypeError('temporary network loss'))
      .mockResolvedValueOnce(response(200,[{data:current,revision:9,updated_at:'2026-08-17T00:00:02.000Z'}]));
    vi.stubGlobal('fetch',fetchMock);

    await expect(readStore('access-token')).rejects.toMatchObject({status:503,code:'DATA_UNAVAILABLE'});
    await expect(readStore('access-token')).resolves.toMatchObject({revision:'9'});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps upstream timeouts to stable 504 contracts',async()=>{
    vi.stubGlobal('fetch',vi.fn((_input:unknown,init?:RequestInit)=>new Promise((_resolve,reject)=>{
      const signal=init?.signal;
      if(signal?.aborted){reject(new DOMException('aborted','AbortError'));return}
      signal?.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});
    })));
    await expect(fetchUpstream('https://project.example/data',{},'DATA',1))
      .rejects.toMatchObject({status:504,code:'DATA_TIMEOUT'});
    await expect(fetchUpstream('https://project.example/auth',{},'AUTH',1))
      .rejects.toMatchObject({status:504,code:'AUTH_TIMEOUT'});
  });

  it('imports supported legacy documents only after normalizing them to the current schema',async()=>{
    const legacy=legacyDocument(2);
    const normalized=migrateProductData(legacy);
    const fetchMock=vi.fn().mockImplementation(async(_input:unknown,init?:RequestInit)=>{
      const payload=JSON.parse(String(init?.body||'{}'));
      expect(payload.p_data.schemaVersion).toBe(3);
      expect(payload.p_data.state.migration?.fromSchema).toBe(2);
      return response(200,[{data:normalized,revision:2,updated_at:'2026-08-17T00:00:01.000Z'}]);
    });
    vi.stubGlobal('fetch',fetchMock);
    const result=await writeStore(legacy,undefined,true,'access-token');
    expect(result.data.schemaVersion).toBe(3);
    expect(result.data.state.migration?.fromSchema).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported future documents before any database request',async()=>{
    const future={...legacyDocument(3),schemaVersion:4} as FinanceData;
    const fetchMock=vi.fn();
    vi.stubGlobal('fetch',fetchMock);
    await expect(writeStore(future,undefined,true,'access-token'))
      .rejects.toMatchObject({status:400,code:'INVALID_DATA'});
    expect(fetchMock).not.toHaveBeenCalled();
  });



  it.each([1,2,3] as const)('loads supported schema v%s documents and migrates them to the current schema',async(schemaVersion)=>{
    const legacy=legacyDocument(schemaVersion);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(200,[{data:legacy,revision:7,updated_at:'2026-08-17T00:00:01.000Z'}])));
    const result=await readStore('access-token');
    expect(result.data.schemaVersion).toBe(3);
    if(schemaVersion<3)expect(result.data.state.migration?.fromSchema).toBe(schemaVersion);
  });

  it('rejects an unsupported future stored schema before it can be normalized',async()=>{
    const future={...legacyDocument(3),schemaVersion:4} as FinanceData;
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(200,[{data:future,revision:7,updated_at:'2026-08-17T00:00:01.000Z'}])));
    await expect(readStore('access-token')).rejects.toMatchObject({status:400,code:'INVALID_DATA'});
  });

  it('keeps data 429 distinct from generic upstream failure',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(429,{message:'busy'})));
    await expect(readStore('access-token'))
      .rejects.toMatchObject({status:429,code:'DATA_RATE_LIMITED'});
  });

  it('maps unexpected data rejection to a redacted 502 contract',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(418,{message:'raw internal upstream marker'})));
    await expect(readStore('access-token'))
      .rejects.toMatchObject({status:502,code:'SUPABASE_ERROR',expose:false});
  });

  it('maps metadata service outage to a stable 503 contract',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(503,{message:'storage internals'})));
    await expect(readAccountMetadata('access-token'))
      .rejects.toMatchObject({status:503,code:'ACCOUNT_METADATA_UNAVAILABLE'});
  });

  it('maps card-vault throttling to actionable retry guidance',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(429,{message:'throttled'})));
    await expect(readCardSecrets('owner-1','card-1','access-token'))
      .rejects.toMatchObject({status:429,code:'CARD_VAULT_RATE_LIMITED'});
  });

  it('keeps the client import boundary ahead of migration so future schemas cannot be silently normalized',()=>{
    const check=useFinanceSource.indexOf('isSupportedFinanceSchemaVersion(incoming.schemaVersion)');
    const migrate=useFinanceSource.indexOf('importData(productData(incoming))');
    expect(check).toBeGreaterThan(-1);
    expect(migrate).toBeGreaterThan(check);
    expect(useFinanceSource).toContain('νεότερη ή μη υποστηριζόμενη έκδοση');
  });

});
