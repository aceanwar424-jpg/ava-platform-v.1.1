-- OWNED_BY: generic. Approved benefit transfers the invoice receivable; no second revenue entry.
BEGIN;
CREATE TABLE rs_payer_claims(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),setup_id bigint NOT NULL REFERENCES rs_billing_setups(id),invoice_id bigint NOT NULL REFERENCES rs_final_invoices(id),eligibility_id bigint NOT NULL REFERENCES rs_payer_eligibilities(id),
 eligibility_snapshot jsonb NOT NULL,quote jsonb NOT NULL,amount numeric NOT NULL CHECK(amount>0),event_key text NOT NULL,cost_center text NOT NULL,accounting_snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','posting','posted','rejected','voiding','voided')),created_by uuid NOT NULL,reviewed_by uuid,version integer NOT NULL DEFAULT 1,reason text NOT NULL,
 journal_id bigint REFERENCES journal_entries(id),reversal_id bigint REFERENCES journal_entries(id),created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz);
CREATE UNIQUE INDEX rs_payer_one_claim ON rs_payer_claims(invoice_id) WHERE state IN ('posting','posted','voiding');
ALTER TABLE rs_payer_claims ENABLE ROW LEVEL SECURITY;REVOKE ALL ON rs_payer_claims FROM PUBLIC,anon,authenticated;
CREATE POLICY rs_payer_claim_read ON rs_payer_claims FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));GRANT SELECT ON rs_payer_claims TO authenticated;
CREATE FUNCTION rs_payer_invoice_quote(p_invoice bigint,p_eligibility bigint) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE i rs_final_invoices;e rs_payer_eligibilities;b rs_billing_setups;rows_value jsonb;
BEGIN
 SELECT * INTO i FROM rs_final_invoices WHERE id=p_invoice;SELECT * INTO e FROM rs_payer_eligibilities WHERE id=p_eligibility;SELECT * INTO b FROM rs_billing_setups WHERE id=i.setup_id;
 IF i.id IS NULL OR i.state<>'posted' OR e.id IS NULL OR e.state<>'approved' OR e.setup_id IS DISTINCT FROM i.setup_id OR e.tenant_id IS DISTINCT FROM i.tenant_id OR e.valid_until<current_date OR e.source_identity IS DISTINCT FROM rs_payer_identity(b.stay_id) THEN RAISE EXCEPTION 'Invoice/eligibility sumber tidak valid';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'category',charge_type,'amount',amount) ORDER BY id),'[]') INTO rows_value FROM inpatient_charges WHERE stay_id=b.stay_id AND dibatalkan_at IS NULL;
 RETURN rs_payer_benefit_quote(e.contract_snapshot->'payload',rows_value,(b.policy_snapshot->>'amount_decimals')::integer);
