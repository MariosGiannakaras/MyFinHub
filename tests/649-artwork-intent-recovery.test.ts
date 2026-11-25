import { createHash } from 'node:crypto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {readPendingArtworkUploadIntent,uploadFinancialProviderAsset,uploadRecurringServiceAsset} from '../server/accountMetadataStore.js';
import {parseArtworkIntentTarget} from '../server/accountMetadataHandler.js';

const bytes=Buffer.from([137,80,78,71,13,10,26,10]);
const sha256=createHash('sha256').update(bytes).digest('hex');
const intentId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const now='2026-11-25T09:00:00Z';
const provider={kind:'provider',targetId:'qa-bank',role:'logo',variant:'light'} as const;
// Deliberately include PostgREST reserved grammar characters in a legal ID.
const recurring={kind:'recurring',targetId:'service,(test)"\\id',role:'',variant:''} as const;
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

describe('#649 read-only durable artwork intent recovery',()=>{
  it('validates the exact target without treating repeated or malformed values as a valid selector',()=>{
    expect(parseArtworkIntentTarget({query:provider})).toEqual(provider);
    expect(parseArtworkIntentTarget({query:{kind:recurring.kind,targetId:recurring.targetId}})).toEqual(recurring);
    for(const query of [
      {kind:'provider',targetId:'../bank',role:'logo',variant:'light'},
      {...provider,role:['logo','wordmark']},
      {...provider,variant:'light,dark'},
      {kind:'recurring',targetId:'id',role:[]},
      {kind:'recurring',targetId:['a','b']},
      {kind:'recurring',targetId:'a\ninside'},
      {kind:'unknown',targetId:'id'},
    ])expect(()=>parseArtworkIntentTarget({query})).toThrow();
  });

  for(const target of [provider,recurring]){
    it.each(['registered','no-intent','no-registry','wrong-bytes','wrong-length','missing-object',
      'wrong-key','wrong-owner-target','wrong-path','duplicate','bad-intent','closed-during-read',
      'revoked-before','revoked-after','malformed-auth-after'] as const)(
      target.kind+' recovery: %s',async scenario=>{
      vi.stubEnv('SUPABASE_URL','https://example.supabase.co');
      vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','test-public-key');
      const assetKey=target.kind==='provider'?'qa-bank-asset-000000000001':'service-asset-000000000000000000000001';
      const bucket=target.kind==='provider'?'financial-provider-assets':'recurring-service-assets';
      const storagePath=(target.kind==='provider'?'providers/qa-bank/':'services/')+assetKey+'.png';
      const intent={intent_id:intentId,kind:target.kind,target_id:target.targetId,role:target.role,variant:target.variant,
        make_primary:false,asset_key:assetKey,file_name:'logo.png',mime_type:'image/png',size_bytes:bytes.length,
        sha256,storage_path:storagePath,disposition:'pending',created_at:now,resolved_at:null};
      const registry={asset_key:assetKey,file_name:'logo.png',mime_type:'image/png',size_bytes:bytes.length,
        storage_bucket:bucket,storage_path:storagePath,updated_at:now,active:true,
        ...(target.kind==='provider'?{provider_id:target.targetId,asset_role:target.role,variant:target.variant}:{recurring_id:target.targetId})};
      let ownerReads=0,intentReads=0;
      const calls:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const url=new URL(String(input)),method=init?.method??'GET';
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer owner-jwt');
        if(url.pathname.endsWith('/rpc/rheomiq_is_owner_aal2')){
          expect(method).toBe('POST');calls.push('owner');ownerReads++;
          return json(scenario==='revoked-before'?false:ownerReads===2&&scenario==='revoked-after'?false:
            ownerReads===2&&scenario==='malformed-auth-after'?{ok:true}:true);
        }
        expect(method).toBe('GET');
        if(url.pathname.endsWith('/rheomiq_artwork_upload_intents')){
          calls.push('intent');intentReads++;
          expect(url.searchParams.get('target_id')).toBe('eq.'+JSON.stringify(target.targetId));
          expect(url.searchParams.get('role')).toBe('eq.'+JSON.stringify(target.role));
          expect(url.searchParams.get('variant')).toBe('eq.'+JSON.stringify(target.variant));
          expect(url.searchParams.get('limit')).toBe('2');
          if(scenario==='no-intent'||scenario==='closed-during-read'&&intentReads===2)return json([]);
          if(scenario==='duplicate')return json([intent,intent]);
          if(scenario==='bad-intent')return json([{...intent,sha256:'invalid'}]);
          return json([intent]);
        }
        if(url.pathname.includes('/rest/v1/rheomiq_')){
          calls.push('registry');
          expect(url.searchParams.get('asset_key')).toBe('eq.'+assetKey);
          if(scenario==='no-registry')return json([]);
          if(scenario==='wrong-key')return json([{...registry,asset_key:'other-key'}]);
          if(scenario==='wrong-owner-target')return json([{...registry,...(target.kind==='provider'?{provider_id:'other-bank'}:{recurring_id:'other-service'})}]);
          if(scenario==='wrong-path')return json([{...registry,storage_path:storagePath.replace('.png','.jpg')}]);
          return json([registry]);
        }
        expect(url.pathname).toBe('/storage/v1/object/public/'+bucket+'/'+storagePath);
        calls.push('bytes');
        if(scenario==='missing-object')return new Response(null,{status:404});
        if(scenario==='wrong-length')return new Response(new Uint8Array(bytes),{headers:{'content-length':'9'}});
        return new Response(scenario==='wrong-bytes'?new Uint8Array(bytes.length):new Uint8Array(bytes));
      }));
      const result=readPendingArtworkUploadIntent(target,'owner-jwt');
      if(scenario==='registered'){
        await expect(result).resolves.toMatchObject({intent:{intentId,assetKey,fileName:'logo.png',asset:{assetKey,fileName:'logo.png',sizeBytes:bytes.length}}});
        expect(calls).toEqual(['owner','intent','registry','bytes','intent','owner']);
      }else if(scenario==='no-intent'){
        await expect(result).resolves.toEqual({intent:null});
        expect(calls).toEqual(['owner','intent','owner']);
      }else if(['no-registry','wrong-bytes','wrong-length','missing-object'].includes(scenario)){
        await expect(result).resolves.toMatchObject({intent:{intentId,assetKey,asset:null}});
        expect(calls).toEqual(scenario==='no-registry'?['owner','intent','registry','intent','owner']:
          ['owner','intent','registry','bytes','intent','owner']);
      }else{
        await expect(result).rejects.toThrow();
        if(scenario==='revoked-before')expect(calls).toEqual(['owner']);
        if(['duplicate','bad-intent'].includes(scenario))expect(calls).toEqual(['owner','intent']);
        if(['wrong-key','wrong-owner-target','wrong-path'].includes(scenario))expect(calls).not.toContain('bytes');
        if(scenario==='revoked-after'||scenario==='malformed-auth-after')expect(calls.at(-1)).toBe('owner');
      }
    });
  }
});

