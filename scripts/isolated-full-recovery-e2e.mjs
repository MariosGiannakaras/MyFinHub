import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Explicitly refuse linked projects, non-CI use and any non-disposable DB.
// No owner financial data or credentials may appear in logs/artifacts.
if(process.env.CI!=='true'||process.env.MYFINHUB_ISOLATED_RECOVERY!=='1'){
  throw new Error('Isolated full recovery rehearsal requires CI and explicit local-only opt-in.');
}
const projectId=readFileSync('supabase/config.toml','utf8').match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if(projectId!=='rheomiq')throw new Error('Refusing recovery against an unexpected Supabase project.');
const container='supabase_db_'+projectId;
const localContainers=execFileSync('docker',['ps','--format','{{.Names}}'],{encoding:'utf8'}).split(/\r?\n/);
if(!localContainers.includes(container))throw new Error('Expected disposable local Supabase database is not running.');
const status=JSON.parse(execFileSync('npx',['--yes','supabase@2.119.0','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
function statusValue(value,keys){
  const wanted=new Set(keys.map(x=>x.replace(/[^a-z0-9]/gi,'').toUpperCase()));
  let found='';
  function visit(node){
    if(found||!node||typeof node!=='object')return;
    for(const [name,item] of Object.entries(node)){
      if((typeof item==='string'||typeof item==='number')&&wanted.has(name.replace(/[^a-z0-9]/gi,'').toUpperCase())){found=String(item).trim();if(found)return}
      if(item&&typeof item==='object')visit(item);
    }
  }
  visit(value);return found;
}
const apiUrl=statusValue(status,['API_URL','api_url']);
const key=statusValue(status,['SERVICE_ROLE_KEY','SECRET_KEY']);
if(!/^http:\/\/127\.0\.0\.1:54321$/.test(apiUrl)||key.length<20)throw new Error('Refusing non-loopback or unverified local Storage service.');
const tmp=mkdtempSync(join(tmpdir(),'myfinhub-isolated-recovery-'));
const archiveHost=join(tmp,'postgres.custom'),archiveOriginal='/tmp/myfinhub-ci-pg-'+process.pid+'.dump';
const archiveRestore='/tmp/myfinhub-ci-restore-'+process.pid+'.dump';
const scratch='myfinhub_ci_restore_'+process.pid;
// The local Supabase postgres role is deliberately not a superuser. Some
// platform-owned archived routines (e.g. realtime.list_changes) set protected
// PostgreSQL parameters and can only be restored by this local admin role.
// Never use it against source finance state or a linked/production project.
const scratchRestoreRole='supabase_admin';
const bucket='myfinhub-ci-recovery-'+process.pid;
const sourceBucket='myfinhub-ci-source-'+process.pid;
let scratchCreated=false,bucketCreated=false,cleanedBucket=false;
let sourceBucketCreated=false,sourceBucketCleaned=false;
const sha=value=>createHash('sha256').update(value).digest('hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
function docker(args,options={}){
  return execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:20*1024*1024,...options}).trim();
}
const db=args=>docker(['exec','-i',container,...args]);
function sql(database,statement,user='postgres'){
  return db(['psql','-X','-v','ON_ERROR_STOP=1','-U',user,'-d',database,'-Atq','-c',statement]);
}
const fingerprintTables=[
  ['public.rheomiq_app_state','id'],
  ['public.rheomiq_backups','id'],
  ['public.rheomiq_audit_log','id'],
  ['auth.users','id'],
  ['storage.buckets','id'],
  ['storage.objects','id'],
  ['supabase_migrations.schema_migrations','version'],
];
function fingerprints(database){
  // --no-owner/--no-acl makes restored objects owned by the local admin.
  // Read scratch with that role, without modifying original source access.
  const readRole=database===scratch?scratchRestoreRole:'postgres';
  return fingerprintTables.map(([table,orderBy])=>{
    const statement='select md5(coalesce(string_agg(to_jsonb(t)::text, '+
      "E'\\n' order by t."+orderBy+"::text),'')) from "+table+' t;';
    return sql(database,statement,readRole);
  });
}
function storageHeaders(extra={}){return {apikey:key,authorization:'Bearer '+key,...extra}}
function objectKey(bucketName,name){
  return (bucketName+'/'+name).split('/').map(x=>encodeURIComponent(x)).join('/');
}
async function storageRequest(path,init={}){
  const result=await fetch(apiUrl+'/storage/v1'+path,{
    ...init,headers:storageHeaders(init.headers||{}),
  });
  if(!result.ok)throw new Error('Disposable local Storage API rejected operation: HTTP '+result.status);
  return result;
}
async function cleanupBucketByName(name){
  await storageRequest('/bucket/'+name+'/empty',{method:'POST'});
  await storageRequest('/bucket/'+name,{method:'DELETE'});
}
async function cleanupBucket(){
  if(!bucketCreated||cleanedBucket)return;
  try{await cleanupBucketByName(bucket);cleanedBucket=true}
  catch{console.warn('[isolated-recovery] replay Storage bucket cleanup failed; disposable local project will be discarded');}
}
async function cleanupSourceBucket(){
  if(!sourceBucketCreated||sourceBucketCleaned)return;
  try{await cleanupBucketByName(sourceBucket);sourceBucketCleaned=true}
  catch{console.warn('[isolated-recovery] source Storage fixture cleanup failed; disposable local project will be discarded');}
}
try{
  // Give the isolated exercise at least one real binary to capture/restore,
  // even when the preceding API smoke has deleted its temporary asset.
  const pristine=fingerprints('postgres');
  await storageRequest('/bucket',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id:sourceBucket,name:sourceBucket,public:false})});
  sourceBucketCreated=true;
  const fixture=Buffer.from('MyFinHub isolated Storage recovery synthetic checkpoint proof\n','utf8');
  await storageRequest('/object/'+objectKey(sourceBucket,'checkpoint.txt'),{
    method:'POST',headers:{'content-type':'text/plain','x-upsert':'false'},body:fixture,
  });
  console.log('[isolated-recovery] stage immutable PostgreSQL+Storage checkpoint');
  const source=fingerprints('postgres');
  assert(source[0]&&sql('postgres','select count(*) from auth.users;')!=='0','Expected synthetic authenticated finance state is missing.');
  db(['pg_dump','-U','postgres','-d','postgres','-Fc','--no-owner','--no-acl','-f',archiveOriginal]);
  docker(['cp',container+':'+archiveOriginal,archiveHost]);
  const archiveBytes=readFileSync(archiveHost);
  assert(archiveBytes.length>1024,'Full PostgreSQL custom archive is missing.');
  const archiveDigest=sha(archiveBytes);
  db(['rm','-f',archiveOriginal]);
  docker(['cp',archiveHost,container+':'+archiveRestore]);
  assert(db(['sha256sum',archiveRestore]).split(/\s+/)[0]===archiveDigest,'Transferred PostgreSQL archive hash mismatch.');
  const toc=db(['pg_restore','--list',archiveRestore]);
  assert(toc.includes('rheomiq_app_state')&&toc.includes('storage')&&toc.includes('schema_migrations'),
    'PostgreSQL archive omitted finance, Storage metadata or migrations.');

  const objects=JSON.parse(sql('postgres',
    "select coalesce(json_agg(json_build_object('bucket',bucket_id,'name',name)), '[]'::json)::text from storage.objects;"));
  assert(Array.isArray(objects)&&objects.length>0&&objects.length<=128,'Local fixture Storage objects missing or over bounded QA limit.');
  const snapshot=[];
  let total=0;
  for(const [index,item] of objects.entries()){
    assert(typeof item.bucket==='string'&&typeof item.name==='string'&&item.bucket&&!item.name.includes('..'),
      'Unsafe Storage object name in synthetic checkpoint.');
    const response=await storageRequest('/object/authenticated/'+objectKey(item.bucket,item.name));
    const bytes=Buffer.from(await response.arrayBuffer());
    total+=bytes.length;
    assert(total<=64*1024*1024,'Local recovery proof exceeds 64 MiB; do not treat a partial snapshot as a backup.');
    const filename=join(tmp,'storage-object-'+index);
    writeFileSync(filename,bytes,{mode:0o600});
    snapshot.push({bucket:item.bucket,name:item.name,filename,hash:sha(bytes),mime:response.headers.get('content-type')||'application/octet-stream'});
  }
  writeFileSync(join(tmp,'manifest.json'),JSON.stringify({archiveSha256:archiveDigest,
    objects:snapshot.map(({bucket,name,hash})=>({bucket,name,sha256:hash}))}),{mode:0o600});

  console.log('[isolated-recovery] stage independent scratch database restore');
  // Verify real local-role identity and superuser status rather than weakening
  // pg_restore, excluding Realtime, or changing postgres role privileges.
  const scratchAdmin=db(['psql','-X','-v','ON_ERROR_STOP=1','-U',scratchRestoreRole,'-d','postgres','-Atq','-c',
    "select case when current_user='supabase_admin' and current_setting('is_superuser')='on' then 'ok' else 'no' end;"]);
  assert(scratchAdmin==='ok','Disposable local Supabase privileged restore role is unavailable.');
  db(['createdb','-U','postgres','-T','template0',scratch]);
  scratchCreated=true;
  // PostgreSQL template0 has public in this Supabase image. pg_dump does NOT
  // emit CREATE SCHEMA public for an inherited, unmodified default schema.
  // Dropping it before pg_restore makes the very first public routine fail.
  // Ensure it is present and restore everything from the independently copied
  // archive; never prepopulate scratch with live finance tables/data.
  sql(scratch,'create schema if not exists public;');
  assert(sql(scratch,"select to_regnamespace('public') is not null;")==='t',
    'Scratch restore requires an empty public schema from the database template.');
  db(['pg_restore','-U',scratchRestoreRole,'-d',scratch,'--exit-on-error','--no-owner','--no-privileges',archiveRestore]);
  const restored=fingerprints(scratch);
  assert(JSON.stringify(restored)===JSON.stringify(source),
    'Independent PostgreSQL restore differs in finance, backup, audit, auth, Storage metadata or migration rows.');
  const sourceRls=sql('postgres',"select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity;");
  const restoredRls=sql(scratch,"select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity;");
  assert(Number(sourceRls)>0&&sourceRls===restoredRls,'Restored PostgreSQL security/RLS topology differs.');

  console.log('[isolated-recovery] stage independent Storage binary replay');
  await storageRequest('/bucket',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id:bucket,name:bucket,public:false})});
  bucketCreated=true;
  for(const item of snapshot){
    const bytes=readFileSync(item.filename);
    assert(sha(bytes)===item.hash,'Checkpoint Storage binary changed on disk.');
    const name=item.bucket+'/'+item.name;
    await storageRequest('/object/'+objectKey(bucket,name),{
      method:'POST',headers:{'content-type':item.mime,'x-upsert':'false'},body:bytes,
    });
    const verified=await storageRequest('/object/authenticated/'+objectKey(bucket,name));
    assert(sha(Buffer.from(await verified.arrayBuffer()))===item.hash,
      'Rehydrated Storage binary checksum mismatch.');
  }
  await cleanupBucket();
  await cleanupSourceBucket();
  assert(cleanedBucket&&sourceBucketCleaned,'An isolated Storage fixture namespace was not cleaned up.');
  assert(JSON.stringify(fingerprints('postgres'))===JSON.stringify(pristine),
    'Local source finance/Storage metadata changed after removing temporary recovery fixtures.');
  console.log('[isolated-recovery] PASS custom PostgreSQL dump transferred/restored into separate scratch DB, RLS and all selected state hashes equal, Storage bytes replayed with SHA-256 and original source unchanged');
}finally{
  await cleanupBucket();
  await cleanupSourceBucket();
  if(scratchCreated){
    try{db(['dropdb','-U','postgres','--if-exists',scratch])}
    catch{console.warn('[isolated-recovery] scratch DB cleanup failed; disposable local Supabase will be stopped by CI');}
  }
  for(const p of [archiveOriginal,archiveRestore]){
    try{db(['rm','-f',p])}catch{}
  }
  rmSync(tmp,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
