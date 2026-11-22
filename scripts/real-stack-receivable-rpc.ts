import {randomUUID} from 'node:crypto';
import {createEvent} from '../src/lib/domain.js';
import type {FinanceData} from '../src/types.js';

type Options={
  apiUrl:string;publishable:string;serviceRole:string;
  email:string;password:string;userId:string;factorId:string;
  totpCode:()=>Promise<string>;
  totpCodeForSecret:(secret:string,previous?:string)=>Promise<string>;
  data:FinanceData;revision:string;generation:string;
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
  for(const method of ['rheomiq_read_state','rheomiq_read_history','rheomiq_save_mutable_state_history']){
    const denied=await rpc(method,nonownerAal2,
      method==='rheomiq_save_mutable_state_history'?mutable(overpay):{});
    assert(denied.status===403&&String(denied.body?.code)==='42501',
      'Local nonowner AAL2 with active device crossed the direct '+method+' owner RPC boundary.');
  }

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
      select:'asset_key,provider_id,storage_path,active',
      asset_key:'eq.'+assetKey,
    });
    const response=await fetch(apiUrl+'/rest/v1/rheomiq_financial_provider_assets?'+query,{
      headers:{apikey:publishable,authorization:'Bearer '+token,accept:'application/json'},
    });
    return {status:response.status,body:await response.json().catch(()=>null)};
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
  const storageRequest=async(method:'POST'|'DELETE',token:string,fixture:StorageFixture)=>{
    const response=await fetch(apiUrl+'/storage/v1/object/'+fixture.bucket+'/'+fixture.path,{
      method,headers:{
        apikey:token===serviceRole?serviceRole:publishable,authorization:'Bearer '+token,
        ...(method==='POST'?{'content-type':'image/svg+xml'}:{}),
      },
      ...(method==='POST'?{body:Uint8Array.from(svgBytes)}:{}),
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
      p_asset_role:'logo',p_variant:'universal',
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
  for(const method of ['rheomiq_read_state','rheomiq_read_history']){
    const denied=await rpc(method,aal2Token,{});
    assert(denied.status===403&&String(denied.body?.code)==='42501',
      'Revoked owner AAL2 device retained direct '+method+' access.');
  }
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
  await assertDeniedStorage('revoked owner AAL2',aal2Token);
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
