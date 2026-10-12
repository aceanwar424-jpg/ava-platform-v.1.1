-- OWNED_BY: generic. Keep source clinical originals and restrict legacy global pharmacy reads.
BEGIN;
CREATE FUNCTION rs_mar_original_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p rs_mar_plans;c rs_prescription_contexts;e rs_pharmacy_execution_contexts;
BEGIN
 IF TG_TABLE_NAME='mar_pemberian' THEN RAISE EXCEPTION 'MAR sumber immutable; gunakan amendment append-only';END IF;
 SELECT * INTO p FROM rs_mar_plans WHERE schedule_id=OLD.id;
 IF p.schedule_id IS NULL THEN IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END IF;
 SELECT c0.* INTO c FROM rs_prescription_contexts c0 JOIN prescription_items i ON i.rx_id=c0.rx_id WHERE i.id=p.rx_item_id;
 SELECT * INTO e FROM rs_pharmacy_execution_contexts WHERE transaction_id=txid_current() AND actor_id=auth.uid() AND tenant_id=c.tenant_id AND admission_id=c.admission_id AND rx_id=c.rx_id AND purpose='mar';
 IF TG_OP='DELETE' OR e.transaction_id IS NULL OR to_jsonb(NEW)-ARRAY['status','alasan_henti','updated_at'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['status','alasan_henti','updated_at'] OR NOT (OLD.status='Draf' AND NEW.status IN ('Aktif','Dihentikan') OR OLD.status='Aktif' AND NEW.status='Dihentikan') THEN RAISE EXCEPTION 'Jadwal original immutable; gunakan workflow dokter/apoteker';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rs_mar_source_original BEFORE UPDATE OR DELETE ON mar_pemberian FOR EACH ROW EXECUTE FUNCTION rs_mar_original_guard();
CREATE TRIGGER rs_mar_schedule_original BEFORE UPDATE OR DELETE ON mar_jadwal FOR EACH ROW EXECUTE FUNCTION rs_mar_original_guard();
ALTER FUNCTION rs_mar_command(text,jsonb,text) RENAME TO rs_mar_command_before_original_guard;
REVOKE ALL ON FUNCTION rs_mar_command_before_original_guard(text,jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_mar_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c rs_prescription_contexts;r jsonb;
BEGIN
 IF p_action='schedule' THEN
  SELECT ctx.* INTO c FROM rs_prescription_contexts ctx JOIN prescription_items i ON i.rx_id=ctx.rx_id JOIN rs_clinical_records record ON i.id=(record.form_values->>'rx_item_id')::bigint WHERE record.id=(p_data->>'clinical_record_id')::bigint AND record.tenant_id=current_tenant_id() AND ctx.tenant_id=current_tenant_id();
 ELSE
  SELECT ctx.* INTO c FROM rs_prescription_contexts ctx JOIN prescription_items i ON i.rx_id=ctx.rx_id JOIN rs_mar_plans plan ON plan.rx_item_id=i.id WHERE plan.schedule_id=(p_data->>'schedule_id')::bigint AND plan.tenant_id=current_tenant_id() AND ctx.tenant_id=current_tenant_id();
 END IF;
 IF c.rx_id IS NULL THEN RAISE EXCEPTION 'Jadwal/resep bukan milik tenant';END IF;
 INSERT INTO rs_pharmacy_execution_contexts VALUES(txid_current(),c.tenant_id,auth.uid(),'mar',c.rx_id,c.admission_id);
 r:=rs_mar_command_before_original_guard(p_action,p_data,p_key);
 DELETE FROM rs_pharmacy_execution_contexts WHERE transaction_id=txid_current();RETURN r;
END $$;
-- Retain explicit integer precision and independent physician-signed correction requirements.
DO $$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('rs_mar_command_before_original_guard(text,jsonb,text)'::regprocedure) INTO body;
 IF position('correction_policy.scope' IN body)=0 THEN RAISE EXCEPTION 'MAR correction source contract changed';END IF;
 body:=replace(body,'correction_policy.scope<>','correction_policy.kind<>''clinical_template'' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(correction_policy.payload->''signer_roles'') role_name WHERE role_name NOT IN (''dokter'',''doctor'')) OR correction_policy.scope<>');
 body:=replace(body,'(policy.payload->>''administration_qty_decimals'')::integer NOT BETWEEN 0 AND 6','(policy.payload->>''administration_qty_decimals'')::numeric<>trunc((policy.payload->>''administration_qty_decimals'')::numeric) OR (policy.payload->>''administration_qty_decimals'')::numeric NOT BETWEEN 0 AND 6');EXECUTE body;
END $$;
CREATE FUNCTION rs_medication_custody_original_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF TG_OP='DELETE' OR OLD.state IN ('posted','rejected') THEN RAISE EXCEPTION 'Custody original immutable';END IF;RETURN NEW;END $$;
CREATE TRIGGER rs_medication_custody_original BEFORE UPDATE OR DELETE ON rs_medication_custody_events FOR EACH ROW EXECUTE FUNCTION rs_medication_custody_original_guard();
CREATE TRIGGER rs_dispense_item_original BEFORE UPDATE OR DELETE ON pharmacy_dispense_items FOR EACH ROW EXECUTE FUNCTION rs_pharmacy_signed_metadata_guard();
-- Direct legacy table reads include global stock, pricing and cross-tenant MR numbers.
-- Read only through the scoped source board; source functions execute as their owner.
REVOKE SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON pharmacy_drugs,pharmacy_batches,pharmacy_stock_ledger,narcotic_register,prescriptions,prescription_items,pharmacy_dispenses,pharmacy_dispense_items,mar_jadwal,mar_pemberian FROM PUBLIC,anon,authenticated;
DO $$DECLARE v record;BEGIN
 FOR v IN SELECT DISTINCT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_rewrite rw ON rw.ev_class=c.oid JOIN pg_depend dep ON dep.objid=rw.oid JOIN pg_class src ON src.oid=dep.refobjid WHERE n.nspname='public' AND c.relkind IN ('v','m') AND src.relname IN ('pharmacy_drugs','pharmacy_batches','pharmacy_stock_ledger','narcotic_register','prescriptions','prescription_items','pharmacy_dispenses','pharmacy_dispense_items','mar_jadwal','mar_pemberian') LOOP
 EXECUTE format('REVOKE SELECT ON %I.%I FROM PUBLIC,anon,authenticated',v.nspname,v.relname);END LOOP;
END $$;
CREATE OR REPLACE VIEW mar_papan WITH (security_barrier=true) AS
SELECT j.id AS jadwal_id,j.admission_id,j.patient_name,j.mr_number,j.nama_obat,j.dosis,j.rute,j.frekuensi,j.jam_pemberian,j.mulai_tgl,j.sampai_tgl,j.status,j.diresepkan_oleh,
(SELECT count(*) FROM rs_mar_events e WHERE e.schedule_id=j.id AND e.outcome='Diberikan' AND NOT EXISTS(SELECT 1 FROM rs_mar_events next WHERE next.amendment_of=e.id)) AS jml_diberikan,
(SELECT count(*) FROM rs_mar_events e WHERE e.schedule_id=j.id AND e.outcome<>'Diberikan' AND NOT EXISTS(SELECT 1 FROM rs_mar_events next WHERE next.amendment_of=e.id)) AS jml_tidak_diberikan,
(SELECT max(e.given_at) AT TIME ZONE current_setting('TimeZone') FROM rs_mar_events e WHERE e.schedule_id=j.id AND e.outcome='Diberikan' AND NOT EXISTS(SELECT 1 FROM rs_mar_events next WHERE next.amendment_of=e.id)) AS terakhir_diberikan
FROM mar_jadwal j JOIN rs_mar_plans p ON p.schedule_id=j.id WHERE p.tenant_id=current_tenant_id() AND rs_can_read('rs-ward-pharmacy');
REVOKE ALL ON mar_papan FROM PUBLIC,anon;GRANT SELECT ON mar_papan TO authenticated;
REVOKE ALL ON FUNCTION rs_mar_original_guard(),rs_medication_custody_original_guard(),rs_mar_command(text,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_mar_original_guard(),rs_medication_custody_original_guard() FROM authenticated;GRANT EXECUTE ON FUNCTION rs_mar_command(text,jsonb,text) TO authenticated;
COMMIT;
