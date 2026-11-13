import {createEvent} from '../src/lib/domain.js';
import type {FinanceData} from '../src/types.js';

type Options={
  apiUrl:string;publishable:string;serviceRole:string;
  email:string;password:string;userId:string;factorId:string;
  totpCode:()=>Promise<string>;
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
  const register=async(sessionId:string)=>{
    const row=await postJson(apiUrl+'/rest/v1/myfinhub_device_sessions',{
      apikey:serviceRole,authorization:'Bearer '+serviceRole,
      prefer:'resolution=merge-duplicates,return=representation'
    },{session_id:sessionId,user_id:userId,platform:'web',device_label:'Synthetic direct RPC proof',app_version:'local-real-stack',revoked_at:null});
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
  // Return only the synthetic local GoTrue session IDs. The existing
  // owner-authorized device API will revoke them before device-lifecycle QA.
  return [...new Set([aal1Claims.session_id!,aal2Claims.session_id!])];
}
