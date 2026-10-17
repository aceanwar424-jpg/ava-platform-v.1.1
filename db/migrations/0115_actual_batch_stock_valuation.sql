-- OWNED_BY: generic. Actual source batch costing; original stock/selling prices stay intact.
BEGIN;
CREATE TABLE rs_stock_cost_bases(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),batch_id bigint NOT NULL REFERENCES pharmacy_batches(id),receipt_ledger_id bigint UNIQUE REFERENCES pharmacy_stock_ledger(id),basis text NOT NULL CHECK(basis IN('receipt','declared_opening')),unit_cost numeric NOT NULL CHECK(unit_cost>=0 AND unit_cost::text NOT IN('NaN','Infinity','-Infinity')),source_snapshot jsonb NOT NULL,evidence text NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN('draft','active','rejected','revoked')),version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),reviewed_by uuid,reviewed_at timestamptz);
CREATE UNIQUE INDEX rs_stock_cost_one_basis ON rs_stock_cost_bases(tenant_id,batch_id) WHERE state='active';
CREATE TABLE rs_stock_cost_movements(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),kind text NOT NULL CHECK(kind IN('receive','dispense','return','adjust_gain','adjust_loss')),source_id bigint NOT NULL,ledger_id bigint NOT NULL REFERENCES pharmacy_stock_ledger(id),batch_id bigint NOT NULL REFERENCES pharmacy_batches(id),dispense_item_id bigint REFERENCES pharmacy_dispense_items(id),quantity numeric NOT NULL CHECK(quantity<>0 AND quantity::text NOT IN('NaN','Infinity','-Infinity')),source_time timestamptz NOT NULL,source_snapshot jsonb NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),capture_mode text NOT NULL DEFAULT 'live' CHECK(capture_mode IN('live','declared_opening')),declaration_evidence text,UNIQUE(kind,source_id));
CREATE TABLE rs_stock_cost_setups(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),cost_center text NOT NULL,timezone text NOT NULL,amount_decimals integer NOT NULL CHECK(amount_decimals BETWEEN 0 AND 4),currency text NOT NULL CHECK(currency='IDR'),mappings jsonb NOT NULL,accounting_snapshot jsonb NOT NULL,evidence text NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN('draft','active','rejected','revoked')),version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),reviewed_by uuid,reviewed_at timestamptz);
CREATE UNIQUE INDEX rs_stock_cost_one_setup ON rs_stock_cost_setups(tenant_id,cost_center) WHERE state='active';
CREATE TABLE rs_stock_cost_postings(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),movement_id bigint NOT NULL REFERENCES rs_stock_cost_movements(id),setup_id bigint NOT NULL REFERENCES rs_stock_cost_setups(id),quote jsonb NOT NULL,amount numeric NOT NULL CHECK(amount>=0),entry_date date NOT NULL,event_key text NOT NULL,cost_center text NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN('draft','posting','posted','rejected','reversal_review','reversing','voided')),version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),reviewed_by uuid,reviewed_at timestamptz,journal_id bigint REFERENCES journal_entries(id),original_posting_id bigint REFERENCES rs_stock_cost_postings(id),void_requested_by uuid,void_reason text,void_reviewed_by uuid,reversal_id bigint REFERENCES journal_entries(id));
CREATE UNIQUE INDEX rs_stock_cost_one_posting ON rs_stock_cost_postings(movement_id) WHERE state NOT IN('rejected','voided');
CREATE TABLE rs_stock_cost_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE rs_stock_cost_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),actor_id uuid NOT NULL,entity text NOT NULL,ref_id bigint NOT NULL,action text NOT NULL,reason text NOT NULL,before_row jsonb,after_row jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE FUNCTION rs_stock_cost_immutable() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Cost source/history immutable';END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['rs_stock_cost_movements','rs_stock_cost_requests','rs_stock_cost_audit'] LOOP EXECUTE format('CREATE TRIGGER cost_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION rs_stock_cost_immutable()',n);END LOOP;FOREACH n IN ARRAY ARRAY['rs_stock_cost_bases','rs_stock_cost_movements','rs_stock_cost_setups','rs_stock_cost_postings','rs_stock_cost_requests','rs_stock_cost_audit'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);END LOOP;END $$;
CREATE FUNCTION rs_stock_cost_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE allowed text[];BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cost source immutable';END IF;
 IF TG_TABLE_NAME='rs_stock_cost_postings' THEN
  allowed:=ARRAY['state','version','reviewed_by','reviewed_at','journal_id','void_requested_by','void_reason','void_reviewed_by','reversal_id'];
  IF NOT ((OLD.state='draft' AND NEW.state IN('posting','rejected')) OR (OLD.state='posting' AND NEW.state='posted') OR (OLD.state='posted' AND NEW.state='reversal_review') OR (OLD.state='reversal_review' AND NEW.state IN('posted','reversing')) OR (OLD.state='reversing' AND NEW.state='voided')) THEN RAISE EXCEPTION 'Cost posting transition invalid';END IF;
 ELSE
  allowed:=ARRAY['state','version','reviewed_by','reviewed_at'];IF NOT ((OLD.state='draft' AND NEW.state IN('active','rejected')) OR (OLD.state='active' AND NEW.state='revoked')) THEN RAISE EXCEPTION 'Cost review transition invalid';END IF;
 END IF;
 IF NEW.version<>OLD.version+1 OR (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN RAISE EXCEPTION 'Cost snapshot/version immutable';END IF;RETURN NEW;
END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['rs_stock_cost_bases','rs_stock_cost_setups','rs_stock_cost_postings'] LOOP EXECUTE format('CREATE TRIGGER cost_state BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION rs_stock_cost_state_guard()',n);END LOOP;END $$;
CREATE FUNCTION rs_stock_cost_batch_snapshot(p_batch bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT jsonb_build_object('id',b.id,'drug_id',b.drug_id,'drug_code',b.drug_code,'batch_no',b.batch_no,'expiry_date',b.expiry_date,'qty_received',b.qty_received,'received_date',b.received_date,'supplier_name',b.supplier_name,'source_unit_price',b.unit_price) FROM pharmacy_batches b JOIN rs_pharmacy_batch_scopes s ON s.batch_id=b.id AND s.tenant_id=current_tenant_id() WHERE b.id=p_batch$$;
CREATE FUNCTION rs_stock_cost_capture_dispense(p_ledger bigint,p_mode text DEFAULT 'live',p_evidence text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE l pharmacy_stock_ledger;s rs_pharmacy_ledger_scopes;d pharmacy_dispense_items;snapshot jsonb;BEGIN
 SELECT * INTO s FROM rs_pharmacy_ledger_scopes WHERE ledger_id=p_ledger AND tenant_id=current_tenant_id();SELECT * INTO l FROM pharmacy_stock_ledger WHERE id=s.ledger_id;
 IF l.id IS NULL OR l.ref_type<>'dispense' OR l.qty>=0 OR p_mode NOT IN('live','declared_opening') THEN RAISE EXCEPTION 'Dispense ledger tenant invalid';END IF;
 IF (SELECT sum(qty) FROM pharmacy_dispense_items WHERE dispense_id=l.ref_id AND drug_id=l.drug_id) IS DISTINCT FROM -l.qty THEN RAISE EXCEPTION 'Cost quantity dispense/ledger tidak rekonsiliasi';END IF;
 FOR d IN SELECT * FROM pharmacy_dispense_items WHERE dispense_id=l.ref_id AND drug_id=l.drug_id ORDER BY id LOOP
  IF NOT EXISTS(SELECT 1 FROM pharmacy_dispenses h JOIN rs_prescription_contexts c ON c.rx_id=h.rx_id WHERE h.id=d.dispense_id AND c.tenant_id=current_tenant_id()) THEN RAISE EXCEPTION 'Dispense source context tenant invalid';END IF;
  snapshot:=rs_stock_cost_batch_snapshot(d.batch_id);IF snapshot IS NULL OR (snapshot->>'drug_id')::bigint<>d.drug_id THEN RAISE EXCEPTION 'Batch cost tenant/source invalid';END IF;
  INSERT INTO rs_stock_cost_movements(tenant_id,kind,source_id,ledger_id,batch_id,dispense_item_id,quantity,source_time,source_snapshot,created_by,capture_mode,declaration_evidence) VALUES(s.tenant_id,'dispense',d.id,l.id,d.batch_id,d.id,-d.qty,s.created_at,jsonb_build_object('batch',snapshot,'item',to_jsonb(d),'ledger_id',l.id),auth.uid(),p_mode,p_evidence) ON CONFLICT(kind,source_id) DO NOTHING;
 END LOOP;
END $$;
CREATE FUNCTION rs_stock_cost_capture_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE l pharmacy_stock_ledger;snapshot jsonb;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM current_tenant_id() OR NEW.actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cost source actor/tenant invalid';END IF;
 SELECT * INTO l FROM pharmacy_stock_ledger WHERE id=NEW.ledger_id;
 IF l.ref_type='receive' THEN
  snapshot:=rs_stock_cost_batch_snapshot(l.ref_id);IF snapshot IS NULL OR (snapshot->>'drug_id')::bigint<>l.drug_id OR l.qty<=0 OR (snapshot->>'source_unit_price')::numeric IS DISTINCT FROM l.unit_price THEN RAISE EXCEPTION 'Source receipt cost tidak konsisten';END IF;
  INSERT INTO rs_stock_cost_movements(tenant_id,kind,source_id,ledger_id,batch_id,quantity,source_time,source_snapshot,created_by) VALUES(NEW.tenant_id,'receive',l.id,l.id,l.ref_id,l.qty,NEW.created_at,jsonb_build_object('batch',snapshot,'ledger_id',l.id),NEW.actor_id);
  INSERT INTO rs_stock_cost_bases(tenant_id,batch_id,receipt_ledger_id,basis,unit_cost,source_snapshot,evidence,created_by) VALUES(NEW.tenant_id,l.ref_id,l.id,'receipt',l.unit_price,snapshot,'Source penerimaan #'||l.id||'; review invoice/bukti perolehan wajib',NEW.actor_id);
 ELSIF l.ref_type='dispense' THEN PERFORM rs_stock_cost_capture_dispense(l.id);END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_stock_cost_capture AFTER INSERT ON rs_pharmacy_ledger_scopes FOR EACH ROW EXECUTE FUNCTION rs_stock_cost_capture_scope();
CREATE FUNCTION rs_stock_cost_capture_return() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE d pharmacy_dispense_items;l pharmacy_stock_ledger;s rs_pharmacy_ledger_scopes;snapshot jsonb;BEGIN
 IF NEW.kind='return' AND NEW.state='posted' AND OLD.state IS DISTINCT FROM 'posted' THEN
  SELECT * INTO d FROM pharmacy_dispense_items WHERE id=NEW.dispense_item_id;SELECT * INTO l FROM pharmacy_stock_ledger WHERE id=NEW.source_ledger_id;SELECT * INTO s FROM rs_pharmacy_ledger_scopes WHERE ledger_id=l.id AND tenant_id=NEW.tenant_id;
  snapshot:=rs_stock_cost_batch_snapshot(d.batch_id);IF NEW.tenant_id IS DISTINCT FROM current_tenant_id() OR s.ledger_id IS NULL OR l.qty IS DISTINCT FROM NEW.quantity OR l.ref_type<>'adjust' OR l.ref_id IS DISTINCT FROM d.batch_id OR snapshot IS NULL THEN RAISE EXCEPTION 'Cost retur/stock source invalid';END IF;
  INSERT INTO rs_stock_cost_movements(tenant_id,kind,source_id,ledger_id,batch_id,dispense_item_id,quantity,source_time,source_snapshot,created_by) VALUES(NEW.tenant_id,'return',NEW.id,l.id,d.batch_id,d.id,NEW.quantity,NEW.reviewed_at,jsonb_build_object('batch',snapshot,'custody_id',NEW.id,'dispense_item_id',d.id,'ledger_id',l.id),auth.uid());
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_stock_cost_return AFTER UPDATE ON rs_medication_custody_events FOR EACH ROW EXECUTE FUNCTION rs_stock_cost_capture_return();
ALTER FUNCTION rs_pharmacy_stock_command(text,jsonb,text) RENAME TO rs_pharmacy_stock_command_before_cost;
REVOKE ALL ON FUNCTION rs_pharmacy_stock_command_before_cost(text,jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_pharmacy_stock_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE prior boolean;before_id bigint;result jsonb;l pharmacy_stock_ledger;BEGIN
 SELECT EXISTS(SELECT 1 FROM rs_pharmacy_requests WHERE tenant_id=current_tenant_id() AND request_key=p_key) INTO prior;SELECT coalesce(max(id),0) INTO before_id FROM pharmacy_stock_ledger;
 result:=rs_pharmacy_stock_command_before_cost(p_action,p_data,p_key);
 IF p_action='adjust' AND NOT prior THEN FOR l IN SELECT e.* FROM pharmacy_stock_ledger e JOIN rs_pharmacy_ledger_scopes s ON s.ledger_id=e.id WHERE e.id>before_id AND e.ref_type='adjust' AND e.ref_id=(p_data->>'batch_id')::bigint AND e.qty=(p_data->>'qty')::numeric AND s.tenant_id=current_tenant_id() AND s.actor_id=auth.uid() AND NOT EXISTS(SELECT 1 FROM rs_medication_custody_events c WHERE c.source_ledger_id=e.id) ORDER BY e.id LOOP
  INSERT INTO rs_stock_cost_movements(tenant_id,kind,source_id,ledger_id,batch_id,quantity,source_time,source_snapshot,created_by) VALUES(current_tenant_id(),CASE WHEN l.qty>0 THEN 'adjust_gain' ELSE 'adjust_loss' END,l.id,l.id,l.ref_id,l.qty,(SELECT created_at FROM rs_pharmacy_ledger_scopes WHERE ledger_id=l.id),jsonb_build_object('batch',rs_stock_cost_batch_snapshot(l.ref_id),'ledger_id',l.id),auth.uid()) ON CONFLICT(kind,source_id) DO NOTHING;
 END LOOP;END IF;RETURN result;
END $$;
CREATE FUNCTION rs_stock_cost_mapping_snapshot(p_center text,p_mappings jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$DECLARE kind text;x jsonb;out_value jsonb:='{}';BEGIN
 IF jsonb_typeof(p_mappings) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Mapping biaya eksplisit wajib';END IF;
 FOREACH kind IN ARRAY ARRAY['receive','dispense','return','adjust_gain','adjust_loss'] LOOP
  IF left(coalesce(p_mappings->>kind,''),length('rs.stock.cost.'||current_tenant_id()::text||'.')) IS DISTINCT FROM 'rs.stock.cost.'||current_tenant_id()::text||'.' THEN RAISE EXCEPTION 'Event mapping % wajib namespace biaya tenant',kind;END IF;
  x:=rs_invoice_accounting_snapshot(p_mappings->>kind,p_center);IF x IS NULL OR x->'debit'->>'code'=x->'credit'->>'code' THEN RAISE EXCEPTION 'Mapping/account/center % aktif dan berbeda wajib',kind;END IF;out_value:=out_value||jsonb_build_object(kind,x);
 END LOOP;
 IF out_value->'return'->'debit'->>'code' IS DISTINCT FROM out_value->'dispense'->'credit'->>'code' OR out_value->'return'->'credit'->>'code' IS DISTINCT FROM out_value->'dispense'->'debit'->>'code' THEN RAISE EXCEPTION 'Mapping return wajib kebalikan dispensing';END IF;RETURN out_value;
END $$;
CREATE FUNCTION rs_stock_cost_lock_mapping(p_center text,p_mappings jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$BEGIN
 PERFORM 1 FROM gl_mappings WHERE event_key IN(SELECT value FROM jsonb_each_text(p_mappings)) ORDER BY event_key FOR SHARE;
 PERFORM 1 FROM chart_of_accounts WHERE code IN(SELECT debit_code FROM gl_mappings WHERE event_key IN(SELECT value FROM jsonb_each_text(p_mappings)) UNION SELECT credit_code FROM gl_mappings WHERE event_key IN(SELECT value FROM jsonb_each_text(p_mappings))) ORDER BY code FOR SHARE;
 PERFORM 1 FROM cost_centers WHERE code=p_center FOR SHARE;
END $$;
CREATE FUNCTION rs_stock_cost_quote(p_movement bigint,p_setup bigint,p_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE m rs_stock_cost_movements;s rs_stock_cost_setups;b rs_stock_cost_bases;original rs_stock_cost_postings;origin rs_stock_cost_movements;unit_cost numeric;amount_value numeric;returned_qty numeric;returned_amount numeric;quote_value jsonb;BEGIN
 PERFORM set_config('TimeZone','UTC',true);
 SELECT * INTO m FROM rs_stock_cost_movements WHERE id=p_movement AND tenant_id=current_tenant_id();SELECT * INTO s FROM rs_stock_cost_setups WHERE id=p_setup AND tenant_id=current_tenant_id() FOR SHARE;
 IF m.id IS NULL OR s.id IS NULL OR s.state<>'active' OR p_date IS NULL OR p_date>(clock_timestamp() AT TIME ZONE s.timezone)::date OR p_date<(m.source_time AT TIME ZONE s.timezone)::date THEN RAISE EXCEPTION 'Movement/setup aktif/tanggal sumber biaya tidak valid';END IF;
 PERFORM rs_stock_cost_lock_mapping(s.cost_center,s.mappings);IF s.accounting_snapshot IS DISTINCT FROM rs_stock_cost_mapping_snapshot(s.cost_center,s.mappings) THEN RAISE EXCEPTION 'Mapping setup berubah; review setup baru';END IF;
 IF m.kind='return' THEN
  SELECT * INTO origin FROM rs_stock_cost_movements WHERE tenant_id=m.tenant_id AND kind='dispense' AND dispense_item_id=m.dispense_item_id;
  SELECT * INTO original FROM rs_stock_cost_postings WHERE movement_id=origin.id AND tenant_id=m.tenant_id AND state='posted' FOR UPDATE;
  IF original.id IS NULL THEN RAISE EXCEPTION 'Biaya dispensing asli posted wajib untuk return';END IF;
  IF s.cost_center IS DISTINCT FROM original.cost_center OR s.currency IS DISTINCT FROM original.quote->'setup'->>'currency' OR s.accounting_snapshot->'return'->'debit'->>'code' IS DISTINCT FROM original.quote->'accounting'->'credit'->>'code' OR s.accounting_snapshot->'return'->'credit'->>'code' IS DISTINCT FROM original.quote->'accounting'->'debit'->>'code' THEN RAISE EXCEPTION 'Return account/center/currency harus membalik dispensing asli';END IF;
  SELECT coalesce(sum(r.quantity),0),coalesce(sum(p.amount),0) INTO returned_qty,returned_amount FROM rs_stock_cost_postings p JOIN rs_stock_cost_movements r ON r.id=p.movement_id WHERE p.original_posting_id=original.id AND p.state IN('posted','reversal_review');
  IF returned_qty+m.quantity>abs(origin.quantity) OR returned_amount>original.amount THEN RAISE EXCEPTION 'Cost return quantity/value melebihi dispensing';END IF;
  unit_cost:=(original.quote->>'unit_cost')::numeric;
  IF returned_qty+m.quantity=abs(origin.quantity) THEN amount_value:=original.amount-returned_amount;ELSE amount_value:=least(round(m.quantity*unit_cost,s.amount_decimals),original.amount-returned_amount);END IF;
  quote_value:=jsonb_build_object('original_posting_id',original.id,'original_quote',original.quote,'returned_quantity',returned_qty,'returned_amount',returned_amount,'original_version',original.version);
 ELSE
  SELECT * INTO b FROM rs_stock_cost_bases WHERE tenant_id=m.tenant_id AND batch_id=m.batch_id AND state='active' FOR SHARE;
  IF b.id IS NULL OR b.source_snapshot IS DISTINCT FROM rs_stock_cost_batch_snapshot(m.batch_id) THEN RAISE EXCEPTION 'Biaya batch belum direview atau source berubah; tidak dianggap nol';END IF;
  unit_cost:=b.unit_cost;amount_value:=round(abs(m.quantity)*unit_cost,s.amount_decimals);quote_value:=jsonb_build_object('basis',to_jsonb(b));
 END IF;
 RETURN quote_value||jsonb_build_object('movement',to_jsonb(m),'setup',to_jsonb(s),'unit_cost',unit_cost,'amount',amount_value,'accounting',s.accounting_snapshot->m.kind,'event_key',s.mappings->>m.kind,'entry_date',p_date);
END $$;
CREATE FUNCTION rs_stock_cost_lock_period(p_day date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE period_value text:=to_char(p_day,'YYYY-MM');status_value text;BEGIN
 IF p_day IS NULL THEN RAISE EXCEPTION 'Tanggal periode biaya wajib';END IF;
 INSERT INTO accounting_periods(period,status) VALUES(period_value,'Buka') ON CONFLICT(period) DO NOTHING;
 SELECT status INTO status_value FROM accounting_periods WHERE period=period_value FOR SHARE;
 IF status_value IS DISTINCT FROM 'Buka' THEN RAISE EXCEPTION 'Periode biaya sudah ditutup: %',period_value;END IF;
END $$;
CREATE FUNCTION rs_stock_cost_posting_action(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;p rs_stock_cost_postings;m rs_stock_cost_movements;old_value jsonb;quote_value jsonb;j jsonb;id_value bigint;BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','finance','finance_staff']);
 IF p_action='create' THEN
  SELECT * INTO m FROM rs_stock_cost_movements WHERE id=(p_data->>'movement_id')::bigint AND tenant_id=t FOR UPDATE;
  IF m.id IS NULL OR coalesce(p_data->>'entry_date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Movement/tanggal cost eksplisit wajib';END IF;
  quote_value:=rs_stock_cost_quote(m.id,(p_data->>'setup_id')::bigint,(p_data->>'entry_date')::date);
  INSERT INTO rs_stock_cost_postings(tenant_id,movement_id,setup_id,quote,amount,entry_date,event_key,cost_center,created_by,original_posting_id) VALUES(t,m.id,(p_data->>'setup_id')::bigint,quote_value,(quote_value->>'amount')::numeric,(p_data->>'entry_date')::date,quote_value->>'event_key',quote_value->'setup'->>'cost_center',a,(quote_value->>'original_posting_id')::bigint) RETURNING * INTO p;
 ELSE
  SELECT movement_id INTO id_value FROM rs_stock_cost_postings WHERE id=(p_data->>'id')::bigint AND tenant_id=t;PERFORM 1 FROM rs_stock_cost_movements WHERE id=id_value FOR UPDATE;
  SELECT * INTO p FROM rs_stock_cost_postings WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;old_value:=to_jsonb(p);
  IF p.id IS NULL OR p.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Posting cost state/version berubah';END IF;
  IF p_action IN('approve','reject') THEN
   IF p.state<>'draft' OR p.created_by=a THEN RAISE EXCEPTION 'Reviewer posting berbeda wajib';END IF;
   IF p_action='approve' THEN
    quote_value:=rs_stock_cost_quote(p.movement_id,p.setup_id,p.entry_date);IF quote_value IS DISTINCT FROM p.quote THEN RAISE EXCEPTION 'Quote/sumber cost berubah; reject lalu draft baru';END IF;
    PERFORM set_config('TimeZone',p.quote->'setup'->>'timezone',true);
    PERFORM rs_stock_cost_lock_period(p.entry_date);
    UPDATE rs_stock_cost_postings SET state='posting',version=version+1,reviewed_by=a,reviewed_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
    j:=post_journal(p.event_key,p.amount,'Biaya batch aktual #'||p.id,'rs_stock_cost',p.id,p.cost_center,p.entry_date);IF j->>'ok' IS DISTINCT FROM 'true' OR (p.amount>0 AND j->>'entry_id' IS NULL) THEN RAISE EXCEPTION 'Source cost journal gagal';END IF;
    UPDATE rs_stock_cost_postings SET state='posted',journal_id=(j->>'entry_id')::bigint,version=version+1 WHERE id=p.id RETURNING * INTO p;
   ELSE UPDATE rs_stock_cost_postings SET state='rejected',reviewed_by=a,reviewed_at=clock_timestamp(),version=version+1 WHERE id=p.id RETURNING * INTO p;END IF;
  ELSIF p_action='request_void' THEN
   IF p.state<>'posted' OR EXISTS(SELECT 1 FROM rs_stock_cost_postings WHERE original_posting_id=p.id AND state NOT IN('rejected','voided')) THEN RAISE EXCEPTION 'Posting cost/return masih aktif; reversal return dahulu';END IF;
   UPDATE rs_stock_cost_postings SET state='reversal_review',void_requested_by=a,void_reason=p_data->>'reason',version=version+1 WHERE id=p.id RETURNING * INTO p;
  ELSIF p_action IN('approve_void','reject_void') THEN
   IF p.state<>'reversal_review' OR p.void_requested_by=a THEN RAISE EXCEPTION 'Reviewer reversal berbeda wajib';END IF;
   IF p_action='approve_void' THEN
    IF EXISTS(SELECT 1 FROM rs_stock_cost_postings WHERE original_posting_id=p.id AND state NOT IN('rejected','voided')) THEN RAISE EXCEPTION 'Return cost masih aktif';END IF;
    PERFORM set_config('TimeZone',p.quote->'setup'->>'timezone',true);PERFORM rs_stock_cost_lock_period(current_date);
    UPDATE rs_stock_cost_postings SET state='reversing',void_reviewed_by=a,version=version+1 WHERE id=p.id RETURNING * INTO p;
    IF p.journal_id IS NOT NULL THEN j:=reverse_journal(p.journal_id,p.void_reason);IF j->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Source cost reversal gagal';END IF;END IF;
    UPDATE rs_stock_cost_postings SET state='voided',reversal_id=(SELECT id FROM journal_entries WHERE reversal_of=p.journal_id ORDER BY id DESC LIMIT 1),version=version+1 WHERE id=p.id RETURNING * INTO p;
   ELSE UPDATE rs_stock_cost_postings SET state='posted',void_reviewed_by=a,version=version+1 WHERE id=p.id RETURNING * INTO p;END IF;
  ELSE RAISE EXCEPTION 'Cost posting action invalid';END IF;
 END IF;RETURN jsonb_build_object('record',to_jsonb(p),'before',old_value);
END $$;
CREATE FUNCTION rs_stock_cost_command(p_entity text,p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;r rs_stock_cost_requests;b rs_stock_cost_bases;s rs_stock_cost_setups;input_value jsonb:=jsonb_build_object('entity',p_entity,'action',p_action,'data',p_data);out_value jsonb;old_value jsonb;snapshot jsonb;helper jsonb;id_value bigint;kind text;key_value text;maps jsonb;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','finance','finance_staff','pharmacist','apoteker']);
 IF p_entity IS NULL OR p_entity NOT IN('basis','setup','posting','opening') OR p_action IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Cost entity/input/key/alasan wajib';END IF;
 IF p_entity IN('setup','posting') OR (p_entity='basis' AND p_action IN('approve','reject','revoke')) THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','finance','finance_staff']);END IF;
 IF p_action IN('approve','approve_void') AND coalesce(length(trim(p_data->>'review_evidence')),0)<5 THEN RAISE EXCEPTION 'Bukti review biaya independen wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||p_key,0));SELECT * INTO r FROM rs_stock_cost_requests WHERE tenant_id=t AND request_key=p_key;IF FOUND THEN IF r.actor_id<>a OR r.input<>input_value THEN RAISE EXCEPTION 'Retry cost actor/input berbeda';END IF;RETURN r.result;END IF;
 IF p_entity='basis' THEN
  IF p_action='create' THEN
   PERFORM 1 FROM pharmacy_batches b0 JOIN rs_pharmacy_batch_scopes bs ON bs.batch_id=b0.id WHERE b0.id=(p_data->>'batch_id')::bigint AND bs.tenant_id=t FOR SHARE OF b0,bs;snapshot:=rs_stock_cost_batch_snapshot((p_data->>'batch_id')::bigint);
   IF snapshot IS NULL OR jsonb_typeof(p_data->'unit_cost') IS DISTINCT FROM 'number' OR (p_data->>'unit_cost')::numeric<0 OR (p_data->>'unit_cost')::numeric>1000000000000 OR (p_data->>'unit_cost')::numeric<>round((p_data->>'unit_cost')::numeric,8) OR coalesce(length(trim(p_data->>'evidence')),0)<5 THEN RAISE EXCEPTION 'Batch tenant/biaya deklaratif/bukti wajib';END IF;
   INSERT INTO rs_stock_cost_bases(tenant_id,batch_id,basis,unit_cost,source_snapshot,evidence,created_by) VALUES(t,(p_data->>'batch_id')::bigint,'declared_opening',(p_data->>'unit_cost')::numeric,snapshot,p_data->>'evidence',a) RETURNING * INTO b;
  ELSE
   SELECT batch_id INTO id_value FROM rs_stock_cost_bases WHERE id=(p_data->>'id')::bigint AND tenant_id=t;PERFORM 1 FROM pharmacy_batches WHERE id=id_value FOR UPDATE;SELECT * INTO b FROM rs_stock_cost_bases WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;old_value:=to_jsonb(b);
   IF b.id IS NULL OR b.version IS DISTINCT FROM (p_data->>'version')::integer OR b.created_by=a OR b.state IS DISTINCT FROM (CASE WHEN p_action='revoke' THEN 'active' ELSE 'draft' END) THEN RAISE EXCEPTION 'Biaya state/version/reviewer berbeda wajib';END IF;
   IF p_action='approve' AND (b.source_snapshot IS DISTINCT FROM rs_stock_cost_batch_snapshot(b.batch_id) OR EXISTS(SELECT 1 FROM rs_stock_cost_bases WHERE batch_id=b.batch_id AND tenant_id=t AND state='active')) THEN RAISE EXCEPTION 'Source biaya berubah/basis aktif sudah ada';END IF;
   IF p_action NOT IN('approve','reject','revoke') THEN RAISE EXCEPTION 'Cost basis action invalid';END IF;
   UPDATE rs_stock_cost_bases SET state=CASE p_action WHEN 'approve' THEN 'active' WHEN 'revoke' THEN 'revoked' ELSE 'rejected' END,version=version+1,reviewed_by=a,reviewed_at=clock_timestamp() WHERE id=b.id RETURNING * INTO b;
  END IF;out_value:=to_jsonb(b);id_value:=b.id;
 ELSIF p_entity='setup' THEN
  IF p_action='create' THEN
   IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_data->>'timezone') OR jsonb_typeof(p_data->'amount_decimals') IS DISTINCT FROM 'number' OR (p_data->>'amount_decimals')::numeric<>trunc((p_data->>'amount_decimals')::numeric) OR (p_data->>'amount_decimals')::integer NOT BETWEEN 0 AND 4 OR p_data->>'currency' IS DISTINCT FROM 'IDR' OR coalesce(length(trim(p_data->>'evidence')),0)<5 THEN RAISE EXCEPTION 'Setup timezone/currency/presisi/bukti eksplisit wajib';END IF;
   maps:=p_data->'mappings';
   IF p_data ? 'accounts' THEN
    IF jsonb_typeof(p_data->'accounts') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Akun sumber eksplisit wajib';END IF;maps:='{}';
    FOREACH kind IN ARRAY ARRAY['receive','dispense','return','adjust_gain','adjust_loss'] LOOP
     IF coalesce(p_data->'accounts'->kind->>'debit','')='' OR coalesce(p_data->'accounts'->kind->>'credit','')='' THEN RAISE EXCEPTION 'Akun debit/kredit % wajib',kind;END IF;
     key_value:='rs.stock.cost.'||t::text||'.'||p_key||'.'||kind;
     INSERT INTO gl_mappings(event_key,debit_code,credit_code,description,is_active) VALUES(key_value,p_data->'accounts'->kind->>'debit',p_data->'accounts'->kind->>'credit','Stock cost setup: '||kind,true);
     maps:=maps||jsonb_build_object(kind,key_value);
    END LOOP;
   END IF;
   PERFORM rs_stock_cost_lock_mapping(p_data->>'cost_center',maps);snapshot:=rs_stock_cost_mapping_snapshot(p_data->>'cost_center',maps);
   INSERT INTO rs_stock_cost_setups(tenant_id,cost_center,timezone,amount_decimals,currency,mappings,accounting_snapshot,evidence,created_by) VALUES(t,p_data->>'cost_center',p_data->>'timezone',(p_data->>'amount_decimals')::integer,p_data->>'currency',maps,snapshot,p_data->>'evidence',a) RETURNING * INTO s;
  ELSE
   SELECT * INTO s FROM rs_stock_cost_setups WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;old_value:=to_jsonb(s);
   IF s.id IS NULL OR s.version IS DISTINCT FROM (p_data->>'version')::integer OR s.created_by=a OR s.state IS DISTINCT FROM (CASE WHEN p_action='revoke' THEN 'active' ELSE 'draft' END) THEN RAISE EXCEPTION 'Setup state/version/reviewer berbeda wajib';END IF;
   PERFORM rs_stock_cost_lock_mapping(s.cost_center,s.mappings);IF p_action='approve' AND s.accounting_snapshot IS DISTINCT FROM rs_stock_cost_mapping_snapshot(s.cost_center,s.mappings) THEN RAISE EXCEPTION 'Source GL setup berubah';END IF;
   IF p_action NOT IN('approve','reject','revoke') THEN RAISE EXCEPTION 'Cost setup action invalid';END IF;
   UPDATE rs_stock_cost_setups SET state=CASE p_action WHEN 'approve' THEN 'active' WHEN 'revoke' THEN 'revoked' ELSE 'rejected' END,version=version+1,reviewed_by=a,reviewed_at=clock_timestamp() WHERE id=s.id RETURNING * INTO s;
  END IF;out_value:=to_jsonb(s);id_value:=s.id;
 ELSIF p_entity='opening' THEN
  IF p_action<>'declare_dispense' OR coalesce(length(trim(p_data->>'evidence')),0)<5 THEN RAISE EXCEPTION 'Deklarasi opening source dispense/bukti wajib';END IF;
  PERFORM rs_stock_cost_capture_dispense((p_data->>'ledger_id')::bigint,'declared_opening',p_data->>'evidence');out_value:=jsonb_build_object('id',(p_data->>'ledger_id')::bigint,'declared',true);id_value:=(p_data->>'ledger_id')::bigint;
 ELSE
  helper:=rs_stock_cost_posting_action(p_action,p_data);out_value:=helper->'record';old_value:=helper->'before';id_value:=(out_value->>'id')::bigint;
 END IF;
 INSERT INTO rs_stock_cost_audit(tenant_id,actor_id,entity,ref_id,action,reason,before_row,after_row) VALUES(t,a,p_entity,id_value,p_action,p_data->>'reason',old_value,out_value||jsonb_build_object('review_evidence',p_data->>'review_evidence'));INSERT INTO rs_stock_cost_requests VALUES(t,p_key,a,input_value,out_value);RETURN out_value;
END $$;
ALTER FUNCTION post_journal(text,numeric,text,text,bigint,text,date) RENAME TO post_journal_before_stock_cost;
ALTER FUNCTION reverse_journal(bigint,text) RENAME TO reverse_journal_before_stock_cost;
REVOKE ALL ON FUNCTION post_journal_before_stock_cost(text,numeric,text,text,bigint,text,date),reverse_journal_before_stock_cost(bigint,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION post_journal(p_event_key text,p_amount numeric,p_description text,p_source_type text DEFAULT 'manual',p_source_id bigint DEFAULT NULL,p_cost_center text DEFAULT NULL,p_date date DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE p rs_stock_cost_postings;BEGIN
 IF left(p_event_key,14)='rs.stock.cost.' AND p_source_type IS DISTINCT FROM 'rs_stock_cost' THEN RAISE EXCEPTION 'Event biaya hanya dari review source cost';END IF;
 IF p_source_type='rs_stock_cost' THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','finance','finance_staff']);SELECT * INTO p FROM rs_stock_cost_postings WHERE id=p_source_id AND tenant_id=current_tenant_id();IF p.id IS NULL OR p.state IS DISTINCT FROM 'posting' OR p.reviewed_by IS DISTINCT FROM auth.uid() OR p.amount IS DISTINCT FROM p_amount OR p.event_key IS DISTINCT FROM p_event_key OR p.cost_center IS DISTINCT FROM p_cost_center OR p.entry_date IS DISTINCT FROM p_date THEN RAISE EXCEPTION 'Jurnal biaya hanya dari review source cost';END IF;END IF;
 RETURN post_journal_before_stock_cost(p_event_key,p_amount,p_description,p_source_type,p_source_id,p_cost_center,p_date);
END $$;
CREATE FUNCTION reverse_journal(p_entry_id bigint,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE e journal_entries;p rs_stock_cost_postings;BEGIN
 SELECT * INTO e FROM journal_entries WHERE id=p_entry_id;IF e.source_type='rs_stock_cost' THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','finance','finance_staff']);SELECT * INTO p FROM rs_stock_cost_postings WHERE id=e.source_id AND tenant_id=current_tenant_id();IF p.id IS NULL OR p.state IS DISTINCT FROM 'reversing' OR p.void_reviewed_by IS DISTINCT FROM auth.uid() OR p.journal_id IS DISTINCT FROM p_entry_id OR p.void_reason IS DISTINCT FROM p_reason OR e.is_reversal OR EXISTS(SELECT 1 FROM journal_entries WHERE reversal_of=e.id) THEN RAISE EXCEPTION 'Reversal biaya hanya dari review source cost';END IF;END IF;
 RETURN reverse_journal_before_stock_cost(p_entry_id,p_reason);
END $$;
DO $$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('rs_invoice_journal_visible(text,bigint)'::regprocedure) INTO body;IF position('ELSE true END' IN body)=0 THEN RAISE EXCEPTION 'Journal visibility contract changed';END IF;
 body:=replace(body,'ELSE true END','WHEN p_type=''rs_stock_cost'' THEN EXISTS(SELECT 1 FROM rs_stock_cost_postings p JOIN user_profiles u ON u.id=auth.uid() AND u.tenant_id=p.tenant_id WHERE p.id=p_source AND p.tenant_id=current_tenant_id() AND lower(u.role) IN (''super_admin'',''head_operation'',''direktur'',''finance'',''finance_staff'')) ELSE true END');EXECUTE body;
 SELECT pg_get_functiondef('rs_invoice_journal_immutable()'::regprocedure) INTO body;IF position('''rs_final_invoice'',''rs_cashier_intent''' IN body)=0 THEN RAISE EXCEPTION 'Journal immutable contract changed';END IF;body:=replace(body,'''rs_final_invoice'',''rs_cashier_intent''','''rs_final_invoice'',''rs_cashier_intent'',''rs_stock_cost''');EXECUTE body;
END $$;
ALTER POLICY rs_journal_invoice_scope ON journal_entries USING(rs_invoice_journal_visible(source_type,source_id)) WITH CHECK(source_type IS NULL OR source_type NOT IN('rs_final_invoice','rs_cashier_intent','rs_payer_claim','rs_stock_cost'));
ALTER POLICY rs_journal_line_invoice_scope ON journal_lines USING(rs_invoice_line_visible(entry_id)) WITH CHECK(NOT EXISTS(SELECT 1 FROM journal_entries e WHERE e.id=entry_id AND e.source_type IN('rs_final_invoice','rs_cashier_intent','rs_payer_claim','rs_stock_cost')));
CREATE FUNCTION rs_stock_cost_board(p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE t uuid:=current_tenant_id();BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','finance','finance_staff','pharmacist','apoteker']);IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset cost invalid';END IF;
 RETURN jsonb_build_object('bases',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM(SELECT * FROM rs_stock_cost_bases WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)b),'[]'),'setups',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM(SELECT * FROM rs_stock_cost_setups WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)s),'[]'),
 'movements',coalesce((SELECT jsonb_agg(to_jsonb(m)||jsonb_build_object('unpriced',NOT EXISTS(SELECT 1 FROM rs_stock_cost_bases b WHERE b.batch_id=m.batch_id AND b.tenant_id=t AND b.state='active'),'posting_state',(SELECT p.state FROM rs_stock_cost_postings p WHERE p.movement_id=m.id AND p.state NOT IN('rejected','voided') ORDER BY id DESC LIMIT 1))) FROM(SELECT * FROM rs_stock_cost_movements WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)m),'[]'),
 'postings',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('basis_current',CASE WHEN p.original_posting_id IS NOT NULL THEN EXISTS(SELECT 1 FROM rs_stock_cost_postings original WHERE original.id=p.original_posting_id AND original.tenant_id=t AND original.state='posted') ELSE EXISTS(SELECT 1 FROM rs_stock_cost_bases b WHERE b.id=(p.quote->'basis'->>'id')::bigint AND b.tenant_id=t AND b.state='active' AND b.source_snapshot=rs_stock_cost_batch_snapshot(b.batch_id)) END)) FROM(SELECT * FROM rs_stock_cost_postings WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)p),'[]'),
 'batches',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',d.generic_name,'batch_no',b.batch_no,'remaining',b.qty_remaining,'source_unit_price',b.unit_price)) FROM(SELECT b.* FROM pharmacy_batches b JOIN rs_pharmacy_batch_scopes s ON s.batch_id=b.id AND s.tenant_id=t ORDER BY b.id DESC LIMIT 51 OFFSET p_offset)b JOIN pharmacy_drugs d ON d.id=b.drug_id),'[]'),
 'gl_mappings',coalesce((SELECT jsonb_agg(jsonb_build_object('event_key',event_key,'debit_code',debit_code,'credit_code',credit_code)) FROM gl_mappings WHERE is_active AND event_key LIKE 'rs.stock.cost.'||t::text||'.%'),'[]'),'accounts',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'name',name,'type',acc_type) ORDER BY code) FROM chart_of_accounts WHERE is_active),'[]'),'cost_centers',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'name',name)) FROM cost_centers WHERE is_active),'[]'));
