create index if not exists rheomiq_recurring_owner_account_idx
  on private.rheomiq_recurring(owner_user_id, account_id);

create index if not exists rheomiq_scheduled_owner_account_idx
  on private.rheomiq_scheduled(owner_user_id, account_id)
  where account_id is not null;

create index if not exists rheomiq_scheduled_owner_from_account_idx
  on private.rheomiq_scheduled(owner_user_id, from_account_id)
  where from_account_id is not null;

create index if not exists rheomiq_scheduled_owner_to_account_idx
  on private.rheomiq_scheduled(owner_user_id, to_account_id)
  where to_account_id is not null;

create index if not exists rheomiq_transactions_owner_statement_idx
  on private.rheomiq_transactions(owner_user_id, statement_id)
  where statement_id is not null;
