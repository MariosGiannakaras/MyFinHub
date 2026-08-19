-- Keep the Data API surface intentionally narrow. RLS remains the row-level
-- owner + AAL2 authorization boundary; these grants only expose the CRUD
-- operations required by the authenticated card-vault API.
revoke all on table public.rheomiq_card_secrets from anon;
revoke all on table public.rheomiq_card_secrets from authenticated;

grant select, insert, update, delete on table public.rheomiq_card_secrets to authenticated;
