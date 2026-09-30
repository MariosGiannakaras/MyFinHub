-- Relational finance ledger cutover.
-- One authority transition: before this migration FinanceData.state ledger arrays live in app_state;
-- after this migration the private relational tables below are authoritative and public RPCs
-- compose the legacy FinanceData envelope for backward-compatible clients.

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

alter table public.rheomiq_app_state
  add column if not exists finance_storage_mode text not null default 'relational_v1'
  constraint rheomiq_app_state_finance_storage_mode_check
    check (finance_storage_mode = 'relational_v1');

create table if not exists private.rheomiq_accounts (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  sort_index integer not null check (sort_index >= 0),
  display_name text not null check (char_length(display_name) between 1 and 160),
  account_kind text not null check (char_length(account_kind) between 1 and 40),
  provider_id text,
  excluded_from_available boolean not null default false,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (owner_user_id, account_id),
  constraint rheomiq_accounts_id_format check (account_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$')
);

create table if not exists private.rheomiq_cards (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  sort_index integer not null check (sort_index >= 0),
  is_deleted boolean not null default false,
  card_kind text not null check (card_kind in ('debit','prepaid','credit')),
  bank_id text,
  active boolean,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (owner_user_id, card_id),
  constraint rheomiq_cards_id_format check (card_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$')
);

create table if not exists private.rheomiq_credit_statements (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  statement_id text not null,
  sort_index integer not null check (sort_index >= 0),
  card_id text not null,
  open_date date not null,
  close_date date not null,
  due_date date not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (owner_user_id, statement_id),
  constraint rheomiq_credit_statements_card_fk
    foreign key (owner_user_id, card_id)
    references private.rheomiq_cards(owner_user_id, card_id)
    on update cascade on delete restrict,
  constraint rheomiq_credit_statement_dates check (open_date <= close_date and close_date <= due_date)
);

create table if not exists private.rheomiq_transactions (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  sort_index integer not null check (sort_index >= 0),
  event_date date not null,
  event_kind text not null check (event_kind in (
    'expense','income','transfer','saving_cash_offset','withdrawal','refund',
    'lending','repayment','card_purchase','card_payment','reconciliation','split'
  )),
  amount numeric not null check (amount > 0),
  card_id text,
  statement_id text,
  recurring_id text,
  category text,
  subcategory text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (owner_user_id, event_id),
  constraint rheomiq_transactions_card_fk
    foreign key (owner_user_id, card_id)
    references private.rheomiq_cards(owner_user_id, card_id)
    on update cascade on delete restrict,
  constraint rheomiq_transactions_statement_fk
    foreign key (owner_user_id, statement_id)
    references private.rheomiq_credit_statements(owner_user_id, statement_id)
    on update cascade on delete restrict
);

create table if not exists private.rheomiq_transaction_legs (
  owner_user_id uuid not null,
  event_id text not null,
  leg_index integer not null check (leg_index >= 0),
  account_id text not null,
  amount numeric not null check (amount <> 0),
  primary key (owner_user_id, event_id, leg_index),
  constraint rheomiq_transaction_legs_event_fk
    foreign key (owner_user_id, event_id)
    references private.rheomiq_transactions(owner_user_id, event_id)
    on update cascade on delete cascade,
  constraint rheomiq_transaction_legs_account_fk
    foreign key (owner_user_id, account_id)
    references private.rheomiq_accounts(owner_user_id, account_id)
    on update cascade on delete restrict
);

create table if not exists private.rheomiq_budgets (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  budget_id text not null,
  sort_index integer not null check (sort_index >= 0),
  month_key text not null check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  scope text not null check (scope in ('overall','category')),
  category text,
  amount numeric not null check (amount >= 0),
  alert_threshold numeric,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (owner_user_id, budget_id),
  constraint rheomiq_budget_scope_category check (
    (scope='overall' and category is null)
    or (scope='category' and nullif(btrim(category),'') is not null)
  )
);

create unique index if not exists rheomiq_budgets_logical_key_idx
  on private.rheomiq_budgets(owner_user_id, month_key, scope, coalesce(category,''));

create table if not exists private.rheomiq_recurring (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recurring_id text not null,
  sort_index integer not null check (sort_index >= 0),
  account_id text not null,
  amount numeric not null check (amount > 0),
  category text not null,
  active boolean not null,
  status text,
  recurrence_unit text,
  recurrence_interval integer,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (owner_user_id, recurring_id),
  constraint rheomiq_recurring_account_fk
    foreign key (owner_user_id, account_id)
    references private.rheomiq_accounts(owner_user_id, account_id)
    on update cascade on delete restrict,
  constraint rheomiq_recurring_status check (status is null or status in ('active','paused','stopped')),
  constraint rheomiq_recurring_unit check (recurrence_unit is null or recurrence_unit in ('month','year')),
  constraint rheomiq_recurring_interval check (recurrence_interval is null or recurrence_interval between 1 and 1200)
);

create table if not exists private.rheomiq_scheduled (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_id text not null,
  sort_index integer not null check (sort_index >= 0),
  due_date date not null,
  scheduled_kind text not null check (scheduled_kind in ('expense','income','transfer')),
  status text not null check (status in ('pending','completed','skipped','cancelled')),
  amount numeric not null check (amount > 0),
  account_id text,
  from_account_id text,
  to_account_id text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (owner_user_id, scheduled_id),
  constraint rheomiq_scheduled_account_fk
    foreign key (owner_user_id, account_id)
    references private.rheomiq_accounts(owner_user_id, account_id)
    on update cascade on delete restrict,
  constraint rheomiq_scheduled_from_account_fk
    foreign key (owner_user_id, from_account_id)
    references private.rheomiq_accounts(owner_user_id, account_id)
    on update cascade on delete restrict,
  constraint rheomiq_scheduled_to_account_fk
    foreign key (owner_user_id, to_account_id)
    references private.rheomiq_accounts(owner_user_id, account_id)
    on update cascade on delete restrict,
  constraint rheomiq_scheduled_account_shape check (
    (scheduled_kind in ('expense','income') and account_id is not null)
    or
    (scheduled_kind='transfer' and from_account_id is not null and to_account_id is not null and from_account_id <> to_account_id)
  )
);

create index if not exists rheomiq_transactions_owner_date_idx
  on private.rheomiq_transactions(owner_user_id, event_date desc, sort_index desc);
create index if not exists rheomiq_transaction_legs_owner_account_idx
  on private.rheomiq_transaction_legs(owner_user_id, account_id, event_id);
create index if not exists rheomiq_transactions_owner_card_idx
  on private.rheomiq_transactions(owner_user_id, card_id, event_date desc)
  where card_id is not null;
create index if not exists rheomiq_credit_statements_owner_card_idx
  on private.rheomiq_credit_statements(owner_user_id, card_id, close_date desc);
create index if not exists rheomiq_recurring_owner_active_idx
  on private.rheomiq_recurring(owner_user_id, active, sort_index);
create index if not exists rheomiq_scheduled_owner_status_date_idx
  on private.rheomiq_scheduled(owner_user_id, status, due_date, sort_index);

alter table private.rheomiq_accounts enable row level security;
alter table private.rheomiq_cards enable row level security;
alter table private.rheomiq_credit_statements enable row level security;
alter table private.rheomiq_transactions enable row level security;
alter table private.rheomiq_transaction_legs enable row level security;
alter table private.rheomiq_budgets enable row level security;
alter table private.rheomiq_recurring enable row level security;
alter table private.rheomiq_scheduled enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'rheomiq_accounts','rheomiq_cards','rheomiq_credit_statements','rheomiq_transactions',
    'rheomiq_transaction_legs','rheomiq_budgets','rheomiq_recurring','rheomiq_scheduled'
  ]
  loop
    execute format('drop policy if exists %I on private.%I', v_table || '_owner_aal2_all', v_table);
    execute format(
      'create policy %I on private.%I for all to authenticated using (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2())) with check (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()))',
      v_table || '_owner_aal2_all', v_table
    );
  end loop;
end
$$;

revoke all on table
  private.rheomiq_accounts,
  private.rheomiq_cards,
  private.rheomiq_credit_statements,
  private.rheomiq_transactions,
  private.rheomiq_transaction_legs,
  private.rheomiq_budgets,
  private.rheomiq_recurring,
  private.rheomiq_scheduled
from public, anon;

grant select, insert, update, delete on table
  private.rheomiq_accounts,
  private.rheomiq_cards,
  private.rheomiq_credit_statements,
  private.rheomiq_transactions,
  private.rheomiq_transaction_legs,
  private.rheomiq_budgets,
  private.rheomiq_recurring,
  private.rheomiq_scheduled
to authenticated, service_role;

create or replace function private.rheomiq_ledger_strip_state(p_state jsonb)
returns jsonb
language sql
immutable
set search_path = private, public
as $$
  select p_state - array[
    'events','cards','deletedCards','creditStatements','budgets','recurringCustom','scheduled'
  ]::text[];
$$;

create or replace function private.rheomiq_ledger_compose_state(p_owner uuid, p_base_state jsonb)
returns jsonb
language plpgsql
stable
set search_path = private, public
as $$
declare
  v_state jsonb := coalesce(p_base_state, '{}'::jsonb);
  v_value jsonb;
begin
  select coalesce(jsonb_agg(c.payload order by c.sort_index, c.card_id), '[]'::jsonb)
    into v_value
  from private.rheomiq_cards c
  where c.owner_user_id=p_owner and not c.is_deleted;
  v_state := jsonb_set(v_state, '{cards}', v_value, true);

  select coalesce(jsonb_agg(c.payload order by c.sort_index, c.card_id), '[]'::jsonb)
    into v_value
  from private.rheomiq_cards c
  where c.owner_user_id=p_owner and c.is_deleted;
  v_state := jsonb_set(v_state, '{deletedCards}', v_value, true);

  select coalesce(jsonb_agg(s.payload order by s.sort_index, s.statement_id), '[]'::jsonb)
    into v_value
  from private.rheomiq_credit_statements s
  where s.owner_user_id=p_owner;
  v_state := jsonb_set(v_state, '{creditStatements}', v_value, true);

  select coalesce(jsonb_agg(
    t.payload || jsonb_build_object(
      'legs',
      coalesce((
        select jsonb_agg(jsonb_build_object('accountId', l.account_id, 'amount', l.amount) order by l.leg_index)
        from private.rheomiq_transaction_legs l
        where l.owner_user_id=t.owner_user_id and l.event_id=t.event_id
      ), '[]'::jsonb)
    )
    order by t.sort_index, t.event_id
  ), '[]'::jsonb)
    into v_value
  from private.rheomiq_transactions t
  where t.owner_user_id=p_owner;
  v_state := jsonb_set(v_state, '{events}', v_value, true);

  select coalesce(jsonb_agg(b.payload order by b.sort_index, b.budget_id), '[]'::jsonb)
    into v_value
  from private.rheomiq_budgets b
  where b.owner_user_id=p_owner;
  v_state := jsonb_set(v_state, '{budgets}', v_value, true);

  select coalesce(jsonb_agg(r.payload order by r.sort_index, r.recurring_id), '[]'::jsonb)
    into v_value
  from private.rheomiq_recurring r
  where r.owner_user_id=p_owner;
  v_state := jsonb_set(v_state, '{recurringCustom}', v_value, true);

  select coalesce(jsonb_agg(s.payload order by s.sort_index, s.scheduled_id), '[]'::jsonb)
    into v_value
  from private.rheomiq_scheduled s
  where s.owner_user_id=p_owner;
  v_state := jsonb_set(v_state, '{scheduled}', v_value, true);

  return v_state;
end;
$$;

create or replace function private.rheomiq_effective_data(p_owner uuid, p_data jsonb)
returns jsonb
language sql
stable
set search_path = private, public
as $$
  select jsonb_set(
    p_data,
    '{state}',
    private.rheomiq_ledger_compose_state(p_owner, coalesce(p_data->'state','{}'::jsonb)),
    true
  );
$$;

create or replace function private.rheomiq_ledger_apply_state(p_owner uuid, p_state jsonb)
returns void
language plpgsql
set search_path = private, public
as $$
declare
  v_roundtrip jsonb;
begin
  if p_owner is null or p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception using errcode='22023', message='INVALID_DATA';
  end if;

  delete from private.rheomiq_transaction_legs where owner_user_id=p_owner;
  delete from private.rheomiq_transactions where owner_user_id=p_owner;
  delete from private.rheomiq_credit_statements where owner_user_id=p_owner;
  delete from private.rheomiq_budgets where owner_user_id=p_owner;
  delete from private.rheomiq_recurring where owner_user_id=p_owner;
  delete from private.rheomiq_scheduled where owner_user_id=p_owner;
  delete from private.rheomiq_cards where owner_user_id=p_owner;
  delete from private.rheomiq_accounts where owner_user_id=p_owner;

  with account_ids as (
    select k.account_id
    from jsonb_object_keys(coalesce(p_state#>'{settings,accountNames}','{}'::jsonb)) as k(account_id)
    union
    select nullif(l.value->>'accountId','')
    from jsonb_array_elements(coalesce(p_state->'events','[]'::jsonb)) e(value)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(e.value->'legs')='array' then e.value->'legs' else '[]'::jsonb end
    ) l(value)
    union
    select nullif(r.value->>'accountId','')
    from jsonb_array_elements(coalesce(p_state->'recurringCustom','[]'::jsonb)) r(value)
    union
    select nullif(s.value->>'accountId','')
    from jsonb_array_elements(coalesce(p_state->'scheduled','[]'::jsonb)) s(value)
    union
    select nullif(s.value->>'fromAccountId','')
    from jsonb_array_elements(coalesce(p_state->'scheduled','[]'::jsonb)) s(value)
    union
    select nullif(s.value->>'toAccountId','')
    from jsonb_array_elements(coalesce(p_state->'scheduled','[]'::jsonb)) s(value)
    union
    select nullif(p_state#>>'{settings,defaultExpenseAccount}','')
    union
    select nullif(p_state#>>'{settings,defaultIncomeAccount}','')
    union
    select nullif(p_state#>>'{settings,defaultLoanAccount}','')
  ),
  clean as (
    select distinct account_id
    from account_ids
    where account_id is not null
      and account_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
  ),
  ranked as (
    select account_id, row_number() over(order by account_id)::integer - 1 as sort_index
    from clean
  ),
  detailed as (
    select
      r.account_id,
      r.sort_index,
      coalesce(
        p_state#>>array['settings','accountNames',r.account_id],
        r.account_id
      ) as display_name,
      coalesce(
        ((p_state#>'{settings,accountOverrides}')->r.account_id)->>'kind',
        case
          when r.account_id='credit-card' then 'credit'
          when r.account_id='cash' then 'cash'
          when r.account_id ilike '%saving%' then 'savings'
          else 'bank'
        end
      ) as account_kind,
      coalesce(
        ((p_state#>'{settings,accountOverrides}')->r.account_id)->>'providerId',
        ((p_state#>'{settings,accountOverrides}')->r.account_id)->>'provider'
      ) as provider_id,
      coalesce((p_state#>'{settings,accountOverrides}')->r.account_id,
        jsonb_build_object(
          'id', r.account_id,
          'name', coalesce(p_state#>>array['settings','accountNames',r.account_id], r.account_id),
          'kind', case
            when r.account_id='credit-card' then 'credit'
            when r.account_id='cash' then 'cash'
            when r.account_id ilike '%saving%' then 'savings'
            else 'bank'
          end
        )
      ) as payload
    from ranked r
  )
  insert into private.rheomiq_accounts(
    owner_user_id,account_id,sort_index,display_name,account_kind,provider_id,excluded_from_available,payload
  )
  select
    p_owner,
    d.account_id,
    d.sort_index,
    d.display_name,
    d.account_kind,
    d.provider_id,
    coalesce(p_state#>'{settings,excludedFromAvailable}','[]'::jsonb) ? d.account_id,
    d.payload
  from detailed d;

  insert into private.rheomiq_cards(
    owner_user_id,card_id,sort_index,is_deleted,card_kind,bank_id,active,payload
  )
  select
    p_owner,
    c.value->>'id',
    c.ordinality::integer-1,
    false,
    c.value->>'kind',
    nullif(c.value->>'bankId',''),
    case when c.value ? 'active' then (c.value->>'active')::boolean else true end,
    c.value
  from jsonb_array_elements(coalesce(p_state->'cards','[]'::jsonb)) with ordinality c(value,ordinality);

  insert into private.rheomiq_cards(
    owner_user_id,card_id,sort_index,is_deleted,card_kind,bank_id,active,payload
  )
  select
    p_owner,
    c.value->>'id',
    c.ordinality::integer-1,
    true,
    c.value->>'kind',
    null,
    false,
    c.value
  from jsonb_array_elements(coalesce(p_state->'deletedCards','[]'::jsonb)) with ordinality c(value,ordinality);

  insert into private.rheomiq_credit_statements(
    owner_user_id,statement_id,sort_index,card_id,open_date,close_date,due_date,payload
  )
  select
    p_owner,
    s.value->>'id',
    s.ordinality::integer-1,
    s.value->>'cardId',
    (s.value->>'openDate')::date,
    (s.value->>'closeDate')::date,
    (s.value->>'dueDate')::date,
    s.value
  from jsonb_array_elements(coalesce(p_state->'creditStatements','[]'::jsonb)) with ordinality s(value,ordinality);

  insert into private.rheomiq_transactions(
    owner_user_id,event_id,sort_index,event_date,event_kind,amount,card_id,statement_id,recurring_id,category,subcategory,payload
  )
  select
    p_owner,
    e.value->>'id',
    e.ordinality::integer-1,
    (e.value->>'date')::date,
    e.value->>'kind',
    (e.value->>'amount')::numeric,
    nullif(e.value->>'cardId',''),
    nullif(e.value->>'statementId',''),
    nullif(e.value->>'recurringId',''),
    nullif(e.value->>'category',''),
    nullif(e.value->>'subcategory',''),
    e.value - 'legs'
  from jsonb_array_elements(coalesce(p_state->'events','[]'::jsonb)) with ordinality e(value,ordinality);

  insert into private.rheomiq_transaction_legs(owner_user_id,event_id,leg_index,account_id,amount)
  select
    p_owner,
    e.value->>'id',
    l.ordinality::integer-1,
    l.value->>'accountId',
    (l.value->>'amount')::numeric
  from jsonb_array_elements(coalesce(p_state->'events','[]'::jsonb)) e(value)
  cross join lateral jsonb_array_elements(e.value->'legs') with ordinality l(value,ordinality);

  insert into private.rheomiq_budgets(
    owner_user_id,budget_id,sort_index,month_key,scope,category,amount,alert_threshold,payload
  )
  select
    p_owner,
    b.value->>'id',
    b.ordinality::integer-1,
    b.value->>'month',
    b.value->>'scope',
    nullif(b.value->>'category',''),
    (b.value->>'amount')::numeric,
    case when b.value ? 'alertThreshold' then (b.value->>'alertThreshold')::numeric else null end,
    b.value
  from jsonb_array_elements(coalesce(p_state->'budgets','[]'::jsonb)) with ordinality b(value,ordinality);

  insert into private.rheomiq_recurring(
    owner_user_id,recurring_id,sort_index,account_id,amount,category,active,status,recurrence_unit,recurrence_interval,payload
  )
  select
    p_owner,
    r.value->>'id',
    r.ordinality::integer-1,
    r.value->>'accountId',
    (r.value->>'amount')::numeric,
    r.value->>'category',
    (r.value->>'active')::boolean,
    nullif(r.value->>'status',''),
    nullif(r.value->>'recurrenceUnit',''),
    case when r.value ? 'recurrenceInterval' then (r.value->>'recurrenceInterval')::integer else null end,
    r.value
  from jsonb_array_elements(coalesce(p_state->'recurringCustom','[]'::jsonb)) with ordinality r(value,ordinality);

  insert into private.rheomiq_scheduled(
    owner_user_id,scheduled_id,sort_index,due_date,scheduled_kind,status,amount,account_id,from_account_id,to_account_id,payload
  )
  select
    p_owner,
    s.value->>'id',
    s.ordinality::integer-1,
    (s.value->>'dueDate')::date,
    s.value->>'kind',
    s.value->>'status',
    (s.value->>'amount')::numeric,
    nullif(s.value->>'accountId',''),
    nullif(s.value->>'fromAccountId',''),
    nullif(s.value->>'toAccountId',''),
    s.value
  from jsonb_array_elements(coalesce(p_state->'scheduled','[]'::jsonb)) with ordinality s(value,ordinality);

  v_roundtrip := private.rheomiq_ledger_compose_state(
    p_owner,
    private.rheomiq_ledger_strip_state(p_state)
  );

  if coalesce(v_roundtrip->'events','[]'::jsonb) is distinct from coalesce(p_state->'events','[]'::jsonb)
     or coalesce(v_roundtrip->'cards','[]'::jsonb) is distinct from coalesce(p_state->'cards','[]'::jsonb)
     or coalesce(v_roundtrip->'deletedCards','[]'::jsonb) is distinct from coalesce(p_state->'deletedCards','[]'::jsonb)
     or coalesce(v_roundtrip->'creditStatements','[]'::jsonb) is distinct from coalesce(p_state->'creditStatements','[]'::jsonb)
     or coalesce(v_roundtrip->'budgets','[]'::jsonb) is distinct from coalesce(p_state->'budgets','[]'::jsonb)
     or coalesce(v_roundtrip->'recurringCustom','[]'::jsonb) is distinct from coalesce(p_state->'recurringCustom','[]'::jsonb)
     or coalesce(v_roundtrip->'scheduled','[]'::jsonb) is distinct from coalesce(p_state->'scheduled','[]'::jsonb) then
    raise exception using errcode='22023', message='LEDGER_ROUNDTRIP_MISMATCH';
  end if;
end;
$$;

revoke all on function private.rheomiq_ledger_strip_state(jsonb) from public, anon;
revoke all on function private.rheomiq_ledger_compose_state(uuid,jsonb) from public, anon;
revoke all on function private.rheomiq_effective_data(uuid,jsonb) from public, anon;
revoke all on function private.rheomiq_ledger_apply_state(uuid,jsonb) from public, anon;
grant execute on function private.rheomiq_ledger_strip_state(jsonb) to authenticated, service_role;
grant execute on function private.rheomiq_ledger_compose_state(uuid,jsonb) to authenticated, service_role;
grant execute on function private.rheomiq_effective_data(uuid,jsonb) to authenticated, service_role;
grant execute on function private.rheomiq_ledger_apply_state(uuid,jsonb) to authenticated, service_role;

-- Atomic authority cutover for an existing singleton state. Semantic finance revision is unchanged.
do $$
declare
  v_owner uuid;
  v_state public.rheomiq_app_state%rowtype;
begin
  select user_id into v_owner from public.rheomiq_owner where singleton=true;
  select * into v_state from public.rheomiq_app_state where id='primary' for update;

  if v_owner is not null and v_state.id is not null then
    insert into public.rheomiq_backups(data,schema_version,revision,reason)
    values(v_state.data,v_state.schema_version,v_state.revision,'manual');

    perform private.rheomiq_ledger_apply_state(v_owner, v_state.data->'state');

    update public.rheomiq_app_state
    set data=jsonb_set(
          v_state.data,
          '{state}',
          private.rheomiq_ledger_strip_state(v_state.data->'state'),
          true
        ),
        finance_storage_mode='relational_v1',
        updated_at=now()
    where id='primary';

    perform public.rheomiq_prune_backups();
  end if;
end
$$;

create or replace function public.rheomiq_read_state()
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_owner uuid;
begin
  v_owner := public.rheomiq_history_assert_access();
  return query
  select private.rheomiq_effective_data(v_owner,s.data),s.revision,s.updated_at
  from public.rheomiq_app_state s
  where s.id='primary';
end;
$$;

create or replace function public.rheomiq_history_ensure_cursor()
returns void
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_owner uuid;
  v_state public.rheomiq_app_state%rowtype;
  v_point_id bigint;
  v_full_state jsonb;
begin
  v_owner := public.rheomiq_history_assert_access();
  select * into v_state from public.rheomiq_app_state where id='primary' for update;
  if not found then raise exception using errcode='P0002',message='NO_STATE'; end if;
  if exists(select 1 from public.rheomiq_history_cursor where owner_user_id=v_owner) then return; end if;

  v_full_state := private.rheomiq_ledger_compose_state(v_owner,v_state.data->'state');
  insert into public.rheomiq_history_points(owner_user_id,parent_point_id,state,label,is_baseline,finance_revision)
  values(v_owner,null,v_full_state,'Αρχική κατάσταση ιστορικού',true,v_state.revision)
  returning id into v_point_id;

  insert into public.rheomiq_history_cursor(owner_user_id,current_point_id,generation,finance_revision)
  values(v_owner,v_point_id,0,v_state.revision);
end;
$$;

create or replace function public.rheomiq_create_backup(p_reason text default 'manual')
returns table(id bigint, created_at timestamptz)
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_owner uuid;
  v_id bigint;
  v_created_at timestamptz;
begin
  v_owner := public.rheomiq_history_assert_access();

  insert into public.rheomiq_backups(data,schema_version,revision,reason)
  select
    private.rheomiq_effective_data(v_owner,s.data),
    s.schema_version,
    s.revision,
    case when p_reason in ('manual','pre-import','automatic') then p_reason else 'manual' end
  from public.rheomiq_app_state s
  where s.id='primary'
  returning rheomiq_backups.id,rheomiq_backups.created_at into v_id,v_created_at;

  if v_id is null then raise exception using errcode='P0002',message='NO_STATE'; end if;

  insert into public.rheomiq_audit_log(actor_user_id,action,revision)
  select auth.uid(),'backup',s.revision from public.rheomiq_app_state s where s.id='primary';

  perform public.rheomiq_prune_backups();
  return query select v_id,v_created_at;
end;
$$;

create or replace function public.rheomiq_save_mutable_state_history(
  p_state jsonb,
  p_expected_revision bigint,
  p_expected_history_generation bigint,
  p_updated_at text,
  p_history_label text
)
returns table(revision bigint, updated_at timestamptz, history jsonb)
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_owner uuid;
  v_current public.rheomiq_app_state%rowtype;
  v_cursor public.rheomiq_history_cursor%rowtype;
  v_result_revision bigint;
  v_next_data jsonb;
  v_new_point bigint;
  v_parent_point bigint;
  v_current_expired boolean;
  v_label text;
  v_current_full_state jsonb;
begin
  v_owner := public.rheomiq_history_assert_access();
  if p_state is null or jsonb_typeof(p_state)<>'object' then raise exception using errcode='22023',message='INVALID_DATA'; end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception using errcode='22023',message='EXPECTED_REVISION_REQUIRED'; end if;
  if p_expected_history_generation is null or p_expected_history_generation<0 then raise exception using errcode='22023',message='EXPECTED_HISTORY_GENERATION_REQUIRED'; end if;
  if p_updated_at is null or length(p_updated_at)<1 or length(p_updated_at)>64 then raise exception using errcode='22023',message='INVALID_DATA'; end if;
  v_label := coalesce(nullif(btrim(p_history_label),''),'Οικονομική αλλαγή');
  if char_length(v_label)>180 then raise exception using errcode='22023',message='INVALID_HISTORY_LABEL'; end if;

  select * into v_current from public.rheomiq_app_state where id='primary' for update;
  if not found then raise exception using errcode='P0002',message='NO_STATE'; end if;
  if p_expected_revision<>v_current.revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;

  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id=v_owner for update;
  if p_expected_history_generation<>v_cursor.generation or v_cursor.finance_revision<>v_current.revision then
    raise exception using errcode='40001',message='HISTORY_CURSOR_CONFLICT';
  end if;

  with recursive descendants as (
    select p.id from public.rheomiq_history_points p
    where p.owner_user_id=v_owner and p.parent_point_id=v_cursor.current_point_id
    union all
    select p.id from public.rheomiq_history_points p
    join descendants d on p.parent_point_id=d.id
    where p.owner_user_id=v_owner
  )
  delete from public.rheomiq_history_points p
  using descendants d
  where p.owner_user_id=v_owner and p.id=d.id;

  v_current_full_state := private.rheomiq_ledger_compose_state(v_owner,v_current.data->'state');

  select expires_at<=now() into v_current_expired
  from public.rheomiq_history_points
  where owner_user_id=v_owner and id=v_cursor.current_point_id;

  v_parent_point := v_cursor.current_point_id;
  if coalesce(v_current_expired,false) then
    insert into public.rheomiq_history_points(owner_user_id,parent_point_id,state,label,is_baseline,finance_revision)
    values(v_owner,null,v_current_full_state,'Αρχική κατάσταση ιστορικού',true,v_current.revision)
    returning id into v_parent_point;
  end if;

  if not exists(
    select 1 from public.rheomiq_backups
    where reason='automatic' and created_at>=now()-interval '6 hours'
  ) then
    insert into public.rheomiq_backups(data,schema_version,revision,reason)
    values(
      private.rheomiq_effective_data(v_owner,v_current.data),
      v_current.schema_version,
      v_current.revision,
      'automatic'
    );
  end if;

  perform private.rheomiq_ledger_apply_state(v_owner,p_state);

  v_result_revision := v_current.revision+1;
  v_next_data := jsonb_set(v_current.data,'{state}',private.rheomiq_ledger_strip_state(p_state),true);
  v_next_data := jsonb_set(v_next_data,'{updatedAt}',to_jsonb(p_updated_at),true);

  insert into public.rheomiq_history_points(owner_user_id,parent_point_id,state,label,finance_revision)
  values(v_owner,v_parent_point,p_state,v_label,v_result_revision)
  returning id into v_new_point;

  update public.rheomiq_app_state
  set data=v_next_data,finance_storage_mode='relational_v1',revision=v_result_revision,updated_at=now()
  where id='primary';

  update public.rheomiq_history_cursor
  set current_point_id=v_new_point,generation=generation+1,finance_revision=v_result_revision,updated_at=now()
  where owner_user_id=v_owner;

  insert into public.rheomiq_audit_log(actor_user_id,action,revision)
  values(auth.uid(),'save',v_result_revision);

  perform public.rheomiq_prune_backups();
  perform public.rheomiq_prune_history(v_owner);

  return query
  select s.revision,s.updated_at,public.rheomiq_history_payload(v_owner)
  from public.rheomiq_app_state s where s.id='primary';
end;
$$;

create or replace function public.rheomiq_move_history(
  p_direction text,
  p_expected_revision bigint,
  p_expected_history_generation bigint,
  p_updated_at text
)
returns table(data jsonb, revision bigint, updated_at timestamptz, history jsonb)
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_owner uuid;
  v_current public.rheomiq_app_state%rowtype;
  v_cursor public.rheomiq_history_cursor%rowtype;
  v_target public.rheomiq_history_points%rowtype;
  v_result_revision bigint;
  v_next_data jsonb;
begin
  v_owner := public.rheomiq_history_assert_access();
  if p_direction not in ('undo','redo') then raise exception using errcode='22023',message='INVALID_HISTORY_DIRECTION'; end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception using errcode='22023',message='EXPECTED_REVISION_REQUIRED'; end if;
  if p_expected_history_generation is null or p_expected_history_generation<0 then raise exception using errcode='22023',message='EXPECTED_HISTORY_GENERATION_REQUIRED'; end if;
  if p_updated_at is null or length(p_updated_at)<1 or length(p_updated_at)>64 then raise exception using errcode='22023',message='INVALID_DATA'; end if;

  select * into v_current from public.rheomiq_app_state where id='primary' for update;
  if not found then raise exception using errcode='P0002',message='NO_STATE'; end if;
  if p_expected_revision<>v_current.revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;

  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id=v_owner for update;
  if p_expected_history_generation<>v_cursor.generation or v_cursor.finance_revision<>v_current.revision then
    raise exception using errcode='40001',message='HISTORY_CURSOR_CONFLICT';
  end if;

  perform public.rheomiq_prune_history(v_owner);

  if p_direction='undo' then
    select target.* into v_target
    from public.rheomiq_history_points current_point
    join public.rheomiq_history_points target
      on target.owner_user_id=current_point.owner_user_id and target.id=current_point.parent_point_id
    where current_point.owner_user_id=v_owner
      and current_point.id=v_cursor.current_point_id
      and target.expires_at>now();
  else
    select * into v_target
    from public.rheomiq_history_points
    where owner_user_id=v_owner
      and parent_point_id=v_cursor.current_point_id
      and expires_at>now()
    order by id asc
    limit 1;
  end if;

  if v_target.id is null then raise exception using errcode='22023',message='HISTORY_UNAVAILABLE'; end if;

  perform private.rheomiq_ledger_apply_state(v_owner,v_target.state);

  v_result_revision := v_current.revision+1;
  v_next_data := jsonb_set(v_current.data,'{state}',private.rheomiq_ledger_strip_state(v_target.state),true);
  v_next_data := jsonb_set(v_next_data,'{updatedAt}',to_jsonb(p_updated_at),true);

  update public.rheomiq_app_state
  set data=v_next_data,finance_storage_mode='relational_v1',revision=v_result_revision,updated_at=now()
  where id='primary';

  update public.rheomiq_history_cursor
  set current_point_id=v_target.id,generation=generation+1,finance_revision=v_result_revision,updated_at=now()
  where owner_user_id=v_owner;

  insert into public.rheomiq_audit_log(actor_user_id,action,revision)
  values(auth.uid(),p_direction,v_result_revision);

  perform public.rheomiq_prune_history(v_owner);

  return query
  select private.rheomiq_effective_data(v_owner,s.data),s.revision,s.updated_at,public.rheomiq_history_payload(v_owner)
  from public.rheomiq_app_state s where s.id='primary';
end;
$$;

create or replace function public.rheomiq_import_state(p_data jsonb)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_owner uuid;
  v_current public.rheomiq_app_state%rowtype;
  v_cursor public.rheomiq_history_cursor%rowtype;
  v_schema_version integer;
  v_next_revision bigint;
  v_parent_point bigint;
  v_bridge_point bigint;
  v_import_point bigint;
  v_current_expired boolean;
  v_current_full_state jsonb;
  v_next_data jsonb;
begin
  v_owner := public.rheomiq_history_assert_access();
  if p_data is null or jsonb_typeof(p_data)<>'object' or jsonb_typeof(p_data->'state')<>'object' then
    raise exception using errcode='22023',message='INVALID_DATA';
  end if;
  v_schema_version := coalesce(nullif(p_data->>'schemaVersion','')::integer,3);
  if v_schema_version<1 or v_schema_version>100 then raise exception using errcode='22023',message='INVALID_SCHEMA_VERSION'; end if;

  select * into v_current from public.rheomiq_app_state where id='primary' for update;

  if not found then
    perform private.rheomiq_ledger_apply_state(v_owner,p_data->'state');
    v_next_data := jsonb_set(p_data,'{state}',private.rheomiq_ledger_strip_state(p_data->'state'),true);

    insert into public.rheomiq_app_state(id,data,schema_version,revision,updated_at,finance_storage_mode)
    values('primary',v_next_data,v_schema_version,1,now(),'relational_v1');

    perform public.rheomiq_history_ensure_cursor();

    insert into public.rheomiq_audit_log(actor_user_id,action,revision)
    values(auth.uid(),'import',1);

    return query
    select private.rheomiq_effective_data(v_owner,s.data),s.revision,s.updated_at
    from public.rheomiq_app_state s where s.id='primary';
    return;
  end if;

  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id=v_owner for update;
  v_current_full_state := private.rheomiq_ledger_compose_state(v_owner,v_current.data->'state');

  with recursive descendants as (
    select p.id from public.rheomiq_history_points p
    where p.owner_user_id=v_owner and p.parent_point_id=v_cursor.current_point_id
    union all
    select p.id from public.rheomiq_history_points p
    join descendants d on p.parent_point_id=d.id
    where p.owner_user_id=v_owner
  )
  delete from public.rheomiq_history_points p
  using descendants d
  where p.owner_user_id=v_owner and p.id=d.id;

  select expires_at<=now() into v_current_expired
  from public.rheomiq_history_points
  where owner_user_id=v_owner and id=v_cursor.current_point_id;

  v_parent_point := v_cursor.current_point_id;
  if coalesce(v_current_expired,false) or v_cursor.finance_revision<>v_current.revision then
    insert into public.rheomiq_history_points(owner_user_id,parent_point_id,state,label,is_baseline,finance_revision)
    values(
      v_owner,
      case when coalesce(v_current_expired,false) then null else v_cursor.current_point_id end,
      v_current_full_state,
      'Προ-εισαγωγής κατάσταση',
      coalesce(v_current_expired,false),
      v_current.revision
    )
    returning id into v_bridge_point;
    v_parent_point := v_bridge_point;
  end if;

  insert into public.rheomiq_backups(data,schema_version,revision,reason)
  values(private.rheomiq_effective_data(v_owner,v_current.data),v_current.schema_version,v_current.revision,'pre-import');

  perform private.rheomiq_ledger_apply_state(v_owner,p_data->'state');

  v_next_revision := v_current.revision+1;
  v_next_data := jsonb_set(p_data,'{state}',private.rheomiq_ledger_strip_state(p_data->'state'),true);

  update public.rheomiq_app_state
  set data=v_next_data,schema_version=v_schema_version,revision=v_next_revision,updated_at=now(),finance_storage_mode='relational_v1'
  where id='primary';

  insert into public.rheomiq_history_points(owner_user_id,parent_point_id,state,label,is_baseline,finance_revision)
  values(v_owner,v_parent_point,p_data->'state','Εισαγωγή δεδομένων',false,v_next_revision)
  returning id into v_import_point;

  update public.rheomiq_history_cursor
  set current_point_id=v_import_point,generation=generation+1,finance_revision=v_next_revision,updated_at=now()
  where owner_user_id=v_owner;

  insert into public.rheomiq_audit_log(actor_user_id,action,revision)
  values(auth.uid(),'import',v_next_revision);

  perform public.rheomiq_prune_backups();
  perform public.rheomiq_prune_history(v_owner);

  return query
  select private.rheomiq_effective_data(v_owner,s.data),s.revision,s.updated_at
  from public.rheomiq_app_state s where s.id='primary';
end;
$$;

create or replace function public.rheomiq_save_state(p_data jsonb,p_expected_revision bigint)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_owner uuid;
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
  v_generation bigint;
  v_updated_at text;
  v_next_data jsonb;
begin
  v_owner := public.rheomiq_history_assert_access();
  if p_data is null or jsonb_typeof(p_data)<>'object' or jsonb_typeof(p_data->'state')<>'object' then
    raise exception using errcode='22023',message='INVALID_DATA';
  end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception using errcode='22023',message='EXPECTED_REVISION_REQUIRED'; end if;

  v_schema_version := coalesce(nullif(p_data->>'schemaVersion','')::integer,3);
  if v_schema_version<1 or v_schema_version>100 then raise exception using errcode='22023',message='INVALID_SCHEMA_VERSION'; end if;
  v_updated_at := coalesce(nullif(p_data->>'updatedAt',''),now()::text);
  if length(v_updated_at)>64 then raise exception using errcode='22023',message='INVALID_DATA'; end if;

  select * into v_current from public.rheomiq_app_state where id='primary' for update;

  if not found then
    if p_expected_revision<>0 then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;
    perform private.rheomiq_ledger_apply_state(v_owner,p_data->'state');
    v_next_data := jsonb_set(p_data,'{state}',private.rheomiq_ledger_strip_state(p_data->'state'),true);

    insert into public.rheomiq_app_state(id,data,schema_version,revision,updated_at,finance_storage_mode)
    values('primary',v_next_data,v_schema_version,1,now(),'relational_v1');

    perform public.rheomiq_history_ensure_cursor();

    insert into public.rheomiq_audit_log(actor_user_id,action,revision)
    values(auth.uid(),'save',1);

    return query
    select private.rheomiq_effective_data(v_owner,s.data),s.revision,s.updated_at
    from public.rheomiq_app_state s where s.id='primary';
    return;
  end if;

  if p_expected_revision<>v_current.revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;

  if v_schema_version<>v_current.schema_version
     or (p_data-array['state','updatedAt']) is distinct from (v_current.data-array['state','updatedAt']) then
    raise exception using errcode='22023',message='FULL_STATE_SAVE_REQUIRES_IMPORT';
  end if;

  perform public.rheomiq_history_ensure_cursor();
  select generation into v_generation
  from public.rheomiq_history_cursor
  where owner_user_id=v_owner
  for update;

  perform 1
  from public.rheomiq_save_mutable_state_history(
    p_data->'state',
    p_expected_revision,
    v_generation,
    v_updated_at,
    'Οικονομική αλλαγή'
  );

  return query
  select private.rheomiq_effective_data(v_owner,s.data),s.revision,s.updated_at
  from public.rheomiq_app_state s where s.id='primary';
end;
$$;

create or replace function public.rheomiq_database_health()
returns jsonb
language plpgsql
security invoker
set search_path = public, auth, storage, private
as $$
declare
  v_owner uuid;
  v_state jsonb;
  v_raw_state jsonb;
  v_revision bigint;
  v_cursor_revision bigint;
  v_current_point bigint;
  v_current_point_state jsonb;
  v_checks jsonb;
  v_warnings jsonb;
  v_ok boolean;
  v_ready boolean;
begin
  v_owner := public.rheomiq_history_assert_access();

  select private.rheomiq_ledger_compose_state(v_owner,data->'state'),data->'state',revision
  into v_state,v_raw_state,v_revision
  from public.rheomiq_app_state
  where id='primary';

  select finance_revision,current_point_id
  into v_cursor_revision,v_current_point
  from public.rheomiq_history_cursor
  where owner_user_id=v_owner;

  select state into v_current_point_state
  from public.rheomiq_history_points
  where owner_user_id=v_owner and id=v_current_point;

  with
  events as (select value j from jsonb_array_elements(coalesce(v_state->'events','[]'::jsonb))),
  cards as (select value j from jsonb_array_elements(coalesce(v_state->'cards','[]'::jsonb))),
  deleted_cards as (select value j from jsonb_array_elements(coalesce(v_state->'deletedCards','[]'::jsonb))),
  statements as (select value j from jsonb_array_elements(coalesce(v_state->'creditStatements','[]'::jsonb))),
  legs as (
    select e.j,l.value leg
    from events e
    cross join lateral jsonb_array_elements(case when jsonb_typeof(e.j->'legs')='array' then e.j->'legs' else '[]'::jsonb end) l(value)
  ),
  account_names as (
    select key account_id from jsonb_object_keys(coalesce(v_state#>'{settings,accountNames}','{}'::jsonb)) key
  )
  select jsonb_build_object(
    'app_state_rows',(select count(*) from public.rheomiq_app_state where id='primary'),
    'owner_rows',(select count(*) from public.rheomiq_owner where singleton=true),
    'history_cursor_rows',(select count(*) from public.rheomiq_history_cursor where owner_user_id=v_owner),
    'history_revision_mismatches',case when v_revision is distinct from v_cursor_revision then 1 else 0 end,
    'history_current_point_missing',case when v_current_point is null or v_current_point_state is null then 1 else 0 end,
    'history_current_point_state_mismatches',case when v_state is distinct from v_current_point_state then 1 else 0 end,
    'raw_state_ledger_keys',(
      select count(*) from unnest(array['events','cards','deletedCards','creditStatements','budgets','recurringCustom','scheduled']) k
      where v_raw_state ? k
    ),
    'duplicate_event_ids',(select count(*) from (select j->>'id' id from events group by 1 having count(*)>1) q),
    'duplicate_card_ids',(select count(*) from (select j->>'id' id from cards group by 1 having count(*)>1) q),
    'duplicate_statement_ids',(select count(*) from (select j->>'id' id from statements group by 1 having count(*)>1) q),
    'events_missing_id',(select count(*) from events where coalesce(j->>'id','')=''),
    'events_missing_date',(select count(*) from events where coalesce(j->>'date','')=''),
    'events_nonpositive_amount',(select count(*) from events where jsonb_typeof(j->'amount')<>'number' or (j->>'amount')::numeric<=0),
    'events_without_legs',(select count(*) from events where jsonb_typeof(j->'legs')<>'array' or jsonb_array_length(case when jsonb_typeof(j->'legs')='array' then j->'legs' else '[]'::jsonb end)=0),
    'unbalanced_internal_events',(
      select count(*)
      from events e
      where e.j->>'kind' in ('transfer','withdrawal','saving_cash_offset','card_payment')
        and (
          jsonb_typeof(e.j->'legs')<>'array'
          or jsonb_array_length(case when jsonb_typeof(e.j->'legs')='array' then e.j->'legs' else '[]'::jsonb end)<>2
          or abs(coalesce((
            select sum((l.value->>'amount')::numeric)
            from jsonb_array_elements(case when jsonb_typeof(e.j->'legs')='array' then e.j->'legs' else '[]'::jsonb end) l(value)
            where jsonb_typeof(l.value->'amount')='number'
          ),0))>0.0001
        )
    ),
    'unknown_leg_accounts',(
      select count(*) from legs
      where coalesce(leg->>'accountId','')=''
        or not exists(
          select 1 from private.rheomiq_accounts a
          where a.owner_user_id=v_owner and a.account_id=leg->>'accountId'
        )
    ),
    'orphan_card_event_refs',(
      select count(*) from events e
      where e.j->>'kind' in ('card_purchase','card_payment')
        and coalesce(e.j->>'cardId','')<>''
        and not exists(select 1 from cards c where c.j->>'id'=e.j->>'cardId')
        and not exists(select 1 from deleted_cards d where d.j->>'id'=e.j->>'cardId')
    ),
    'orphan_statement_event_refs',(
      select count(*) from events e
      where coalesce(e.j->>'statementId','')<>''
        and not exists(select 1 from statements s where s.j->>'id'=e.j->>'statementId')
    ),
    'stale_account_metadata',(
      select count(*) from public.rheomiq_account_metadata m
      where m.owner_user_id=v_owner
        and not exists(select 1 from private.rheomiq_accounts a where a.owner_user_id=v_owner and a.account_id=m.account_id)
    ),
    'provider_invalid_active_refs',(
      select count(*)
      from public.rheomiq_financial_providers p
      left join public.rheomiq_financial_provider_assets la on la.asset_key=p.logo_asset_key
      left join public.rheomiq_financial_provider_assets wa on wa.asset_key=p.wordmark_asset_key
      where p.active and (
        (p.logo_asset_key is not null and coalesce(la.active,false)=false)
        or (p.wordmark_asset_key is not null and coalesce(wa.active,false)=false)
      )
    ),
    'active_assets_missing_storage_object',(
      select count(*)
      from public.rheomiq_financial_provider_assets a
      left join storage.objects o on o.bucket_id=a.storage_bucket and o.name=a.storage_path
      where a.active and o.id is null
    )
  ) into v_checks;

  v_warnings := jsonb_build_object(
    'providers_missing_logo',(select count(*) from public.rheomiq_financial_providers where active and logo_asset_key is null),
    'providers_missing_wordmark',(select count(*) from public.rheomiq_financial_providers where active and wordmark_asset_key is null),
    'inactive_legacy_asset_rows',(select count(*) from public.rheomiq_financial_provider_assets where not active)
  );

  v_ok :=
    coalesce((v_checks->>'app_state_rows')::int,0)=1
    and coalesce((v_checks->>'owner_rows')::int,0)=1
    and coalesce((v_checks->>'history_cursor_rows')::int,0)=1
    and coalesce((v_checks->>'history_revision_mismatches')::int,0)=0
    and coalesce((v_checks->>'history_current_point_missing')::int,0)=0
    and coalesce((v_checks->>'history_current_point_state_mismatches')::int,0)=0
    and coalesce((v_checks->>'raw_state_ledger_keys')::int,0)=0
    and coalesce((v_checks->>'duplicate_event_ids')::int,0)=0
    and coalesce((v_checks->>'duplicate_card_ids')::int,0)=0
    and coalesce((v_checks->>'duplicate_statement_ids')::int,0)=0
    and coalesce((v_checks->>'events_missing_id')::int,0)=0
    and coalesce((v_checks->>'events_missing_date')::int,0)=0
    and coalesce((v_checks->>'events_nonpositive_amount')::int,0)=0
    and coalesce((v_checks->>'events_without_legs')::int,0)=0
    and coalesce((v_checks->>'unbalanced_internal_events')::int,0)=0
    and coalesce((v_checks->>'unknown_leg_accounts')::int,0)=0
    and coalesce((v_checks->>'orphan_card_event_refs')::int,0)=0
    and coalesce((v_checks->>'orphan_statement_event_refs')::int,0)=0
    and coalesce((v_checks->>'stale_account_metadata')::int,0)=0
    and coalesce((v_checks->>'provider_invalid_active_refs')::int,0)=0
    and coalesce((v_checks->>'active_assets_missing_storage_object')::int,0)=0;

  v_ready := v_ok
    and coalesce((v_warnings->>'providers_missing_logo')::int,0)=0
    and coalesce((v_warnings->>'providers_missing_wordmark')::int,0)=0;

  return jsonb_build_object(
    'ok',v_ok,
    'productionReady',v_ready,
    'storageMode','relational_v1',
    'revision',v_revision,
    'checks',v_checks,
    'warnings',v_warnings,
    'checkedAt',now()
  );
end;
$$;

revoke all on function public.rheomiq_read_state() from public, anon;
revoke all on function public.rheomiq_history_ensure_cursor() from public, anon;
revoke all on function public.rheomiq_create_backup(text) from public, anon;
revoke all on function public.rheomiq_save_mutable_state_history(jsonb,bigint,bigint,text,text) from public, anon;
revoke all on function public.rheomiq_move_history(text,bigint,bigint,text) from public, anon;
revoke all on function public.rheomiq_import_state(jsonb) from public, anon;
revoke all on function public.rheomiq_save_state(jsonb,bigint) from public, anon;
revoke all on function public.rheomiq_database_health() from public, anon, authenticated;

grant execute on function public.rheomiq_read_state() to authenticated, service_role;
grant execute on function public.rheomiq_history_ensure_cursor() to authenticated, service_role;
grant execute on function public.rheomiq_create_backup(text) to authenticated, service_role;
grant execute on function public.rheomiq_save_mutable_state_history(jsonb,bigint,bigint,text,text) to authenticated, service_role;
grant execute on function public.rheomiq_move_history(text,bigint,bigint,text) to authenticated, service_role;
grant execute on function public.rheomiq_import_state(jsonb) to authenticated, service_role;
grant execute on function public.rheomiq_save_state(jsonb,bigint) to authenticated, service_role;
grant execute on function public.rheomiq_database_health() to authenticated, service_role;

comment on column public.rheomiq_app_state.finance_storage_mode is
  'relational_v1 means live ledger arrays are authoritative in private relational tables; app_state stores only non-ledger mutable state.';
comment on table private.rheomiq_transactions is
  'Canonical owner finance-event headers. Ordered legs are stored separately in private.rheomiq_transaction_legs.';
comment on table private.rheomiq_transaction_legs is
  'Canonical ordered account effects for finance events.';
