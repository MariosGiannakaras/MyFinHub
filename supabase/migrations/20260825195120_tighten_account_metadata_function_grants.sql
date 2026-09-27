-- Supabase default function privileges can leave anon with EXECUTE even when the RPC
-- itself fails closed. Make the public API surface match the owner+AAL2 contract.

revoke all on function public.rheomiq_upsert_account_metadata(text, text, bigint)
from public, anon, authenticated;

grant execute on function public.rheomiq_upsert_account_metadata(text, text, bigint)
to authenticated;
