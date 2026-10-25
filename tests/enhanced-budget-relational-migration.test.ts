import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const migration=readFileSync('supabase/migrations/20261022213500_expand_budget_scope_to_subcategories.sql','utf8');
const realStack=readFileSync('scripts/real-stack-e2e.ts','utf8');

describe('#588 forward-only relational budget expansion',()=>{
  it('retains the legacy key and RLS while accepting a real subcategory path',()=>{
    expect(migration).toContain("scope in ('overall','category','subcategory')");
    expect(migration).toContain("scope='subcategory'");
    expect(migration).toContain("payload->>'subcategory'");
    expect(migration).toContain('drop index if exists private.rheomiq_budgets_logical_key_idx');
    expect(migration).toContain('create unique index rheomiq_budgets_logical_key_idx');
    expect(migration).toContain("owner_user_id, month_key, scope, coalesce(category,'')");
    expect(migration).toContain("case when scope='subcategory'");
    // PostgreSQL CREATE INDEX requires a CASE expression to be parenthesized.
    expect(migration).toMatch(/\(case when scope='subcategory'[\s\S]*?end\)/);
    expect(migration).toContain("else ''");
    expect(migration).not.toMatch(/delete\s+from|truncate\s+|drop\s+table|disable\s+row\s+level\s+security/i);
  });
  it('tests two different subcategories under one category/month through live revisioned finance',()=>{
    expect(realStack).toContain("stage enhanced-budget-real-db-roundtrip");
    expect(realStack).toContain("id:budgetIdPrefix+'other-subcategory'");
    expect(realStack).toContain('Same-month same-parent distinct subcategory budget was not persisted.');
    expect(realStack).toContain('enhanced-budget-invalid-identity');
    expect(realStack).toContain('enhanced-budget-real-final-undo');
  });
});
