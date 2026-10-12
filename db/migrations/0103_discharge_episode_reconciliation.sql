-- OWNED_BY: generic. The source inpatient discharge decision also supports final encounter closure.
BEGIN;
DO $$DECLARE body text;anchor text:='id=decision.policy_id AND scope=ep.unit_code';BEGIN
 SELECT pg_get_functiondef('rs_episode_command(text,jsonb,text)'::regprocedure) INTO body;
 IF position(anchor IN body)=0 THEN RAISE EXCEPTION 'Episode decision source contract changed';END IF;
 body:=replace(body,anchor,'id=decision.policy_id AND (scope=ep.unit_code OR p_action=''close'' AND scope=''rs-discharge'' AND EXISTS(SELECT 1 FROM rs_discharge_executions execution JOIN inpatient_stays source ON source.id=execution.stay_id WHERE execution.clinical_record_id=decision.id AND execution.tenant_id=t AND execution.state=''posted'' AND source.admission_id=ep.admission_id AND source.status<>''Dirawat'' AND source.discharged_at IS NOT NULL))');EXECUTE body;
END $$;
CREATE FUNCTION rs_pharmacy_encounter_exit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.state='open' AND NEW.state='closed' THEN
  -- Admission lock serializes this with prescription, MAR and custody source commands.
  PERFORM 1 FROM admissions WHERE id=NEW.admission_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM prescriptions p JOIN rs_prescription_contexts c ON c.rx_id=p.id WHERE c.tenant_id=NEW.tenant_id AND c.admission_id=NEW.admission_id AND p.status='Baru') OR EXISTS(SELECT 1 FROM rs_mar_plans p JOIN mar_jadwal j ON j.id=p.schedule_id WHERE p.tenant_id=NEW.tenant_id AND j.admission_id=NEW.admission_id AND p.state IN ('draft','verified')) OR EXISTS(SELECT 1 FROM pharmacy_dispense_items d JOIN prescription_items i ON i.id=d.rx_item_id JOIN rs_prescription_contexts c ON c.rx_id=i.rx_id WHERE c.tenant_id=NEW.tenant_id AND c.admission_id=NEW.admission_id AND (rs_medication_custody_used(d.id) IS DISTINCT FROM d.qty OR EXISTS(SELECT 1 FROM rs_medication_custody_events e WHERE e.dispense_item_id=d.id AND e.state IN ('draft','posting')))) THEN RAISE EXCEPTION 'Farmasi encounter belum rekonsiliasi';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_pharmacy_encounter_exit BEFORE UPDATE OF state ON rs_encounter_lifecycle FOR EACH ROW EXECUTE FUNCTION rs_pharmacy_encounter_exit_guard();
REVOKE ALL ON FUNCTION rs_pharmacy_encounter_exit_guard() FROM PUBLIC,anon,authenticated;
COMMIT;
