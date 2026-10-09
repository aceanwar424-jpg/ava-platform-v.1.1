-- OWNED_BY: generic. Invoice metadata references actual charge and accounting sources.
BEGIN;
CREATE TABLE rs_final_invoices(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),setup_id bigint NOT NULL REFERENCES rs_billing_setups(id),
 source_snapshot jsonb NOT NULL,room_quote jsonb NOT NULL,total numeric NOT NULL CHECK(total>=0),
 event_key text NOT NULL,cost_center text NOT NULL,accounting_snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','posting','posted','rejected','voiding','voided')),
 created_by uuid NOT NULL,reviewed_by uuid,reason text NOT NULL,version integer NOT NULL DEFAULT 1,
 journal_id bigint REFERENCES journal_entries(id),reversal_id bigint REFERENCES journal_entries(id),created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz);
CREATE UNIQUE INDEX rs_one_posted_invoice ON rs_final_invoices(setup_id) WHERE state IN ('posting','posted','voiding');
CREATE FUNCTION rs_invoice_accounting_snapshot(p_event text,p_center text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('mapping',to_jsonb(m),'debit',to_jsonb(d),'credit',to_jsonb(c),'center',to_jsonb(cc))
 FROM gl_mappings m JOIN chart_of_accounts d ON d.code=m.debit_code AND d.is_active JOIN chart_of_accounts c ON c.code=m.credit_code AND c.is_active JOIN cost_centers cc ON cc.code=p_center AND cc.is_active WHERE m.event_key=p_event AND m.is_active
$$;
CREATE FUNCTION rs_invoice_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;invoice rs_final_invoices;b rs_billing_setups;s inpatient_stays;r rs_billing_requests;input_value jsonb:=jsonb_build_object('invoice_action',p_action,'data',p_data);before_value jsonb;result_value jsonb;snapshot_value jsonb;quote_value jsonb;accounting_value jsonb;net_value numeric;total_value numeric;j jsonb;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);PERFORM ops_assert_permission('rs-inpatient-billing','billing.invoice.'||p_action);
 IF coalesce(length(trim(p_key)),0)<8 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Request key/alasan wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_billing_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Request key dipakai input berbeda';END IF;RETURN r.result;END IF;
 IF p_action='create' THEN SELECT * INTO b FROM rs_billing_setups WHERE id=(p_data->>'setup_id')::bigint AND tenant_id=t;
 ELSE SELECT * INTO invoice FROM rs_final_invoices WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO b FROM rs_billing_setups WHERE id=invoice.setup_id AND tenant_id=t;END IF;
 IF b.id IS NULL OR b.state<>'active' THEN RAISE EXCEPTION 'Setup bukan milik tenant/tidak aktif';END IF;
 SELECT * INTO s FROM inpatient_stays WHERE id=b.stay_id AND tenant_id=t FOR UPDATE;SELECT * INTO b FROM rs_billing_setups WHERE id=b.id FOR UPDATE;IF invoice.id IS NOT NULL THEN SELECT * INTO invoice FROM rs_final_invoices WHERE id=invoice.id FOR UPDATE;END IF;before_value:=to_jsonb(invoice);
 IF p_action IN ('create','approve') THEN
  IF s.status='Dirawat' OR s.discharged_at IS NULL THEN RAISE EXCEPTION 'Pemulangan klinis sumber belum selesai';END IF;
  IF EXISTS(SELECT 1 FROM journal_entries e WHERE e.source_type='inpatient' AND e.source_id=s.id AND NOT coalesce(e.is_reversal,false) AND NOT EXISTS(SELECT 1 FROM journal_entries reversal_row WHERE reversal_row.reversal_of=e.id)) THEN RAISE EXCEPTION 'Jurnal inpatient legacy masih aktif; rekonsiliasi sebelum invoice baru';END IF;
  quote_value:=rs_billing_calculate(b.id,s.discharged_at AT TIME ZONE b.source_timezone);
  SELECT coalesce(sum(delta),0) INTO net_value FROM rs_billing_proposals WHERE setup_id=b.id AND state='posted';
  IF net_value IS DISTINCT FROM (quote_value->>'total')::numeric THEN RAISE EXCEPTION 'Biaya kamar sampai pulang belum direkonsiliasi';END IF;
  IF EXISTS(SELECT 1 FROM rs_final_invoices WHERE setup_id=b.id AND state IN ('posting','posted','voiding')) THEN RAISE EXCEPTION 'Invoice aktif sudah ada';END IF;
  snapshot_value:=rs_billing_source_snapshot(s.id);SELECT coalesce(sum(amount),0) INTO total_value FROM inpatient_charges WHERE stay_id=s.id AND dibatalkan_at IS NULL;
  IF total_value<0 THEN RAISE EXCEPTION 'Total invoice negatif';END IF;
 END IF;
 IF p_action='create' THEN
  accounting_value:=rs_invoice_accounting_snapshot(p_data->>'event_key',p_data->>'cost_center');IF accounting_value IS NULL THEN RAISE EXCEPTION 'Mapping/account/cost center aktif wajib';END IF;
  INSERT INTO rs_final_invoices(tenant_id,setup_id,source_snapshot,room_quote,total,event_key,cost_center,accounting_snapshot,created_by,reason) VALUES(t,b.id,snapshot_value,quote_value,total_value,p_data->>'event_key',p_data->>'cost_center',accounting_value,a,p_data->>'reason') RETURNING * INTO invoice;
 ELSIF p_action IN ('approve','reject') THEN
  IF invoice.state IS DISTINCT FROM 'draft' OR invoice.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Invoice berubah/tidak draft';END IF;
  IF invoice.created_by=a THEN RAISE EXCEPTION 'Reviewer invoice harus berbeda';END IF;
  IF p_action='approve' THEN
   IF snapshot_value IS DISTINCT FROM invoice.source_snapshot OR quote_value IS DISTINCT FROM invoice.room_quote OR total_value IS DISTINCT FROM invoice.total OR rs_invoice_accounting_snapshot(invoice.event_key,invoice.cost_center) IS DISTINCT FROM invoice.accounting_snapshot THEN RAISE EXCEPTION 'Sumber invoice/mapping berubah; buat draft baru';END IF;
   UPDATE rs_final_invoices SET state='posting' WHERE id=invoice.id;
   j:=post_journal(invoice.event_key,invoice.total,'Invoice rawat inap #'||invoice.id,'rs_final_invoice',invoice.id,invoice.cost_center,current_date);
   IF j->>'ok' IS DISTINCT FROM 'true' OR invoice.total>0 AND j->>'entry_id' IS NULL THEN RAISE EXCEPTION 'Jurnal sumber gagal';END IF;
  END IF;
  UPDATE rs_final_invoices SET state=CASE WHEN p_action='approve' THEN 'posted' ELSE 'rejected' END,reviewed_by=a,reviewed_at=now(),journal_id=(j->>'entry_id')::bigint,version=version+1 WHERE id=invoice.id RETURNING * INTO invoice;
 ELSIF p_action='void' THEN
  IF invoice.state IS DISTINCT FROM 'posted' OR invoice.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Invoice berubah/tidak posted';END IF;
  IF a=invoice.created_by THEN RAISE EXCEPTION 'Pembatal harus berbeda dari pembuat invoice';END IF;
  IF EXISTS(SELECT 1 FROM accounting_periods WHERE period=to_char(current_date,'YYYY-MM') AND status='Tutup') THEN RAISE EXCEPTION 'Periode reversal sudah ditutup';END IF;
  UPDATE rs_final_invoices SET state='voiding' WHERE id=invoice.id;
  IF invoice.journal_id IS NOT NULL THEN j:=reverse_journal(invoice.journal_id,p_data->>'reason');IF j->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Reversal sumber gagal';END IF;END IF;
  UPDATE rs_final_invoices SET state='voided',reversal_id=(SELECT id FROM journal_entries WHERE reversal_of=invoice.journal_id ORDER BY id DESC LIMIT 1),version=version+1 WHERE id=invoice.id RETURNING * INTO invoice;
 ELSE RAISE EXCEPTION 'Aksi invoice tidak dikenal';END IF;
 result_value:=to_jsonb(invoice);INSERT INTO rs_billing_events(tenant_id,setup_id,actor_id,action,evidence,before_row,after_row) VALUES(t,b.id,a,'invoice.'||p_action,p_data,before_value,result_value);INSERT INTO rs_billing_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
