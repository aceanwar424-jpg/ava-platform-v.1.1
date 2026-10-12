-- OWNED_BY: generic adapter. Existing pharmacy source functions retain their original provenance.
BEGIN;
CREATE TABLE rs_pharmacy_ledger_scopes(ledger_id bigint PRIMARY KEY REFERENCES pharmacy_stock_ledger(id),tenant_id uuid NOT NULL REFERENCES tenants(id),local_balance_after numeric NOT NULL CHECK(local_balance_after>=0),actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE rs_pharmacy_ledger_scopes ENABLE ROW LEVEL SECURITY;REVOKE ALL ON rs_pharmacy_ledger_scopes FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_pharmacy_local_stock(p_drug bigint) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(sum(b.qty_remaining),0) FROM pharmacy_batches b JOIN rs_pharmacy_batch_scopes s ON s.batch_id=b.id WHERE b.drug_id=p_drug AND s.tenant_id=current_tenant_id()
$$;
CREATE FUNCTION rs_pharmacy_active_binding(p_drug bigint) RETURNS rs_pharmacy_bindings LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE b rs_pharmacy_bindings;
BEGIN SELECT * INTO b FROM rs_pharmacy_bindings WHERE drug_id=p_drug AND tenant_id=current_tenant_id() AND state='active';
 IF b.id IS NULL OR b.valid_until<(clock_timestamp() AT TIME ZONE b.timezone)::date OR NOT EXISTS(SELECT 1 FROM pharmacy_drugs WHERE id=p_drug AND is_active) OR b.opening_snapshot->'drug' IS DISTINCT FROM rs_pharmacy_drug_snapshot(p_drug) THEN RAISE EXCEPTION 'Binding/formulary source aktif belum sah, berubah atau kedaluwarsa';END IF;RETURN b;
END $$;
CREATE FUNCTION rs_pharmacy_quantity(p_binding rs_pharmacy_bindings,p_qty jsonb,p_signed boolean DEFAULT false) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE n numeric;
BEGIN IF jsonb_typeof(p_qty) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Quantity numerik wajib';END IF;n:=(p_qty#>>'{}')::numeric;
 IF n=0 OR (NOT p_signed AND n<0) OR abs(n)>1000000 OR mod(abs(n),p_binding.qty_step)<>0 THEN RAISE EXCEPTION 'Quantity/step tidak sesuai binding yang disahkan';END IF;RETURN n;
END $$;
ALTER FUNCTION rx_receive_stock(bigint,numeric,text,date,numeric,text,text) RENAME TO rx_receive_stock_before_rs_pharmacy;
ALTER FUNCTION rx_adjust_stock(bigint,numeric,text) RENAME TO rx_adjust_stock_before_rs_pharmacy;
REVOKE ALL ON FUNCTION rx_receive_stock_before_rs_pharmacy(bigint,numeric,text,date,numeric,text,text),rx_adjust_stock_before_rs_pharmacy(bigint,numeric,text) FROM PUBLIC,anon,authenticated;
-- Normalize registered English professional roles only inside these private legacy source guards.
DO $$DECLARE sig text;body text;BEGIN FOREACH sig IN ARRAY ARRAY['rx_receive_stock_before_rs_pharmacy(bigint,numeric,text,date,numeric,text,text)','rx_adjust_stock_before_rs_pharmacy(bigint,numeric,text)'] LOOP
 SELECT pg_get_functiondef(sig::regprocedure) INTO body;IF position('public.current_app_role()' IN body)=0 THEN RAISE EXCEPTION 'Pharmacy role source contract changed';END IF;
 body:=replace(body,'public.current_app_role()','CASE public.current_app_role() WHEN ''pharmacist'' THEN ''apoteker'' ELSE public.current_app_role() END');EXECUTE body;END LOOP;END $$;
CREATE FUNCTION rs_pharmacy_stock_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;b rs_pharmacy_bindings;batch pharmacy_batches;r rs_pharmacy_requests;qty_value numeric;cost_value numeric;before_qty numeric;before_ledger bigint;source_result jsonb;result_value jsonb;ledger pharmacy_stock_ledger;running_qty numeric;
 input_value jsonb:=jsonb_build_object('stock_action',p_action,'data',p_data);
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','operasional','pharmacist','apoteker']);
 IF p_action IS NULL OR p_action NOT IN ('receive','adjust') OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Action/input/key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_pharmacy_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN r.result;END IF;
 IF p_action='receive' THEN b:=rs_pharmacy_active_binding((p_data->>'drug_id')::bigint);
 ELSE SELECT * INTO batch FROM pharmacy_batches WHERE id=(p_data->>'batch_id')::bigint;IF batch.id IS NULL OR NOT EXISTS(SELECT 1 FROM rs_pharmacy_batch_scopes WHERE batch_id=batch.id AND tenant_id=t) THEN RAISE EXCEPTION 'Batch bukan milik tenant';END IF;b:=rs_pharmacy_active_binding(batch.drug_id);END IF;
 PERFORM 1 FROM pharmacy_drugs WHERE id=b.drug_id FOR UPDATE;SELECT * INTO b FROM rs_pharmacy_bindings WHERE id=b.id FOR SHARE;
 IF b.state<>'active' OR b.valid_until<(clock_timestamp() AT TIME ZONE b.timezone)::date THEN RAISE EXCEPTION 'Binding berubah/kedaluwarsa';END IF;
 PERFORM set_config('TimeZone',b.timezone,true);PERFORM ops_assert_permission('rs-ward-pharmacy','pharmacy.stock.'||p_action);
 qty_value:=rs_pharmacy_quantity(b,p_data->'qty',p_action='adjust');before_qty:=rs_pharmacy_local_stock(b.drug_id);SELECT coalesce(max(id),0) INTO before_ledger FROM pharmacy_stock_ledger WHERE drug_id=b.drug_id;
 IF p_action='receive' THEN
  IF jsonb_typeof(p_data->'unit_cost') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Harga penerimaan eksplisit wajib';END IF;cost_value:=(p_data->>'unit_cost')::numeric;
  IF cost_value<0 OR cost_value<>round(cost_value,b.amount_decimals) THEN RAISE EXCEPTION 'Harga/presisi penerimaan tidak valid';END IF;
  source_result:=rx_receive_stock_before_rs_pharmacy(b.drug_id,qty_value,p_data->>'batch_no',(p_data->>'expiry_date')::date,cost_value,p_data->>'supplier',p_data->>'reason');
  IF source_result->>'ok' IS DISTINCT FROM 'true' OR source_result->>'batch_id' IS NULL THEN RAISE EXCEPTION 'Source penerimaan gagal';END IF;
  INSERT INTO rs_pharmacy_batch_scopes(batch_id,tenant_id,binding_id,assigned_by) VALUES((source_result->>'batch_id')::bigint,t,b.id,a);
 ELSE
  PERFORM ops_actor(ARRAY['super_admin','direktur','pharmacist','apoteker']);
  source_result:=rx_adjust_stock_before_rs_pharmacy(batch.id,qty_value,p_data->>'reason');IF source_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Source adjustment gagal';END IF;
 END IF;
 running_qty:=before_qty;
 FOR ledger IN SELECT * FROM pharmacy_stock_ledger WHERE drug_id=b.drug_id AND id>before_ledger ORDER BY id LOOP
  running_qty:=running_qty+ledger.qty;INSERT INTO rs_pharmacy_ledger_scopes(ledger_id,tenant_id,local_balance_after,actor_id) VALUES(ledger.id,t,running_qty,a);
 END LOOP;
 IF running_qty IS DISTINCT FROM rs_pharmacy_local_stock(b.drug_id) THEN RAISE EXCEPTION 'Ledger/batch source tidak rekonsiliasi';END IF;
 result_value:=(source_result-'stock_qty')||jsonb_build_object('tenant_stock_qty',running_qty,'drug_id',b.drug_id,'binding_id',b.id);
 INSERT INTO rs_pharmacy_events(tenant_id,actor_id,action,ref_id,reason,before_row,after_row) VALUES(t,a,'stock.'||p_action,b.drug_id,p_data->>'reason',jsonb_build_object('tenant_stock_qty',before_qty),result_value);
 INSERT INTO rs_pharmacy_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
REVOKE ALL ON FUNCTION rs_pharmacy_local_stock(bigint),rs_pharmacy_active_binding(bigint),rs_pharmacy_quantity(rs_pharmacy_bindings,jsonb,boolean),rs_pharmacy_stock_command(text,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_pharmacy_local_stock(bigint),rs_pharmacy_active_binding(bigint),rs_pharmacy_quantity(rs_pharmacy_bindings,jsonb,boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION rs_pharmacy_stock_command(text,jsonb,text) TO authenticated;
COMMIT;