END $$;
CREATE FUNCTION rs_payer_claim_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;b rs_billing_setups;i rs_final_invoices;e rs_payer_eligibilities;c rs_payer_claims;r rs_billing_requests;
 input_value jsonb:=jsonb_build_object('payer_claim_action',p_action,'data',p_data);before_value jsonb;result_value jsonb;q jsonb;m jsonb;j jsonb;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);PERFORM ops_assert_permission('rs-inpatient-billing','billing.payer.claim_'||p_action);
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR coalesce(length(trim(p_data->>'reason')),0)<3 OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 THEN RAISE EXCEPTION 'Input/key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_billing_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN r.result;END IF;
 IF p_action='create' THEN SELECT * INTO i FROM rs_final_invoices WHERE id=(p_data->>'invoice_id')::bigint AND tenant_id=t;
 ELSE SELECT * INTO c FROM rs_payer_claims WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO i FROM rs_final_invoices WHERE id=c.invoice_id AND tenant_id=t;END IF;
 SELECT * INTO b FROM rs_billing_setups WHERE id=i.setup_id AND tenant_id=t;IF b.id IS NULL THEN RAISE EXCEPTION 'Invoice bukan milik tenant';END IF;
 PERFORM 1 FROM inpatient_stays WHERE id=b.stay_id FOR UPDATE;SELECT * INTO b FROM rs_billing_setups WHERE id=b.id FOR UPDATE;SELECT * INTO i FROM rs_final_invoices WHERE id=i.id FOR UPDATE;
 IF c.id IS NOT NULL THEN SELECT * INTO c FROM rs_payer_claims WHERE id=c.id FOR UPDATE;END IF;before_value:=to_jsonb(c);
 IF p_action IN ('create','approve') THEN
  SELECT * INTO e FROM rs_payer_eligibilities WHERE id=CASE WHEN p_action='create' THEN (p_data->>'eligibility_id')::bigint ELSE c.eligibility_id END AND tenant_id=t FOR SHARE;
  q:=rs_payer_invoice_quote(i.id,e.id);IF (q->>'total')::numeric IS DISTINCT FROM i.total OR (q->>'payer_amount')::numeric<=0 THEN RAISE EXCEPTION 'Benefit harus positif dan cocok total sumber invoice';END IF;
  IF (q->>'payer_amount')::numeric>rs_cashier_invoice_balance(i.id) THEN RAISE EXCEPTION 'Benefit melebihi saldo pasien; refund pembayaran/alokasi dahulu';END IF;
 END IF;
 IF p_action='create' THEN
  m:=rs_invoice_accounting_snapshot(p_data->>'event_key',p_data->>'cost_center');
  IF m IS NULL OR m->'mapping'->>'credit_code' IS DISTINCT FROM i.accounting_snapshot->'mapping'->>'debit_code' OR m->'mapping'->>'debit_code' IS DISTINCT FROM e.contract_snapshot->'payload'->>'payer_receivable_account' OR m->'mapping'->>'debit_code'=m->'mapping'->>'credit_code' THEN RAISE EXCEPTION 'Mapping wajib piutang penjamin kontrak menuju piutang pasien invoice';END IF;
  INSERT INTO rs_payer_claims(tenant_id,setup_id,invoice_id,eligibility_id,eligibility_snapshot,quote,amount,event_key,cost_center,accounting_snapshot,created_by,reason)
  VALUES(t,b.id,i.id,e.id,to_jsonb(e),q,(q->>'payer_amount')::numeric,p_data->>'event_key',p_data->>'cost_center',m,a,p_data->>'reason') RETURNING * INTO c;
 ELSIF p_action IN ('approve','reject','void') THEN
  IF c.version IS DISTINCT FROM (p_data->>'version')::integer OR c.state IS DISTINCT FROM (CASE WHEN p_action='void' THEN 'posted' ELSE 'draft' END) THEN RAISE EXCEPTION 'Claim berubah/state tidak sesuai';END IF;
  IF c.created_by=a THEN RAISE EXCEPTION 'Reviewer claim harus berbeda';END IF;
  IF p_action='approve' THEN
   IF c.eligibility_snapshot IS DISTINCT FROM to_jsonb(e) OR c.quote IS DISTINCT FROM q OR rs_invoice_accounting_snapshot(c.event_key,c.cost_center) IS DISTINCT FROM c.accounting_snapshot THEN RAISE EXCEPTION 'Snapshot claim berubah';END IF;
   UPDATE rs_payer_claims SET state='posting' WHERE id=c.id;j:=post_journal(c.event_key,c.amount,'Alokasi penjamin #'||c.id,'rs_payer_claim',c.id,c.cost_center,current_date);
   IF j->>'ok' IS DISTINCT FROM 'true' OR j->>'entry_id' IS NULL THEN RAISE EXCEPTION 'Jurnal claim gagal';END IF;
  ELSIF p_action='void' THEN
   IF EXISTS(SELECT 1 FROM accounting_periods WHERE period=to_char(current_date,'YYYY-MM') AND status='Tutup') THEN RAISE EXCEPTION 'Periode reversal ditutup';END IF;
   UPDATE rs_payer_claims SET state='voiding' WHERE id=c.id;j:=reverse_journal(c.journal_id,p_data->>'reason');IF j->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Reversal claim gagal';END IF;
  END IF;
  UPDATE rs_payer_claims SET state=CASE p_action WHEN 'approve' THEN 'posted' WHEN 'reject' THEN 'rejected' ELSE 'voided' END,version=version+1,reviewed_by=a,reviewed_at=now(),journal_id=coalesce((j->>'entry_id')::bigint,journal_id),reversal_id=CASE WHEN p_action='void' THEN (SELECT id FROM journal_entries WHERE reversal_of=c.journal_id ORDER BY id DESC LIMIT 1) ELSE reversal_id END WHERE id=c.id RETURNING * INTO c;
 ELSE RAISE EXCEPTION 'Aksi claim tidak dikenal';END IF;
 result_value:=to_jsonb(c);INSERT INTO rs_billing_events(tenant_id,setup_id,actor_id,action,evidence,before_row,after_row) VALUES(t,b.id,a,'payer.claim_'||p_action,p_data,before_value,result_value);INSERT INTO rs_billing_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