-- Serialize service charge edits with invoice approval and prohibit edits after posting.
CREATE FUNCTION rs_invoice_charge_lock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE setup_value bigint;stay_value bigint;
BEGIN stay_value:=CASE WHEN TG_OP='DELETE' THEN OLD.stay_id ELSE NEW.stay_id END;
 PERFORM 1 FROM inpatient_stays WHERE id=stay_value FOR UPDATE;
 SELECT id INTO setup_value FROM rs_billing_setups WHERE stay_id=stay_value AND state='active' FOR UPDATE;
 IF EXISTS(SELECT 1 FROM rs_final_invoices WHERE setup_id=setup_value AND state IN ('posting','posted','voiding')) THEN RAISE EXCEPTION 'Invoice sudah diposting; void dengan jurnal balik sebelum koreksi sumber';END IF;
 IF TG_OP='DELETE' THEN IF setup_value IS NOT NULL THEN RAISE EXCEPTION 'Histori biaya sumber tidak boleh dihapus';END IF;RETURN OLD;END IF;RETURN NEW;END $$;
CREATE TRIGGER rs_invoice_charge_lock BEFORE INSERT OR UPDATE OR DELETE ON inpatient_charges FOR EACH ROW EXECUTE FUNCTION rs_invoice_charge_lock();
ALTER FUNCTION post_journal(text,numeric,text,text,bigint,text,date) RENAME TO post_journal_before_rs_invoice;
REVOKE ALL ON FUNCTION post_journal_before_rs_invoice(text,numeric,text,text,bigint,text,date) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION post_journal(p_event_key text,p_amount numeric,p_description text,p_source_type text DEFAULT 'manual',p_source_id bigint DEFAULT NULL,p_cost_center text DEFAULT NULL,p_date date DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i rs_final_invoices;
BEGIN
 IF p_source_type='rs_final_invoice' THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);SELECT * INTO i FROM rs_final_invoices WHERE id=p_source_id AND tenant_id=current_tenant_id();IF i.state IS DISTINCT FROM 'posting' OR i.total IS DISTINCT FROM p_amount OR i.event_key IS DISTINCT FROM p_event_key OR i.cost_center IS DISTINCT FROM p_cost_center THEN RAISE EXCEPTION 'Jurnal invoice hanya dari review sumber';END IF;END IF;
 RETURN post_journal_before_rs_invoice(p_event_key,p_amount,p_description,p_source_type,p_source_id,p_cost_center,p_date);END $$;
