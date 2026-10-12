-- OWNED_BY: generic. Only the checked source workflow can change operational status on signed Rx originals.
BEGIN;
CREATE TABLE rs_pharmacy_execution_contexts(transaction_id bigint PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),actor_id uuid NOT NULL,purpose text NOT NULL,rx_id bigint,admission_id bigint NOT NULL REFERENCES admissions(id));
ALTER TABLE rs_pharmacy_execution_contexts ENABLE ROW LEVEL SECURITY;REVOKE ALL ON rs_pharmacy_execution_contexts FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_prescription_original_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c rs_prescription_contexts;e rs_pharmacy_execution_contexts;
BEGIN
 IF TG_TABLE_NAME='prescriptions' THEN SELECT * INTO c FROM rs_prescription_contexts WHERE rx_id=OLD.id;
 ELSE SELECT * INTO c FROM rs_prescription_contexts WHERE rx_id=OLD.rx_id;END IF;
 IF c.rx_id IS NULL THEN IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Original resep signed immutable; gunakan cancel/amendment';END IF;
 SELECT * INTO e FROM rs_pharmacy_execution_contexts WHERE transaction_id=txid_current() AND tenant_id=c.tenant_id AND actor_id=auth.uid() AND rx_id=c.rx_id AND admission_id=c.admission_id;
 IF e.purpose IS NULL THEN RAISE EXCEPTION 'Original resep signed immutable; gunakan workflow sumber';END IF;
 IF TG_TABLE_NAME='prescription_items' THEN
  IF e.purpose<>'dispense' OR to_jsonb(NEW)-'qty_dispensed' IS DISTINCT FROM to_jsonb(OLD)-'qty_dispensed' OR NEW.qty_dispensed IS DISTINCT FROM OLD.qty THEN RAISE EXCEPTION 'Item resep signed immutable';END IF;
 ELSE
  IF e.purpose='dispense' THEN
   IF OLD.status<>'Baru' OR NEW.status<>'Diserahkan' OR to_jsonb(NEW)-ARRAY['status','updated_at'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['status','updated_at'] THEN RAISE EXCEPTION 'Perubahan resep hanya status source dispensing';END IF;
  ELSIF e.purpose='cancel' THEN
   IF OLD.status<>'Baru' OR NEW.status<>'Dibatalkan' OR to_jsonb(NEW)-ARRAY['status','cancel_reason','updated_at'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['status','cancel_reason','updated_at'] THEN RAISE EXCEPTION 'Perubahan resep hanya cancel beralasan';END IF;
  ELSE RAISE EXCEPTION 'Original resep signed immutable';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_prescription_original_guard BEFORE UPDATE OR DELETE ON prescriptions FOR EACH ROW EXECUTE FUNCTION rs_prescription_original_guard();
CREATE TRIGGER rs_prescription_item_original_guard BEFORE UPDATE OR DELETE ON prescription_items FOR EACH ROW EXECUTE FUNCTION rs_prescription_original_guard();
CREATE FUNCTION rs_pharmacy_signed_metadata_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$BEGIN RAISE EXCEPTION 'Metadata klinis signed immutable';END $$;
CREATE TRIGGER rs_prescription_context_immutable BEFORE UPDATE OR DELETE ON rs_prescription_contexts FOR EACH ROW EXECUTE FUNCTION rs_pharmacy_signed_metadata_guard();
CREATE TRIGGER rs_prescription_verification_immutable BEFORE UPDATE OR DELETE ON rs_prescription_verifications FOR EACH ROW EXECUTE FUNCTION rs_pharmacy_signed_metadata_guard();
DO $$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('rs_pharmacy_rx_command(text,jsonb,text)'::regprocedure) INTO body;
 IF position('source_result:=rx_dispense_prescription_before_rs_pharmacy' IN body)=0 OR position('source_result:=rx_cancel_prescription_before_rs_pharmacy' IN body)=0 THEN RAISE EXCEPTION 'Rx workflow source contract changed';END IF;
 body:=replace(body,'source_result:=rx_dispense_prescription_before_rs_pharmacy','INSERT INTO rs_pharmacy_execution_contexts VALUES(txid_current(),t,a,''dispense'',rx.id,adm.id);source_result:=rx_dispense_prescription_before_rs_pharmacy');
 body:=replace(body,'source_result:=rx_cancel_prescription_before_rs_pharmacy','INSERT INTO rs_pharmacy_execution_contexts VALUES(txid_current(),t,a,''cancel'',rx.id,adm.id);source_result:=rx_cancel_prescription_before_rs_pharmacy');
 body:=replace(body,'result_value:=source_result||','DELETE FROM rs_pharmacy_execution_contexts WHERE transaction_id=txid_current();result_value:=source_result||');EXECUTE body;
END $$;
REVOKE ALL ON FUNCTION rs_prescription_original_guard(),rs_pharmacy_signed_metadata_guard() FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON prescriptions,prescription_items,pharmacy_dispenses,pharmacy_dispense_items,pharmacy_stock_ledger,narcotic_register FROM PUBLIC,anon,authenticated;
COMMIT;
