-- OWNED_BY: generic. Scoped source projections and discharge reconciliation; no global stock/price leakage.
BEGIN;
CREATE FUNCTION rs_pharmacy_board(p_admission_id bigint DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();result_value jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','dokter','doctor','pharmacist','apoteker','nurse','perawat']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 IF p_admission_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM admissions WHERE id=p_admission_id AND tenant_id=t) THEN RAISE EXCEPTION 'Admission bukan milik tenant';END IF;
 SELECT jsonb_build_object(
 'tenant_id',t,'admission_id',p_admission_id,'offset',p_offset,
 'encounters',coalesce((SELECT jsonb_agg(row_value) FROM (SELECT jsonb_build_object('id',a.id,'mr_number',a.mr_number,'patient_name',a.patient_name,'visit_number',a.visit_number,'patient_dob',a.patient_dob,'episode_id',e.id,'unit',e.unit_code) row_value FROM admissions a JOIN rs_care_episodes e ON e.admission_id=a.id AND e.tenant_id=t AND e.state='active' WHERE a.tenant_id=t AND (p_admission_id IS NULL OR a.id=p_admission_id) ORDER BY a.id DESC LIMIT 51 OFFSET CASE WHEN p_admission_id IS NULL THEN p_offset ELSE 0 END) selected),'[]'),
 'catalog',coalesce((SELECT jsonb_agg(rs_pharmacy_drug_snapshot(id)) FROM (SELECT id FROM pharmacy_drugs WHERE is_active ORDER BY id LIMIT 51 OFFSET p_offset) drugs),'[]'),
 'bindings',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('drug',rs_pharmacy_drug_snapshot(b.drug_id),'tenant_stock_qty',rs_pharmacy_local_stock(b.drug_id),'batches',(SELECT coalesce(jsonb_agg(to_jsonb(batch)),'[]') FROM pharmacy_batches batch JOIN rs_pharmacy_batch_scopes scope ON scope.batch_id=batch.id WHERE scope.tenant_id=t AND batch.drug_id=b.drug_id))) FROM (SELECT * FROM rs_pharmacy_bindings WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset) b),'[]'),
 'templates',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM ops_policy_versions p WHERE tenant_id=t AND scope='rs-ward-pharmacy' AND kind='clinical_template' AND state='active' AND effective_at<=now()),'[]'),
 'reconciliations',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT * FROM rs_medication_reconciliations WHERE tenant_id=t AND admission_id=p_admission_id ORDER BY id DESC LIMIT 201 OFFSET p_offset) r),'[]'),
 'prescriptions',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('context',to_jsonb(c),'verification',(SELECT to_jsonb(v) FROM rs_prescription_verifications v WHERE v.rx_id=p.id),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]') FROM prescription_items i WHERE rx_id=p.id))) FROM (SELECT * FROM rs_prescription_contexts WHERE tenant_id=t AND admission_id=p_admission_id ORDER BY rx_id DESC LIMIT 201 OFFSET p_offset) c JOIN prescriptions p ON p.id=c.rx_id),'[]'),
 'dispense_items',coalesce((SELECT jsonb_agg(to_jsonb(d)||jsonb_build_object('used',rs_medication_custody_used(d.id),'remaining',d.qty-rs_medication_custody_used(d.id))) FROM pharmacy_dispense_items d JOIN prescription_items i ON i.id=d.rx_item_id JOIN rs_prescription_contexts c ON c.rx_id=i.rx_id WHERE c.tenant_id=t AND c.admission_id=p_admission_id),'[]'),
 'plans',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('source',to_jsonb(j))) FROM rs_mar_plans p JOIN mar_jadwal j ON j.id=p.schedule_id WHERE p.tenant_id=t AND j.admission_id=p_admission_id),'[]'),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('is_head',NOT EXISTS(SELECT 1 FROM rs_mar_events successor WHERE successor.amendment_of=e.id))) FROM rs_mar_events e JOIN mar_jadwal j ON j.id=e.schedule_id WHERE e.tenant_id=t AND j.admission_id=p_admission_id),'[]'),
 'custody',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT event.* FROM rs_medication_custody_events event JOIN pharmacy_dispense_items d ON d.id=event.dispense_item_id JOIN prescription_items i ON i.id=d.rx_item_id JOIN rs_prescription_contexts c ON c.rx_id=i.rx_id WHERE event.tenant_id=t AND c.tenant_id=t AND c.admission_id=p_admission_id ORDER BY event.id DESC LIMIT 201 OFFSET p_offset) e),'[]')
 ) INTO result_value;RETURN result_value;
END $$;
CREATE FUNCTION rs_pharmacy_discharge_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.discharged_at IS NULL AND NEW.discharged_at IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM prescriptions p JOIN rs_prescription_contexts c ON c.rx_id=p.id WHERE c.tenant_id=NEW.tenant_id AND c.admission_id=NEW.admission_id AND p.status='Baru') OR EXISTS(SELECT 1 FROM rs_mar_plans p JOIN mar_jadwal j ON j.id=p.schedule_id WHERE p.tenant_id=NEW.tenant_id AND j.admission_id=NEW.admission_id AND p.state IN ('draft','verified')) OR EXISTS(SELECT 1 FROM pharmacy_dispense_items d JOIN prescription_items i ON i.id=d.rx_item_id JOIN rs_prescription_contexts c ON c.rx_id=i.rx_id WHERE c.tenant_id=NEW.tenant_id AND c.admission_id=NEW.admission_id AND (rs_medication_custody_used(d.id) IS DISTINCT FROM d.qty OR EXISTS(SELECT 1 FROM rs_medication_custody_events e WHERE e.dispense_item_id=d.id AND e.state IN ('draft','posting')))) THEN RAISE EXCEPTION 'Farmasi belum rekonsiliasi: resep/jadwal/sisa obat atau custody draft masih terbuka';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_pharmacy_discharge_gate BEFORE UPDATE OF discharged_at ON inpatient_stays FOR EACH ROW EXECUTE FUNCTION rs_pharmacy_discharge_guard();
REVOKE ALL ON FUNCTION rs_pharmacy_board(bigint,integer),rs_pharmacy_discharge_guard() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_pharmacy_discharge_guard() FROM authenticated;GRANT EXECUTE ON FUNCTION rs_pharmacy_board(bigint,integer) TO authenticated;
COMMIT;
