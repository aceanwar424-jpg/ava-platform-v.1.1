-- OWNED_BY: generic. Signed physician decision drives the actual inpatient discharge; source history preserved.
BEGIN;
CREATE TABLE rs_discharge_executions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),stay_id bigint NOT NULL REFERENCES inpatient_stays(id),clinical_record_id bigint NOT NULL UNIQUE REFERENCES rs_clinical_records(id),policy_snapshot jsonb NOT NULL,source_snapshot jsonb NOT NULL,request_key text NOT NULL,actor_id uuid NOT NULL,state text NOT NULL CHECK(state IN ('posting','posted')),source_discharge_id bigint REFERENCES inpatient_discharges(id),result jsonb,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,request_key),UNIQUE(stay_id));
ALTER TABLE rs_discharge_executions ENABLE ROW LEVEL SECURITY;REVOKE ALL ON rs_discharge_executions FROM PUBLIC,anon,authenticated;
CREATE POLICY rs_discharge_execution_read ON rs_discharge_executions FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-discharge') AND EXISTS(SELECT 1 FROM rs_clinical_records c WHERE c.id=clinical_record_id AND rs_clinical_can_read(c.policy_id)));GRANT SELECT ON rs_discharge_executions TO authenticated;
ALTER FUNCTION inp_discharge_patient(bigint,text,text,text,text,text,text,text,text,text,date,text) RENAME TO inp_discharge_patient_before_signed_decision;
REVOKE ALL ON FUNCTION inp_discharge_patient_before_signed_decision(bigint,text,text,text,text,text,text,text,text,text,date,text) FROM PUBLIC,anon,authenticated;
-- Preserve the source implementation, but identify its actual signing physician instead of an old DPJP label.
DO $$DECLARE body text;BEGIN SELECT pg_get_functiondef('inp_discharge_patient_before_signed_decision(bigint,text,text,text,text,text,text,text,text,text,date,text)'::regprocedure) INTO body;
 IF position('coalesce(v_stay.dpjp_name, v_name)' IN body)=0 THEN RAISE EXCEPTION 'Discharge physician source contract changed';END IF;
 EXECUTE replace(body,'coalesce(v_stay.dpjp_name, v_name)','v_name');END $$;
