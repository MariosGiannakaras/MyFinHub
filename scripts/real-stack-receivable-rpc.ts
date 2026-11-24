import {randomUUID} from 'node:crypto';
import {createEvent} from '../src/lib/domain.js';
import type {FinanceData} from '../src/types.js';

type Options={
  apiUrl:string;publishable:string;serviceRole:string;
  email:string;password:string;userId:string;factorId:string;
  totpCode:()=>Promise<string>;
  totpCodeForSecret:(secret:string,previous?:string)=>Promise<string>;
  data:FinanceData;revision:string;generation:string;
  proveHttpDenial:(identity:'owner-aal1'|'nonowner-aal2',accessToken:string)=>Promise<void>;
  proveAssetHttpDenial:(identity:'owner-aal1'|'nonowner-aal2'|'revoked-aal2',accessToken:string,fixture:{accountId:string;providerId:string;providerAssetKey:string;recurringAssetKey:string})=>Promise<void>;
};
type Response={status:number;body:any};
function assert(condition:unknown,message:string):asserts condition{
  if(!condition)throw new Error(message);
}
async function postJson(url:string,headers:Record<string,string>,body?:unknown):Promise<Response>{
  const response=await fetch(url,{
    method:'POST',
    headers:{accept:'application/json',...headers,...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  return {status:response.status,body:await response.json().catch(()=>null)};
}
function jwtClaims(token:string){
  const payload=token.split('.')[1]||'';
  const claims=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')) as {sub?:string;aal?:string;session_id?:string};
  assert(/^[0-9a-f-]{36}$/i.test(claims.session_id||''),'Local direct RPC JWT has no session ID.');
  return claims;
}
export async function runDirectReceivableRpcProof(options:Options){
  const {apiUrl,publishable,serviceRole,email,password,userId,factorId,data,revision,generation}=options;
  assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(apiUrl),'Only loopback Supabase is allowed for direct-RPC proof.');
  const authHeaders={apikey:publishable};
  const passwordLogin=await postJson(apiUrl+'/auth/v1/token?grant_type=password',authHeaders,{email,password});
  assert(passwordLogin.status===200&&typeof passwordLogin.body?.access_token==='string','Local direct RPC password authentication failed.');
  const aal1Token=String(passwordLogin.body.access_token);
  const aal1Claims=jwtClaims(aal1Token);
  assert(aal1Claims.sub===userId&&aal1Claims.aal==='aal1','Local direct RPC did not start from the owner AAL1 boundary.');

  // Only synthetic local Auth sessions are registered here. The actual
  // finance RPC still checks its own owner+AAL2 and active-device policies.
  const register=async(sessionId:string,registeredUserId=userId)=>{
    const row=await postJson(apiUrl+'/rest/v1/myfinhub_device_sessions',{
      apikey:serviceRole,authorization:'Bearer '+serviceRole,
      prefer:'resolution=merge-duplicates,return=representation'
    },{session_id:sessionId,user_id:registeredUserId,platform:'web',device_label:'Synthetic direct RPC proof',app_version:'local-real-stack',revoked_at:null});
    assert(row.status===201||row.status===200,'Local direct RPC test device registration failed.');
  };
  await register(aal1Claims.session_id!);
  // Prove the API boundary before upgrading the genuine owner password session.
  await options.proveHttpDenial('owner-aal1',aal1Token);

  const rpc=async(method:string,accessToken:string,payload:unknown)=>{
    return postJson(apiUrl+'/rest/v1/rpc/'+method,{
      apikey:publishable,authorization:'Bearer '+accessToken,
    },payload);
  };
  const proposed=(events:NonNullable<FinanceData['state']['events']>)=>({...data.state,events});
  const payment=(date:string,amount:number,note:string)=>createEvent({
    kind:'repayment',date,amount,note,person:'Synthetic QA Receivable',accountId:'qa-cash',
  });
  const lending=(date:string,amount:number,note:string)=>createEvent({
    kind:'lending',date,amount,note,person:'Synthetic QA Receivable',accountId:'qa-cash',
  });
  const mutable=(state:FinanceData['state'])=>({
    p_state:state,p_expected_revision:Number(revision),p_expected_history_generation:Number(generation),
    p_updated_at:new Date().toISOString(),p_history_label:'Synthetic direct RPC receivable denial',
  });
  // All RPCs receive valid current revisions and a non-noop canonical state;
  // the main harness established reachable Redo before capturing this baseline.
  const deniedState=structuredClone(data.state);
  deniedState.settings={...deniedState.settings,accountNames:{...deniedState.settings.accountNames,
    'qa-cash':'Unauthorized direct RPC must not save'}};
  assert(JSON.stringify(deniedState)!==JSON.stringify(data.state),'Direct RPC denial requires non-noop state.');
  const deniedData={...data,state:deniedState,updatedAt:new Date().toISOString()};
  const protectedFinanceCalls=[
    {method:'rheomiq_read_state',params:{}},
    {method:'rheomiq_read_history',params:{}},
    {method:'rheomiq_save_mutable_state_history',params:mutable(deniedState)},
    {method:'rheomiq_save_state',params:{p_data:deniedData,p_expected_revision:Number(revision)}},
    {method:'rheomiq_move_history',params:{p_direction:'redo',p_expected_revision:Number(revision),
      p_expected_history_generation:Number(generation),p_updated_at:deniedData.updatedAt}},
    {method:'rheomiq_create_backup',params:{p_reason:'manual'}},
    {method:'rheomiq_import_state_checked',params:{p_data:deniedData,p_expected_revision:Number(revision)}},
    {method:'rheomiq_import_state',params:{p_data:deniedData}},
  ];
  const financeEffects=async()=>{
    const paths=[
      'rheomiq_app_state?id=eq.primary&select=revision,updated_at',
      'rheomiq_history_cursor?select=*&order=owner_user_id.asc',
      'rheomiq_backups?select=id,reason,revision&order=id.asc',
      'rheomiq_audit_log?select=id&order=id.asc',
    ];
    return Promise.all(paths.map(async path=>{
      const response=await fetch(apiUrl+'/rest/v1/'+path,{
        headers:{apikey:serviceRole,authorization:'Bearer '+serviceRole,accept:'application/json'},
      });
      const rows=await response.json().catch(()=>null);
      assert(response.status===200&&Array.isArray(rows),'Synthetic direct finance effect read-back failed.');
      return rows;
    }));
  };
  const assertDeniedFinanceRpcs=async(identity:string,token:string)=>{
    console.log('[real-stack] stage direct-finance-rpc-owner-aal2-denial '+identity);
    const before=await financeEffects();
    assert(before[0].length===1&&String(before[0][0]?.revision)===revision&&
      before[1].length===1&&String(before[1][0]?.generation)===generation,
      'Direct finance denial requires the original current revision and history generation.');
    for(const entry of protectedFinanceCalls){
      const denied=await rpc(entry.method,token,entry.params);
      assert(denied.status===403&&denied.body?.code==='42501',
        'Direct '+entry.method+' unexpectedly accepted '+identity+' or failed for an unrelated reason.');
    }
    assert(JSON.stringify(await financeEffects())===JSON.stringify(before),
      'Unauthorized direct finance RPC changed revision, history cursor, backup or audit rows: '+identity);
    console.log('[real-stack] PASS direct-finance-rpc-owner-aal2-denial '+identity);
  };
  await assertDeniedFinanceRpcs('owner-aal1',aal1Token);
  const overpay=proposed([...(data.state.events??[]),payment('2026-10-04',10.01,'Synthetic overpayment')]);
  const aal1Denied=await rpc('rheomiq_save_mutable_state_history',aal1Token,mutable(overpay));
  assert([401,403].includes(aal1Denied.status),'PostgREST direct mutable RPC unexpectedly accepted AAL1.');

  const challenge=await postJson(apiUrl+'/auth/v1/factors/'+encodeURIComponent(factorId)+'/challenge',{
    ...authHeaders,authorization:'Bearer '+aal1Token,
  });
  assert(challenge.status===200&&typeof challenge.body?.id==='string','Local direct RPC TOTP challenge failed.');
  const verified=await postJson(apiUrl+'/auth/v1/factors/'+encodeURIComponent(factorId)+'/verify',{
    ...authHeaders,authorization:'Bearer '+aal1Token,
  },{challenge_id:challenge.body.id,code:await options.totpCode()});
  assert(verified.status===200&&typeof verified.body?.access_token==='string','Local direct RPC AAL2 verification failed.');
  const aal2Token=String(verified.body.access_token),aal2Claims=jwtClaims(aal2Token);
  assert(aal2Claims.sub===userId&&aal2Claims.aal==='aal2','Local direct RPC did not reach AAL2.');
  if(aal2Claims.session_id!==aal1Claims.session_id)await register(aal2Claims.session_id!);

  const before=await rpc('rheomiq_read_state',aal2Token,{});
  const historyBefore=await rpc('rheomiq_read_history',aal2Token,{});
  assert(before.status===200&&historyBefore.status===200,'Synthetic owner AAL2 cannot read protected canonical data/history.');
  const originalRows=Array.isArray(before.body)?before.body:[before.body];
  assert(String(originalRows[0]?.revision)===revision&&
    String(historyBefore.body?.generation)===generation,'Direct RPC proof began at a stale finance/history revision.');


  // A second synthetic user has genuine GoTrue TOTP-verified AAL2 and an
  // active local device, but is NOT in the single-owner table. This isolates
  // owner authorization from a merely missing MFA or missing device session.
  // Every privileged bootstrap call is confined to the above loopback origin.
  const nonownerEmail='qa-nonowner-'+userId+'@example.com';
  const newUser=await postJson(apiUrl+'/auth/v1/admin/users',{
    apikey:serviceRole,authorization:'Bearer '+serviceRole,
  },{email:nonownerEmail,password,email_confirm:true});
  const nonownerUserId=String(newUser.body?.id||'');
  assert([200,201].includes(newUser.status)&&/^[0-9a-f-]{36}$/i.test(nonownerUserId)&&nonownerUserId!==userId,
    'Local nonowner Auth fixture registration failed.');
  const nonownerLogin=await postJson(apiUrl+'/auth/v1/token?grant_type=password',authHeaders,{
    email:nonownerEmail,password,
  });
  assert(nonownerLogin.status===200&&typeof nonownerLogin.body?.access_token==='string',
    'Local nonowner GoTrue password login failed.');
  const nonownerAal1=String(nonownerLogin.body.access_token);
  const nonownerAal1Claims=jwtClaims(nonownerAal1);
  assert(nonownerAal1Claims.sub===nonownerUserId&&nonownerAal1Claims.aal==='aal1',
    'Local nonowner did not reach AAL1.');
  const nonownerEnroll=await postJson(apiUrl+'/auth/v1/factors',{
    ...authHeaders,authorization:'Bearer '+nonownerAal1,
  },{factor_type:'totp',friendly_name:'Isolated nonowner QA factor'});
  const nonownerFactorId=String(nonownerEnroll.body?.id||'');
  const nonownerSecret=String(nonownerEnroll.body?.totp?.secret||'');
  assert(nonownerEnroll.status===200&&nonownerFactorId.length>5&&nonownerSecret.length>=16,
    'Local nonowner TOTP factor enrollment failed.');
  const nonownerChallenge=await postJson(
    apiUrl+'/auth/v1/factors/'+encodeURIComponent(nonownerFactorId)+'/challenge',
    {...authHeaders,authorization:'Bearer '+nonownerAal1});
  assert(nonownerChallenge.status===200&&typeof nonownerChallenge.body?.id==='string',
    'Local nonowner GoTrue TOTP challenge failed.');
  const nonownerCode=await options.totpCodeForSecret(nonownerSecret);
  let nonownerVerified=await postJson(
    apiUrl+'/auth/v1/factors/'+encodeURIComponent(nonownerFactorId)+'/verify',
    {...authHeaders,authorization:'Bearer '+nonownerAal1},
    {challenge_id:nonownerChallenge.body.id,code:nonownerCode});
  if(nonownerVerified.status===401||nonownerVerified.status===422){
    // One bounded clock-boundary retry with the same local challenge.
    nonownerVerified=await postJson(
      apiUrl+'/auth/v1/factors/'+encodeURIComponent(nonownerFactorId)+'/verify',
      {...authHeaders,authorization:'Bearer '+nonownerAal1},
      {challenge_id:nonownerChallenge.body.id,code:await options.totpCodeForSecret(nonownerSecret,nonownerCode)});
  }
  assert(nonownerVerified.status===200&&typeof nonownerVerified.body?.access_token==='string',
    'Local nonowner GoTrue AAL2 verification failed.');
  const nonownerAal2=String(nonownerVerified.body.access_token);
  const nonownerClaims=jwtClaims(nonownerAal2);
  assert(nonownerClaims.sub===nonownerUserId&&nonownerClaims.aal==='aal2',
    'Local nonowner token is not genuine AAL2.');
  await register(nonownerClaims.session_id!,nonownerUserId);
  await options.proveHttpDenial('nonowner-aal2',nonownerAal2);
  await assertDeniedFinanceRpcs('nonowner-aal2',nonownerAal2);

  // Genuine local GoTrue JWTs, not forged claims. Invoker RPCs must
  // reject AAL1 and nonowner AAL2 before any Storage or metadata write.
  const protectedMetadataMutations=[
    {method:'rheomiq_create_financial_provider',params:{
      p_id:'qa-direct-rpc',p_display_name:'Synthetic QA Provider',p_short_name:'QA',
      p_provider_kind:'bank',p_country_code:'GR',p_sort_order:42,
    }},
    {method:'rheomiq_update_financial_provider',params:{
      p_id:'qa-direct-rpc',p_display_name:'Synthetic QA Provider',p_short_name:'QA',
      p_provider_kind:'bank',p_country_code:'GR',p_sort_order:42,
    }},
    {method:'rheomiq_register_recurring_service_asset',params:{
      p_recurring_id:'qa-direct-rpc',p_asset_key:'service-asset-ffffffffffffffffffffffff',
      p_file_name:'qa.svg',p_mime_type:'image/svg+xml',
      p_storage_path:'services/service-asset-ffffffffffffffffffffffff.svg',p_size_bytes:32,
    }},
    {method:'rheomiq_register_financial_provider_asset',params:{
      p_provider_id:'qa-direct-rpc',p_asset_key:'qa-direct-rpc-asset-ffffffffffff',
      p_asset_role:'logo',p_variant:'universal',p_file_name:'qa.svg',
      p_mime_type:'image/svg+xml',p_storage_path:'providers/qa-direct-rpc/qa-direct-rpc-asset-ffffffffffff.svg',
      p_size_bytes:32,p_make_primary:false,
    }},
    {method:'rheomiq_set_financial_provider_asset_binding',params:{
      p_provider_id:'qa-direct-rpc',p_asset_role:'logo',p_variant:'universal',
      p_asset_key:'qa-direct-rpc-asset-ffffffffffff',
    }},
    {method:'rheomiq_release_recurring_service_asset',params:{p_asset_key:'service-asset-ffffffffffffffffffffffff'}},
    {method:'rheomiq_purge_recurring_service_asset',params:{p_asset_key:'service-asset-ffffffffffffffffffffffff'}},
    {method:'rheomiq_upsert_account_metadata',params:{
      p_account_id:'qa-direct-rpc-owner-iban',
      p_iban:'GR1601101250000000012300695',p_expected_revision:0,
    }},
  ];
  for(const entry of protectedMetadataMutations){
    for(const [label,token] of [['owner AAL1',aal1Token],['nonowner AAL2',nonownerAal2]] as const){
      const denied=await rpc(entry.method,token,entry.params);
      assert(denied.status===403&&denied.body?.code==='42501',
        'Direct '+entry.method+' unexpectedly accepted '+label+'.');
    }
  }

  // A genuine owner AAL2 session can insert a synthetic IBAN, while direct
  // PostgREST (not the trusted HTTP API) must hide it from an AAL1 owner
  // and another real TOTP-verified AAL2 user. Cleanup uses only the confined
  // disposable loopback service role; no hosted/production data is touched.
  const privateAccountId='qa-direct-rpc-owner-iban';
  const privateIban='GR1601101250000000012300695';
  const ownerWrite=await rpc('rheomiq_upsert_account_metadata',aal2Token,{
    p_account_id:privateAccountId,p_iban:privateIban,p_expected_revision:0,
  });
  assert(ownerWrite.status===200&&Array.isArray(ownerWrite.body)&&ownerWrite.body.length===1,
    'Local owner AAL2 failed to create its isolated versioned metadata fixture.');
  const selectMetadata=async(token:string)=>{
    const response=await fetch(apiUrl+'/rest/v1/rheomiq_account_metadata?select=account_id,iban,revision&account_id=eq.'+encodeURIComponent(privateAccountId),{
      headers:{apikey:publishable,authorization:'Bearer '+token,accept:'application/json'},
    });
    return {status:response.status,body:await response.json().catch(()=>null)};
  };
  // Positive seeded-row control ensures direct JWT denials are not vacuous.
  const selectProvider=async(token:string,providerId?:string)=>{
    const query=new URLSearchParams({select:'id,active',active:'eq.true'});
    if(providerId)query.set('id','eq.'+providerId);
    else{query.set('order','id.asc');query.set('limit','1');}
    const response=await fetch(apiUrl+'/rest/v1/rheomiq_financial_providers?'+query,{
      headers:{apikey:publishable,authorization:'Bearer '+token,accept:'application/json'},
    });
    return {status:response.status,body:await response.json().catch(()=>null)};
  };
  // A sibling RLS read boundary protects owner-managed artwork metadata
  // independently from the provider table and Storage object permissions.
  const selectProviderAsset=async(token:string,assetKey:string)=>{
    const query=new URLSearchParams({
      select:'asset_key,provider_id,storage_path,active,usage_note',
      asset_key:'eq.'+assetKey,
    });
    const response=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_assets?'+query,{
      // Service-role readback must use both admin credentials. Supplying only
      // the service JWT with a public API key can be rejected by the gateway
      // before any PostgreSQL/RLS assertion is reached.
      headers:{apikey:token===serviceRole?serviceRole:publishable,
        authorization:'Bearer '+token,accept:'application/json'},
    });
    return {status:response.status,body:await response.json().catch(()=>null)};
  };
  // Bindings have an independent owner+AAL2 table SELECT policy.
  const selectProviderBinding=async(token:string,providerId:string,variant:'light'|'dark'='dark')=>{
    const query=new URLSearchParams({
      select:'provider_id,asset_role,variant,asset_key,updated_at',
      provider_id:'eq.'+providerId,asset_role:'eq.card-mark',variant:'eq.'+variant,
    });
    const response=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings?'+query,{
      headers:{apikey:token===serviceRole?serviceRole:publishable,
        authorization:'Bearer '+token,accept:'application/json'},
    });
    return {status:response.status,body:await response.json().catch(()=>null)};
  };
  // A real existing binding provides a positive control for UPDATE/DELETE.
  // The unused second slot provides a distinct INSERT target, so a uniqueness
  // constraint cannot masquerade as proof that a denied INSERT obeyed RLS.
  const assertDeniedBindingMutations=async(label:string,token:string,providerId:string,assetKey:string)=>{
    const baseline=await selectProviderBinding(serviceRole,providerId);
    const empty=await selectProviderBinding(serviceRole,providerId,'light');
    assert(baseline.status===200&&Array.isArray(baseline.body)&&baseline.body.length===1&&
      baseline.body[0]?.asset_key===assetKey&&typeof baseline.body[0]?.updated_at==='string'&&
      empty.status===200&&Array.isArray(empty.body)&&empty.body.length===0,
      'Direct binding DML must start with one real owner row and an empty insertion slot.');
    for(const method of ['POST','PATCH','DELETE'] as const){
      const query=method==='POST'?'':('?'+new URLSearchParams({
        provider_id:'eq.'+providerId,asset_role:'eq.card-mark',variant:'eq.dark',
      }));
      const response=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings'+query,{
        method,headers:{
          apikey:publishable,authorization:'Bearer '+token,accept:'application/json',
          prefer:'return=representation',
          ...(method!=='DELETE'?{'content-type':'application/json'}:{}),
        },
        ...(method==='POST'?{body:JSON.stringify({
          provider_id:providerId,asset_role:'card-mark',variant:'light',asset_key:assetKey,
        })}:method==='PATCH'?{body:JSON.stringify({
          updated_at:'2020-01-01T00:00:00.000Z',
        })}:{}),
      });
      const result=await response.json().catch(()=>null);
      if(method==='POST'){
        assert(response.status===403&&String(result?.code)==='42501',
          'Direct provider binding INSERT unexpectedly accepted '+label+'.');
      }else{
        assert(response.status===200&&Array.isArray(result)&&result.length===0,
          'Direct provider binding '+method+' unexpectedly modified a protected owner row for '+label+'.');
      }
      const after=await selectProviderBinding(serviceRole,providerId);
      const afterEmpty=await selectProviderBinding(serviceRole,providerId,'light');
      assert(after.status===200&&Array.isArray(after.body)&&
        JSON.stringify(after.body)===JSON.stringify(baseline.body)&&
        afterEmpty.status===200&&Array.isArray(afterEmpty.body)&&afterEmpty.body.length===0,
        'Denied '+label+' '+method+' changed an owner binding or inserted a new slot.');
    }
  };
  // A separate owner-user-scoped recurring service artwork registry uses
  // RLS in addition to its Storage bucket. Verify its actual positive row.
  const selectRecurringAsset=async(token:string,assetKey:string)=>{
    const query=new URLSearchParams({
      select:'owner_user_id,asset_key,recurring_id,storage_path,active',
      asset_key:'eq.'+assetKey,
    });
    const response=await fetch(apiUrl+'/rest/v1/rheomiq_recurring_service_assets?'+query,{
      headers:{apikey:publishable,authorization:'Bearer '+token,accept:'application/json'},
    });
    return {status:response.status,body:await response.json().catch(()=>null)};
  };
  // #649 I22.02: genuine local GoTrue identities must also obey direct
  // Supabase Storage INSERT/DELETE policies, not only PostgreSQL RPC/RLS.
  // Use a valid SVG and positive owner AAL2 controls so malformed content
  // cannot explain any denied write. All paths are random, local and scoped.
  type StorageBucket='financial-provider-assets'|'recurring-service-assets';
  type StorageFixture={bucket:StorageBucket;path:string};
  const syntheticStoragePaths:StorageFixture[]=[];
  const syntheticRegisteredAssets:string[]=[];
  const syntheticCrossProviderIds:string[]=[];
  const syntheticRegisteredBindings:Array<{providerId:string;assetRole:string;variant:string;assetKey:string}>=[];
  const syntheticRegisteredRecurringAssets:string[]=[];
  const newStoragePath=(bucket:StorageBucket,providerId='qa-direct-rpc'):StorageFixture=>{
    const nonce=randomUUID().replace(/-/g,'');
    const path=bucket==='financial-provider-assets'
      ?'providers/'+providerId+'/'+providerId+'-asset-'+nonce.slice(0,12)+'.svg'
      :'services/service-asset-'+nonce.slice(0,24)+'.svg';
    const fixture={bucket,path};
    syntheticStoragePaths.push(fixture);
    return fixture;
  };
  const protectedStorage=[
    newStoragePath('financial-provider-assets'),
    newStoragePath('recurring-service-assets'),
  ];
  const svgBytes=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path d="M0 0"/></svg>','utf8');
  // Different valid SVG bytes make an unauthorized overwrite observable.
  const replacementBytes=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="3"/></svg>','utf8');
  const storageRequest=async(method:'POST'|'PUT'|'DELETE',token:string,fixture:StorageFixture)=>{
    const response=await fetch(apiUrl+'/storage/v1/object/'+fixture.bucket+'/'+fixture.path,{
      method,headers:{
        apikey:token===serviceRole?serviceRole:publishable,authorization:'Bearer '+token,
        ...(method!=='DELETE'?{'content-type':'image/svg+xml'}:{}),
      },
      ...(method!=='DELETE'?{body:Uint8Array.from(method==='PUT'?replacementBytes:svgBytes)}:{}),
    });
    return {status:response.status,body:await response.json().catch(()=>null)};
  };
  const storageExists=async(fixture:StorageFixture)=>{
    const delimiter=fixture.path.lastIndexOf('/');
    const response=await postJson(apiUrl+'/storage/v1/object/list/'+fixture.bucket,{
      apikey:serviceRole,authorization:'Bearer '+serviceRole,
    },{prefix:fixture.path.slice(0,delimiter),limit:100,offset:0});
    assert(response.status===200&&Array.isArray(response.body),
      'Local privileged Storage readback failed.');
    return response.body.some((row:{name?:unknown})=>row?.name===fixture.path.slice(delimiter+1));
  };
  const storageBytesUnchanged=async(fixture:StorageFixture)=>{
    // These are public-artwork buckets; fresh bytes, not an object listing,
    // prove a denied UPDATE did not overwrite existing owner content.
    const response=await fetch(
      apiUrl+'/storage/v1/object/public/'+fixture.bucket+'/'+fixture.path+'?qa='+randomUUID(),{
        headers:{apikey:serviceRole,authorization:'Bearer '+serviceRole},
      });
    assert(response.status===200,'Local positive Storage byte readback failed.');
    return Buffer.from(await response.arrayBuffer()).equals(svgBytes);
  };
  const assertDeniedStorage=async(label:string,token:string)=>{
    for(const fixture of protectedStorage){
      const candidate=newStoragePath(fixture.bucket);
      const deniedInsert=await storageRequest('POST',token,candidate);
      assert(deniedInsert.status>=400&&deniedInsert.status<500,
        'Direct '+fixture.bucket+' Storage INSERT unexpectedly accepted '+label+'.');
      assert(!(await storageExists(candidate)),
        'Denied '+label+' Storage INSERT persisted an unregistered object.');
      const deniedDelete=await storageRequest('DELETE',token,fixture);
      assert(deniedDelete.status>=400&&deniedDelete.status<500,
        'Direct '+fixture.bucket+' Storage DELETE unexpectedly accepted '+label+'.');
      assert(await storageExists(fixture),
        'Denied '+label+' Storage DELETE removed a legitimate owner AAL2 object.');
      const deniedOverwrite=await storageRequest('PUT',token,fixture);
      assert(deniedOverwrite.status>=400&&deniedOverwrite.status<500,
        'Direct '+fixture.bucket+' Storage UPDATE unexpectedly accepted '+label+'.');
      assert(await storageBytesUnchanged(fixture),
        'Denied '+label+' Storage UPDATE changed the owner artwork bytes.');
    }
  };
  try{
    const ownerRows=await selectMetadata(aal2Token);
    assert(ownerRows.status===200&&Array.isArray(ownerRows.body)&&ownerRows.body.length===1&&
      ownerRows.body[0]?.account_id===privateAccountId&&ownerRows.body[0]?.iban===privateIban&&
      ownerRows.body[0]?.revision===1,'Local owner AAL2 cannot read its exact versioned IBAN record.');
    for(const [label,token] of [['owner AAL1',aal1Token],['nonowner AAL2',nonownerAal2]] as const){
      const denied=await selectMetadata(token);
      assert(denied.status===200&&Array.isArray(denied.body)&&denied.body.length===0,
        'Direct account metadata SELECT leaked owner IBAN to '+label+'.');
    }

    const ownerCatalog=await selectProvider(aal2Token);
    const protectedProviderId=String(ownerCatalog.body?.[0]?.id??'');
    assert(ownerCatalog.status===200&&Array.isArray(ownerCatalog.body)&&
      ownerCatalog.body.length===1&&ownerCatalog.body[0]?.active===true&&
      /^[a-z][a-z0-9-]{0,63}$/.test(protectedProviderId),
      'Local owner AAL2 cannot read an active seeded provider catalog row.');
    for(const [label,token] of [['owner AAL1',aal1Token],['nonowner AAL2',nonownerAal2]] as const){
      const deniedProvider=await selectProvider(token,protectedProviderId);
      assert(deniedProvider.status===200&&Array.isArray(deniedProvider.body)&&
        deniedProvider.body.length===0,
        'Direct financial provider SELECT leaked owner catalog data to '+label+'.');
    }

    for(const fixture of protectedStorage){
      const inserted=await storageRequest('POST',aal2Token,fixture);
      assert([200,201].includes(inserted.status)&&await storageExists(fixture),
        'Valid owner AAL2 could not upload its positive '+fixture.bucket+' Storage fixture.');
    }
    await assertDeniedStorage('owner AAL1',aal1Token);
    await assertDeniedStorage('nonowner AAL2',nonownerAal2);

    // The recurring Storage object is already a positive real owner AAL2
    // fixture. Register it through the same protected RPC before comparing
    // any identity's direct SELECT result; never treat an empty table as RLS.
    const recurringStorage=protectedStorage.find(fixture=>fixture.bucket==='recurring-service-assets');
    assert(!!recurringStorage,'Missing known recurring Storage fixture.');
    const recurringAssetKey=recurringStorage.path.split('/').at(-1)?.replace(/\.svg$/,'')||'';
    assert(/^service-asset-[a-f0-9]{24}$/.test(recurringAssetKey),
      'Synthetic recurring asset key is not storage-backed.');
    syntheticRegisteredRecurringAssets.push(recurringAssetKey);
    const registeredRecurring=await rpc('rheomiq_register_recurring_service_asset',aal2Token,{
      p_recurring_id:'qa-direct-rpc',p_asset_key:recurringAssetKey,
      p_file_name:recurringAssetKey+'.svg',p_mime_type:'image/svg+xml',
      p_storage_path:recurringStorage.path,p_size_bytes:svgBytes.length,
    });
    assert(registeredRecurring.status===200&&Array.isArray(registeredRecurring.body)&&
      registeredRecurring.body.length===1&&registeredRecurring.body[0]?.asset_key===recurringAssetKey&&
      registeredRecurring.body[0]?.owner_user_id===userId&&registeredRecurring.body[0]?.active===true,
      'Legitimate owner AAL2 cannot register its actual recurring service artwork.');
    const ownerRecurringRead=await selectRecurringAsset(aal2Token,recurringAssetKey);
    assert(ownerRecurringRead.status===200&&Array.isArray(ownerRecurringRead.body)&&
      ownerRecurringRead.body.length===1&&ownerRecurringRead.body[0]?.owner_user_id===userId&&
      ownerRecurringRead.body[0]?.asset_key===recurringAssetKey&&
      ownerRecurringRead.body[0]?.recurring_id==='qa-direct-rpc'&&
      ownerRecurringRead.body[0]?.storage_path===recurringStorage.path&&
      ownerRecurringRead.body[0]?.active===true,
      'Owner AAL2 direct recurring asset SELECT lost the registered positive readback.');
    for(const [label,token] of [['owner AAL1',aal1Token],['nonowner AAL2',nonownerAal2]] as const){
      const deniedRecurringRead=await selectRecurringAsset(token,recurringAssetKey);
      assert(deniedRecurringRead.status===200&&Array.isArray(deniedRecurringRead.body)&&
        deniedRecurringRead.body.length===0,
        'Direct recurring service asset SELECT leaked owner artwork metadata to '+label+'.');
    }

    // Register a real, active artwork row through the already-protected
    // owner AAL2 Storage + provider RPC. Without a known positive row, an
    // empty AAL1/nonowner response would prove nothing about asset SELECT.
    const registeredAssetStorage=newStoragePath('financial-provider-assets',protectedProviderId);
    const registeredAssetKey=registeredAssetStorage.path.split('/').at(-1)?.replace(/\.svg$/,'')||'';
    assert(registeredAssetKey.startsWith(protectedProviderId+'-asset-'),
      'Synthetic provider asset key did not match its actual provider Storage path.');
    syntheticRegisteredAssets.push(registeredAssetKey);
    const storedAsset=await storageRequest('POST',aal2Token,registeredAssetStorage);
    assert([200,201].includes(storedAsset.status)&&await storageExists(registeredAssetStorage),
      'Owner AAL2 could not upload its registered provider artwork fixture.');
    const registered=await rpc('rheomiq_register_financial_provider_asset',aal2Token,{
      p_provider_id:protectedProviderId,p_asset_key:registeredAssetKey,
      p_asset_role:'card-mark',p_variant:'dark',
      p_file_name:registeredAssetKey+'.svg',p_mime_type:'image/svg+xml',
      p_storage_path:registeredAssetStorage.path,p_size_bytes:svgBytes.length,p_make_primary:false,
    });
    assert(registered.status===200&&Array.isArray(registered.body)&&registered.body.length===1&&
      registered.body[0]?.asset_key===registeredAssetKey&&registered.body[0]?.active===true,
      'Valid owner AAL2 could not register its real active provider artwork row.');
    const ownerAssetRead=await selectProviderAsset(aal2Token,registeredAssetKey);
    assert(ownerAssetRead.status===200&&Array.isArray(ownerAssetRead.body)&&ownerAssetRead.body.length===1&&
      ownerAssetRead.body[0]?.asset_key===registeredAssetKey&&
      ownerAssetRead.body[0]?.provider_id===protectedProviderId&&
      ownerAssetRead.body[0]?.storage_path===registeredAssetStorage.path&&
      ownerAssetRead.body[0]?.active===true,
      'Owner AAL2 direct PostgREST provider asset SELECT did not return its exact registered artwork.');
    for(const [label,token] of [['owner AAL1',aal1Token],['nonowner AAL2',nonownerAal2]] as const){
      const deniedAssetRead=await selectProviderAsset(token,registeredAssetKey);
      assert(deniedAssetRead.status===200&&Array.isArray(deniedAssetRead.body)&&
        deniedAssetRead.body.length===0,
        'Direct financial provider asset SELECT leaked real registered artwork metadata to '+label+'.');
    }

    // Never overwrite any existing provider binding: this non-primary
    // synthetic slot must be absent before its invoker write.
    const bindingBefore=await selectProviderBinding(aal2Token,protectedProviderId);
    assert(bindingBefore.status===200&&Array.isArray(bindingBefore.body)&&
      bindingBefore.body.length===0,
      'Synthetic card-mark/dark test would overwrite a populated binding.');
    syntheticRegisteredBindings.push({
      providerId:protectedProviderId,assetRole:'card-mark',variant:'dark',assetKey:registeredAssetKey,
    });
    const bound=await rpc('rheomiq_set_financial_provider_asset_binding',aal2Token,{
      p_provider_id:protectedProviderId,p_asset_role:'card-mark',
      p_variant:'dark',p_asset_key:registeredAssetKey,
    });
    assert([200,204].includes(bound.status),
      'Owner AAL2 could not create the temporary provider binding.');
    const ownerBindingRead=await selectProviderBinding(aal2Token,protectedProviderId);
    assert(ownerBindingRead.status===200&&Array.isArray(ownerBindingRead.body)&&
      ownerBindingRead.body.length===1&&
      ownerBindingRead.body[0]?.provider_id===protectedProviderId&&
      ownerBindingRead.body[0]?.asset_role==='card-mark'&&
      ownerBindingRead.body[0]?.variant==='dark'&&
      ownerBindingRead.body[0]?.asset_key===registeredAssetKey,
      'Owner AAL2 direct provider binding SELECT lost its positive control.');
    // Enroll the exact unpopulated second slot for cleanup BEFORE attempting
    // negative INSERT, even if a broken RLS policy permits that insertion.
    const unusedBindingSlot=await selectProviderBinding(aal2Token,protectedProviderId,'light');
    assert(unusedBindingSlot.status===200&&Array.isArray(unusedBindingSlot.body)&&
      unusedBindingSlot.body.length===0,
      'Cannot use a populated provider light slot for negative INSERT proof.');
    syntheticRegisteredBindings.push({
      providerId:protectedProviderId,assetRole:'card-mark',variant:'light',assetKey:registeredAssetKey,
    });
    for(const [label,token] of [['owner AAL1',aal1Token],['nonowner AAL2',nonownerAal2]] as const){
      const deniedBindingRead=await selectProviderBinding(token,protectedProviderId);
      assert(deniedBindingRead.status===200&&Array.isArray(deniedBindingRead.body)&&
        deniedBindingRead.body.length===0,
        'Direct provider binding SELECT leaked owner metadata to '+label+'.');
      await assertDeniedBindingMutations(label,token,protectedProviderId,registeredAssetKey);
    }

    const httpFixture={accountId:privateAccountId,providerId:protectedProviderId,providerAssetKey:registeredAssetKey,recurringAssetKey};
    await options.proveAssetHttpDenial('owner-aal1',aal1Token,httpFixture);
    await options.proveAssetHttpDenial('nonowner-aal2',nonownerAal2,httpFixture);
    assert(await storageBytesUnchanged(recurringStorage)&&await storageBytesUnchanged(registeredAssetStorage),
      'HTTP owner/AAL2 negatives changed real registered artwork bytes.');

    // A legitimate owner+AAL2 token can bypass the invoker RPC and write
    // binding rows directly. The database must independently enforce that
    // a bound asset belongs to the SAME provider, not merely exists.
    // Create a second random local-only provider with its own real
    // Storage-backed artwork, preserving the seeded provider and all slots.
    const crossProviderId='qa-cross-provider-'+randomUUID().replace(/-/g,'').slice(0,12);
    const crossProviderBefore=await selectProvider(aal2Token,crossProviderId);
    assert(crossProviderBefore.status===200&&Array.isArray(crossProviderBefore.body)&&
      crossProviderBefore.body.length===0,
      'Cross-provider QA id unexpectedly overlaps an existing provider.');
    syntheticCrossProviderIds.push(crossProviderId);
    const crossCreated=await rpc('rheomiq_create_financial_provider',aal2Token,{
      p_id:crossProviderId,p_display_name:'QA Cross Provider',
      p_short_name:'QA Cross',p_provider_kind:'bank',p_country_code:'GR',p_sort_order:421,
    });
    assert(crossCreated.status===200&&Array.isArray(crossCreated.body)&&
      crossCreated.body.length===1&&crossCreated.body[0]?.id===crossProviderId,
      'Valid owner AAL2 could not create its isolated second provider.');
    const crossStorage=newStoragePath('financial-provider-assets',crossProviderId);
    const crossAssetKey=crossStorage.path.split('/').at(-1)?.replace(/\.svg$/,'')||'';
    syntheticRegisteredAssets.push(crossAssetKey);
    const crossStored=await storageRequest('POST',aal2Token,crossStorage);
    assert([200,201].includes(crossStored.status)&&await storageExists(crossStorage),
      'Second provider Storage positive control was not uploaded.');
    const crossAsset=await rpc('rheomiq_register_financial_provider_asset',aal2Token,{
      p_provider_id:crossProviderId,p_asset_key:crossAssetKey,
      p_asset_role:'card-mark',p_variant:'dark',
      p_file_name:crossAssetKey+'.svg',p_mime_type:'image/svg+xml',
      p_storage_path:crossStorage.path,p_size_bytes:svgBytes.length,p_make_primary:false,
    });
    assert(crossAsset.status===200&&Array.isArray(crossAsset.body)&&
      crossAsset.body.length===1&&crossAsset.body[0]?.asset_key===crossAssetKey&&
      crossAsset.body[0]?.provider_id===crossProviderId,
      'Second provider artwork must be a real owner-registered asset.');
    const originalCrossBaseline=await selectProviderBinding(serviceRole,protectedProviderId);
    const crossSlotBefore=await selectProviderBinding(serviceRole,crossProviderId);
    assert(originalCrossBaseline.status===200&&Array.isArray(originalCrossBaseline.body)&&
      originalCrossBaseline.body.length===1&&
      originalCrossBaseline.body[0]?.asset_key===registeredAssetKey&&
      crossSlotBefore.status===200&&Array.isArray(crossSlotBefore.body)&&
      crossSlotBefore.body.length===0,
      'Cross-provider negative DML must start with exact owner-positive and empty slots.');

    // Enroll both potential corrupt rows in scoped cleanup before any
    // probe, so even a discovered FK bypass cannot leave a cross-binding.
    syntheticRegisteredBindings.push({
      providerId:crossProviderId,assetRole:'card-mark',variant:'dark',assetKey:registeredAssetKey,
    });
    const foreignInsert=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings',{
      method:'POST',headers:{
        apikey:publishable,authorization:'Bearer '+aal2Token,accept:'application/json',
        'content-type':'application/json',prefer:'return=representation',
      },
      body:JSON.stringify({
        provider_id:crossProviderId,asset_role:'card-mark',
        variant:'dark',asset_key:registeredAssetKey,
      }),
    });
    const foreignInsertBody=await foreignInsert.json().catch(()=>null);
    assert(foreignInsert.status===409&&String(foreignInsertBody?.code)==='23503',
      'Owner AAL2 direct cross-provider INSERT bypassed provider/asset FK provenance.');
    const crossSlotAfter=await selectProviderBinding(serviceRole,crossProviderId);
    assert(crossSlotAfter.status===200&&Array.isArray(crossSlotAfter.body)&&
      crossSlotAfter.body.length===0,
      'Rejected cross-provider INSERT persisted an unauthorized binding.');

    syntheticRegisteredBindings.push({
      providerId:protectedProviderId,assetRole:'card-mark',variant:'dark',assetKey:crossAssetKey,
    });
    const foreignPatch=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings?'+
      new URLSearchParams({
        provider_id:'eq.'+protectedProviderId,asset_role:'eq.card-mark',variant:'eq.dark',
      }),{
      method:'PATCH',headers:{
        apikey:publishable,authorization:'Bearer '+aal2Token,accept:'application/json',
        'content-type':'application/json',prefer:'return=representation',
      },body:JSON.stringify({asset_key:crossAssetKey}),
    });
    const foreignPatchBody=await foreignPatch.json().catch(()=>null);
    assert(foreignPatch.status===409&&String(foreignPatchBody?.code)==='23503',
      'Owner AAL2 direct cross-provider UPDATE bypassed provider/asset FK provenance.');
    const originalCrossAfter=await selectProviderBinding(serviceRole,protectedProviderId);
    assert(originalCrossAfter.status===200&&Array.isArray(originalCrossAfter.body)&&
      JSON.stringify(originalCrossAfter.body)===JSON.stringify(originalCrossBaseline.body),
      'Rejected cross-provider UPDATE changed the original binding or timestamp.');

    // Unlike the binding FK, a foreign key alone cannot enforce active=true.
    // A direct owner+AAL2 PATCH to the registered image must not deactivate
    // it while the real synthetic dark-slot binding still references it.
    const boundAssetBefore=await selectProviderAsset(serviceRole,registeredAssetKey);
    assert(boundAssetBefore.status===200&&Array.isArray(boundAssetBefore.body)&&
      boundAssetBefore.body.length===1&&boundAssetBefore.body[0]?.active===true,
      'Bound provider artwork deactivation proof requires one active registered row.');
    const deniedBoundDeactivate=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_assets?asset_key=eq.'+
      encodeURIComponent(registeredAssetKey),{
      method:'PATCH',headers:{
        apikey:publishable,authorization:'Bearer '+aal2Token,
        'content-type':'application/json',accept:'application/json',
        prefer:'return=representation',
      },body:JSON.stringify({active:false}),
    });
    const deniedBoundBody=await deniedBoundDeactivate.json().catch(()=>null);
    assert(deniedBoundDeactivate.status===409&&String(deniedBoundBody?.code)==='23503',
      'Direct owner AAL2 deactivated a still-bound provider artwork row.');
    const boundAssetAfter=await selectProviderAsset(serviceRole,registeredAssetKey);
    const boundBindingAfter=await selectProviderBinding(serviceRole,protectedProviderId);
    assert(JSON.stringify(boundAssetAfter.body)===JSON.stringify(boundAssetBefore.body)&&
      JSON.stringify(boundBindingAfter.body)===JSON.stringify(originalCrossBaseline.body),
      'Denied bound artwork deactivation changed asset state, timestamp or binding.');

    // Separate the existing active-only SELECT RLS contract from this new
    // bound-artwork trigger: even an unbound asset cannot become invisible
    // through owner PostgREST UPDATE active=false under existing RLS.
    const unboundAssetBefore=await selectProviderAsset(serviceRole,crossAssetKey);
    assert(unboundAssetBefore.status===200&&Array.isArray(unboundAssetBefore.body)&&
      unboundAssetBefore.body.length===1&&unboundAssetBefore.body[0]?.active===true,
      'Unbound provider artwork control must start as a real active row.');
    const unboundDeactivate=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_assets?asset_key=eq.'+
      encodeURIComponent(crossAssetKey),{
      method:'PATCH',headers:{
        apikey:publishable,authorization:'Bearer '+aal2Token,
        'content-type':'application/json',accept:'application/json',
        prefer:'return=minimal',
      },body:JSON.stringify({active:false}),
    });
    // The existing active-only SELECT policy independently rejects this
    // transition with 42501; do not weaken owner-data visibility to
    // turn an intentionally denied operation into an artificial positive.
    const unboundDeactivateBody=await unboundDeactivate.json().catch(()=>null);
    assert(unboundDeactivate.status===403&&String(unboundDeactivateBody?.code)==='42501',
      'Unbound artwork deactivation escaped existing active-only SELECT RLS.');
    const unboundAfterDenied=await selectProviderAsset(serviceRole,crossAssetKey);
    assert(JSON.stringify(unboundAfterDenied.body)===JSON.stringify(unboundAssetBefore.body),
      'RLS-denied unbound artwork deactivation modified registry data.');

    // True owner+AAL2 positive control exercises UPDATE OF active (true→true)
    // through the new invoker trigger and an allowed metadata update,
    // without broadening active-only RLS or touching an existing binding.
    const unboundEdit=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_assets?asset_key=eq.'+
      encodeURIComponent(crossAssetKey),{
      method:'PATCH',headers:{
        apikey:publishable,authorization:'Bearer '+aal2Token,
        'content-type':'application/json',accept:'application/json',
        prefer:'return=minimal',
      },body:JSON.stringify({active:true,usage_note:'Synthetic unbound artwork QA control'}),
    });
    assert([200,204].includes(unboundEdit.status),
      'Owner AAL2 lost valid unbound active-artwork metadata UPDATE.');
    const unboundAssetAfter=await selectProviderAsset(serviceRole,crossAssetKey);
    assert(unboundAssetAfter.status===200&&Array.isArray(unboundAssetAfter.body)&&
      unboundAssetAfter.body.length===1&&
      unboundAssetAfter.body[0]?.asset_key===crossAssetKey&&
      unboundAssetAfter.body[0]?.active===true&&
      unboundAssetAfter.body[0]?.usage_note==='Synthetic unbound artwork QA control'&&
      unboundAssetAfter.body[0]?.storage_path===unboundAssetBefore.body[0]?.storage_path,
      'Unbound artwork allowed metadata update did not persist or changed its identity.');

  // Keep the owner IBAN fixture until the revoked-session RLS readback.
  const negativeCases=[
    {name:'dated overpayment',state:overpay,marker:'RECEIVABLE_CHRONOLOGY_CONFLICT'},
    {name:'future lending masks an intermediate deficit',state:proposed([
      payment('2026-10-20',8,'Synthetic prior repayment'),
      lending('2026-10-30',10,'Synthetic later lending'),
      payment('2026-10-19',3,'Synthetic backdated repayment'),
    ]),marker:'RECEIVABLE_CHRONOLOGY_CONFLICT'},
    {name:'forged receivable delta',state:proposed([
      {...payment('2026-10-04',5,'Synthetic forged delta'),receivableDelta:-1},
    ]),marker:'INVALID_RECEIVABLE_EVENT'},
  ];
  for(const candidate of negativeCases){
    const denied=await rpc('rheomiq_save_mutable_state_history',aal2Token,mutable(candidate.state));
    assert(denied.status===400&&denied.body?.message===candidate.marker,
      'Direct PostgREST '+candidate.name+' was not rejected at the locked database boundary.');
  }
  const after=await rpc('rheomiq_read_state',aal2Token,{});
  const historyAfter=await rpc('rheomiq_read_history',aal2Token,{});
  assert(after.status===200&&historyAfter.status===200,'Post-rejection finance/history read-back failed.');
  assert(JSON.stringify(after.body)===JSON.stringify(before.body)&&
    String(historyAfter.body?.generation)===generation,
    'Direct RPC rejected a finance mutation but changed revision, state or history.');
  // #649 I22.02: revoke the previously valid synthetic owner AAL2 device
  // at the real local PostgREST boundary. This is NOT an Auth logout: its
  // JWT still parses, so only the active-device predicate can deny access.
  // The legitimate primary browser device is a separate registered session.
  const revokedDevice=await fetch(apiUrl+'/rest/v1/myfinhub_device_sessions?'+
    new URLSearchParams({session_id:'eq.'+aal2Claims.session_id!,user_id:'eq.'+userId,revoked_at:'is.null'}),{
    method:'PATCH',headers:{
      apikey:serviceRole,authorization:'Bearer '+serviceRole,
      'content-type':'application/json',prefer:'return=representation',accept:'application/json',
    },body:JSON.stringify({revoked_at:new Date().toISOString()}),
  });
  const revokedRows=await revokedDevice.json().catch(()=>null);
  assert(revokedDevice.status===200&&Array.isArray(revokedRows)&&revokedRows.length===1&&
    revokedRows[0]?.session_id===aal2Claims.session_id&&revokedRows[0]?.user_id===userId&&
    !!revokedRows[0]?.revoked_at,
    'Synthetic owner AAL2 device revocation was not committed exactly once.');
  await assertDeniedFinanceRpcs('revoked-aal2',aal2Token);
  const deniedWrite=await rpc('rheomiq_upsert_account_metadata',aal2Token,{
    p_account_id:'qa-direct-rpc-revoked-iban',p_iban:privateIban,p_expected_revision:0,
  });
  assert(deniedWrite.status===403&&String(deniedWrite.body?.code)==='42501',
    'Revoked owner AAL2 device could still create IBAN metadata through direct RPC.');
  const revokedRead=await selectMetadata(aal2Token);
  assert(revokedRead.status===200&&Array.isArray(revokedRead.body)&&revokedRead.body.length===0,
    'Revoked owner AAL2 device retained direct account metadata visibility.');
  const revokedProviderRead=await selectProvider(aal2Token,protectedProviderId);
  assert(revokedProviderRead.status===200&&Array.isArray(revokedProviderRead.body)&&
    revokedProviderRead.body.length===0,
    'Revoked owner AAL2 device retained direct financial provider SELECT visibility.');
  const revokedRecurringRead=await selectRecurringAsset(aal2Token,recurringAssetKey);
  assert(revokedRecurringRead.status===200&&Array.isArray(revokedRecurringRead.body)&&
    revokedRecurringRead.body.length===0,
    'Revoked owner AAL2 device retained direct recurring service asset SELECT visibility.');
  const revokedAssetRead=await selectProviderAsset(aal2Token,registeredAssetKey);
  assert(revokedAssetRead.status===200&&Array.isArray(revokedAssetRead.body)&&
    revokedAssetRead.body.length===0,
    'Revoked owner AAL2 device retained direct financial provider asset SELECT visibility.');
  const revokedBindingRead=await selectProviderBinding(aal2Token,protectedProviderId);
  assert(revokedBindingRead.status===200&&Array.isArray(revokedBindingRead.body)&&
    revokedBindingRead.body.length===0,
    'Revoked owner AAL2 retained provider binding SELECT visibility.');
  await assertDeniedBindingMutations('revoked owner AAL2',aal2Token,protectedProviderId,registeredAssetKey);
  await assertDeniedStorage('revoked owner AAL2',aal2Token);
  await options.proveAssetHttpDenial('revoked-aal2',aal2Token,httpFixture);
  assert(await storageBytesUnchanged(recurringStorage)&&await storageBytesUnchanged(registeredAssetStorage),
    'HTTP revoked-device negatives changed real registered artwork bytes.');
  // The JWT still parses after device revocation. Every previously tested
  // direct metadata/asset RPC must now deny the same revoked AAL2 identity.
  // No request is replayed and any write would abort the disposable proof.
  for(const entry of protectedMetadataMutations){
    const denied=await rpc(entry.method,aal2Token,entry.params);
    assert(denied.status===403&&String(denied.body?.code)==='42501',
      'Revoked owner AAL2 retained direct '+entry.method+' mutation access.');
  }
  // The AAL1 and AAL2 tokens may share the same local GoTrue session_id.
  // The suite's outer owner-authorized cleanup should revoke only an active
  // synthetic session, never re-revoke a row already retired above.
  return aal1Claims.session_id===aal2Claims.session_id?[]:[aal1Claims.session_id!];
  }finally{
    // An asset registry row must be removed before its Storage object:
    // preserve production FK semantics while cleaning only random fixtures
    // in the disposable local Supabase. An empty DELETE return is valid if
    // the test failed before registration was committed.
    for(const binding of syntheticRegisteredBindings){
      const response=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings?'+
        new URLSearchParams({
          provider_id:'eq.'+binding.providerId,asset_role:'eq.'+binding.assetRole,
          variant:'eq.'+binding.variant,asset_key:'eq.'+binding.assetKey,
        }),{
        method:'DELETE',headers:{
          apikey:serviceRole,authorization:'Bearer '+serviceRole,
          prefer:'return=representation',accept:'application/json',
        },
      });
      const rows=await response.json().catch(()=>null);
      assert(response.status===200&&Array.isArray(rows)&&rows.length<=1&&
        rows.every((row:{provider_id?:unknown;asset_role?:unknown;variant?:unknown;asset_key?:unknown})=>
          row.provider_id===binding.providerId&&row.asset_role===binding.assetRole&&
          row.variant===binding.variant&&row.asset_key===binding.assetKey),
        'Synthetic binding cleanup escaped its exact provider/slot/key.');
    }
    for(const assetKey of syntheticRegisteredAssets){
      const response=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_assets?asset_key=eq.'+
        encodeURIComponent(assetKey),{
        method:'DELETE',headers:{
          apikey:serviceRole,authorization:'Bearer '+serviceRole,
          prefer:'return=representation',accept:'application/json',
        },
      });
      const rows=await response.json().catch(()=>null);
      assert(response.status===200&&Array.isArray(rows)&&rows.length<=1&&
        rows.every((row:{asset_key?:unknown})=>row.asset_key===assetKey),
        'Isolated direct provider asset registry cleanup was not confined to its synthetic key.');
    }
    for(const assetKey of syntheticRegisteredRecurringAssets){
      const response=await fetch(apiUrl+'/rest/v1/rheomiq_recurring_service_assets?'+
        new URLSearchParams({owner_user_id:'eq.'+userId,asset_key:'eq.'+assetKey}),{
        method:'DELETE',headers:{
          apikey:serviceRole,authorization:'Bearer '+serviceRole,
          prefer:'return=representation',accept:'application/json',
        },
      });
      const rows=await response.json().catch(()=>null);
      assert(response.status===200&&Array.isArray(rows)&&rows.length<=1&&
        rows.every((row:{owner_user_id?:unknown;asset_key?:unknown})=>
          row.owner_user_id===userId&&row.asset_key===assetKey),
        'Isolated recurring service asset cleanup was not scoped to the true synthetic owner/key.');
    }
    // Delete only our own random loopback fixtures through the confined local
    // service role, even if a negative assertion discovered a Storage bypass.
    for(const fixture of syntheticStoragePaths){
      if(!(await storageExists(fixture)))continue;
      const response=await storageRequest('DELETE',serviceRole,fixture);
      assert(response.status>=200&&response.status<300,
        'Isolated direct Storage fixture cleanup failed.');
      assert(!(await storageExists(fixture)),
        'Isolated direct Storage cleanup left a synthetic object behind.');
    }
    // Every cross-provider fixture is a new random provider, never a seeded
    // owner record; delete it after the bindings, assets and Storage objects.
    for(const providerId of syntheticCrossProviderIds){
      const response=await fetch(apiUrl+'/rest/v1/rheomiq_financial_providers?id=eq.'+
        encodeURIComponent(providerId),{
        method:'DELETE',headers:{
          apikey:serviceRole,authorization:'Bearer '+serviceRole,
          prefer:'return=representation',accept:'application/json',
        },
      });
      const rows=await response.json().catch(()=>null);
      assert(response.status===200&&Array.isArray(rows)&&rows.length<=1&&
        rows.every((row:{id?:unknown})=>row.id===providerId),
        'Isolated cross-provider fixture cleanup escaped its random provider ID.');
    }
    const cleanup=await fetch(apiUrl+'/rest/v1/rheomiq_account_metadata?account_id=eq.'+encodeURIComponent(privateAccountId),{
      method:'DELETE',headers:{
        apikey:serviceRole,authorization:'Bearer '+serviceRole,
        prefer:'return=representation',accept:'application/json',
      },
    });
    const removed=await cleanup.json().catch(()=>null);
    assert(cleanup.status===200&&Array.isArray(removed)&&removed.length===1&&
      removed[0]?.account_id===privateAccountId,
      'Isolated direct-RPC metadata fixture cleanup did not confirm exactly one removed row.');
  }
}
