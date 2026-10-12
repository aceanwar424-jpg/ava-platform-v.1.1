-- OWNED_BY: generic. Patient-held medication accounting, reviewed returns and append-only source credits.
BEGIN;
ALTER TABLE rs_medication_custody_events ADD COLUMN policy_id bigint REFERENCES ops_policy_versions(id), ADD COLUMN policy_snapshot jsonb;
-- Retain the existing charge guard and extend only the typed, reviewed medication credit.
ALTER FUNCTION rs_charge_source_guard() RENAME TO rs_charge_source_guard_before_medication;
CREATE FUNCTION rs_charge_source_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e rs_medication_custody_events;d pharmacy_dispense_items;c rs_prescription_contexts;
BEGIN
 IF TG_OP='UPDATE' AND OLD.ref_tabel IN ('pharmacy_dispense_items','rs_medication_custody_events') THEN RAISE EXCEPTION 'Biaya obat asli immutable; gunakan retur terverifikasi';END IF;
 IF NEW.ref_tabel='pharmacy_dispense_items' THEN
  PERFORM ops_actor(ARRAY['pharmacist','apoteker']);SELECT * INTO d FROM pharmacy_dispense_items WHERE id=NEW.ref_id;
  SELECT context.* INTO c FROM rs_prescription_contexts context JOIN prescription_items i ON i.rx_id=context.rx_id WHERE i.id=d.rx_item_id;
  IF TG_OP<>'INSERT' OR d.id IS NULL OR c.tenant_id IS DISTINCT FROM current_tenant_id() OR NOT EXISTS(SELECT 1 FROM rs_pharmacy_execution_contexts execution WHERE execution.transaction_id=txid_current() AND execution.tenant_id=c.tenant_id AND execution.actor_id=auth.uid() AND execution.rx_id=c.rx_id AND execution.admission_id=c.admission_id AND execution.purpose='dispense') OR NEW.qty IS DISTINCT FROM d.qty OR NEW.unit_price IS DISTINCT FROM d.unit_price OR NEW.amount IS DISTINCT FROM d.subtotal OR NEW.admission_id IS DISTINCT FROM c.admission_id OR rs_charge_source_owner(NEW.stay_id,NEW.admission_id) IS DISTINCT FROM current_tenant_id() OR NEW.charge_type IS DISTINCT FROM 'Obat & BHP' THEN RAISE EXCEPTION 'Biaya dispensing hanya dari workflow dan item source aktual';END IF;RETURN NEW;
 END IF;
 IF NEW.ref_tabel='rs_medication_custody_events' THEN
  PERFORM ops_actor(ARRAY['pharmacist','apoteker']);
  SELECT * INTO e FROM rs_medication_custody_events WHERE id=NEW.ref_id AND tenant_id=current_tenant_id() AND state='posting';
  SELECT * INTO d FROM pharmacy_dispense_items WHERE id=e.dispense_item_id;
  SELECT context.* INTO c FROM rs_prescription_contexts context JOIN prescription_items i ON i.rx_id=context.rx_id WHERE i.id=d.rx_item_id;
  IF TG_OP<>'INSERT' OR e.id IS NULL OR c.tenant_id IS DISTINCT FROM current_tenant_id() OR e.kind NOT IN ('return','waste') OR e.kind='waste' AND e.policy_snapshot->'waste_billable' IS DISTINCT FROM 'false'::jsonb OR NEW.qty IS DISTINCT FROM -e.quantity OR NEW.unit_price IS DISTINCT FROM d.unit_price OR NEW.amount IS DISTINCT FROM -e.quantity*d.unit_price OR NEW.admission_id IS DISTINCT FROM c.admission_id OR rs_charge_source_owner(NEW.stay_id,NEW.admission_id) IS DISTINCT FROM current_tenant_id() OR NEW.charge_type IS DISTINCT FROM 'Obat & BHP' THEN RAISE EXCEPTION 'Kredit obat harus dari custody review yang sedang posting';END IF;
  RETURN NEW;
 END IF;
 -- Trigger functions cannot be called directly. Execute the preserved source body below instead.
 RETURN NEW;
