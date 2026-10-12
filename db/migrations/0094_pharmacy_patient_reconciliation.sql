-- OWNED_BY: generic. Explicit source allergy ownership and independently reviewed encounter reconciliation.
BEGIN;
CREATE TABLE rs_pharmacy_allergy_scopes(allergy_id bigint PRIMARY KEY REFERENCES patient_allergies(id),tenant_id uuid NOT NULL REFERENCES tenants(id),assigned_by uuid NOT NULL,assigned_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE rs_medication_reconciliations(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),admission_id bigint NOT NULL REFERENCES admissions(id),episode_id bigint NOT NULL REFERENCES rs_care_episodes(id),
 source_identity jsonb NOT NULL,allergy_ids jsonb NOT NULL,allergy_snapshot jsonb NOT NULL,no_known_allergies boolean NOT NULL,timezone text NOT NULL,
 medication_history text NOT NULL,evidence text NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','approved','rejected','revoked')),
 created_by uuid NOT NULL,reviewed_by uuid,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,reason text NOT NULL);
CREATE UNIQUE INDEX rs_one_medication_reconciliation ON rs_medication_reconciliations(admission_id) WHERE state='approved';
CREATE FUNCTION rs_pharmacy_encounter_identity(p_admission bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('admission_id',id,'mr_number',mr_number,'patient_name',patient_name,'patient_gender',patient_gender,'patient_dob',patient_dob) FROM admissions WHERE id=p_admission
$$;
CREATE FUNCTION rs_pharmacy_assert_encounter(p_admission bigint,p_episode bigint) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM admissions a JOIN user_profiles u ON u.id=auth.uid() AND u.tenant_id=a.tenant_id WHERE a.id=p_admission AND a.tenant_id=t) THEN RAISE EXCEPTION 'Admission bukan milik tenant';END IF;
 IF NOT EXISTS(SELECT 1 FROM rs_encounter_lifecycle WHERE admission_id=p_admission AND tenant_id=t AND state='open') OR NOT EXISTS(SELECT 1 FROM rs_care_episodes WHERE admission_id=p_admission AND tenant_id=t AND state='active') THEN RAISE EXCEPTION 'Encounter/episode aktif yang disahkan wajib';END IF;
 IF NOT EXISTS(SELECT 1 FROM rs_care_episodes WHERE id=p_episode AND admission_id=p_admission AND tenant_id=t AND state IN ('active','transferred')) THEN RAISE EXCEPTION 'Episode order tidak sesuai source encounter';END IF;
 IF EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=p_admission AND status<>'Dirawat') AND NOT EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=p_admission AND status='Dirawat') THEN RAISE EXCEPTION 'Source rawat inap sudah pulang';END IF;
END $$;
CREATE FUNCTION rs_pharmacy_allergy_snapshot(p_admission bigint,p_ids jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ids bigint[];result_value jsonb;mr_value text;
BEGIN
 IF jsonb_typeof(p_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ids)>1000 THEN RAISE EXCEPTION 'Daftar sumber alergi eksplisit wajib';END IF;
 SELECT mr_number INTO mr_value FROM admissions WHERE id=p_admission;SELECT array_agg(value::bigint) INTO ids FROM jsonb_array_elements_text(p_ids);
 IF EXISTS(SELECT 1 FROM rs_pharmacy_allergy_scopes WHERE allergy_id=ANY(ids) AND tenant_id<>current_tenant_id()) THEN RAISE EXCEPTION 'Source alergi milik tenant lain';END IF;
 IF cardinality(ids) IS NOT NULL AND cardinality(ids)<>(SELECT count(DISTINCT value)::integer FROM unnest(ids) value) THEN RAISE EXCEPTION 'ID sumber alergi duplikat';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ids) src(id) LEFT JOIN patient_allergies a ON a.id=src.id WHERE a.id IS NULL OR a.mr_number IS DISTINCT FROM mr_value OR NOT coalesce(a.is_active,true)) THEN RAISE EXCEPTION 'Source alergi tidak sesuai identitas pasien/aktif';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') INTO result_value FROM patient_allergies a WHERE a.id=ANY(ids);RETURN result_value;