END $$;
CREATE FUNCTION rs_stock_cost_history(p_entity text,p_id bigint,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE t uuid:=current_tenant_id();name text;owned boolean;BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','finance','finance_staff','pharmacist','apoteker']);IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset cost history invalid';END IF;name:=CASE p_entity WHEN 'basis' THEN 'rs_stock_cost_bases' WHEN 'setup' THEN 'rs_stock_cost_setups' WHEN 'posting' THEN 'rs_stock_cost_postings' END;IF name IS NULL THEN RAISE EXCEPTION 'Cost history entity invalid';END IF;EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE id=$1 AND tenant_id=$2)',name) INTO owned USING p_id,t;IF NOT owned THEN RAISE EXCEPTION 'Cost history tenant invalid';END IF;
 RETURN jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(a)-'before_row'-'after_row'||jsonb_build_object('actor_name',u.full_name,'before_state',a.before_row->>'state','after_state',a.after_row->>'state','review_evidence',a.after_row->>'review_evidence')) FROM(SELECT * FROM rs_stock_cost_audit WHERE tenant_id=t AND entity=p_entity AND ref_id=p_id ORDER BY id DESC LIMIT 51 OFFSET p_offset)a LEFT JOIN user_profiles u ON u.id=a.actor_id AND u.tenant_id=t),'[]'));