CREATE OR REPLACE FUNCTION rs_cashier_invoice_balance(p_invoice bigint) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT i.total-coalesce((SELECT sum(c.amount) FROM rs_payer_claims c WHERE c.invoice_id=i.id AND c.state='posted'),0)-coalesce((SELECT sum(CASE WHEN a.kind='refund_payment' THEN -a.amount ELSE a.amount END) FROM rs_cashier_intents a WHERE a.invoice_id=i.id AND a.kind IN ('apply','pay','refund_payment') AND a.state='posted'),0) FROM rs_final_invoices i WHERE i.id=p_invoice
$$;
ALTER FUNCTION post_journal(text,numeric,text,text,bigint,text,date) RENAME TO post_journal_before_payer;
REVOKE ALL ON FUNCTION post_journal_before_payer(text,numeric,text,text,bigint,text,date) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION post_journal(p_event_key text,p_amount numeric,p_description text,p_source_type text DEFAULT 'manual',p_source_id bigint DEFAULT NULL,p_cost_center text DEFAULT NULL,p_date date DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c rs_payer_claims;BEGIN IF p_source_type='rs_payer_claim' THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);SELECT * INTO c FROM rs_payer_claims WHERE id=p_source_id AND tenant_id=current_tenant_id();IF c.state IS DISTINCT FROM 'posting' OR c.amount IS DISTINCT FROM p_amount OR c.event_key IS DISTINCT FROM p_event_key OR c.cost_center IS DISTINCT FROM p_cost_center THEN RAISE EXCEPTION 'Jurnal claim hanya dari review';END IF;END IF;RETURN post_journal_before_payer(p_event_key,p_amount,p_description,p_source_type,p_source_id,p_cost_center,p_date);END $$;
ALTER FUNCTION reverse_journal(bigint,text) RENAME TO reverse_journal_before_payer;
REVOKE ALL ON FUNCTION reverse_journal_before_payer(bigint,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION reverse_journal(p_entry_id bigint,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e journal_entries;c rs_payer_claims;BEGIN SELECT * INTO e FROM journal_entries WHERE id=p_entry_id;IF e.source_type='rs_payer_claim' THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);SELECT * INTO c FROM rs_payer_claims WHERE id=e.source_id AND tenant_id=current_tenant_id();IF c.state IS DISTINCT FROM 'voiding' OR c.journal_id IS DISTINCT FROM e.id OR e.is_reversal OR EXISTS(SELECT 1 FROM journal_entries WHERE reversal_of=e.id) THEN RAISE EXCEPTION 'Reversal claim hanya dari void';END IF;END IF;RETURN reverse_journal_before_payer(p_entry_id,p_reason);END $$;
DO $$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('rs_invoice_journal_visible(text,bigint)'::regprocedure) INTO body;body:=replace(body,'ELSE true END','WHEN p_type=''rs_payer_claim'' THEN EXISTS(SELECT 1 FROM rs_payer_claims c JOIN user_profiles u ON u.id=auth.uid() AND u.tenant_id=c.tenant_id WHERE c.id=p_source AND c.tenant_id=current_tenant_id() AND rs_can_read(''rs-inpatient-billing'')) ELSE true END');EXECUTE body;
 SELECT pg_get_functiondef('rs_invoice_journal_immutable()'::regprocedure) INTO body;body:=replace(body,'(''rs_final_invoice'',''rs_cashier_intent'')','(''rs_final_invoice'',''rs_cashier_intent'',''rs_payer_claim'')');EXECUTE body;
END $$;
ALTER POLICY rs_journal_invoice_scope ON journal_entries WITH CHECK(source_type IS NULL OR source_type NOT IN ('rs_final_invoice','rs_cashier_intent','rs_payer_claim'));
ALTER POLICY rs_journal_line_invoice_scope ON journal_lines WITH CHECK(NOT EXISTS(SELECT 1 FROM journal_entries e WHERE e.id=entry_id AND e.source_type IN ('rs_final_invoice','rs_cashier_intent','rs_payer_claim')));
REVOKE ALL ON FUNCTION rs_payer_invoice_quote(bigint,bigint),rs_payer_claim_command(text,jsonb,text),post_journal(text,numeric,text,text,bigint,text,date),reverse_journal(bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_payer_invoice_quote(bigint,bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION rs_payer_claim_command(text,jsonb,text),post_journal(text,numeric,text,text,bigint,text,date),reverse_journal(bigint,text) TO authenticated;
COMMIT;