CREATE FUNCTION inp_discharge_patient(p_stay_id bigint,p_discharge_type text DEFAULT 'Pulang',p_final_diagnosis text DEFAULT NULL,p_final_icd text DEFAULT NULL,p_secondary text DEFAULT NULL,p_procedures text DEFAULT NULL,p_summary text DEFAULT NULL,p_medication text DEFAULT NULL,p_instruction text DEFAULT NULL,p_condition text DEFAULT 'Membaik',p_follow_up_date date DEFAULT NULL,p_referred_to text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM ops_actor();
 IF NOT EXISTS(SELECT 1 FROM inpatient_stays WHERE id=p_stay_id AND tenant_id=current_tenant_id()) THEN RAISE EXCEPTION 'Stay bukan milik tenant';END IF;
 IF EXISTS(SELECT 1 FROM inpatient_stays s JOIN rs_encounter_lifecycle lifecycle ON lifecycle.admission_id=s.admission_id WHERE s.id=p_stay_id) THEN RAISE EXCEPTION 'Visit episode engine wajib keputusan dokter signed melalui discharge command';END IF;
 RETURN inp_discharge_patient_before_signed_decision(p_stay_id,p_discharge_type,p_final_diagnosis,p_final_icd,p_secondary,p_procedures,p_summary,p_medication,p_instruction,p_condition,p_follow_up_date,p_referred_to);
END $$;
CREATE FUNCTION rs_inpatient_discharge_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;execution rs_discharge_executions;stay inpatient_stays;record rs_clinical_records;policy ops_policy_versions;field_name text;source_result jsonb;type_value text;
BEGIN
 a:=ops_actor(ARRAY['dokter','doctor']);
 IF p_action IS DISTINCT FROM 'execute' OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Action/input/key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO execution FROM rs_discharge_executions WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF execution.actor_id<>a OR execution.source_snapshot->'request' IS DISTINCT FROM p_data THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN execution.result;END IF;
 SELECT * INTO stay FROM inpatient_stays WHERE id=(p_data->>'stay_id')::bigint AND tenant_id=t FOR UPDATE;
 IF stay.id IS NULL OR stay.status<>'Dirawat' OR p_data->'source_stay_snapshot' IS DISTINCT FROM to_jsonb(stay) THEN RAISE EXCEPTION 'Stay sumber tidak aktif/berubah; muat ulang snapshot';END IF;
 PERFORM 1 FROM admissions WHERE id=stay.admission_id AND tenant_id=t FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM rs_care_episodes WHERE admission_id=stay.admission_id AND tenant_id=t AND state='active') OR NOT EXISTS(SELECT 1 FROM rs_encounter_lifecycle WHERE admission_id=stay.admission_id AND tenant_id=t AND state='open') OR NOT EXISTS(SELECT 1 FROM rs_billing_setups WHERE stay_id=stay.id AND tenant_id=t AND state='active') THEN RAISE EXCEPTION 'Episode/encounter dan setup billing sumber aktif wajib';END IF;
 SELECT * INTO record FROM rs_clinical_records WHERE id=(p_data->>'clinical_record_id')::bigint AND tenant_id=t AND admission_id=stay.admission_id AND signed_at IS NOT NULL FOR SHARE;
 SELECT * INTO policy FROM ops_policy_versions WHERE id=record.policy_id AND tenant_id=t;
 IF record.id IS NULL OR record.signed_by IS DISTINCT FROM a OR policy.kind IS DISTINCT FROM 'clinical_template' OR policy.scope IS DISTINCT FROM 'rs-discharge' OR policy.payload->>'purpose' IS DISTINCT FROM 'inpatient_discharge' OR jsonb_typeof(policy.payload->'signer_roles') IS DISTINCT FROM 'array' OR jsonb_array_length(policy.payload->'signer_roles')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(policy.payload->'signer_roles') role_name WHERE role_name NOT IN ('dokter','doctor')) OR EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=record.id AND signed_at IS NOT NULL) OR record.created_at<(stay.admitted_at AT TIME ZONE (SELECT source_timezone FROM rs_billing_setups WHERE stay_id=stay.id AND tenant_id=t AND state='active')) OR EXISTS(SELECT 1 FROM rs_clinical_records newer JOIN ops_policy_versions np ON np.id=newer.policy_id WHERE newer.tenant_id=t AND newer.admission_id=stay.admission_id AND newer.signed_at IS NOT NULL AND np.scope='rs-discharge' AND np.payload->>'purpose'='inpatient_discharge' AND (newer.created_at,newer.id)>(record.created_at,record.id)) THEN RAISE EXCEPTION 'Keputusan dokter signed terkini milik encounter dan SOP discharge wajib';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=policy.payload->>'timezone') OR jsonb_typeof(policy.payload->'decision_valid_minutes') IS DISTINCT FROM 'number' OR (policy.payload->>'decision_valid_minutes')::numeric<=0 OR record.signed_at<clock_timestamp()-make_interval(secs => 60*(policy.payload->>'decision_valid_minutes')::double precision) THEN RAISE EXCEPTION 'Timezone/masa berlaku keputusan SOP wajib atau keputusan kedaluwarsa';END IF;
 PERFORM set_config('TimeZone',policy.payload->>'timezone',true);PERFORM ops_assert_permission('rs-discharge','clinical.discharge.execute');
 FOR field_name IN SELECT unnest(ARRAY['final_diagnosis','treatment_summary','discharge_medication','discharge_instruction','condition_on_discharge','exit_kind']) LOOP IF jsonb_typeof(record.form_values->field_name) IS DISTINCT FROM 'string' OR coalesce(length(trim(record.form_values->>field_name)),0)=0 THEN RAISE EXCEPTION 'Field keputusan eksplisit wajib: %',field_name;END IF;END LOOP;
 type_value:=CASE record.form_values->>'exit_kind' WHEN 'discharge' THEN 'Pulang' WHEN 'referral' THEN 'Dirujuk' WHEN 'death' THEN 'Meninggal' WHEN 'dama' THEN 'Pulang APS' END;
 IF type_value IS NULL OR type_value='Dirujuk' AND coalesce(length(trim(record.form_values->>'referred_to')),0)=0 THEN RAISE EXCEPTION 'Disposition/tujuan rujukan dokter wajib';END IF;
 INSERT INTO rs_discharge_executions(tenant_id,stay_id,clinical_record_id,policy_snapshot,source_snapshot,request_key,actor_id,state,reason) VALUES(t,stay.id,record.id,policy.payload,jsonb_build_object('request',p_data,'stay',to_jsonb(stay),'record',to_jsonb(record)),p_key,a,'posting',p_data->>'reason') RETURNING * INTO execution;
 -- Legacy inpatient timestamps are without timezone; execute that source in its reviewed billing source timezone.
 PERFORM set_config('TimeZone',(SELECT source_timezone FROM rs_billing_setups WHERE stay_id=stay.id AND tenant_id=t AND state='active'),true);
 source_result:=inp_discharge_patient_before_signed_decision(stay.id,type_value,record.form_values->>'final_diagnosis',record.form_values->>'final_icd',record.form_values->>'secondary_diagnosis',record.form_values->>'procedures',record.form_values->>'treatment_summary',record.form_values->>'discharge_medication',record.form_values->>'discharge_instruction',record.form_values->>'condition_on_discharge',(nullif(record.form_values->>'follow_up_date',''))::date,record.form_values->>'referred_to');
 IF source_result->>'ok' IS DISTINCT FROM 'true' OR source_result->>'discharge_id' IS NULL OR source_result->>'finance_deferred' IS DISTINCT FROM 'true' OR source_result->>'warning' IS NOT NULL THEN RAISE EXCEPTION 'Pemulangan sumber/billing tidak final: %',source_result;END IF;
 UPDATE rs_discharge_executions SET state='posted',source_discharge_id=(source_result->>'discharge_id')::bigint,result=source_result||jsonb_build_object('execution_id',execution.id,'clinical_record_id',record.id) WHERE id=execution.id RETURNING * INTO execution;
 INSERT INTO rs_clinical_events(tenant_id,record_id,actor_id,action) VALUES(t,record.id,a,'discharge.execute');
 RETURN execution.result;