ALTER FUNCTION reverse_journal(bigint,text) RENAME TO reverse_journal_before_rs_invoice;
REVOKE ALL ON FUNCTION reverse_journal_before_rs_invoice(bigint,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION reverse_journal(p_entry_id bigint,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e journal_entries;i rs_final_invoices;
BEGIN SELECT * INTO e FROM journal_entries WHERE id=p_entry_id;
 IF e.source_type='rs_final_invoice' THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);SELECT * INTO i FROM rs_final_invoices WHERE id=e.source_id AND tenant_id=current_tenant_id();IF i.state IS DISTINCT FROM 'voiding' OR i.journal_id IS DISTINCT FROM p_entry_id OR e.is_reversal OR EXISTS(SELECT 1 FROM journal_entries WHERE reversal_of=p_entry_id) THEN RAISE EXCEPTION 'Pembalikan invoice hanya dari void sumber';END IF;END IF;
 RETURN reverse_journal_before_rs_invoice(p_entry_id,p_reason);END $$;
ALTER TABLE rs_final_invoices ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION rs_invoice_journal_visible(p_type text,p_source bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_type IS DISTINCT FROM 'rs_final_invoice' OR EXISTS(SELECT 1 FROM rs_final_invoices i JOIN user_profiles u ON u.id=auth.uid() AND u.tenant_id=i.tenant_id WHERE i.id=p_source AND i.tenant_id=current_tenant_id() AND lower(u.role) IN ('super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff'))
$$;
CREATE FUNCTION rs_invoice_line_visible(p_entry bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM journal_entries e WHERE e.id=p_entry AND rs_invoice_journal_visible(e.source_type,e.source_id))
$$;
-- Existing reports are SECURITY DEFINER; RLS alone cannot protect their aggregates.
DO $$DECLARE body text;needle text;BEGIN
 SELECT pg_get_functiondef('trial_balance(text)'::regprocedure) INTO body;
 needle:='LEFT JOIN journal_lines l   ON l.account_code = c.code';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'trial_balance source contract changed';END IF;
 body:=replace(body,needle,'LEFT JOIN (SELECT l.* FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id WHERE e.period=p_period AND rs_invoice_journal_visible(e.source_type,e.source_id)) l ON l.account_code=c.code');EXECUTE body;
 SELECT pg_get_functiondef('profit_by_cost_center(text)'::regprocedure) INTO body;needle:='WHERE c.acc_type IN';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'profit_by_cost_center source contract changed';END IF;
 body:=replace(body,needle,'WHERE rs_invoice_journal_visible(e.source_type,e.source_id) AND c.acc_type IN');EXECUTE body;
END $$;
CREATE FUNCTION rs_invoice_journal_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e journal_entries;
BEGIN
 IF TG_TABLE_NAME='journal_entries' THEN e:=OLD;
 ELSE SELECT * INTO e FROM journal_entries WHERE id=OLD.entry_id;END IF;
 IF e.source_type='rs_final_invoice' THEN RAISE EXCEPTION 'Histori jurnal invoice immutable; gunakan void/reversal';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_invoice_journal_immutable BEFORE UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION rs_invoice_journal_immutable();
CREATE TRIGGER rs_invoice_journal_line_immutable BEFORE UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION rs_invoice_journal_immutable();
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
-- Preserve legacy journal visibility; restrictive policies constrain new invoice references even if older permissive policies exist.
CREATE POLICY rs_journal_base_read ON journal_entries FOR SELECT TO authenticated USING(rs_invoice_journal_visible(source_type,source_id));
CREATE POLICY rs_journal_invoice_scope ON journal_entries AS RESTRICTIVE TO authenticated USING(rs_invoice_journal_visible(source_type,source_id)) WITH CHECK(source_type IS DISTINCT FROM 'rs_final_invoice');
CREATE POLICY rs_journal_line_base_read ON journal_lines FOR SELECT TO authenticated USING(rs_invoice_line_visible(entry_id));
CREATE POLICY rs_journal_line_invoice_scope ON journal_lines AS RESTRICTIVE TO authenticated USING(rs_invoice_line_visible(entry_id)) WITH CHECK(NOT EXISTS(SELECT 1 FROM journal_entries e WHERE e.id=entry_id AND e.source_type='rs_final_invoice'));
GRANT SELECT ON journal_entries,journal_lines TO authenticated;
REVOKE ALL ON rs_final_invoices FROM PUBLIC,anon,authenticated;
CREATE POLICY rs_final_invoice_read ON rs_final_invoices FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));
GRANT SELECT ON rs_final_invoices TO authenticated;
REVOKE ALL ON FUNCTION rs_invoice_command(text,jsonb,text),rs_invoice_accounting_snapshot(text,text),rs_invoice_charge_lock(),post_journal(text,numeric,text,text,bigint,text,date),reverse_journal(bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_invoice_accounting_snapshot(text,text),rs_invoice_charge_lock() FROM authenticated;
GRANT EXECUTE ON FUNCTION rs_invoice_command(text,jsonb,text),post_journal(text,numeric,text,text,bigint,text,date),reverse_journal(bigint,text) TO authenticated;
REVOKE ALL ON FUNCTION rs_invoice_journal_visible(text,bigint),rs_invoice_line_visible(bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_invoice_journal_immutable() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION rs_invoice_journal_visible(text,bigint),rs_invoice_line_visible(bigint) TO authenticated;
ALTER FUNCTION rs_billing_board(bigint,integer) RENAME TO rs_billing_board_before_invoice;
REVOKE ALL ON FUNCTION rs_billing_board_before_invoice(bigint,integer) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_billing_board(p_stay_id bigint DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result_value jsonb;ids bigint[];
BEGIN result_value:=rs_billing_board_before_invoice(p_stay_id,p_offset);SELECT array_agg((s->>'id')::bigint) INTO ids FROM jsonb_array_elements(result_value->'setups')s;
 RETURN result_value||jsonb_build_object('invoices',coalesce((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('room_quote',i.room_quote-'lines')) FROM (SELECT * FROM rs_final_invoices WHERE tenant_id=current_tenant_id() AND setup_id=ANY(ids) ORDER BY id DESC LIMIT 200)i),'[]'),
 'gl_mappings',coalesce((SELECT jsonb_agg(jsonb_build_object('event_key',event_key,'description',description,'debit_code',debit_code,'credit_code',credit_code)) FROM gl_mappings WHERE is_active),'[]'),
 'cost_centers',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'name',name)) FROM cost_centers WHERE is_active),'[]'));
END $$;
REVOKE ALL ON FUNCTION rs_billing_board(bigint,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_billing_board(bigint,integer) TO authenticated;
COMMIT;
