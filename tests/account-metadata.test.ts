import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../server/http.js';
import { parseAccountMetadataExpectedRevision, parseAccountMetadataWrite } from '../server/accountMetadataHandler.js';
import { assertValidIban, formatIban, isValidIban, normalizeIban } from '../src/lib/iban.js';

const migration=readFileSync(new URL('../supabase/migrations/20260824205000_add_account_metadata.sql',import.meta.url),'utf8');
const grantHardening=readFileSync(new URL('../supabase/migrations/20260825195120_tighten_account_metadata_function_grants.sql',import.meta.url),'utf8');
const conflictFix=readFileSync(new URL('../supabase/migrations/20260901133549_fix_account_metadata_upsert_conflict.sql',import.meta.url),'utf8');
const activeDeviceHardening=readFileSync(new URL('../supabase/migrations/20260930062504_harden_active_device_sensitive_rls.sql',import.meta.url),'utf8');
const financeTypes=readFileSync(new URL('../src/types.ts',import.meta.url),'utf8');
const financeHook=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');
const dashboardSource=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const settingsSource=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const accountManagerSource=readFileSync(new URL('../src/components/AccountManagementSettings.tsx',import.meta.url),'utf8');
const accountIbanSource=readFileSync(new URL('../src/components/AccountIban.tsx',import.meta.url),'utf8');

describe('account IBAN metadata',()=>{
  it('normalizes, validates and formats real IBAN checksums without inventing issuer restrictions',()=>{
    expect(normalizeIban(' gr16 0110 1250 0000 0001 2300 695 ')).toBe('GR1601101250000000012300695');
    expect(isValidIban('GR1601101250000000012300695')).toBe(true);
    expect(isValidIban('GR1601101250000000012300694')).toBe(false);
    expect(isValidIban('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(formatIban('GR1601101250000000012300695')).toBe('GR16 0110 1250 0000 0001 2300 695');
    expect(assertValidIban('')).toBeNull();
    expect(()=>assertValidIban('GR1601101250000000012300694')).toThrow('INVALID_IBAN');
  });

  it('accepts only stable account ids plus IBAN and normalizes writes at the API boundary',()=>{
    expect(parseAccountMetadataWrite({accountId:'piraeus-payroll',iban:' gr16 0110 1250 0000 0001 2300 695 '})).toEqual({accountId:'piraeus-payroll',iban:'GR1601101250000000012300695'});
    expect(parseAccountMetadataWrite({accountId:'cash',iban:null})).toEqual({accountId:'cash',iban:null});
    for(const input of [
      {accountId:'../../bad',iban:null},
      {accountId:'cash',iban:'GR1601101250000000012300694'},
      {accountId:'cash',iban:null,note:'not-allowed'},
    ]){
      try{parseAccountMetadataWrite(input);throw new Error('expected failure')}catch(error){expect(error).toBeInstanceOf(ApiError)}
    }
  });

  it('requires an explicit optimistic revision including first-write revision zero',()=>{
    expect(parseAccountMetadataExpectedRevision('0')).toBe(0);
    expect(parseAccountMetadataExpectedRevision('"4"')).toBe(4);
    expect(parseAccountMetadataExpectedRevision('W/"7"')).toBe(7);
    try{parseAccountMetadataExpectedRevision(undefined);throw new Error('expected failure')}catch(error){expect((error as ApiError).status).toBe(428);expect((error as ApiError).code).toBe('REVISION_REQUIRED')}
    expect(()=>parseAccountMetadataExpectedRevision('-1')).toThrow(ApiError);
  });

  it('keeps account metadata in its own owner+AAL2 RLS store with a revision-checked invoker RPC',()=>{
    expect(migration).toContain('create table if not exists public.rheomiq_account_metadata');
    expect(migration).toContain('primary key (owner_user_id, account_id)');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain("auth.jwt()) ->> 'aal', '') = 'aal2'");
    expect(migration).toContain('security invoker');
    expect(migration).toContain('p_expected_revision bigint');
    expect(migration).toContain("raise exception 'REVISION_CONFLICT'");
    expect(migration).toContain('revision = rheomiq_account_metadata.revision + 1');
    expect(migration).not.toContain('rheomiq_backups');
    expect(grantHardening).toContain('revoke all on function public.rheomiq_upsert_account_metadata(text, text, bigint)');
    expect(grantHardening).toContain('from public, anon, authenticated');
    expect(grantHardening).toContain('grant execute on function public.rheomiq_upsert_account_metadata(text, text, bigint)');
    expect(grantHardening).toContain('to authenticated');
  });

  it('requires the current active device for account metadata RLS and RPC writes',()=>{
    expect(activeDeviceHardening).toContain('create policy rheomiq_account_metadata_owner_aal2_select');
    expect(activeDeviceHardening).toContain('create policy rheomiq_account_metadata_owner_aal2_insert');
    expect(activeDeviceHardening).toContain('create policy rheomiq_account_metadata_owner_aal2_update');
    expect(activeDeviceHardening).toContain('and (select public.rheomiq_is_owner_aal2())');
    expect(activeDeviceHardening).toContain('if v_uid is null or not (select public.rheomiq_is_owner_aal2()) then');
    expect(activeDeviceHardening).toContain('on conflict on constraint rheomiq_account_metadata_pkey do nothing');
  });

  it('keeps first-write conflict handling unambiguous inside the table-returning PL/pgSQL function',()=>{
    expect(conflictFix).toContain('on conflict on constraint rheomiq_account_metadata_pkey do nothing');
    expect(conflictFix).not.toContain('on conflict (owner_user_id, account_id) do nothing');
    expect(conflictFix).toContain('security invoker');
    expect(conflictFix).toContain("raise exception 'REVISION_CONFLICT'");
  });

  it('keeps IBAN outside FinanceData and finance Undo/Redo while exposing it on Dashboard and Settings',()=>{
    expect(financeTypes.toLowerCase()).not.toContain('iban');
    expect(financeHook.toLowerCase()).not.toContain('iban');
    expect(dashboardSource).toContain('<AccountIban accountId={account.id} variant="dashboard"');
    expect(accountIbanSource).toContain("variant?:'default'|'dashboard'");
    expect(accountIbanSource).toContain('••••');
    expect(settingsSource).toContain('<AccountManagementSettings');
    expect(accountManagerSource).toContain('useAccountMetadata');
    expect(accountManagerSource).toContain('saveAccountMetadata');
    expect(accountManagerSource).toContain('metadata.records[account.id]?.iban');
  });
});