END $$;
CREATE FUNCTION rs_medication_reconciliation_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;m rs_medication_reconciliations;r rs_pharmacy_requests;adm bigint;episode_value bigint;zone_value text;allergy_value jsonb;selected_allergy bigint;
 input_value jsonb:=jsonb_build_object('reconciliation_action',p_action,'data',p_data);result_value jsonb;before_value jsonb;
BEGIN
 a:=ops_actor(ARRAY['dokter','doctor','pharmacist','apoteker','nurse','perawat']);
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Input/key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_pharmacy_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN r.result;END IF;
 IF p_action='create' THEN adm:=(p_data->>'admission_id')::bigint;episode_value:=(p_data->>'episode_id')::bigint;zone_value:=p_data->>'timezone';
 ELSE SELECT * INTO m FROM rs_medication_reconciliations WHERE id=(p_data->>'id')::bigint AND tenant_id=t;IF m.id IS NULL THEN RAISE EXCEPTION 'Rekonsiliasi bukan milik tenant';END IF;adm:=m.admission_id;episode_value:=m.episode_id;zone_value:=m.timezone;END IF;
 PERFORM 1 FROM inpatient_stays WHERE admission_id=adm AND tenant_id=t AND status='Dirawat' ORDER BY id FOR UPDATE;
 PERFORM 1 FROM admissions WHERE id=adm AND tenant_id=t FOR UPDATE;PERFORM rs_pharmacy_assert_encounter(adm,episode_value);
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=zone_value) THEN RAISE EXCEPTION 'Timezone rekonsiliasi eksplisit wajib';END IF;PERFORM set_config('TimeZone',zone_value,true);
 PERFORM ops_assert_permission('rs-ward-pharmacy','clinical.pharmacy.reconcile.'||p_action);
 IF m.id IS NOT NULL THEN SELECT * INTO m FROM rs_medication_reconciliations WHERE id=m.id FOR UPDATE;END IF;before_value:=to_jsonb(m);
 IF p_action='create' THEN
  IF p_data->'no_known_allergies'='false'::jsonb AND jsonb_typeof(p_data->'allergy_ids')='array' AND jsonb_array_length(p_data->'allergy_ids')=0 THEN RAISE EXCEPTION 'Status alergi belum dikonfirmasi; sumber allergy diketahui atau asesmen no-known eksplisit wajib';END IF;
  IF jsonb_typeof(p_data->'no_known_allergies') IS DISTINCT FROM 'boolean' OR coalesce(length(trim(p_data->>'medication_history')),0)<5 OR coalesce(length(trim(p_data->>'evidence')),0)<5 THEN RAISE EXCEPTION 'Status alergi, riwayat obat dan bukti eksplisit wajib';END IF;
  allergy_value:=rs_pharmacy_allergy_snapshot(adm,p_data->'allergy_ids');
  IF (p_data->>'no_known_allergies')::boolean IS DISTINCT FROM (jsonb_array_length(allergy_value)=0) THEN RAISE EXCEPTION 'Status alergi tidak konsisten dengan source yang dipilih';END IF;
  INSERT INTO rs_medication_reconciliations(tenant_id,admission_id,episode_id,source_identity,allergy_ids,allergy_snapshot,no_known_allergies,timezone,medication_history,evidence,created_by,reason)
  VALUES(t,adm,episode_value,rs_pharmacy_encounter_identity(adm),p_data->'allergy_ids',allergy_value,(p_data->>'no_known_allergies')::boolean,zone_value,p_data->>'medication_history',p_data->>'evidence',a,p_data->>'reason') RETURNING * INTO m;
 ELSIF p_action IN ('approve','reject','revoke') THEN
  IF m.version IS DISTINCT FROM (p_data->>'version')::integer OR m.state IS DISTINCT FROM (CASE WHEN p_action='revoke' THEN 'approved' ELSE 'draft' END) THEN RAISE EXCEPTION 'Rekonsiliasi berubah/state tidak sesuai';END IF;
  IF m.created_by=a THEN RAISE EXCEPTION 'Reviewer rekonsiliasi harus berbeda';END IF;
  IF p_action='approve' THEN
   PERFORM ops_actor(ARRAY['pharmacist','apoteker','dokter','doctor']);
   IF m.source_identity IS DISTINCT FROM rs_pharmacy_encounter_identity(adm) OR m.allergy_snapshot IS DISTINCT FROM rs_pharmacy_allergy_snapshot(adm,m.allergy_ids) THEN RAISE EXCEPTION 'Source rekonsiliasi berubah; buat draft baru';END IF;
   PERFORM 1 FROM patient_allergies WHERE id IN (SELECT value::bigint FROM jsonb_array_elements_text(m.allergy_ids)) ORDER BY id FOR UPDATE;
   IF m.allergy_snapshot IS DISTINCT FROM rs_pharmacy_allergy_snapshot(adm,m.allergy_ids) THEN RAISE EXCEPTION 'Source alergi berubah saat menunggu lock; buat draft baru';END IF;
   FOR selected_allergy IN SELECT value::bigint FROM jsonb_array_elements_text(m.allergy_ids) ORDER BY value::bigint LOOP
    PERFORM 1 FROM patient_allergies WHERE id=selected_allergy FOR UPDATE;
    IF EXISTS(SELECT 1 FROM rs_pharmacy_allergy_scopes WHERE allergy_id=selected_allergy AND tenant_id<>t) THEN RAISE EXCEPTION 'Source alergi milik tenant lain';END IF;
    INSERT INTO rs_pharmacy_allergy_scopes(allergy_id,tenant_id,assigned_by) VALUES(selected_allergy,t,a) ON CONFLICT(allergy_id) DO NOTHING;
   END LOOP;
   IF EXISTS(SELECT 1 FROM patient_allergies p LEFT JOIN rs_pharmacy_allergy_scopes s ON s.allergy_id=p.id WHERE (s.tenant_id=t OR s.allergy_id IS NULL) AND p.mr_number=m.source_identity->>'mr_number' AND coalesce(p.is_active,true) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(m.allergy_ids) selected(value) WHERE selected.value::bigint=p.id)) THEN RAISE EXCEPTION 'Ada source alergi aktif/ownership legacy yang belum direkonsiliasi';END IF;
  END IF;
  UPDATE rs_medication_reconciliations SET state=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'revoked' END,reviewed_by=a,reviewed_at=now(),version=version+1 WHERE id=m.id RETURNING * INTO m;
 ELSE RAISE EXCEPTION 'Aksi rekonsiliasi tidak dikenal';END IF;
 result_value:=to_jsonb(m);INSERT INTO rs_pharmacy_events(tenant_id,actor_id,action,ref_id,reason,before_row,after_row) VALUES(t,a,'reconciliation.'||p_action,m.id,p_data->>'reason',before_value,result_value);INSERT INTO rs_pharmacy_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
ALTER TABLE rs_pharmacy_allergy_scopes ENABLE ROW LEVEL SECURITY;ALTER TABLE rs_medication_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rs_pharmacy_allergy_scopes,rs_medication_reconciliations FROM PUBLIC,anon,authenticated;
CREATE POLICY rs_medication_reconciliation_read ON rs_medication_reconciliations FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-ward-pharmacy'));GRANT SELECT ON rs_medication_reconciliations TO authenticated;
REVOKE ALL ON FUNCTION rs_pharmacy_encounter_identity(bigint),rs_pharmacy_assert_encounter(bigint,bigint),rs_pharmacy_allergy_snapshot(bigint,jsonb),rs_medication_reconciliation_command(text,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_pharmacy_encounter_identity(bigint),rs_pharmacy_assert_encounter(bigint,bigint),rs_pharmacy_allergy_snapshot(bigint,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION rs_medication_reconciliation_command(text,jsonb,text) TO authenticated;
COMMIT;
