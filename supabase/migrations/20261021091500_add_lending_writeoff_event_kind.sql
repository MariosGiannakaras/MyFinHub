-- Issue #588 Batch B3: auditable non-cash receivable writeoffs.
-- Expand only the event kind check; preserve finance rows, RLS policies and audit history.
begin;
alter table private.rheomiq_transactions
  drop constraint if exists rheomiq_transactions_event_kind_check;
alter table private.rheomiq_transactions
  add constraint rheomiq_transactions_event_kind_check
  check (event_kind in (
    'expense','income','transfer','saving_cash_offset','withdrawal','refund',
    'lending','repayment','lending_writeoff','card_purchase','card_payment','reconciliation','split'
  ));
commit;
