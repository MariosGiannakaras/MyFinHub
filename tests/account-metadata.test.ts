import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../server/http.js';
import { parseAccountMetadataExpectedRevision, parseAccountMetadataWrite } from '../server/accountMetadataHandler.js';
import { assertValidIban, formatIban, isValidIban, normalizeIban } from '../src/lib/iban.js';

const migration=readFileSync(new URL('../supabase/migrations/20260824205000_add_account_metadata.sql',import.meta.url),'utf8');
const financeTypes=readFileSync(new URL('../src/types.ts',import.meta.url),'utf8');
const financeHook=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');
const dashboardSource=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const settingsSource=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');

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
  });

  it('keeps IBAN outside FinanceData and finance Undo/Redo while exposing it on Dashboard and Settings',()=>{
    expect(financeTypes.toLowerCase()).not.toContain('iban');
    expect(financeHook.toLowerCase()).not.toContain('iban');
    expect(dashboardSource).toContain('<AccountIban accountId={account.id}/>');
    expect(settingsSource).toContain('<AccountMetadataSettings data={data}/>');
  });
});