END $$;
CREATE FUNCTION rs_stock_cost_choices(p_kind text,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$DECLARE t uuid:=current_tenant_id();rows_value jsonb;BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','finance','finance_staff','pharmacist','apoteker']);IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset cost choices invalid';END IF;
 IF p_kind='setup' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'label',s.cost_center||' · '||s.timezone||' · '||s.currency||' · v'||s.version)),'[]') INTO rows_value FROM(SELECT * FROM rs_stock_cost_setups WHERE tenant_id=t AND state='active' ORDER BY id DESC LIMIT 51 OFFSET p_offset)s;
 ELSIF p_kind='batch' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'label',b.batch_no||' · '||d.generic_name)),'[]') INTO rows_value FROM(SELECT b.* FROM pharmacy_batches b JOIN rs_pharmacy_batch_scopes s ON s.batch_id=b.id AND s.tenant_id=t ORDER BY b.id DESC LIMIT 51 OFFSET p_offset)b JOIN pharmacy_drugs d ON d.id=b.drug_id;
 ELSIF p_kind='opening_dispense' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'label','Ledger #'||l.id||' · '||l.drug_name||' · qty '||abs(l.qty))),'[]') INTO rows_value FROM(SELECT l.* FROM pharmacy_stock_ledger l JOIN rs_pharmacy_ledger_scopes s ON s.ledger_id=l.id AND s.tenant_id=t WHERE l.ref_type='dispense' AND EXISTS(SELECT 1 FROM pharmacy_dispense_items d JOIN pharmacy_dispenses h ON h.id=d.dispense_id JOIN rs_prescription_contexts c ON c.rx_id=h.rx_id AND c.tenant_id=t WHERE d.dispense_id=l.ref_id AND d.drug_id=l.drug_id AND NOT EXISTS(SELECT 1 FROM rs_stock_cost_movements m WHERE m.kind='dispense' AND m.source_id=d.id)) ORDER BY l.id DESC LIMIT 51 OFFSET p_offset)l;
 ELSE RAISE EXCEPTION 'Cost choices kind invalid';END IF;RETURN jsonb_build_object('rows',rows_value);
