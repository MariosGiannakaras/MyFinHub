-- Disposable-only direct SQL proof of real PL/pgSQL functions extracted
-- verbatim from the pending forward migration. No hosted DB, no sample owner data.
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION qa.expect_chronology(
  p_label text,p_seed jsonb,p_previous jsonb,p_proposed jsonb,p_reject boolean
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
declare v_rejected boolean:=false;
begin
  begin
    perform private.rheomiq_guard_mutable_receivable_chronology(p_seed,p_previous,p_proposed);
  exception when SQLSTATE '22023' then
    v_rejected:=true;
  end;
  if v_rejected is distinct from p_reject then
    raise exception 'Chronology proof failed: % (rejected %, expected %)',p_label,v_rejected,p_reject;
  end if;
end;
$$;
GRANT EXECUTE ON FUNCTION qa.expect_chronology(text,jsonb,jsonb,jsonb,boolean) TO authenticated;
DO $$ BEGIN
  IF has_function_privilege('anon','private.rheomiq_guard_mutable_receivable_chronology(jsonb,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous database guard privilege leaked';
  END IF;
  IF NOT has_function_privilege('authenticated','private.rheomiq_guard_mutable_receivable_chronology(jsonb,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated invoker lost guard privilege';
  END IF;
END $$;

SET ROLE authenticated;
DO $$
declare
  v_seed jsonb:='{"lending":[{"person":"Alex","outstanding":100,"entries":[]}]}';
  v_prior jsonb;
  v_next jsonb;
  v_legacy jsonb;
begin
  -- Ordinary payoff and backdated cent overpayment.
  v_prior:='{"events":[{"id":"last","kind":"repayment","person":"Alex","date":"2026-08-29","amount":100,"receivableDelta":-100}]}';
  v_next:=jsonb_set(v_prior,'{events}',v_prior->'events'||
    '[{"id":"earlier","kind":"repayment","person":"Alex","date":"2026-08-16","amount":0.01,"receivableDelta":-0.01}]'::jsonb);
  perform qa.expect_chronology('cent beyond payoff',v_seed,v_prior,v_next,true);
  -- No added negative: legacy older deficit remains readable/unchanged.
  v_prior:='{"events":[{"id":"old","kind":"repayment","person":"Alex","date":"2026-08-20","amount":120,"receivableDelta":-120}]}';
  perform qa.expect_chronology('unchanged historic anomaly',v_seed,v_prior,v_prior,false);
  v_next:=jsonb_set(v_prior,'{events}',v_prior->'events'||
    '[{"id":"worsen","kind":"repayment","person":"Alex","date":"2026-08-19","amount":1,"receivableDelta":-1}]'::jsonb);
  perform qa.expect_chronology('worsening old deficit',v_seed,v_prior,v_next,true);
  -- Future lending must not conceal an intermediate negative.
  v_prior:='{"events":[
    {"id":"paid","kind":"repayment","person":"Alex","date":"2026-08-20","amount":80,"receivableDelta":-80},
    {"id":"later","kind":"lending","person":"Alex","date":"2026-08-30","amount":100,"receivableDelta":100}
  ]}';
  v_next:=jsonb_set(v_prior,'{events}',v_prior->'events'||
    '[{"id":"backdated","kind":"repayment","person":"Alex","date":"2026-08-19","amount":30,"receivableDelta":-30}]'::jsonb);
  perform qa.expect_chronology('hidden dated deficit',v_seed,v_prior,v_next,true);
  v_next:=jsonb_set(v_prior,'{events}',v_prior->'events'||
    '[{"id":"valid","kind":"repayment","person":"Alex","date":"2026-08-19","amount":20,"receivableDelta":-20}]'::jsonb);
  perform qa.expect_chronology('bounded backdated repayment',v_seed,v_prior,v_next,false);
  -- Same-date sums are independent of event ID/order.
  v_prior:='{"events":[]}';
  v_next:='{"events":[
    {"id":"a-repaid","kind":"repayment","person":"Alex","date":"2026-08-21","amount":130,"receivableDelta":-130},
    {"id":"z-lent","kind":"lending","person":"Alex","date":"2026-08-21","amount":40,"receivableDelta":40}
  ]}';
  perform qa.expect_chronology('same day additive lending',v_seed,v_prior,v_next,false);
  -- Reconstructed imported legacy history, not the final snapshot backdated.
  v_legacy:='{"lending":[{"person":"Alex","outstanding":20,"entries":[
    {"date":"2026-07-01","lent":100,"repaid":0},
    {"date":"2026-08-20","lent":0,"repaid":80}
  ]}]}';
  v_prior:='{"events":[]}';
  v_next:='{"events":[
    {"id":"older","kind":"repayment","person":"Alex","date":"2026-08-19","amount":30,"receivableDelta":-30},
    {"id":"replenish","kind":"lending","person":"Alex","date":"2026-08-30","amount":100,"receivableDelta":100}
  ]}';
  perform qa.expect_chronology('complete legacy intermediate deficit',v_legacy,v_prior,v_next,true);
  -- Incomplete historical details keep the imported 20-cent snapshot contract.
  v_legacy:='{"lending":[{"person":"Alex","outstanding":20,"entries":[
    {"date":"2026-07-01","lent":100}
  ]}]}';
  v_next:='{"events":[{"id":"allowed","kind":"repayment","person":"Alex","date":"2026-08-19","amount":20,"receivableDelta":-20}]}';
  perform qa.expect_chronology('incomplete legacy opening preserved',v_legacy,v_prior,v_next,false);
  v_next:='{"events":[{"id":"excess","kind":"repayment","person":"Alex","date":"2026-08-19","amount":21,"receivableDelta":-21}]}';
  perform qa.expect_chronology('incomplete legacy overpayment denied',v_legacy,v_prior,v_next,true);
  -- Forged delta and non-receivable offset must not bypass raw RPC.
  v_next:='{"events":[{"id":"forged","kind":"repayment","person":"Alex","date":"2026-08-19","amount":30,"receivableDelta":-1}]}';
  perform qa.expect_chronology('forged amount-vs-delta',v_seed,v_prior,v_next,true);
  v_next:='{"events":[{"id":"forged","kind":"expense","person":"Alex","date":"2026-08-19","amount":30,"receivableDelta":50}]}';
  perform qa.expect_chronology('forged nonreceivable source',v_seed,v_prior,v_next,true);
  -- A legitimate nondecreasing writeoff uses no cash leg.
  v_next:='{"events":[{"id":"forgive","kind":"lending_writeoff","person":"Alex","date":"2026-08-19","amount":35,"receivableDelta":-35}]}';
  perform qa.expect_chronology('noncash writeoff in bounds',v_seed,v_prior,v_next,false);
  -- Day validity must fail closed on changed receivable mutations.
  v_next:='{"events":[{"id":"bad-date","kind":"repayment","person":"Alex","date":"2026-02-30","amount":1,"receivableDelta":-1}]}';
  perform qa.expect_chronology('invalid day denied',v_seed,v_prior,v_next,true);
  -- Numeric-scientific text cannot hide the receivable delta from the
  -- daily comparison when a direct RPC skips the Node input validator.
  v_prior:='{"events":[{"id":"last","kind":"repayment","person":"Alex","date":"2026-08-29","amount":100,"receivableDelta":-100}]}';
  v_next:=jsonb_set(v_prior,'{events}',v_prior->'events'||
    '[{"id":"scientific","kind":"repayment","person":"Alex","date":"2026-08-19","amount":100,"receivableDelta":"-1e2"}]'::jsonb);
  perform qa.expect_chronology('scientific notation cannot hide overpayment',v_seed,v_prior,v_next,true);
  -- The guard is read-only and never rewrites past seed/entries.
  if private.rheomiq_legacy_receivable_cents_asof(v_seed,'Alex',date '2026-08-20')<>10000 then
    raise exception 'Initial legacy opening not preserved';
  end if;
  if private.rheomiq_legacy_receivable_cents_asof(
    '{"lending":[{"person":"Alex","outstanding":20,"entries":[{"date":"2026-07-01","lent":100},{"date":"2026-08-20","repaid":80}]}]}'::jsonb,
    'Alex',date '2026-08-19')<>10000 then
    raise exception 'Complete history not reconstructed as of earlier date';
  end if;
end $$;
RESET ROLE;
