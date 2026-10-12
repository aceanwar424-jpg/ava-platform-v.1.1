-- OWNED_BY: generic adapter. Original prescription/FEFO/controlled-drug register sources are retained.
BEGIN;
CREATE TABLE rs_prescription_contexts(rx_id bigint PRIMARY KEY REFERENCES prescriptions(id),tenant_id uuid NOT NULL REFERENCES tenants(id),admission_id bigint NOT NULL REFERENCES admissions(id),episode_id bigint NOT NULL REFERENCES rs_care_episodes(id),reconciliation_id bigint NOT NULL REFERENCES rs_medication_reconciliations(id),reconciliation_snapshot jsonb NOT NULL,binding_snapshots jsonb NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),non_formulary_reason text,amendment_of bigint REFERENCES prescriptions(id));
CREATE TABLE rs_prescription_verifications(rx_id bigint PRIMARY KEY REFERENCES rs_prescription_contexts(rx_id),tenant_id uuid NOT NULL REFERENCES tenants(id),source_snapshot jsonb NOT NULL,reviewed_by uuid NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT now(),allergy_review text NOT NULL,interaction_review text NOT NULL,dose_review text NOT NULL,reason text NOT NULL);
CREATE FUNCTION rs_pharmacy_price(p_drug bigint) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT (rs_pharmacy_active_binding(p_drug)).unit_price$$;
CREATE FUNCTION rs_prescription_snapshot(p_rx bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('header',to_jsonb(r),'items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM prescription_items i WHERE i.rx_id=r.id),'[]')) FROM prescriptions r WHERE r.id=p_rx
$$;
CREATE FUNCTION rs_rx_allergy_warnings(p_reconciliation bigint,p_drugs bigint[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('drug_id',d.id,'drug_name',coalesce(d.brand_name,d.generic_name),'allergen',a.value->>'allergen','reaction',a.value->>'reaction','severity',a.value->>'severity')),'[]')
 FROM rs_medication_reconciliations r CROSS JOIN LATERAL jsonb_array_elements(r.allergy_snapshot) a(value) JOIN pharmacy_drugs d ON d.id=ANY(p_drugs)
 WHERE r.id=p_reconciliation AND r.tenant_id=current_tenant_id() AND r.state='approved' AND length(trim(a.value->>'allergen'))>=3
 AND (lower(coalesce(d.generic_name,'')) LIKE '%'||lower(trim(a.value->>'allergen'))||'%' OR lower(coalesce(d.brand_name,'')) LIKE '%'||lower(trim(a.value->>'allergen'))||'%')
$$;
ALTER FUNCTION rx_save_prescription(jsonb,jsonb) RENAME TO rx_save_prescription_before_rs_pharmacy;
ALTER FUNCTION rx_dispense_prescription(bigint,jsonb,text) RENAME TO rx_dispense_prescription_before_rs_pharmacy;
ALTER FUNCTION rx_cancel_prescription(bigint,text) RENAME TO rx_cancel_prescription_before_rs_pharmacy;
REVOKE ALL ON FUNCTION rx_save_prescription_before_rs_pharmacy(jsonb,jsonb),rx_dispense_prescription_before_rs_pharmacy(bigint,jsonb,text),rx_cancel_prescription_before_rs_pharmacy(bigint,text),rx_check_allergies(text,bigint[]),rx_check_interactions(bigint[]) FROM PUBLIC,anon,authenticated;
DO $$DECLARE body text;sig text;BEGIN
 SELECT pg_get_functiondef('rx_save_prescription_before_rs_pharmacy(jsonb,jsonb)'::regprocedure) INTO body;
 IF position('public.rx_check_allergies(v_mr, v_ids)' IN body)=0 OR position('coalesce(v_drug.unit_price,0)' IN body)=0 THEN RAISE EXCEPTION 'Prescription source contract changed';END IF;
 body:=replace(body,'public.rx_check_allergies(v_mr, v_ids)','rs_rx_allergy_warnings((p_header->>''reconciliation_id'')::bigint,v_ids)');body:=replace(body,'coalesce(v_drug.unit_price,0)','rs_pharmacy_price(v_drug.id)');EXECUTE body;
 SELECT pg_get_functiondef('rx_dispense_prescription_before_rs_pharmacy(bigint,jsonb,text)'::regprocedure) INTO body;
 IF position('WHERE drug_id = v_drug.id' IN body)=0 THEN RAISE EXCEPTION 'FEFO source contract changed';END IF;
 body:=replace(body,'WHERE drug_id = v_drug.id','WHERE drug_id = v_drug.id AND id IN (SELECT batch_id FROM rs_pharmacy_batch_scopes WHERE tenant_id=current_tenant_id())');body:=replace(body,'(expiry_date IS NULL OR expiry_date > current_date)','expiry_date > current_date');EXECUTE body;
 FOREACH sig IN ARRAY ARRAY['rx_save_prescription_before_rs_pharmacy(jsonb,jsonb)','rx_dispense_prescription_before_rs_pharmacy(bigint,jsonb,text)','rx_cancel_prescription_before_rs_pharmacy(bigint,text)'] LOOP
  SELECT pg_get_functiondef(sig::regprocedure) INTO body;body:=replace(body,'public.current_app_role()','CASE public.current_app_role() WHEN ''pharmacist'' THEN ''apoteker'' WHEN ''doctor'' THEN ''dokter'' ELSE public.current_app_role() END');EXECUTE body;
 END LOOP;
END $$;
CREATE FUNCTION rs_pharmacy_rx_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;adm admissions;stay inpatient_stays;ctx rs_prescription_contexts;recon rs_medication_reconciliations;rx prescriptions;verification rs_prescription_verifications;r rs_pharmacy_requests;
 input_value jsonb:=jsonb_build_object('rx_action',p_action,'data',p_data);source_result jsonb;result_value jsonb;before_value jsonb;header_value jsonb;bindings_value jsonb:='[]';item jsonb;b rs_pharmacy_bindings;source_snapshot jsonb;
 drug_id_value bigint;rx_value bigint;qty_value numeric;before_ledger bigint;stock_before jsonb:='{}';ledger pharmacy_stock_ledger;balance_value numeric;dispense_item pharmacy_dispense_items;charge_value jsonb;
BEGIN
 a:=ops_actor(ARRAY['dokter','doctor','pharmacist','apoteker']);
 IF p_action IS NULL OR p_action NOT IN ('create','verify','dispense','cancel') OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Action/input/key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_pharmacy_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN r.result;END IF;
 IF p_action='create' THEN SELECT * INTO recon FROM rs_medication_reconciliations WHERE id=(p_data->>'reconciliation_id')::bigint AND tenant_id=t AND state='approved';
 ELSE SELECT * INTO ctx FROM rs_prescription_contexts WHERE rx_id=(p_data->>'rx_id')::bigint AND tenant_id=t;SELECT * INTO recon FROM rs_medication_reconciliations WHERE id=ctx.reconciliation_id AND tenant_id=t;END IF;
 IF recon.id IS NULL THEN RAISE EXCEPTION 'Rekonsiliasi/Rx bukan milik tenant atau belum approved';END IF;
 SELECT * INTO stay FROM inpatient_stays WHERE admission_id=recon.admission_id AND tenant_id=t AND status='Dirawat' FOR UPDATE;
 SELECT * INTO adm FROM admissions WHERE id=recon.admission_id AND tenant_id=t FOR UPDATE;PERFORM rs_pharmacy_assert_encounter(adm.id,CASE WHEN ctx.rx_id IS NULL THEN recon.episode_id ELSE ctx.episode_id END);
 PERFORM set_config('TimeZone',recon.timezone,true);
 PERFORM ops_assert_permission('rs-ward-pharmacy','clinical.pharmacy.rx.'||p_action);
 IF EXISTS(SELECT 1 FROM patient_allergies p LEFT JOIN rs_pharmacy_allergy_scopes scope ON scope.allergy_id=p.id WHERE (scope.tenant_id=t OR scope.allergy_id IS NULL) AND p.mr_number=adm.mr_number AND coalesce(p.is_active,true) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(recon.allergy_ids) selected(value) WHERE selected.value::bigint=p.id)) THEN RAISE EXCEPTION 'Ada source alergi baru/ownership belum direkonsiliasi';END IF;
 IF recon.state<>'approved' OR recon.source_identity IS DISTINCT FROM rs_pharmacy_encounter_identity(adm.id) OR recon.allergy_snapshot IS DISTINCT FROM rs_pharmacy_allergy_snapshot(adm.id,recon.allergy_ids) THEN RAISE EXCEPTION 'Rekonsiliasi/identitas/alergi berubah; review ulang';END IF;
 IF ctx.rx_id IS NOT NULL THEN SELECT * INTO rx FROM prescriptions WHERE id=ctx.rx_id FOR UPDATE;IF ctx.reconciliation_snapshot IS DISTINCT FROM to_jsonb(recon) THEN RAISE EXCEPTION 'Snapshot rekonsiliasi Rx berubah';END IF;END IF;
 before_value:=to_jsonb(rx);
 IF p_action='create' THEN
  PERFORM ops_actor(ARRAY['dokter','doctor']);
  IF p_data->'signature_attestation' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(p_data->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Tanda tangan dokter dan item resep eksplisit wajib';END IF;
  IF p_data->>'amendment_of' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM rs_prescription_contexts c JOIN prescriptions p ON p.id=c.rx_id WHERE c.rx_id=(p_data->>'amendment_of')::bigint AND c.tenant_id=t AND c.admission_id=adm.id AND p.status IN ('Dibatalkan','Diserahkan')) THEN RAISE EXCEPTION 'Amendment harus mengacu resep sumber pasien yang dibatalkan/diserahkan';END IF;
  FOR drug_id_value IN SELECT DISTINCT (value->>'drug_id')::bigint FROM jsonb_array_elements(p_data->'items') ORDER BY 1 LOOP PERFORM 1 FROM pharmacy_drugs WHERE id=drug_id_value FOR UPDATE;END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'items') LOOP
   b:=rs_pharmacy_active_binding((item->>'drug_id')::bigint);PERFORM 1 FROM rs_pharmacy_bindings WHERE id=b.id FOR SHARE;
   IF b.timezone<>recon.timezone THEN RAISE EXCEPTION 'Timezone formulary dan encounter harus cocok';END IF;
   qty_value:=rs_pharmacy_quantity(b,item->'qty');
   IF coalesce(length(trim(item->>'dose')),0)=0 OR coalesce(length(trim(item->>'frequency')),0)=0 OR jsonb_typeof(item->'duration_days') IS DISTINCT FROM 'number' OR (item->>'duration_days')::numeric<0 OR (item->>'duration_days')::numeric<>trunc((item->>'duration_days')::numeric) THEN RAISE EXCEPTION 'Dosis/frekuensi/durasi dokter wajib eksplisit';END IF;
   IF NOT b.is_formulary AND coalesce(length(trim(p_data->>'non_formulary_reason')),0)<5 THEN RAISE EXCEPTION 'Alasan non-formulary wajib direview';END IF;
   bindings_value:=bindings_value||jsonb_build_array(to_jsonb(b));
  END LOOP;
  header_value:=coalesce(p_data->'header','{}')||jsonb_build_object('admission_id',adm.id,'mr_number',adm.mr_number,'patient_name',adm.patient_name,'patient_gender',adm.patient_gender,'patient_age',adm.patient_age,'doctor_name',current_app_name(),'reconciliation_id',recon.id);
  source_result:=rx_save_prescription_before_rs_pharmacy(header_value,p_data->'items');IF source_result->>'ok' IS DISTINCT FROM 'true' OR source_result->>'rx_id' IS NULL THEN RAISE EXCEPTION 'Source resep gagal';END IF;
  rx_value:=(source_result->>'rx_id')::bigint;
  INSERT INTO rs_prescription_contexts(rx_id,tenant_id,admission_id,episode_id,reconciliation_id,reconciliation_snapshot,binding_snapshots,created_by,non_formulary_reason,amendment_of)
  VALUES(rx_value,t,adm.id,recon.episode_id,recon.id,to_jsonb(recon),bindings_value,a,p_data->>'non_formulary_reason',(p_data->>'amendment_of')::bigint);
 ELSIF p_action='verify' THEN
  PERFORM ops_actor(ARRAY['pharmacist','apoteker']);IF rx.status<>'Baru' OR ctx.created_by=a THEN RAISE EXCEPTION 'Verifikasi resep baru oleh apoteker berbeda dari prescriber';END IF;
  IF coalesce(length(trim(p_data->>'allergy_review')),0)<5 OR coalesce(length(trim(p_data->>'interaction_review')),0)<5 OR coalesce(length(trim(p_data->>'dose_review')),0)<5 THEN RAISE EXCEPTION 'Review alergi/interaksi/dosis profesional wajib';END IF;
  source_snapshot:=rs_prescription_snapshot(rx.id);
  INSERT INTO rs_prescription_verifications(rx_id,tenant_id,source_snapshot,reviewed_by,allergy_review,interaction_review,dose_review,reason) VALUES(rx.id,t,source_snapshot,a,p_data->>'allergy_review',p_data->>'interaction_review',p_data->>'dose_review',p_data->>'reason');
  source_result:=jsonb_build_object('ok',true,'rx_id',rx.id,'reviewed_by',a);
 ELSIF p_action='dispense' THEN
  PERFORM ops_actor(ARRAY['pharmacist','apoteker']);SELECT * INTO verification FROM rs_prescription_verifications WHERE rx_id=rx.id AND tenant_id=t;
  IF verification.rx_id IS NULL OR verification.source_snapshot IS DISTINCT FROM rs_prescription_snapshot(rx.id) THEN RAISE EXCEPTION 'Verifikasi source resep wajib/telah berubah';END IF;
  FOR drug_id_value IN SELECT DISTINCT drug_id FROM prescription_items WHERE rx_id=rx.id ORDER BY drug_id LOOP
   PERFORM 1 FROM pharmacy_drugs WHERE id=drug_id_value FOR UPDATE;b:=rs_pharmacy_active_binding(drug_id_value);IF b.timezone<>recon.timezone THEN RAISE EXCEPTION 'Timezone binding berubah';END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ctx.binding_snapshots) original(value) WHERE (original.value->>'drug_id')::bigint=drug_id_value AND original.value->'opening_snapshot'->'drug'=rs_pharmacy_drug_snapshot(drug_id_value)) THEN RAISE EXCEPTION 'Identitas/form/kekuatan/golongan obat berubah; resep perlu amendment';END IF;
   stock_before:=stock_before||jsonb_build_object(drug_id_value::text,rs_pharmacy_local_stock(drug_id_value));
  END LOOP;
  SELECT coalesce(max(id),0) INTO before_ledger FROM pharmacy_stock_ledger;
  source_result:=rx_dispense_prescription_before_rs_pharmacy(rx.id,p_data->'recipient',p_data->>'reason');IF source_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Source dispensing gagal';END IF;
  FOR ledger IN SELECT * FROM pharmacy_stock_ledger WHERE ref_type='dispense' AND ref_id=(source_result->>'dispense_id')::bigint AND id>before_ledger ORDER BY id LOOP
   balance_value:=(stock_before->>ledger.drug_id::text)::numeric+ledger.qty;stock_before:=stock_before||jsonb_build_object(ledger.drug_id::text,balance_value);
   INSERT INTO rs_pharmacy_ledger_scopes(ledger_id,tenant_id,local_balance_after,actor_id) VALUES(ledger.id,t,balance_value,a);
  END LOOP;
  FOR drug_id_value IN SELECT DISTINCT drug_id FROM prescription_items WHERE rx_id=rx.id LOOP IF (stock_before->>drug_id_value::text)::numeric IS DISTINCT FROM rs_pharmacy_local_stock(drug_id_value) THEN RAISE EXCEPTION 'Dispensing ledger/batch source tidak rekonsiliasi';END IF;END LOOP;
  IF stay.id IS NOT NULL THEN FOR dispense_item IN SELECT * FROM pharmacy_dispense_items WHERE dispense_id=(source_result->>'dispense_id')::bigint ORDER BY id LOOP
   charge_value:=tagihan_posting('pharmacy_dispense_items',dispense_item.id,'Obat & BHP',dispense_item.drug_name,dispense_item.qty,dispense_item.unit_price,adm.id,stay.id,current_app_name());IF charge_value->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Source billing dispensing gagal';END IF;
  END LOOP;END IF;
 ELSIF p_action='cancel' THEN PERFORM ops_actor(ARRAY['dokter','doctor']);source_result:=rx_cancel_prescription_before_rs_pharmacy(rx.id,p_data->>'reason');IF source_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Source cancel resep gagal';END IF;
 END IF;
 result_value:=source_result||jsonb_build_object('admission_id',adm.id,'episode_id',recon.episode_id,'reconciliation_id',recon.id);
 INSERT INTO rs_pharmacy_events(tenant_id,actor_id,action,ref_id,reason,before_row,after_row) VALUES(t,a,'rx.'||p_action,coalesce(rx_value,rx.id),p_data->>'reason',before_value,result_value);INSERT INTO rs_pharmacy_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
ALTER TABLE rs_prescription_contexts ENABLE ROW LEVEL SECURITY;ALTER TABLE rs_prescription_verifications ENABLE ROW LEVEL SECURITY;REVOKE ALL ON rs_prescription_contexts,rs_prescription_verifications FROM PUBLIC,anon,authenticated;
CREATE POLICY rs_prescription_context_read ON rs_prescription_contexts FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-ward-pharmacy'));GRANT SELECT ON rs_prescription_contexts TO authenticated;
REVOKE ALL ON FUNCTION rs_pharmacy_price(bigint),rs_prescription_snapshot(bigint),rs_rx_allergy_warnings(bigint,bigint[]),rs_pharmacy_rx_command(text,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_pharmacy_price(bigint),rs_prescription_snapshot(bigint),rs_rx_allergy_warnings(bigint,bigint[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION rs_pharmacy_rx_command(text,jsonb,text) TO authenticated;
COMMIT;