describe('#649 fresh durable artwork reservation dispatch guard',()=>{
  for(const target of [provider,recurring]){
    it.each(['fresh','conflict','timeout','malformed','wrong-intent','wrong-key','wrong-hash','not-created','revoked-before','revoked-after'] as const)(
      target.kind+' reservation: %s',async scenario=>{
      vi.stubEnv('SUPABASE_URL','https://example.supabase.co');
      vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','test-public-key');
      const calls:string[]=[];
      let ownerReads=0;
      let key='',path='';
      const bucket=target.kind==='provider'?'financial-provider-assets':'recurring-service-assets';
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const url=new URL(String(input));
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer owner-jwt');
        expect(init?.method).toBe('POST');
        if(url.pathname.endsWith('/rpc/rheomiq_is_owner_aal2')){
          calls.push('owner');ownerReads++;
          return json(scenario!=='revoked-before'&&!(ownerReads===2&&scenario==='revoked-after'));
        }
        if(url.pathname.endsWith('/rheomiq_artwork_upload_intents')){
          calls.push('reserve');
          expect(new Headers(init?.headers).get('prefer')).toBe('return=representation');
          expect(url.searchParams.has('on_conflict')).toBe(false);
          const row=JSON.parse(String(init?.body));
          expect(row).toMatchObject({intent_id:intentId,kind:target.kind,target_id:target.targetId,
            role:target.role,variant:target.variant,make_primary:false,file_name:'logo.png',
            mime_type:'image/png',size_bytes:bytes.length,sha256});
          key=row.asset_key;
          expect(key).toMatch(target.kind==='provider'?/^qa-bank-asset-[a-f0-9]{12}$/:/^service-asset-[a-f0-9]{24}$/);
          path=(target.kind==='provider'?'providers/qa-bank/':'services/')+key+'.png';
          if(scenario==='conflict')return new Response(JSON.stringify({code:'23505'}),{status:409});
          if(scenario==='timeout')return new Response(JSON.stringify({code:'23505'}),{status:504});
          const receipt={...row,storage_path:path,disposition:'pending',created_at:now,resolved_at:null};
          if(scenario==='wrong-intent')receipt.intent_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
          if(scenario==='wrong-key')receipt.asset_key=target.kind==='provider'?'qa-bank-asset-000000000001':'service-asset-000000000000000000000001';
          if(scenario==='wrong-hash')receipt.sha256='0'.repeat(64);
          return new Response(JSON.stringify(scenario==='malformed'?[]:[receipt]),{
            status:scenario==='not-created'?200:201,headers:{'content-type':'application/json'},
          });
        }
        if(url.pathname.startsWith('/storage/v1/object/')){
          calls.push('storage');
          expect(url.pathname).toBe('/storage/v1/object/'+bucket+'/'+path);
          expect(Buffer.from(init?.body as Uint8Array)).toEqual(bytes);
          return json({ok:true});
        }
        calls.push('register');
        expect(url.pathname).toBe('/rest/v1/rpc/'+(target.kind==='provider'?'rheomiq_register_financial_provider_asset':'rheomiq_register_recurring_service_asset'));
        expect(JSON.parse(String(init?.body))).toMatchObject({p_asset_key:key,p_storage_path:path});
        return json([{asset_key:key,file_name:'logo.png',mime_type:'image/png',size_bytes:bytes.length,
          storage_bucket:bucket,storage_path:path,updated_at:now,active:true,
          ...(target.kind==='provider'?{provider_id:target.targetId,asset_role:target.role,variant:target.variant}:{recurring_id:target.targetId})}]);
      }));
      const input={intentId,fileName:'logo.png',mimeType:'image/png',content:bytes};
      const result=target.kind==='provider'?
        uploadFinancialProviderAsset({...input,providerId:target.targetId,role:target.role,variant:target.variant,makePrimary:false},'owner-jwt'):
        uploadRecurringServiceAsset({...input,recurringId:target.targetId},'owner-jwt');
      if(scenario==='fresh'){
        await expect(result).resolves.toMatchObject({fileName:'logo.png',sizeBytes:bytes.length});
        expect(calls).toEqual(['owner','reserve','owner','storage','register']);
      }else{
        await expect(result).rejects.toMatchObject({code:'ARTWORK_UPLOAD_INTENT_UNVERIFIED'});
        expect(calls).toEqual(scenario==='revoked-before'?['owner']:scenario==='revoked-after'?['owner','reserve','owner']:['owner','reserve']);
      }
    });
  }
});