END $$;
DO $$DECLARE sig text;BEGIN FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'rs_stock_cost_%' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||sig||' FROM PUBLIC,anon,authenticated';END LOOP;END $$;
GRANT EXECUTE ON FUNCTION rs_stock_cost_command(text,text,jsonb,text),rs_stock_cost_board(integer),rs_stock_cost_history(text,bigint,integer),rs_stock_cost_choices(text,integer) TO authenticated;
REVOKE ALL ON FUNCTION rs_pharmacy_stock_command(text,jsonb,text),post_journal(text,numeric,text,text,bigint,text,date),reverse_journal(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_pharmacy_stock_command(text,jsonb,text),post_journal(text,numeric,text,text,bigint,text,date),reverse_journal(bigint,text) TO authenticated;
INSERT INTO roles(kode,label) VALUES('pharmacist','Apoteker'),('finance','Keuangan') ON CONFLICT DO NOTHING;
INSERT INTO role_pages(role_kode,page) SELECT r.kode,p.page FROM roles r CROSS JOIN(VALUES('cfg-medicine'),('cfg-medicine-reference'))p(page) WHERE r.kode IN('super_admin','head_operation','direktur','finance','finance_staff','pharmacist','apoteker') ON CONFLICT DO NOTHING;
COMMIT;