END $$;
CREATE FUNCTION rs_signed_discharge_source_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.discharged_at IS NULL AND NEW.discharged_at IS NOT NULL AND EXISTS(SELECT 1 FROM rs_encounter_lifecycle WHERE admission_id=NEW.admission_id) AND NOT EXISTS(SELECT 1 FROM rs_discharge_executions WHERE tenant_id=NEW.tenant_id AND stay_id=NEW.id AND actor_id=auth.uid() AND state='posting') THEN RAISE EXCEPTION 'Pemulangan episode engine harus melalui keputusan dokter signed';END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_signed_discharge_source_gate BEFORE UPDATE OF discharged_at ON inpatient_stays FOR EACH ROW EXECUTE FUNCTION rs_signed_discharge_source_guard();
CREATE FUNCTION rs_discharge_execution_original_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$BEGIN IF TG_OP='DELETE' OR OLD.state='posted' THEN RAISE EXCEPTION 'Discharge execution original immutable';END IF;RETURN NEW;END $$;
CREATE TRIGGER rs_discharge_execution_immutable BEFORE UPDATE OR DELETE ON rs_discharge_executions FOR EACH ROW EXECUTE FUNCTION rs_discharge_execution_original_guard();
CREATE TRIGGER rs_signed_discharge_original BEFORE UPDATE OR DELETE ON inpatient_discharges FOR EACH ROW EXECUTE FUNCTION rs_pharmacy_signed_metadata_guard();
ALTER TABLE inpatient_discharges ENABLE ROW LEVEL SECURITY;
CREATE POLICY rs_discharge_source_scope ON inpatient_discharges AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM inpatient_stays s WHERE s.id=inpatient_discharges.stay_id AND s.tenant_id=current_tenant_id() AND rs_can_read('rs-discharge')));
REVOKE ALL ON inpatient_discharges FROM PUBLIC,anon;REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON inpatient_discharges FROM authenticated;
REVOKE ALL ON FUNCTION rs_inpatient_discharge_command(text,jsonb,text),inp_discharge_patient(bigint,text,text,text,text,text,text,text,text,text,date,text),rs_signed_discharge_source_guard(),rs_discharge_execution_original_guard() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_signed_discharge_source_guard(),rs_discharge_execution_original_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION rs_inpatient_discharge_command(text,jsonb,text),inp_discharge_patient(bigint,text,text,text,text,text,text,text,text,text,date,text) TO authenticated;
COMMIT;
