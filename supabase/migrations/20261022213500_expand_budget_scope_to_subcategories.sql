-- #588/#9: versioned, data-preserving support for subcategory budgets.
-- The original relational ledger only admitted scope overall/category, and its
-- unique key collapsed every subcategory under the same category/month.
-- This transition keeps all existing rows/IDs/payloads and owner RLS intact.
begin;

alter table private.rheomiq_budgets
  drop constraint if exists rheomiq_budgets_scope_check;
alter table private.rheomiq_budgets
  drop constraint if exists rheomiq_budget_scope_category;

alter table private.rheomiq_budgets
  add constraint rheomiq_budgets_scope_check
    check (scope in ('overall','category','subcategory'));
alter table private.rheomiq_budgets
  add constraint rheomiq_budget_scope_category
    check (
      (scope='overall' and category is null)
      or (scope='category' and nullif(btrim(category),'') is not null)
      or (scope='subcategory' and nullif(btrim(category),'') is not null
        and nullif(btrim(coalesce(payload->>'subcategory','')),'') is not null)
    );

-- Preserve unique logical owner/month/scope/category keys for older scopes
-- while treating two separately named subcategories as distinct budgets.
drop index if exists private.rheomiq_budgets_logical_key_idx;
create unique index rheomiq_budgets_logical_key_idx
  on private.rheomiq_budgets (
    owner_user_id, month_key, scope, coalesce(category,''),
    case when scope='subcategory'
      then coalesce(nullif(btrim(payload->>'subcategory'),''),'')
      else ''
    end
  );

commit;
