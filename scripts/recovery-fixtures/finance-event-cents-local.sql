-- Direct real PL/pgSQL helper proofs, extracted verbatim from forward migration.
-- No hosted credentials, owner data, or production state.
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION qa.expect_event_cents(
  p_title text,p_old jsonb,p_new jsonb,p_should_reject boolean
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM private.rheomiq_guard_changed_event_cents(p_old,p_new);
  EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true;
  END;
  IF v_rejected IS DISTINCT FROM p_should_reject THEN
    RAISE EXCEPTION 'Changed event cents proof: % (rejected %, expected %)',
      p_title,v_rejected,p_should_reject;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION qa.expect_event_cents(text,jsonb,jsonb,boolean) TO authenticated;
DO $$ BEGIN
  IF has_function_privilege('anon','private.rheomiq_guard_changed_event_cents(jsonb,jsonb)','EXECUTE')
    OR has_function_privilege('anon','private.rheomiq_mutable_event_money_fields(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role gained direct mutable event guard privilege';
  END IF;
  IF NOT has_function_privilege('authenticated','private.rheomiq_guard_changed_event_cents(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role lost finance validation guard';
  END IF;
END $$;

SET ROLE authenticated;
DO $$
DECLARE
  prior jsonb:='{"events":[]}';
  good jsonb;
  historical jsonb;
  altered jsonb;
BEGIN
  good:='{"events":[{"id":"evt","kind":"transfer","amount":10.01,
    "legs":[{"accountId":"payroll","amount":-10.01},{"accountId":"cash","amount":10.01}],
    "savingAmount":0,"creditDelta":0}]}';
  PERFORM qa.expect_event_cents('valid cents',prior,good,false);
  altered:=jsonb_set(good,'{events,0,amount}','10.001'::jsonb);
  PERFORM qa.expect_event_cents('new parent fractional cent',prior,altered,true);
  altered:=jsonb_set(good,'{events,0,legs,0,amount}','-10.001'::jsonb);
  PERFORM qa.expect_event_cents('new ledger fractional cent',prior,altered,true);
  altered:=jsonb_set(good,'{events,0,savingAmount}','0.001'::jsonb);
  PERFORM qa.expect_event_cents('new saving delta fractional cent',prior,altered,true);
  altered:=jsonb_set(good,'{events,0,creditDelta}','-0.001'::jsonb);
  PERFORM qa.expect_event_cents('new credit delta fractional cent',prior,altered,true);
  altered:=jsonb_set(good,'{events,0,amount}','"10.01"'::jsonb);
  PERFORM qa.expect_event_cents('non-numeric money rejected',prior,altered,true);
  altered:=jsonb_set(good,'{events,0,amount}','90071992547409.92'::jsonb);
  PERFORM qa.expect_event_cents('unsafe cents overflow',prior,altered,true);
  -- Non-monetary owner edits may preserve historical fractional anomalies.
  historical:='{"events":[{"id":"legacy","kind":"expense","amount":10.001,
    "note":"old","legs":[{"accountId":"payroll","amount":-10.001}]}]}';
  altered:=jsonb_set(historical,'{events,0,note}','"updated note"'::jsonb);
  PERFORM qa.expect_event_cents('grandfathered untouched anomaly',historical,altered,false);
  altered:=jsonb_set(historical,'{events,0,amount}','10.002'::jsonb);
  PERFORM qa.expect_event_cents('monetary edit to old anomaly',historical,altered,true);
  altered:=jsonb_set(historical,'{events,0,kind}','"refund"'::jsonb);
  PERFORM qa.expect_event_cents('changed event kind cannot bypass',historical,altered,true);
  -- Test split and funding component identities independently of parent.
  good:='{"events":[{"id":"split","kind":"split","amount":10,
    "parts":[{"id":"a","amount":4},{"id":"b","amount":6}],
    "legs":[{"accountId":"payroll","amount":-10}]}]}';
  altered:=jsonb_set(good,'{events,0,parts,0,amount}','4.001'::jsonb);
  PERFORM qa.expect_event_cents('changed split part',good,altered,true);
  good:='{"events":[{"id":"funded","kind":"expense","amount":10,
    "funding":[{"kind":"account","sourceId":"payroll","amount":4},
               {"kind":"credit","sourceId":"card","amount":6}],
    "legs":[{"accountId":"payroll","amount":-4},{"accountId":"credit-card","amount":-6}]}]}';
  altered:=jsonb_set(good,'{events,0,funding,1,amount}','6.001'::jsonb);
  PERFORM qa.expect_event_cents('changed funding component',good,altered,true);
  altered:=jsonb_set(good,'{events,0,funding,1,amount}','6.01'::jsonb);
  PERFORM qa.expect_event_cents('valid changed funding cents',good,altered,false);
END $$;
RESET ROLE;
