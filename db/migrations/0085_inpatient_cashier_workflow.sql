-- OWNED_BY: generic. Proposal metadata references the existing cashier and journal sources.
BEGIN;
-- Forward hardening of the previously published charge/invoice contracts.
DO $$DECLARE body text;needle text;BEGIN
 SELECT pg_get_functiondef('rs_charge_source_guard()'::regprocedure) INTO body;needle:='NEW.qty IS NULL OR NEW.unit_price IS NULL OR NEW.amount IS NULL OR NEW.unit_price<0';IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Charge numeric guard source contract changed';END IF;
 body:=replace(body,needle,'NEW.qty IS NULL OR NEW.unit_price IS NULL OR NEW.amount IS NULL OR NEW.qty::text IN (''NaN'',''Infinity'',''-Infinity'') OR NEW.unit_price::text IN (''NaN'',''Infinity'',''-Infinity'') OR NEW.amount::text IN (''NaN'',''Infinity'',''-Infinity'') OR NEW.unit_price<0');EXECUTE body;
 SELECT pg_get_functiondef('rs_invoice_command(text,jsonb,text)'::regprocedure) INTO body;needle:='IF total_value<0 THEN';IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Invoice numeric source contract changed';END IF;
 body:=replace(body,needle,'IF total_value<0 OR total_value::text IN (''NaN'',''Infinity'',''-Infinity'') THEN');EXECUTE body;
END $$;
CREATE TABLE rs_cashier_intents(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),setup_id bigint NOT NULL REFERENCES rs_billing_setups(id),
 kind text NOT NULL CHECK(kind IN ('receive','refund','apply','pay','refund_payment')),amount numeric NOT NULL CHECK(amount>0),receipt_id bigint REFERENCES rs_cashier_intents(id),invoice_id bigint REFERENCES rs_final_invoices(id),deposit_snapshot jsonb,
 payment_method text,payment_ref text,event_key text NOT NULL,cost_center text NOT NULL,accounting_snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','posting','posted','rejected','voiding','voided')),
 source_cashier_id bigint REFERENCES cashier_transactions(id),journal_id bigint REFERENCES journal_entries(id),reversal_id bigint REFERENCES journal_entries(id),
 created_by uuid NOT NULL,reviewed_by uuid,reason text NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,
 CHECK(kind='receive' AND receipt_id IS NULL AND invoice_id IS NULL OR kind='refund' AND receipt_id IS NOT NULL AND invoice_id IS NULL OR kind='apply' AND receipt_id IS NOT NULL AND invoice_id IS NOT NULL OR kind='pay' AND receipt_id IS NULL AND invoice_id IS NOT NULL OR kind='refund_payment' AND receipt_id IS NOT NULL AND invoice_id IS NOT NULL));
