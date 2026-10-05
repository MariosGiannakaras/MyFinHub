import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const source=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

describe('full state write history atomicity',()=>{
  const migration=source('supabase/migrations/20260930105145_make_state_writes_history_atomic.sql');

  it('routes legacy ordinary saves through the durable history mutation path',()=>{
    const save=migration.slice(migration.indexOf('create or replace function public.rheomiq_save_state'),migration.indexOf('create or replace function public.rheomiq_import_state'));
    expect(save).toContain('rheomiq_save_mutable_state_history');
    expect(save).toContain('FULL_STATE_SAVE_REQUIRES_IMPORT');
    expect(save).toContain("p_data - array['state','updatedAt']");
    expect(save).not.toContain("values (auth.uid(), 'save', v_result_revision)");
  });

  it('makes imports backup, history, cursor and audit changes in one database function',()=>{
    const imp=migration.slice(migration.indexOf('create or replace function public.rheomiq_import_state'));
    expect(imp).toContain("'pre-import'");
    expect(imp).toContain("'Προ-εισαγωγής κατάσταση'");
    expect(imp).toContain("'Εισαγωγή δεδομένων'");
    expect(imp).toContain('current_point_id=v_import_point');
    expect(imp).toContain('finance_revision=v_next_revision');
    expect(imp).toContain("values(auth.uid(),'import',v_next_revision)");
    expect(imp).toContain('rheomiq_prune_history(v_owner)');
  });

  it('keeps invoker security and existing owner/AAL2 authorization',()=>{
    expect(migration.match(/security invoker/g)?.length).toBe(2);
    expect(migration).toContain('rheomiq_history_assert_access()');
    expect(migration).not.toContain('security definer');
  });
});