END $$;
DO $$DECLARE body text;original text;anchor text:=' -- Trigger functions cannot be called directly. Execute the preserved source body below instead.';BEGIN
 SELECT pg_get_functiondef('rs_charge_source_guard_before_medication()'::regprocedure) INTO original;
 SELECT pg_get_functiondef('rs_charge_source_guard()'::regprocedure) INTO body;
 original:=substring(original FROM position('BEGIN' IN original)+5);original:=regexp_replace(original,'END[[:space:]]+\$function\$[[:space:]]*;?[[:space:]]*$','');
 IF length(original)<500 OR position('PERFORM ops_actor' IN original)=0 THEN RAISE EXCEPTION 'Charge source contract changed';END IF;
 body:=replace(body,'DECLARE e rs_medication_custody_events;d pharmacy_dispense_items;c rs_prescription_contexts;','DECLARE e rs_medication_custody_events;d pharmacy_dispense_items;c rs_prescription_contexts;proposal rs_billing_proposals;b rs_billing_setups;');
 body:=replace(body,anchor||E'\n RETURN NEW;',original);EXECUTE body;
END $$;
DROP TRIGGER rs_charge_source_guard ON inpatient_charges;
CREATE TRIGGER rs_charge_source_guard BEFORE INSERT OR UPDATE ON inpatient_charges FOR EACH ROW EXECUTE FUNCTION rs_charge_source_guard();
REVOKE ALL ON FUNCTION rs_charge_source_guard_before_medication() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION rs_medication_custody_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;r rs_pharmacy_requests;e rs_medication_custody_events;d pharmacy_dispense_items;ctx rs_prescription_contexts;stay inpatient_stays;policy ops_policy_versions;batch pharmacy_batches;b rs_pharmacy_bindings;ledger pharmacy_stock_ledger;qty numeric;before_qty numeric;before_ledger bigint;source_result jsonb;result_value jsonb;before_value jsonb;input_value jsonb:=jsonb_build_object('custody_action',p_action,'data',p_data);
BEGIN
 a:=ops_actor(ARRAY['pharmacist','apoteker','nurse','perawat']);
 IF p_action IS NULL OR p_action NOT IN ('create','approve','reject') OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Action/input/key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_pharmacy_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN r.result;END IF;
 IF p_action='create' THEN SELECT * INTO d FROM pharmacy_dispense_items WHERE id=(p_data->>'dispense_item_id')::bigint;
 ELSE SELECT * INTO e FROM rs_medication_custody_events WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO d FROM pharmacy_dispense_items WHERE id=e.dispense_item_id;END IF;
 SELECT c.* INTO ctx FROM rs_prescription_contexts c JOIN prescription_items i ON i.rx_id=c.rx_id WHERE i.id=d.rx_item_id AND c.tenant_id=t;
 IF ctx.rx_id IS NULL THEN RAISE EXCEPTION 'Dispense/custody bukan milik tenant';END IF;
 SELECT * INTO stay FROM inpatient_stays WHERE admission_id=ctx.admission_id AND tenant_id=t AND status='Dirawat' FOR UPDATE;
 PERFORM 1 FROM admissions WHERE id=ctx.admission_id AND tenant_id=t FOR UPDATE;PERFORM rs_pharmacy_assert_encounter(ctx.admission_id,ctx.episode_id);
 PERFORM set_config('TimeZone',ctx.reconciliation_snapshot->>'timezone',true);PERFORM ops_assert_permission('rs-ward-pharmacy','clinical.pharmacy.custody.'||p_action);
 SELECT * INTO d FROM pharmacy_dispense_items WHERE id=d.id FOR UPDATE;
 IF e.id IS NOT NULL THEN SELECT * INTO e FROM rs_medication_custody_events WHERE id=e.id FOR UPDATE;IF e.state<>'draft' OR e.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Custody state/version berubah';END IF;END IF;
 before_value:=to_jsonb(e);
 IF p_action='create' THEN
  SELECT * INTO policy FROM ops_policy_versions WHERE id=(p_data->>'policy_id')::bigint AND tenant_id=t AND state='active' AND effective_at<=now();
  IF policy.id IS NULL OR policy.kind<>'clinical_template' OR policy.scope<>'rs-ward-pharmacy' OR policy.payload->>'purpose' IS DISTINCT FROM 'medication_custody' OR policy.payload->>'timezone' IS DISTINCT FROM ctx.reconciliation_snapshot->>'timezone' OR jsonb_typeof(policy.payload->'allow_return') IS DISTINCT FROM 'boolean' OR jsonb_typeof(policy.payload->'allow_waste') IS DISTINCT FROM 'boolean' OR jsonb_typeof(policy.payload->'allow_take_home') IS DISTINCT FROM 'boolean' OR jsonb_typeof(policy.payload->'waste_billable') IS DISTINCT FROM 'boolean' OR jsonb_typeof(policy.payload->'quantity_decimals') IS DISTINCT FROM 'number' OR (policy.payload->>'quantity_decimals')::numeric<>trunc((policy.payload->>'quantity_decimals')::numeric) OR (policy.payload->>'quantity_decimals')::numeric NOT BETWEEN 0 AND 6 THEN RAISE EXCEPTION 'SOP custody reviewed dengan flags/presisi eksplisit wajib';END IF;
  IF p_data->>'kind' IS NULL OR p_data->>'kind' NOT IN ('return','waste','take_home') OR policy.payload->('allow_'||(p_data->>'kind')) IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(p_data->'quantity') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'evidence') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Kind/quantity/evidence tidak sesuai SOP';END IF;
  qty:=(p_data->>'quantity')::numeric;
  IF qty<=0 OR qty<>round(qty,(policy.payload->>'quantity_decimals')::integer) OR qty>1000000 OR rs_medication_custody_used(d.id)+qty>d.qty THEN RAISE EXCEPTION 'Quantity custody melampaui sisa aktual/presisi';END IF;
  IF coalesce(length(trim(p_data->'evidence'->>'assessment')),0)<5 THEN RAISE EXCEPTION 'Asesmen custody profesional wajib';END IF;
  IF p_data->>'kind'='return' AND (p_data->'evidence'->'sealed' IS DISTINCT FROM 'true'::jsonb OR p_data->'evidence'->'storage_verified' IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Retur perlu sealed dan storage terverifikasi';END IF;
  IF p_data->>'kind'='take_home' AND (coalesce(length(trim(p_data->'evidence'->>'recipient_identity')),0)<6 OR coalesce(length(trim(p_data->'evidence'->>'counselling')),0)<5) THEN RAISE EXCEPTION 'Serah pulang perlu identitas penerima dan konseling';END IF;
  INSERT INTO rs_medication_custody_events(tenant_id,dispense_item_id,kind,quantity,evidence,created_by,reason,policy_id,policy_snapshot) VALUES(t,d.id,p_data->>'kind',qty,p_data->'evidence',a,p_data->>'reason',policy.id,policy.payload) RETURNING * INTO e;
 ELSE
  PERFORM ops_actor(ARRAY['pharmacist','apoteker']);IF e.created_by=a THEN RAISE EXCEPTION 'Review custody wajib aktor berbeda';END IF;
  IF p_action='reject' THEN UPDATE rs_medication_custody_events SET state='rejected',reviewed_by=a,reviewed_at=now(),version=version+1 WHERE id=e.id RETURNING * INTO e;
  ELSE
   IF rs_medication_custody_used(d.id)+e.quantity>d.qty THEN RAISE EXCEPTION 'Sisa custody tidak cukup saat review';END IF;
   IF coalesce(length(trim(p_data->>'professional_review')),0)<5 THEN RAISE EXCEPTION 'Review profesional custody wajib';END IF;
   -- Prevent further scheduled administration from using quantities leaving patient custody.
   IF EXISTS(SELECT 1 FROM rs_mar_plans WHERE dispense_item_id=d.id AND state IN ('draft','verified')) THEN RAISE EXCEPTION 'Dokter harus stop jadwal aktif sebelum custody keluar';END IF;
   UPDATE rs_medication_custody_events SET state='posting',reviewed_by=a,reviewed_at=now(),version=version+1,evidence=evidence||jsonb_build_object('professional_review',p_data->>'professional_review') WHERE id=e.id RETURNING * INTO e;
   IF e.kind='return' THEN
    PERFORM 1 FROM pharmacy_drugs WHERE id=d.drug_id FOR UPDATE;b:=rs_pharmacy_active_binding(d.drug_id);
    IF mod(e.quantity,b.qty_step)<>0 THEN RAISE EXCEPTION 'Quantity retur tidak sesuai step satuan stok binding';END IF;
    SELECT * INTO batch FROM pharmacy_batches WHERE id=d.batch_id FOR UPDATE;
    IF batch.id IS NULL OR batch.drug_id IS DISTINCT FROM d.drug_id OR batch.batch_no IS DISTINCT FROM d.batch_no OR batch.expiry_date IS DISTINCT FROM d.expiry_date OR batch.expiry_date IS NULL OR batch.expiry_date<=current_date OR NOT EXISTS(SELECT 1 FROM rs_pharmacy_batch_scopes WHERE batch_id=batch.id AND tenant_id=t) THEN RAISE EXCEPTION 'Batch retur/expiry/tenant tidak valid';END IF;
    before_qty:=rs_pharmacy_local_stock(d.drug_id);SELECT coalesce(max(id),0) INTO before_ledger FROM pharmacy_stock_ledger WHERE drug_id=d.drug_id;
    source_result:=rx_adjust_stock_before_rs_pharmacy(batch.id,e.quantity,'Retur custody #'||e.id||': '||(p_data->>'reason'));IF source_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Source retur gagal';END IF;
    SELECT * INTO STRICT ledger FROM pharmacy_stock_ledger WHERE drug_id=d.drug_id AND id>before_ledger;
    IF ledger.qty IS DISTINCT FROM e.quantity OR rs_pharmacy_local_stock(d.drug_id) IS DISTINCT FROM before_qty+e.quantity THEN RAISE EXCEPTION 'Ledger retur tidak rekonsiliasi';END IF;
    INSERT INTO rs_pharmacy_ledger_scopes VALUES(ledger.id,t,before_qty+e.quantity,a,now());UPDATE rs_medication_custody_events SET source_ledger_id=ledger.id WHERE id=e.id;
   END IF;
   IF stay.id IS NOT NULL AND (e.kind='return' OR e.kind='waste' AND e.policy_snapshot->'waste_billable'='false'::jsonb) THEN
    IF e.quantity*d.unit_price<>round(e.quantity*d.unit_price,(SELECT amount_decimals FROM rs_pharmacy_bindings WHERE tenant_id=t AND drug_id=d.drug_id AND state='active')) THEN RAISE EXCEPTION 'Kredit custody melebihi presisi nominal; gunakan quantity sesuai satuan minor';END IF;
    source_result:=tagihan_posting('rs_medication_custody_events',e.id,'Obat & BHP','Kredit obat custody #'||e.id,-e.quantity,d.unit_price,ctx.admission_id,stay.id,current_app_name());IF source_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Source kredit obat gagal';END IF;
    UPDATE rs_medication_custody_events SET source_charge_id=(SELECT id FROM inpatient_charges WHERE ref_tabel='rs_medication_custody_events' AND ref_id=e.id AND dibatalkan_at IS NULL) WHERE id=e.id;
   END IF;
   UPDATE rs_medication_custody_events SET state='posted' WHERE id=e.id RETURNING * INTO e;
  END IF;
 END IF;
 result_value:=to_jsonb(e);INSERT INTO rs_pharmacy_events(tenant_id,actor_id,action,ref_id,reason,before_row,after_row) VALUES(t,a,'custody.'||p_action,e.id,p_data->>'reason',before_value,result_value);INSERT INTO rs_pharmacy_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
CREATE POLICY rs_medication_custody_read ON rs_medication_custody_events FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-ward-pharmacy'));
GRANT SELECT ON rs_medication_custody_events TO authenticated;
REVOKE ALL ON FUNCTION rs_medication_custody_command(text,jsonb,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION rs_medication_custody_command(text,jsonb,text) TO authenticated;
COMMIT;