CREATE UNIQUE INDEX rs_cashier_one_source_receipt ON rs_cashier_intents(source_cashier_id) WHERE kind IN ('receive','refund','pay','refund_payment') AND source_cashier_id IS NOT NULL;
CREATE FUNCTION rs_cashier_assert_mapping(p_setup bigint,p_kind text,p_mapping jsonb,p_invoice bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b rs_billing_setups;deposit_code text;cash_codes jsonb;debit_code text:=p_mapping->'mapping'->>'debit_code';credit_code text:=p_mapping->'mapping'->>'credit_code';receivable_code text;
BEGIN
 SELECT * INTO b FROM rs_billing_setups WHERE id=p_setup;
 deposit_code:=b.policy_snapshot->>'deposit_account_code';cash_codes:=b.policy_snapshot->'deposit_cash_accounts';
 IF p_kind IN ('receive','refund','apply') AND coalesce(length(trim(deposit_code)),0)=0 OR jsonb_typeof(cash_codes) IS DISTINCT FROM 'array' OR jsonb_array_length(cash_codes)=0 THEN RAISE EXCEPTION 'Akun titipan dan daftar akun kas wajib disahkan eksplisit dalam policy';END IF;
 IF p_kind='receive' AND (credit_code IS DISTINCT FROM deposit_code OR NOT cash_codes ? debit_code) OR p_kind='refund' AND (debit_code IS DISTINCT FROM deposit_code OR NOT cash_codes ? credit_code) THEN RAISE EXCEPTION 'Mapping kas/titipan tidak sesuai policy';END IF;
 IF p_kind IN ('apply','pay','refund_payment') THEN
  SELECT accounting_snapshot->'mapping'->>'debit_code' INTO receivable_code FROM rs_final_invoices WHERE id=p_invoice AND tenant_id=b.tenant_id AND setup_id=b.id AND state='posted';
  IF receivable_code IS NULL OR p_kind='apply' AND (debit_code IS DISTINCT FROM deposit_code OR credit_code IS DISTINCT FROM receivable_code) OR p_kind='pay' AND (NOT cash_codes ? debit_code OR credit_code IS DISTINCT FROM receivable_code) OR p_kind='refund_payment' AND (debit_code IS DISTINCT FROM receivable_code OR NOT cash_codes ? credit_code) THEN RAISE EXCEPTION 'Mapping alokasi tidak sesuai titipan/piutang invoice';END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION rs_cashier_assert_mapping(bigint,text,jsonb,bigint) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_deposit_requirement(p_setup bigint,p_estimate numeric DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b rs_billing_setups;method_value text;base_value numeric;required_value numeric;factor_value numeric;rounding_value text;
BEGIN SELECT * INTO b FROM rs_billing_setups WHERE id=p_setup;IF NOT FOUND THEN RAISE EXCEPTION 'Setup tidak ditemukan';END IF;method_value:=b.policy_snapshot->>'deposit_method';
 IF method_value='none' THEN RETURN jsonb_build_object('method','none','required',0,'voluntary_allowed',b.policy_snapshot->'allow_voluntary_deposit'='true'::jsonb);END IF;
 IF jsonb_typeof(b.policy_snapshot->'deposit_value') IS DISTINCT FROM 'number' OR (b.policy_snapshot->>'deposit_value')::numeric<0 THEN RAISE EXCEPTION 'Nilai deposit eksplisit wajib';END IF;
 IF method_value='fixed' THEN required_value:=(b.policy_snapshot->>'deposit_value')::numeric;IF required_value<>round(required_value,(b.policy_snapshot->>'amount_decimals')::integer) THEN RAISE EXCEPTION 'Presisi deposit fixed tidak sesuai';END IF;
 ELSIF method_value='percentage' THEN
  IF b.policy_snapshot->>'deposit_basis'='active_charges' THEN SELECT coalesce(sum(amount),0) INTO base_value FROM inpatient_charges WHERE stay_id=b.stay_id AND dibatalkan_at IS NULL;
  ELSIF b.policy_snapshot->>'deposit_basis'='estimate' THEN base_value:=p_estimate;
  ELSE RAISE EXCEPTION 'Basis deposit percentage active_charges/estimate wajib eksplisit';END IF;
  rounding_value:=b.policy_snapshot->>'deposit_amount_rounding';IF rounding_value IS NULL OR rounding_value NOT IN ('up','down','nearest') OR base_value IS NULL OR base_value<0 OR base_value::text IN ('NaN','Infinity','-Infinity') OR (b.policy_snapshot->>'deposit_value')::numeric>100 THEN RAISE EXCEPTION 'Basis dan pembulatan nominal deposit eksplisit wajib';END IF;
  factor_value:=power(10,(b.policy_snapshot->>'amount_decimals')::integer);required_value:=base_value*(b.policy_snapshot->>'deposit_value')::numeric/100;required_value:=CASE rounding_value WHEN 'up' THEN ceil(required_value*factor_value)/factor_value WHEN 'down' THEN floor(required_value*factor_value)/factor_value ELSE round(required_value,(b.policy_snapshot->>'amount_decimals')::integer) END;
 ELSE RAISE EXCEPTION 'Metode deposit tidak valid';END IF;
 RETURN jsonb_build_object('method',method_value,'required',required_value,'basis',b.policy_snapshot->>'deposit_basis','base_value',base_value,'estimate',p_estimate,'rounding',rounding_value,'policy',b.policy_snapshot);
END $$;
CREATE FUNCTION rs_cashier_source_owner(p_admission bigint) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT tenant_id FROM admissions WHERE id=p_admission$$;
CREATE FUNCTION rs_cashier_receipt_available(p_receipt bigint) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.paid_amount-coalesce((SELECT sum(CASE WHEN i.kind='refund' THEN refund_source.paid_amount ELSE i.amount END) FROM rs_cashier_intents i LEFT JOIN cashier_transactions refund_source ON refund_source.id=i.source_cashier_id WHERE i.receipt_id=r.id AND i.state='posted'),0)
 FROM rs_cashier_intents r JOIN cashier_transactions c ON c.id=r.source_cashier_id WHERE r.id=p_receipt AND r.kind='receive' AND r.state='posted'
$$;
CREATE FUNCTION rs_cashier_invoice_balance(p_invoice bigint) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT i.total-coalesce((SELECT sum(CASE WHEN a.kind='refund_payment' THEN -a.amount ELSE a.amount END) FROM rs_cashier_intents a WHERE a.invoice_id=i.id AND a.kind IN ('apply','pay','refund_payment') AND a.state='posted'),0) FROM rs_final_invoices i WHERE i.id=p_invoice
$$;
REVOKE ALL ON FUNCTION rs_cashier_invoice_balance(bigint) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_cashier_source_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE intent rs_cashier_intents;b rs_billing_setups;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM rs_cashier_intents WHERE source_cashier_id=OLD.id) OR OLD.transaction_number LIKE 'RSDEP/%' THEN RAISE EXCEPTION 'Histori deposit/refund immutable';END IF;IF rs_cashier_source_owner(OLD.admission_id) IS DISTINCT FROM current_tenant_id() THEN RAISE EXCEPTION 'Kasir bukan milik tenant';END IF;RETURN OLD;END IF;
 IF rs_cashier_source_owner(NEW.admission_id) IS DISTINCT FROM current_tenant_id() THEN RAISE EXCEPTION 'Kasir bukan milik tenant';END IF;
 IF NEW.total_amount::text IN ('NaN','Infinity','-Infinity') OR NEW.paid_amount::text IN ('NaN','Infinity','-Infinity') OR NEW.change_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Nominal kasir harus finite';END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.admission_id IS DISTINCT FROM NEW.admission_id THEN RAISE EXCEPTION 'Identitas sumber kasir immutable';END IF;
  IF EXISTS(SELECT 1 FROM rs_cashier_intents WHERE source_cashier_id=OLD.id AND kind IN ('receive','refund','pay','refund_payment')) THEN RAISE EXCEPTION 'Histori deposit/refund immutable';END IF;
 END IF;
 IF NEW.transaction_number LIKE 'RSDEP/%' THEN
  SELECT * INTO intent FROM rs_cashier_intents WHERE 'RSDEP/'||id::text=NEW.transaction_number AND tenant_id=current_tenant_id() AND state='posting';SELECT * INTO b FROM rs_billing_setups WHERE id=intent.setup_id;
  IF TG_OP<>'INSERT' OR intent.id IS NULL OR intent.kind NOT IN ('receive','refund','pay','refund_payment') OR NEW.admission_id IS DISTINCT FROM (SELECT admission_id FROM inpatient_stays WHERE id=b.stay_id) OR NEW.paid_amount IS DISTINCT FROM intent.amount OR NEW.total_amount IS DISTINCT FROM intent.amount OR NEW.change_amount IS DISTINCT FROM 0::numeric OR NEW.payment_method IS DISTINCT FROM intent.payment_method OR NEW.payment_ref IS DISTINCT FROM intent.payment_ref OR NEW.status IS DISTINCT FROM 'Completed' OR NEW.transaction_type IS DISTINCT FROM (CASE WHEN intent.kind IN ('receive','pay') THEN 'Payment' ELSE 'Refund' END) THEN RAISE EXCEPTION 'Source deposit hanya dari intent review';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_cashier_source_guard BEFORE INSERT OR UPDATE OR DELETE ON cashier_transactions FOR EACH ROW EXECUTE FUNCTION rs_cashier_source_guard();
-- Actual legacy trigger catches posting failures and maps all payments to revenue.
-- Only validated RS deposit/refund rows bypass that trigger; the command posts their explicit mapping atomically.
DO $$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('trg_post_cashier()'::regprocedure) INTO body;
 IF position('cashier.refund' IN body)=0 OR position('cashier.cash' IN body)=0 THEN RAISE EXCEPTION 'Cashier GL trigger source contract changed';END IF;
 body:=replace(body,'BEGIN', 'BEGIN IF NEW.transaction_number LIKE ''RSDEP/%'' AND EXISTS(SELECT 1 FROM rs_cashier_intents i WHERE ''RSDEP/''||i.id::text=NEW.transaction_number AND i.tenant_id=current_tenant_id() AND i.state=''posting'') THEN RETURN NEW;END IF;');EXECUTE body;
END $$;
CREATE FUNCTION rs_cashier_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;intent rs_cashier_intents;receipt rs_cashier_intents;b rs_billing_setups;s inpatient_stays;invoice rs_final_invoices;r rs_billing_requests;input_value jsonb:=jsonb_build_object('cashier_action',p_action,'data',p_data);result_value jsonb;before_value jsonb;accounting_value jsonb;deposit_value jsonb;kind_value text;amount_value numeric;available_value numeric;balance_value numeric;source_id bigint;j jsonb;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input/key/alasan wajib';END IF;
 kind_value:=p_data->>'kind';PERFORM ops_assert_permission('rs-inpatient-billing','billing.cashier.'||CASE WHEN p_action='create' THEN 'create_'||kind_value ELSE p_action END);
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_billing_requests WHERE tenant_id=t AND request_key=p_key;IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN r.result;END IF;
 IF p_action='create' THEN SELECT * INTO b FROM rs_billing_setups WHERE id=(p_data->>'setup_id')::bigint AND tenant_id=t;
 ELSE SELECT * INTO intent FROM rs_cashier_intents WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO b FROM rs_billing_setups WHERE id=intent.setup_id AND tenant_id=t;END IF;
 IF b.id IS NULL OR b.state<>'active' THEN RAISE EXCEPTION 'Setup bukan milik tenant/tidak aktif';END IF;
 SELECT * INTO s FROM inpatient_stays WHERE id=b.stay_id AND tenant_id=t FOR UPDATE;SELECT * INTO b FROM rs_billing_setups WHERE id=b.id FOR UPDATE;
 IF intent.id IS NOT NULL THEN SELECT * INTO intent FROM rs_cashier_intents WHERE id=intent.id FOR UPDATE;END IF;before_value:=to_jsonb(intent);
 IF p_action='create' THEN
  amount_value:=(p_data->>'amount')::numeric;IF kind_value IS NULL OR kind_value NOT IN ('receive','refund','apply','pay','refund_payment') OR jsonb_typeof(p_data->'amount') IS DISTINCT FROM 'number' OR amount_value IS NULL OR amount_value<=0 OR amount_value<>round(amount_value,(b.policy_snapshot->>'amount_decimals')::integer) THEN RAISE EXCEPTION 'Jenis/nominal/presisi tidak valid';END IF;
  IF kind_value IN ('receive','refund','pay','refund_payment') AND (coalesce(length(trim(p_data->>'payment_method')),0)=0 OR coalesce(length(trim(p_data->>'payment_ref')),0)=0) THEN RAISE EXCEPTION 'Metode dan referensi pembayaran wajib';END IF;
  IF kind_value='receive' AND b.policy_snapshot->>'deposit_method'='none' AND b.policy_snapshot->'allow_voluntary_deposit' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Kebijakan deposit none; voluntary harus disahkan eksplisit';END IF;
  IF kind_value='receive' THEN deposit_value:=rs_deposit_requirement(b.id,(p_data->>'estimated_total')::numeric);END IF;
  IF p_data ? 'estimated_total' AND (jsonb_typeof(p_data->'estimated_total') IS DISTINCT FROM 'number' OR (p_data->>'estimated_total')::numeric<0) THEN RAISE EXCEPTION 'Estimate numerik nonnegatif wajib';END IF;
  accounting_value:=rs_invoice_accounting_snapshot(p_data->>'event_key',p_data->>'cost_center');IF accounting_value IS NULL THEN RAISE EXCEPTION 'Mapping/account/cost center aktif wajib';END IF;
  IF kind_value IN ('refund','apply','refund_payment') AND NOT EXISTS(SELECT 1 FROM rs_cashier_intents WHERE id=(p_data->>'receipt_id')::bigint AND tenant_id=t AND setup_id=b.id AND kind=CASE WHEN kind_value='refund_payment' THEN 'pay' ELSE 'receive' END AND state='posted') THEN RAISE EXCEPTION 'Receipt source bukan milik stay/tidak posted';END IF;
  IF kind_value IN ('apply','pay','refund_payment') AND NOT EXISTS(SELECT 1 FROM rs_final_invoices WHERE id=(p_data->>'invoice_id')::bigint AND tenant_id=t AND setup_id=b.id AND state='posted') THEN RAISE EXCEPTION 'Invoice source bukan milik stay/tidak posted';END IF;
  PERFORM rs_cashier_assert_mapping(b.id,kind_value,accounting_value,(p_data->>'invoice_id')::bigint);
  INSERT INTO rs_cashier_intents(tenant_id,setup_id,kind,amount,receipt_id,invoice_id,deposit_snapshot,payment_method,payment_ref,event_key,cost_center,accounting_snapshot,created_by,reason) VALUES(t,b.id,kind_value,amount_value,(p_data->>'receipt_id')::bigint,(p_data->>'invoice_id')::bigint,deposit_value,p_data->>'payment_method',p_data->>'payment_ref',p_data->>'event_key',p_data->>'cost_center',accounting_value,a,p_data->>'reason') RETURNING * INTO intent;
 ELSIF p_action IN ('approve','reject') THEN
  IF intent.state IS DISTINCT FROM 'draft' OR intent.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Intent berubah/tidak draft';END IF;
  IF intent.created_by=a THEN RAISE EXCEPTION 'Reviewer kasir harus berbeda';END IF;
  IF p_action='approve' THEN
   IF rs_invoice_accounting_snapshot(intent.event_key,intent.cost_center) IS DISTINCT FROM intent.accounting_snapshot THEN RAISE EXCEPTION 'Mapping source berubah; buat draft baru';END IF;
   IF intent.kind='receive' AND b.policy_snapshot->>'deposit_method'='none' AND b.policy_snapshot->'allow_voluntary_deposit' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Kebijakan deposit tidak mengizinkan';END IF;
   IF intent.kind='receive' AND rs_deposit_requirement(b.id,(intent.deposit_snapshot->>'estimate')::numeric) IS DISTINCT FROM intent.deposit_snapshot THEN RAISE EXCEPTION 'Basis/kebijakan deposit berubah; buat draft baru';END IF;
   IF intent.kind IN ('refund','apply','refund_payment') THEN
    SELECT * INTO receipt FROM rs_cashier_intents WHERE id=intent.receipt_id AND tenant_id=t AND setup_id=b.id AND kind=CASE WHEN intent.kind='refund_payment' THEN 'pay' ELSE 'receive' END AND state='posted' FOR UPDATE;
    IF receipt.id IS NULL THEN RAISE EXCEPTION 'Receipt source bukan milik stay/tidak posted';END IF;
    IF intent.kind='refund_payment' THEN IF receipt.invoice_id IS DISTINCT FROM intent.invoice_id THEN RAISE EXCEPTION 'Refund harus mengacu invoice pembayaran asal';END IF;SELECT receipt.amount-coalesce(sum(amount),0) INTO available_value FROM rs_cashier_intents WHERE receipt_id=receipt.id AND kind='refund_payment' AND state='posted';ELSE available_value:=rs_cashier_receipt_available(receipt.id);END IF;IF available_value IS NULL OR intent.amount>available_value THEN RAISE EXCEPTION 'Saldo receipt tidak cukup';END IF;
   END IF;
   IF intent.kind IN ('apply','pay','refund_payment') THEN
    SELECT * INTO invoice FROM rs_final_invoices WHERE id=intent.invoice_id AND tenant_id=t AND setup_id=b.id FOR UPDATE;
    IF invoice.state IS DISTINCT FROM 'posted' THEN RAISE EXCEPTION 'Invoice source belum posted';END IF;
    balance_value:=rs_cashier_invoice_balance(invoice.id);
    IF intent.kind<>'refund_payment' AND intent.amount>balance_value THEN RAISE EXCEPTION 'Alokasi melebihi saldo invoice';END IF;
   END IF;
   PERFORM rs_cashier_assert_mapping(b.id,intent.kind,intent.accounting_snapshot,intent.invoice_id);
   UPDATE rs_cashier_intents SET state='posting' WHERE id=intent.id;
   IF intent.kind IN ('receive','refund','pay','refund_payment') THEN
    INSERT INTO cashier_transactions(transaction_number,admission_id,visit_number,patient_name,subtotal,total_amount,paid_amount,change_amount,payment_method,payment_ref,transaction_type,status,cashier_name,notes) VALUES('RSDEP/'||intent.id,s.admission_id,(SELECT visit_number FROM admissions WHERE id=s.admission_id),s.patient_name,intent.amount,intent.amount,intent.amount,0,intent.payment_method,intent.payment_ref,CASE WHEN intent.kind IN ('receive','pay') THEN 'Payment' ELSE 'Refund' END,'Completed',current_app_name(),intent.reason) RETURNING id INTO source_id;
   ELSE source_id:=receipt.source_cashier_id;END IF;
   j:=post_journal(intent.event_key,intent.amount,'Deposit '||intent.kind||' #'||intent.id,'rs_cashier_intent',intent.id,intent.cost_center,current_date);IF j->>'ok' IS DISTINCT FROM 'true' OR j->>'entry_id' IS NULL THEN RAISE EXCEPTION 'Jurnal deposit gagal';END IF;
  END IF;
  UPDATE rs_cashier_intents SET state=CASE WHEN p_action='approve' THEN 'posted' ELSE 'rejected' END,reviewed_by=a,reviewed_at=now(),version=version+1,source_cashier_id=source_id,journal_id=(j->>'entry_id')::bigint WHERE id=intent.id RETURNING * INTO intent;
 ELSIF p_action='void_apply' THEN
  IF intent.kind IS DISTINCT FROM 'apply' OR intent.state IS DISTINCT FROM 'posted' OR intent.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Hanya alokasi posted dapat di-void';END IF;
  IF intent.created_by=a THEN RAISE EXCEPTION 'Pembatal alokasi harus berbeda';END IF;
  IF EXISTS(SELECT 1 FROM accounting_periods WHERE period=to_char(current_date,'YYYY-MM') AND status='Tutup') THEN RAISE EXCEPTION 'Periode reversal ditutup';END IF;
  UPDATE rs_cashier_intents SET state='voiding' WHERE id=intent.id;j:=reverse_journal(intent.journal_id,p_data->>'reason');IF j->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Reversal alokasi gagal';END IF;
  UPDATE rs_cashier_intents SET state='voided',version=version+1,reversal_id=(SELECT id FROM journal_entries WHERE reversal_of=intent.journal_id ORDER BY id DESC LIMIT 1) WHERE id=intent.id RETURNING * INTO intent;
 ELSE RAISE EXCEPTION 'Aksi kasir tidak dikenal';END IF;
 result_value:=to_jsonb(intent);INSERT INTO rs_billing_events(tenant_id,setup_id,actor_id,action,evidence,before_row,after_row) VALUES(t,b.id,a,'cashier.'||p_action,p_data,before_value,result_value);INSERT INTO rs_billing_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
ALTER FUNCTION post_journal(text,numeric,text,text,bigint,text,date) RENAME TO post_journal_before_rs_cashier;
REVOKE ALL ON FUNCTION post_journal_before_rs_cashier(text,numeric,text,text,bigint,text,date) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION post_journal(p_event_key text,p_amount numeric,p_description text,p_source_type text DEFAULT 'manual',p_source_id bigint DEFAULT NULL,p_cost_center text DEFAULT NULL,p_date date DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i rs_cashier_intents;
BEGIN IF p_source_type='rs_cashier_intent' THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);SELECT * INTO i FROM rs_cashier_intents WHERE id=p_source_id AND tenant_id=current_tenant_id();IF i.state IS DISTINCT FROM 'posting' OR i.amount IS DISTINCT FROM p_amount OR i.event_key IS DISTINCT FROM p_event_key OR i.cost_center IS DISTINCT FROM p_cost_center THEN RAISE EXCEPTION 'Jurnal deposit hanya dari intent review';END IF;END IF;RETURN post_journal_before_rs_cashier(p_event_key,p_amount,p_description,p_source_type,p_source_id,p_cost_center,p_date);END $$;
ALTER FUNCTION reverse_journal(bigint,text) RENAME TO reverse_journal_before_rs_cashier;
REVOKE ALL ON FUNCTION reverse_journal_before_rs_cashier(bigint,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION reverse_journal(p_entry_id bigint,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e journal_entries;i rs_cashier_intents;
BEGIN SELECT * INTO e FROM journal_entries WHERE id=p_entry_id;IF e.source_type='rs_cashier_intent' THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);SELECT * INTO i FROM rs_cashier_intents WHERE id=e.source_id AND tenant_id=current_tenant_id();IF i.state IS DISTINCT FROM 'voiding' OR i.kind IS DISTINCT FROM 'apply' OR i.journal_id IS DISTINCT FROM e.id OR e.is_reversal OR EXISTS(SELECT 1 FROM journal_entries WHERE reversal_of=e.id) THEN RAISE EXCEPTION 'Reversal deposit hanya dari void alokasi';END IF;END IF;RETURN reverse_journal_before_rs_cashier(p_entry_id,p_reason);END $$;
-- Prevent reversing an invoice while an application still consumes its receipt.
ALTER FUNCTION rs_invoice_command(text,jsonb,text) RENAME TO rs_invoice_command_before_deposit;
REVOKE ALL ON FUNCTION rs_invoice_command_before_deposit(text,jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_invoice_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i rs_final_invoices;b rs_billing_setups;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);
 IF p_action='void' THEN SELECT * INTO i FROM rs_final_invoices WHERE id=(p_data->>'id')::bigint AND tenant_id=current_tenant_id();SELECT * INTO b FROM rs_billing_setups WHERE id=i.setup_id;PERFORM 1 FROM inpatient_stays WHERE id=b.stay_id FOR UPDATE;PERFORM 1 FROM rs_billing_setups WHERE id=b.id FOR UPDATE;IF EXISTS(SELECT 1 FROM rs_cashier_intents WHERE invoice_id=i.id AND kind='apply' AND state='posted') OR rs_cashier_invoice_balance(i.id)<i.total THEN RAISE EXCEPTION 'Void alokasi deposit dahulu';END IF;END IF;
 RETURN rs_invoice_command_before_deposit(p_action,p_data,p_key);END $$;
CREATE OR REPLACE FUNCTION rs_invoice_journal_visible(p_type text,p_source bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN p_type='rs_final_invoice' THEN EXISTS(SELECT 1 FROM rs_final_invoices i JOIN user_profiles u ON u.id=auth.uid() AND u.tenant_id=i.tenant_id WHERE i.id=p_source AND i.tenant_id=current_tenant_id() AND lower(u.role) IN ('super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff')) WHEN p_type='rs_cashier_intent' THEN EXISTS(SELECT 1 FROM rs_cashier_intents i JOIN user_profiles u ON u.id=auth.uid() AND u.tenant_id=i.tenant_id WHERE i.id=p_source AND i.tenant_id=current_tenant_id() AND lower(u.role) IN ('super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff')) ELSE true END
$$;
DO $$DECLARE body text;BEGIN SELECT pg_get_functiondef('rs_invoice_journal_immutable()'::regprocedure) INTO body;body:=replace(body,'e.source_type=''rs_final_invoice''','e.source_type IN (''rs_final_invoice'',''rs_cashier_intent'')');EXECUTE body;END $$;
ALTER POLICY rs_journal_invoice_scope ON journal_entries USING(rs_invoice_journal_visible(source_type,source_id)) WITH CHECK(source_type IS NULL OR source_type NOT IN ('rs_final_invoice','rs_cashier_intent'));
ALTER POLICY rs_journal_line_invoice_scope ON journal_lines USING(rs_invoice_line_visible(entry_id)) WITH CHECK(NOT EXISTS(SELECT 1 FROM journal_entries e WHERE e.id=entry_id AND e.source_type IN ('rs_final_invoice','rs_cashier_intent')));
ALTER TABLE cashier_transactions ENABLE ROW LEVEL SECURITY;
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='cashier_transactions' LOOP EXECUTE format('DROP POLICY %I ON cashier_transactions',p.policyname);END LOOP;END $$;
CREATE POLICY rs_cashier_source_select ON cashier_transactions FOR SELECT TO authenticated USING(rs_cashier_source_owner(admission_id)=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));
CREATE POLICY rs_cashier_source_insert ON cashier_transactions FOR INSERT TO authenticated WITH CHECK(rs_cashier_source_owner(admission_id)=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));
CREATE POLICY rs_cashier_source_update ON cashier_transactions FOR UPDATE TO authenticated USING(rs_cashier_source_owner(admission_id)=current_tenant_id() AND rs_can_read('rs-inpatient-billing')) WITH CHECK(rs_cashier_source_owner(admission_id)=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));
REVOKE ALL ON cashier_transactions FROM PUBLIC,anon;REVOKE DELETE,TRUNCATE ON cashier_transactions FROM authenticated;GRANT SELECT,INSERT,UPDATE ON cashier_transactions TO authenticated;
ALTER TABLE rs_cashier_intents ENABLE ROW LEVEL SECURITY;REVOKE ALL ON rs_cashier_intents FROM PUBLIC,anon,authenticated;
CREATE POLICY rs_cashier_intent_read ON rs_cashier_intents FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));GRANT SELECT ON rs_cashier_intents TO authenticated;
REVOKE ALL ON FUNCTION rs_cashier_command(text,jsonb,text),rs_cashier_source_owner(bigint),rs_cashier_receipt_available(bigint),rs_cashier_source_guard(),post_journal(text,numeric,text,text,bigint,text,date),reverse_journal(bigint,text),rs_invoice_command(text,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_cashier_receipt_available(bigint),rs_cashier_source_guard() FROM authenticated;
REVOKE ALL ON FUNCTION rs_deposit_requirement(bigint,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION rs_cashier_command(text,jsonb,text),rs_cashier_source_owner(bigint),post_journal(text,numeric,text,text,bigint,text,date),reverse_journal(bigint,text),rs_invoice_command(text,jsonb,text) TO authenticated;
CREATE FUNCTION rs_cashier_board(p_setup_id bigint DEFAULT NULL,p_offset integer DEFAULT 0,p_intent_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();ids bigint[];setups_value jsonb;
BEGIN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);IF p_intent_offset IS NULL OR p_intent_offset<0 OR p_intent_offset>1000000 OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_setup_id IS NOT NULL AND p_setup_id<1 THEN RAISE EXCEPTION 'Filter/offset tidak valid';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(b)),'[]'),array_agg(b.id) INTO setups_value,ids FROM (SELECT b.id,b.stay_id,b.version,b.policy_snapshot,s.patient_name,s.stay_number,s.status,(SELECT coalesce(sum(c.paid_amount),0) FROM rs_cashier_intents i JOIN cashier_transactions c ON c.id=i.source_cashier_id WHERE i.setup_id=b.id AND i.kind='receive' AND i.state='posted') received,(SELECT coalesce(sum(c.paid_amount),0) FROM rs_cashier_intents i JOIN cashier_transactions c ON c.id=i.source_cashier_id WHERE i.setup_id=b.id AND i.kind='refund' AND i.state='posted') refunded,(SELECT coalesce(sum(i.amount),0) FROM rs_cashier_intents i WHERE i.setup_id=b.id AND i.kind='apply' AND i.state='posted') applied FROM rs_billing_setups b JOIN inpatient_stays s ON s.id=b.stay_id WHERE b.tenant_id=t AND b.state='active' AND (p_setup_id IS NULL OR b.id=p_setup_id) ORDER BY b.id DESC LIMIT 51 OFFSET p_offset)b;
 RETURN jsonb_build_object('setups',setups_value,'intents',coalesce((SELECT jsonb_agg(to_jsonb(i)-'accounting_snapshot') FROM (SELECT i.*,CASE WHEN kind='receive' AND state='posted' THEN rs_cashier_receipt_available(id) WHEN kind='pay' AND state='posted' THEN amount-(SELECT coalesce(sum(r.amount),0) FROM rs_cashier_intents r WHERE r.receipt_id=i.id AND r.kind='refund_payment' AND r.state='posted') END available FROM rs_cashier_intents i WHERE i.tenant_id=t AND i.setup_id=ANY(ids) ORDER BY id DESC LIMIT 201 OFFSET p_intent_offset)i),'[]'),
 'invoices',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM (SELECT i.id,i.setup_id,i.total,i.state,rs_cashier_invoice_balance(i.id) balance FROM rs_final_invoices i WHERE i.tenant_id=t AND i.setup_id=ANY(ids) ORDER BY (state='posted') DESC,id DESC LIMIT 200)i),'[]'),
 'gl_mappings',coalesce((SELECT jsonb_agg(jsonb_build_object('event_key',event_key,'debit_code',debit_code,'credit_code',credit_code)) FROM gl_mappings WHERE is_active),'[]'),
 'cost_centers',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'name',name)) FROM cost_centers WHERE is_active),'[]'));
END $$;
REVOKE ALL ON FUNCTION rs_cashier_board(bigint,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_cashier_board(bigint,integer,integer) TO authenticated;
COMMIT;
