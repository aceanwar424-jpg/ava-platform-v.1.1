-- OWNED_BY: generic. Reviewed local eligibility evidence; never a vendor verification ACK.
BEGIN;
CREATE TABLE rs_payer_eligibilities(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),setup_id bigint NOT NULL REFERENCES rs_billing_setups(id),
 contract_id bigint NOT NULL REFERENCES his_master_records(id),contract_snapshot jsonb NOT NULL,source_identity jsonb NOT NULL,
 evidence_ref text NOT NULL,valid_until date NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','approved','rejected','revoked')),
 created_by uuid NOT NULL,reviewed_by uuid,version integer NOT NULL DEFAULT 1,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz);
CREATE UNIQUE INDEX rs_payer_one_eligibility ON rs_payer_eligibilities(setup_id) WHERE state='approved';
CREATE FUNCTION rs_payer_identity(p_stay bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('stay_id',id,'admission_id',admission_id,'mr_number',mr_number,'guarantor',guarantor) FROM inpatient_stays WHERE id=p_stay
$$;
CREATE FUNCTION rs_payer_eligibility_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;b rs_billing_setups;e rs_payer_eligibilities;c his_master_records;request rs_billing_requests;
 input_value jsonb:=jsonb_build_object('payer_eligibility_action',p_action,'data',p_data);before_value jsonb;result_value jsonb;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);PERFORM ops_assert_permission('rs-inpatient-billing','billing.payer.'||p_action);
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR coalesce(length(trim(p_data->>'reason')),0)<3 OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 THEN RAISE EXCEPTION 'Input/key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO request FROM rs_billing_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF request.actor_id<>a OR request.input<>input_value THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN request.result;END IF;
 IF p_action='create' THEN SELECT * INTO b FROM rs_billing_setups WHERE id=(p_data->>'setup_id')::bigint AND tenant_id=t;
 ELSE SELECT * INTO e FROM rs_payer_eligibilities WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO b FROM rs_billing_setups WHERE id=e.setup_id AND tenant_id=t;END IF;
 IF b.id IS NULL OR b.state<>'active' THEN RAISE EXCEPTION 'Setup bukan milik tenant/tidak aktif';END IF;
 PERFORM 1 FROM inpatient_stays WHERE id=b.stay_id AND tenant_id=t FOR UPDATE;SELECT * INTO b FROM rs_billing_setups WHERE id=b.id FOR UPDATE;
 IF e.id IS NOT NULL THEN SELECT * INTO e FROM rs_payer_eligibilities WHERE id=e.id FOR UPDATE;END IF;before_value:=to_jsonb(e);
 IF p_action IN ('create','approve') THEN
  SELECT * INTO c FROM his_master_records WHERE id=CASE WHEN p_action='create' THEN (p_data->>'contract_id')::bigint ELSE e.contract_id END AND tenant_id=t FOR SHARE;
  IF c.id IS NULL OR c.domain_key<>'corporate_contract' OR c.status<>'active' OR c.effective_from IS NULL OR c.effective_to IS NULL OR current_date NOT BETWEEN c.effective_from AND c.effective_to THEN RAISE EXCEPTION 'Kontrak aktif dengan periode eksplisit wajib';END IF;
  IF c.payload->>'payer_type' IS NULL OR c.payload->>'payer_type' NOT IN ('BPJS','Asuransi','Korporat') OR c.payload->>'payer_type' IS DISTINCT FROM rs_payer_identity(b.stay_id)->>'guarantor' THEN RAISE EXCEPTION 'Penjamin kontrak tidak sesuai identitas source';END IF;
  PERFORM rs_payer_benefit_quote(c.payload,'[]', (b.policy_snapshot->>'amount_decimals')::integer);
 END IF;
 IF p_action='create' THEN
  IF coalesce(length(trim(p_data->>'evidence_ref')),0)<3 OR (p_data->>'valid_until')::date IS NULL OR (p_data->>'valid_until')::date NOT BETWEEN current_date AND c.effective_to THEN RAISE EXCEPTION 'Bukti eligibility dan masa berlaku dalam kontrak wajib';END IF;
  INSERT INTO rs_payer_eligibilities(tenant_id,setup_id,contract_id,contract_snapshot,source_identity,evidence_ref,valid_until,created_by,reason)
  VALUES(t,b.id,c.id,to_jsonb(c),rs_payer_identity(b.stay_id),p_data->>'evidence_ref',(p_data->>'valid_until')::date,a,p_data->>'reason') RETURNING * INTO e;
 ELSIF p_action IN ('approve','reject','revoke') THEN
  IF e.version IS DISTINCT FROM (p_data->>'version')::integer OR e.state IS DISTINCT FROM (CASE WHEN p_action='revoke' THEN 'approved' ELSE 'draft' END) THEN RAISE EXCEPTION 'Eligibility berubah/state tidak sesuai';END IF;
  IF e.created_by=a THEN RAISE EXCEPTION 'Reviewer eligibility harus berbeda';END IF;
  IF p_action='approve' AND (e.contract_snapshot IS DISTINCT FROM to_jsonb(c) OR e.source_identity IS DISTINCT FROM rs_payer_identity(b.stay_id) OR e.valid_until<current_date) THEN RAISE EXCEPTION 'Kontrak/identitas berubah atau eligibility kedaluwarsa';END IF;
  UPDATE rs_payer_eligibilities SET state=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'revoked' END,reviewed_by=a,reviewed_at=now(),version=version+1 WHERE id=e.id RETURNING * INTO e;
 ELSE RAISE EXCEPTION 'Aksi eligibility tidak dikenal';END IF;
 result_value:=to_jsonb(e);INSERT INTO rs_billing_events(tenant_id,setup_id,actor_id,action,evidence,before_row,after_row) VALUES(t,b.id,a,'payer.'||p_action,p_data,before_value,result_value);INSERT INTO rs_billing_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
ALTER TABLE rs_payer_eligibilities ENABLE ROW LEVEL SECURITY;REVOKE ALL ON rs_payer_eligibilities FROM PUBLIC,anon,authenticated;
CREATE POLICY rs_payer_eligibility_read ON rs_payer_eligibilities FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));
GRANT SELECT ON rs_payer_eligibilities TO authenticated;
REVOKE ALL ON FUNCTION rs_payer_identity(bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rs_payer_eligibility_command(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_payer_eligibility_command(text,jsonb,text) TO authenticated;
COMMIT;
