import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const config=readFileSync('supabase/config.toml','utf8');
const projectId=config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]||'';
if(!projectId)throw new Error('Supabase local project_id was not found.');

const expectedContainer='supabase_db_'+projectId;
const containers=execFileSync('docker',['ps','--format','{{.Names}}'],{encoding:'utf8'})
  .split(/\r?\n/)
  .map(value=>value.trim())
  .filter(Boolean);
const dbContainer=containers.find(value=>value===expectedContainer);
if(!dbContainer)throw new Error('Local Supabase database container '+expectedContainer+' is not running.');

const partial=readFileSync('scripts/recovery-fixtures/partial-migration.sql','utf8');
const rollForward=readFileSync('scripts/recovery-fixtures/roll-forward.sql','utf8');

function sql(statement:string){
  return execFileSync('docker',[
    'exec','-i',dbContainer,
    'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-Atq',
  ],{input:statement,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
}
function assert(condition:unknown,message:string):asserts condition{
  if(!condition)throw new Error(message);
}
function cleanup(){
  sql('drop table if exists public.myfinhub_migration_recovery_probe cascade;');
}

try{
  cleanup();
  const ledgerBefore=sql('select count(*) from supabase_migrations.schema_migrations;');

  console.log('[migration-recovery] stage partial-state');
  sql(partial);
  assert(sql("select count(*) from public.myfinhub_migration_recovery_probe where id='sentinel' and payload='preserve-me';")==='1','Synthetic sentinel was not created.');
  assert(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='myfinhub_migration_recovery_probe' and column_name='recovery_status';")==='0','Partial state unexpectedly contains the final recovery column.');
  assert(sql("select has_table_privilege('authenticated','public.myfinhub_migration_recovery_probe','SELECT');")==='f','Partial state unexpectedly grants authenticated SELECT.');

  console.log('[migration-recovery] stage roll-forward');
  sql(rollForward);
  assert(sql("select payload||'|'||recovery_status from public.myfinhub_migration_recovery_probe where id='sentinel';")==='preserve-me|ready','Roll-forward did not preserve and normalize the sentinel.');
  assert(sql("select relrowsecurity from pg_class where oid='public.myfinhub_migration_recovery_probe'::regclass;")==='t','Roll-forward did not preserve RLS.');
  assert(sql("select has_table_privilege('anon','public.myfinhub_migration_recovery_probe','SELECT');")==='f','Anon unexpectedly gained probe access.');
  assert(sql("select has_table_privilege('authenticated','public.myfinhub_migration_recovery_probe','SELECT');")==='t','Authenticated SELECT grant is missing after roll-forward.');
  assert(sql("select has_table_privilege('authenticated','public.myfinhub_migration_recovery_probe','INSERT');")==='f','Authenticated write privilege was broadened by roll-forward.');
  assert(sql("select count(*) from pg_policies where schemaname='public' and tablename='myfinhub_migration_recovery_probe' and policyname='myfinhub_migration_recovery_probe_owner_select' and cmd='SELECT';")==='1','Owner/AAL2 recovery policy is missing.');
  assert(sql("select count(*) from pg_constraint where conname='myfinhub_migration_recovery_probe_status_check' and conrelid='public.myfinhub_migration_recovery_probe'::regclass;")==='1','Recovery status constraint is missing.');

  console.log('[migration-recovery] stage idempotent-rerun');
  sql(rollForward);
  assert(sql("select count(*) from public.myfinhub_migration_recovery_probe where id='sentinel' and payload='preserve-me' and recovery_status='ready';")==='1','Idempotent roll-forward changed or duplicated the sentinel.');

  const ledgerAfter=sql('select count(*) from supabase_migrations.schema_migrations;');
  assert(ledgerAfter===ledgerBefore,'Synthetic rehearsal must not rewrite Supabase migration history.');

  cleanup();
  assert(sql("select to_regclass('public.myfinhub_migration_recovery_probe') is null;")==='t','Recovery probe cleanup failed.');
  console.log('[migration-recovery] PASS forward-only partial-state recovery preserved data, RLS/grants and migration history');
}finally{
  cleanup();
}
