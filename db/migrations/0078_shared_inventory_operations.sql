-- OWNED_BY: generic. Extends existing inventory ledger; no item keys changed.
BEGIN;
-- Ownership metadata references existing IDs; legacy master keys stay intact.
CREATE TABLE rs_inventory_source_owners (
 tenant_id uuid NOT NULL REFERENCES tenants(id),source_kind text NOT NULL CHECK(source_kind IN ('item','warehouse')),
 source_id bigint NOT NULL,policy_id bigint NOT NULL REFERENCES ops_policy_versions(id),bound_by uuid NOT NULL,bound_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_kind,source_id)
);
CREATE FUNCTION rs_inventory_tenant(p_kind text,p_id bigint) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE native_owner uuid;mapped_owner uuid;
BEGIN
 IF p_kind='item' THEN SELECT (to_jsonb(i)->>'tenant_id')::uuid INTO native_owner FROM inventory_items i WHERE id=p_id;
 ELSIF p_kind='warehouse' THEN SELECT (to_jsonb(w)->>'tenant_id')::uuid INTO native_owner FROM warehouses w WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Jenis sumber tidak valid';END IF;
 SELECT tenant_id INTO mapped_owner FROM rs_inventory_source_owners WHERE source_kind=p_kind AND source_id=p_id;
 IF native_owner IS NOT NULL AND mapped_owner IS NOT NULL AND native_owner<>mapped_owner THEN RAISE EXCEPTION 'Ownership sumber berubah; review diperlukan';END IF;
 RETURN coalesce(native_owner,mapped_owner);
END $$;
REVOKE ALL ON FUNCTION rs_inventory_tenant(text,bigint) FROM PUBLIC,anon,authenticated;
ALTER TABLE ops_policy_versions DROP CONSTRAINT ops_policy_versions_kind_check;
ALTER TABLE ops_policy_versions ADD CONSTRAINT ops_policy_versions_kind_check CHECK(kind IN ('administrative','clinical_template','authority','sprint','resources','stock_opening','stock_ownership'));
ALTER FUNCTION ops_validate_policy(text,jsonb) RENAME TO ops_validate_policy_v2;
CREATE FUNCTION ops_validate_policy(p_kind text,p jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE x jsonb;batch_item bigint;batch_owner uuid;seen text[]:='{}';slot text;
BEGIN
 IF p_kind='stock_ownership' THEN
  IF jsonb_typeof(p->'sources') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'sources')=0 THEN RAISE EXCEPTION 'Daftar sumber wajib';END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p->'sources') LOOP
   IF x->>'kind' IS NULL OR x->>'kind' NOT IN ('item','warehouse') OR jsonb_typeof(x->'id') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Identitas sumber tidak valid';END IF;
   IF x->>'kind'='item' AND NOT EXISTS(SELECT 1 FROM inventory_items WHERE id=(x->>'id')::bigint) OR x->>'kind'='warehouse' AND NOT EXISTS(SELECT 1 FROM warehouses WHERE id=(x->>'id')::bigint) THEN RAISE EXCEPTION 'Sumber tidak ditemukan';END IF;
   batch_owner:=rs_inventory_tenant(x->>'kind',(x->>'id')::bigint);
   IF batch_owner IS NOT NULL AND batch_owner<>current_tenant_id() THEN RAISE EXCEPTION 'Sumber sudah milik tenant lain';END IF;
   slot:=(x->>'kind')||':'||(x->>'id');IF slot=ANY(seen) THEN RAISE EXCEPTION 'Sumber duplikat';END IF;seen:=array_append(seen,slot);
  END LOOP;RETURN;
 END IF;
 IF p_kind IS DISTINCT FROM 'stock_opening' THEN PERFORM ops_validate_policy_v2(p_kind,p);RETURN;END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'batch_id') IS DISTINCT FROM 'number' OR jsonb_typeof(p->'positions') IS DISTINCT FROM 'array' OR p->>'domain' IS NULL OR p->>'domain' NOT IN ('general','pharmacy','cssd','blood','linen','diet') THEN RAISE EXCEPTION 'Batch, domain dan posisi opening wajib'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone') THEN RAISE EXCEPTION 'Timezone tidak valid'; END IF;
 IF p->>'domain'='pharmacy' THEN RAISE EXCEPTION 'Farmasi memakai master pharmacy_drugs; adapter sumber farmasi wajib sebelum aktivasi domain ini'; END IF;
 SELECT b.item_id,rs_inventory_tenant('item',i.id) INTO batch_item,batch_owner FROM inventory_batches b JOIN inventory_items i ON i.id=b.item_id WHERE b.id=(p->>'batch_id')::bigint;
 IF batch_owner IS DISTINCT FROM current_tenant_id() THEN RAISE EXCEPTION 'Batch/master item belum dipetakan ke tenant'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'positions') LOOP
  IF jsonb_typeof(x->'warehouse_id') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'qty') IS DISTINCT FROM 'number' OR (x->>'qty')::numeric<0 OR (x->>'qty')::numeric::text IN ('NaN','Infinity','-Infinity') OR x->>'state' IS NULL OR x->>'state' NOT IN ('available','quarantine') THEN RAISE EXCEPTION 'Posisi opening tidak valid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM warehouses w WHERE w.id=(x->>'warehouse_id')::bigint AND rs_inventory_tenant('warehouse',w.id)=current_tenant_id()) THEN RAISE EXCEPTION 'Lokasi bukan milik tenant'; END IF;
  slot:=(x->>'warehouse_id')||':'||(x->>'state');IF slot=ANY(seen) THEN RAISE EXCEPTION 'Posisi duplikat'; END IF;seen:=array_append(seen,slot);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION ops_validate_policy(text,jsonb) FROM PUBLIC,anon,authenticated;

ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_batch_id bigint REFERENCES inventory_batches(id);
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_warehouse_id bigint REFERENCES warehouses(id);
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_admission_id bigint REFERENCES admissions(id);
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_order_id bigint REFERENCES rs_work_orders(id);
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_operation text;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_qty_delta numeric;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_state text;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_actor_id uuid;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_request_key text;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_return_of bigint REFERENCES stock_ledger(id);
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS rs_context jsonb;
CREATE INDEX rs_stock_trace ON stock_ledger(tenant_id,rs_batch_id,created_at);
-- Legacy grants may permit ledger writes. Protected RS columns/rows can only be
-- written by the owning SECURITY DEFINER command, never by API roles directly.
CREATE FUNCTION rs_protect_stock_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') THEN
  IF TG_OP<>'INSERT' AND (OLD.rs_operation IS NOT NULL OR OLD.rs_batch_id IS NOT NULL) THEN RAISE EXCEPTION 'Ledger RS hanya melalui command teraudit'; END IF;
  IF TG_OP<>'DELETE' AND (NEW.rs_operation IS NOT NULL OR NEW.rs_batch_id IS NOT NULL OR NEW.rs_return_of IS NOT NULL OR NEW.rs_qty_delta IS NOT NULL OR NEW.rs_actor_id IS NOT NULL OR NEW.rs_request_key IS NOT NULL OR NEW.rs_admission_id IS NOT NULL OR NEW.rs_order_id IS NOT NULL OR NEW.rs_warehouse_id IS NOT NULL OR NEW.rs_state IS NOT NULL OR NEW.rs_context IS NOT NULL) THEN RAISE EXCEPTION 'Kolom ledger RS hanya melalui command teraudit'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_stock_ledger_guard BEFORE INSERT OR UPDATE OR DELETE ON stock_ledger FOR EACH ROW EXECUTE FUNCTION rs_protect_stock_ledger();
CREATE TABLE rs_lot_positions (
 tenant_id uuid NOT NULL REFERENCES tenants(id),batch_id bigint NOT NULL REFERENCES inventory_batches(id),
 warehouse_id bigint NOT NULL REFERENCES warehouses(id),state text NOT NULL CHECK(state IN ('available','quarantine')),
 qty numeric NOT NULL CHECK(qty>=0 AND qty::text NOT IN ('NaN','Infinity','-Infinity')),
 quarantined_by uuid,PRIMARY KEY(batch_id,warehouse_id,state)
);
CREATE TABLE rs_stock_initializations (
 batch_id bigint PRIMARY KEY REFERENCES inventory_batches(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 policy_id bigint NOT NULL REFERENCES ops_policy_versions(id),domain text NOT NULL,timezone text NOT NULL,
 initialized_by uuid NOT NULL,initialized_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rs_stock_requests (
 tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,
 input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key)
);
CREATE TABLE rs_stock_order_lots (
 tenant_id uuid NOT NULL REFERENCES tenants(id),order_id bigint NOT NULL REFERENCES rs_work_orders(id),
 batch_id bigint NOT NULL REFERENCES inventory_batches(id),linked_at timestamptz NOT NULL DEFAULT now(),
 linked_by uuid NOT NULL,PRIMARY KEY(order_id,batch_id)
);
CREATE FUNCTION rs_stock_command(p_action text,p_data jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;batch inventory_batches;item inventory_items;
 init rs_stock_initializations;req rs_stock_requests;p jsonb;x jsonb;position rs_lot_positions;
 qty_value numeric;total numeric;wh bigint;dest bigint;loc_qty numeric;delta numeric;new_state text;
 ledger_id bigint;input_value jsonb:=jsonb_build_object('action',p_action,'data',p_data);result_value jsonb;
 domain_scope text;order_value rs_work_orders;clinical rs_clinical_records;source_return stock_ledger;old_positions jsonb;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','pharmacist','apoteker','cssd','lab','analis','nutrition','housekeeping','facility','nurse','perawat']);
 IF p_action IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input, alasan dan request key wajib'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'stock-key'||p_request_key));
 SELECT * INTO req FROM rs_stock_requests WHERE tenant_id=t AND request_key=p_request_key;
 IF FOUND THEN IF req.actor_id<>a OR req.input IS DISTINCT FROM input_value THEN RAISE EXCEPTION 'Retry input/actor berbeda'; END IF;RETURN req.result;END IF;
 SELECT * INTO batch FROM inventory_batches WHERE id=(p_data->>'batch_id')::bigint;
 IF NOT FOUND THEN RAISE EXCEPTION 'Batch tidak ditemukan'; END IF;
 -- Item lock serializes all batches/locations sharing a master balance.
 SELECT * INTO item FROM inventory_items WHERE id=batch.item_id FOR UPDATE;
 IF rs_inventory_tenant('item',item.id) IS DISTINCT FROM t THEN RAISE EXCEPTION 'Item bukan milik tenant'; END IF;
 SELECT * INTO batch FROM inventory_batches WHERE id=batch.id FOR UPDATE;
 IF item.stock_qty IS NULL OR batch.qty_remaining IS NULL OR batch.qty_received IS NULL OR item.stock_qty<0 OR batch.qty_remaining<0 OR item.stock_qty::text IN ('NaN','Infinity','-Infinity') OR batch.qty_remaining::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Saldo sumber tidak valid; rekonsiliasi sumber diperlukan'; END IF;
 IF p_action IN ('initialize','reconcile') THEN
  PERFORM ops_assert_permission(p_data->>'scope','stock.'||p_action);
  p:=ops_active_policy('stock_opening','stock-lot:'||batch.id);
  domain_scope:=CASE p->'payload'->>'domain' WHEN 'blood' THEN 'rs-transfusion' WHEN 'cssd' THEN 'rs-cssd' WHEN 'linen' THEN 'rs-linen' WHEN 'diet' THEN 'rs-diet' ELSE p_data->>'scope' END;
  IF domain_scope IS DISTINCT FROM p_data->>'scope' THEN RAISE EXCEPTION 'Scope tidak sesuai domain opening'; END IF;
  IF (p->'payload'->>'batch_id')::bigint<>batch.id THEN RAISE EXCEPTION 'Opening batch berbeda'; END IF;
  SELECT * INTO init FROM rs_stock_initializations WHERE batch_id=batch.id FOR UPDATE;
  IF p_action='initialize' AND FOUND THEN RAISE EXCEPTION 'Batch sudah diinisialisasi; koreksi melalui rekonsiliasi disahkan'; END IF;
  IF p_action='reconcile' THEN
   IF init.batch_id IS NULL OR init.policy_id=(p->>'id')::bigint THEN RAISE EXCEPTION 'Rekonsiliasi memerlukan versi baru yang disahkan'; END IF;
   IF init.domain IS DISTINCT FROM p->'payload'->>'domain' OR init.timezone IS DISTINCT FROM p->'payload'->>'timezone' THEN RAISE EXCEPTION 'Rekonsiliasi tidak boleh mengubah domain/timezone lot'; END IF;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(pos)),'[]') INTO old_positions FROM rs_lot_positions pos WHERE batch_id=batch.id;
  SELECT coalesce(sum((value->>'qty')::numeric),0) INTO total FROM jsonb_array_elements(p->'payload'->'positions');
  IF total IS DISTINCT FROM batch.qty_remaining OR total>coalesce(item.stock_qty,0) THEN RAISE EXCEPTION 'Opening tidak sesuai saldo sumber'; END IF;
  DELETE FROM rs_lot_positions WHERE batch_id=batch.id;
  FOR x IN SELECT value FROM jsonb_array_elements(p->'payload'->'positions') LOOP
   wh:=(x->>'warehouse_id')::bigint;
   SELECT qty INTO loc_qty FROM stock_by_location WHERE item_id=item.id AND warehouse_id=wh FOR UPDATE;
   SELECT coalesce(sum(pos.qty),0) INTO delta FROM rs_lot_positions pos JOIN inventory_batches b ON b.id=pos.batch_id WHERE b.item_id=item.id AND pos.warehouse_id=wh AND pos.batch_id<>batch.id;
   SELECT sum((value->>'qty')::numeric) INTO qty_value FROM jsonb_array_elements(p->'payload'->'positions') WHERE (value->>'warehouse_id')::bigint=wh;
   IF coalesce(loc_qty,0)<delta+qty_value THEN RAISE EXCEPTION 'Opening melebihi saldo lokasi sumber'; END IF;
   INSERT INTO rs_lot_positions VALUES(t,batch.id,wh,x->>'state',(x->>'qty')::numeric,CASE WHEN x->>'state'='quarantine' THEN a ELSE NULL END);
  END LOOP;
  INSERT INTO rs_stock_initializations VALUES(batch.id,t,(p->>'id')::bigint,p->'payload'->>'domain',p->'payload'->>'timezone',a,now()) ON CONFLICT(batch_id) DO UPDATE SET policy_id=EXCLUDED.policy_id;
  INSERT INTO stock_ledger(tenant_id,item_id,item_code,item_name,movement_type,qty,balance_after,ref_type,ref_id,notes,created_by,rs_batch_id,rs_operation,rs_qty_delta,rs_actor_id,rs_request_key)
   VALUES(t,item.id,item.item_code,item.item_name,'ADJUST',0,item.stock_qty,'rs-opening',(p->>'id')::bigint,p_data->>'reason',current_app_name(),batch.id,p_action,0,a,p_request_key) RETURNING id INTO ledger_id;
  UPDATE stock_ledger SET rs_context=jsonb_build_object('before',old_positions,'after',p->'payload'->'positions') WHERE id=ledger_id;
 ELSE
  SELECT * INTO init FROM rs_stock_initializations WHERE batch_id=batch.id AND tenant_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch memerlukan opening yang disahkan'; END IF;
  domain_scope:=CASE init.domain WHEN 'blood' THEN 'rs-transfusion' WHEN 'pharmacy' THEN 'rs-ward-pharmacy' WHEN 'cssd' THEN 'rs-cssd' WHEN 'linen' THEN 'rs-linen' WHEN 'diet' THEN 'rs-diet' ELSE p_data->>'scope' END;
  IF domain_scope IS NULL OR domain_scope IS DISTINCT FROM p_data->>'scope' THEN RAISE EXCEPTION 'Scope tidak sesuai domain lot'; END IF;
  PERFORM ops_assert_permission(domain_scope,'stock.'||p_action);
  SELECT coalesce(sum(qty),0) INTO total FROM rs_lot_positions WHERE batch_id=batch.id;
  IF total IS DISTINCT FROM batch.qty_remaining THEN RAISE EXCEPTION 'Saldo batch berubah di sumber; rekonsiliasi diperlukan'; END IF;
  SELECT coalesce(sum(pos.qty),0) INTO total FROM rs_lot_positions pos JOIN inventory_batches b ON b.id=pos.batch_id WHERE b.item_id=item.id;
  IF total>item.stock_qty THEN RAISE EXCEPTION 'Saldo master berubah di sumber; rekonsiliasi diperlukan'; END IF;
  IF p_action='link_order' THEN
   SELECT * INTO order_value FROM rs_work_orders WHERE id=(p_data->>'order_id')::bigint AND tenant_id=t AND kind=domain_scope AND status='active';
   IF NOT FOUND THEN RAISE EXCEPTION 'Order aktif domain yang sama wajib'; END IF;
   INSERT INTO rs_stock_order_lots VALUES(t,order_value.id,batch.id,now(),a) ON CONFLICT DO NOTHING;
   INSERT INTO stock_ledger(tenant_id,item_id,item_code,item_name,movement_type,qty,balance_after,ref_type,ref_id,notes,created_by,rs_batch_id,rs_order_id,rs_operation,rs_qty_delta,rs_actor_id,rs_request_key)
    VALUES(t,item.id,item.item_code,item.item_name,'ADJUST',0,item.stock_qty,'rs-order-link',order_value.id,p_data->>'reason',current_app_name(),batch.id,order_value.id,p_action,0,a,p_request_key) RETURNING id INTO ledger_id;
  ELSE
   IF jsonb_typeof(p_data->'qty') IS DISTINCT FROM 'number' OR (p_data->>'qty')::numeric<=0 OR (p_data->>'qty')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Kuantitas wajib positif dan finite'; END IF;qty_value:=(p_data->>'qty')::numeric;
   wh:=(p_data->>'warehouse_id')::bigint;dest:=(p_data->>'destination_id')::bigint;
   IF wh IS NULL OR NOT EXISTS(SELECT 1 FROM warehouses w WHERE id=wh AND rs_inventory_tenant('warehouse',w.id)=t) THEN RAISE EXCEPTION 'Lokasi bukan milik tenant'; END IF;
   IF p_data->>'admission_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM admissions WHERE id=(p_data->>'admission_id')::bigint AND tenant_id=t) THEN RAISE EXCEPTION 'Kunjungan bukan milik tenant'; END IF;
   IF p_data->>'order_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM rs_work_orders WHERE id=(p_data->>'order_id')::bigint AND tenant_id=t AND kind=domain_scope AND admission_id IS NOT DISTINCT FROM (p_data->>'admission_id')::bigint) THEN RAISE EXCEPTION 'Order/kunjungan tidak sesuai'; END IF;
   IF p_action IN ('issue','transfer','quarantine') THEN new_state:='available';ELSIF p_action='release' THEN new_state:='quarantine';ELSE new_state:=p_data->>'state';END IF;
   IF new_state IS NULL OR new_state NOT IN ('available','quarantine') THEN RAISE EXCEPTION 'Status lokasi stok wajib'; END IF;
   IF p_action NOT IN ('receive','return','issue','transfer','quarantine','release','waste') THEN RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
   IF p_action IN ('receive','issue','release') AND (to_jsonb(item)->>'is_active')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Item tidak aktif'; END IF;
   IF p_action='return' THEN
    SELECT * INTO source_return FROM stock_ledger WHERE id=(p_data->>'return_of')::bigint AND tenant_id=t AND rs_batch_id=batch.id AND rs_operation='issue' FOR UPDATE;
    IF NOT FOUND OR source_return.rs_admission_id IS DISTINCT FROM (p_data->>'admission_id')::bigint OR source_return.rs_order_id IS DISTINCT FROM (p_data->>'order_id')::bigint THEN RAISE EXCEPTION 'Retur wajib merujuk issue sumber yang sama'; END IF;
    SELECT coalesce(sum(qty),0) INTO total FROM stock_ledger WHERE rs_return_of=source_return.id AND rs_operation='return';
    IF total+qty_value>source_return.qty THEN RAISE EXCEPTION 'Retur melebihi jumlah issue sumber'; END IF;
    IF init.domain IN ('blood','cssd','pharmacy') AND new_state<>'quarantine' THEN RAISE EXCEPTION 'Retur klinis harus dikarantina untuk verifikasi'; END IF;
   END IF;
   SELECT * INTO position FROM rs_lot_positions WHERE batch_id=batch.id AND warehouse_id=wh AND state=new_state FOR UPDATE;
   IF p_action NOT IN ('receive','return') AND coalesce(position.qty,0)<qty_value THEN RAISE EXCEPTION 'Stok tersedia tidak cukup'; END IF;
   IF p_action IN ('issue','release') AND (batch.expiry_date IS NULL OR batch.expiry_date<(now() AT TIME ZONE init.timezone)::date) THEN RAISE EXCEPTION 'Expiry wajib dan stok kedaluwarsa tidak dapat digunakan'; END IF;
   IF p_action='release' THEN
    PERFORM ops_assert_permission(domain_scope,'stock.release',position.quarantined_by);
    -- A location can combine quarantine receipts by several operators.
    -- Every recorded maker is checked; last-writer identity is insufficient.
    FOR x IN SELECT DISTINCT jsonb_build_object('actor',rs_actor_id) FROM stock_ledger WHERE tenant_id=t AND rs_batch_id=batch.id AND rs_warehouse_id=wh AND rs_actor_id IS NOT NULL AND (rs_operation='quarantine-in' OR rs_operation IN ('receive','return') AND rs_state='quarantine') LOOP
     PERFORM ops_assert_permission(domain_scope,'stock.release',(x->>'actor')::uuid);
    END LOOP;
    IF init.domain IN ('blood','cssd') THEN
     IF init.domain='blood' THEN PERFORM ops_actor(ARRAY['lab','analis','pharmacist','apoteker']);ELSE PERFORM ops_actor(ARRAY['cssd']);END IF;
     IF NOT EXISTS(SELECT 1 FROM rs_stock_order_lots l JOIN rs_work_orders o ON o.id=l.order_id WHERE l.batch_id=batch.id AND l.order_id=(p_data->>'quality_order_id')::bigint AND o.tenant_id=t AND o.kind=domain_scope AND o.status='completed' AND l.linked_at<=o.updated_at) THEN RAISE EXCEPTION 'Release memerlukan workflow kualitas lot yang selesai'; END IF;
    END IF;
   END IF;
   IF p_action='issue' AND init.domain='blood' THEN
    RAISE EXCEPTION 'Pengeluaran darah ke pasien memerlukan adapter komponen individual dan crossmatch sumber; lot umum tidak cukup';
   END IF;
   INSERT INTO stock_by_location(item_id,warehouse_id,qty,updated_at) VALUES(item.id,wh,0,now()) ON CONFLICT(item_id,warehouse_id) DO NOTHING;
   SELECT qty INTO loc_qty FROM stock_by_location WHERE item_id=item.id AND warehouse_id=wh FOR UPDATE;
   SELECT coalesce(sum(pos.qty),0) INTO total FROM rs_lot_positions pos JOIN inventory_batches b ON b.id=pos.batch_id WHERE b.item_id=item.id AND pos.warehouse_id=wh;
   IF total>loc_qty THEN RAISE EXCEPTION 'Saldo lokasi berubah di sumber; rekonsiliasi diperlukan'; END IF;
   IF p_action NOT IN ('receive','return','quarantine','release') AND loc_qty<qty_value THEN RAISE EXCEPTION 'Saldo lokasi sumber tidak cukup'; END IF;
   IF p_action='transfer' THEN
    IF dest IS NULL OR dest=wh OR NOT EXISTS(SELECT 1 FROM warehouses w WHERE id=dest AND rs_inventory_tenant('warehouse',w.id)=t) THEN RAISE EXCEPTION 'Lokasi tujuan tidak valid'; END IF;
    INSERT INTO stock_by_location(item_id,warehouse_id,qty,updated_at) VALUES(item.id,dest,0,now()) ON CONFLICT(item_id,warehouse_id) DO NOTHING;
   END IF;
   delta:=CASE WHEN p_action IN ('receive','return') THEN qty_value WHEN p_action IN ('issue','waste') THEN -qty_value ELSE 0 END;
   IF delta<>0 THEN
    UPDATE inventory_items SET stock_qty=stock_qty+delta,updated_at=now() WHERE id=item.id RETURNING * INTO item;
    UPDATE inventory_batches SET qty_remaining=qty_remaining+delta,qty_received=qty_received+CASE WHEN p_action='receive' THEN qty_value ELSE 0 END,updated_at=now() WHERE id=batch.id;
    UPDATE stock_by_location SET qty=qty+delta,updated_at=now() WHERE item_id=item.id AND warehouse_id=wh;
   ELSIF p_action='transfer' THEN
    UPDATE stock_by_location SET qty=qty-qty_value,updated_at=now() WHERE item_id=item.id AND warehouse_id=wh;
    UPDATE stock_by_location SET qty=qty+qty_value,updated_at=now() WHERE item_id=item.id AND warehouse_id=dest;
   END IF;
   IF p_action IN ('receive','return') THEN
    INSERT INTO rs_lot_positions VALUES(t,batch.id,wh,new_state,qty_value,CASE WHEN new_state='quarantine' THEN a ELSE NULL END) ON CONFLICT(batch_id,warehouse_id,state) DO UPDATE SET qty=rs_lot_positions.qty+EXCLUDED.qty,quarantined_by=coalesce(EXCLUDED.quarantined_by,rs_lot_positions.quarantined_by);
   ELSE
    UPDATE rs_lot_positions SET qty=qty-qty_value WHERE batch_id=batch.id AND warehouse_id=wh AND state=new_state;
    IF p_action IN ('transfer','quarantine','release') THEN
     INSERT INTO rs_lot_positions VALUES(t,batch.id,CASE WHEN p_action='transfer' THEN dest ELSE wh END,CASE WHEN p_action='quarantine' THEN 'quarantine' ELSE 'available' END,qty_value,CASE WHEN p_action='quarantine' THEN a ELSE NULL END)
      ON CONFLICT(batch_id,warehouse_id,state) DO UPDATE SET qty=rs_lot_positions.qty+EXCLUDED.qty,quarantined_by=coalesce(EXCLUDED.quarantined_by,rs_lot_positions.quarantined_by);
    END IF;
   END IF;
   INSERT INTO stock_ledger(tenant_id,item_id,item_code,item_name,movement_type,qty,balance_after,ref_type,ref_id,notes,created_by,rs_batch_id,rs_warehouse_id,rs_admission_id,rs_order_id,rs_operation,rs_qty_delta,rs_state,rs_actor_id,rs_request_key)
    VALUES(t,item.id,item.item_code,item.item_name,CASE WHEN delta>0 THEN 'IN' WHEN delta<0 THEN 'OUT' ELSE 'ADJUST' END,abs(delta),item.stock_qty,'rs-operation',batch.id,p_data->>'reason',current_app_name(),batch.id,wh,(p_data->>'admission_id')::bigint,(p_data->>'order_id')::bigint,p_action,CASE WHEN p_action IN ('transfer','quarantine','release') THEN -qty_value ELSE delta END,new_state,a,p_request_key) RETURNING id INTO ledger_id;
   UPDATE stock_ledger SET rs_return_of=CASE WHEN p_action='return' THEN source_return.id ELSE NULL END,rs_context=p_data WHERE id=ledger_id;
   IF p_action IN ('transfer','quarantine','release') THEN
    INSERT INTO stock_ledger(tenant_id,item_id,item_code,item_name,movement_type,qty,balance_after,ref_type,ref_id,notes,created_by,rs_batch_id,rs_warehouse_id,rs_operation,rs_qty_delta,rs_state,rs_actor_id,rs_request_key)
     VALUES(t,item.id,item.item_code,item.item_name,'ADJUST',0,item.stock_qty,'rs-operation',batch.id,p_data->>'reason',current_app_name(),batch.id,CASE WHEN p_action='transfer' THEN dest ELSE wh END,p_action||'-in',qty_value,CASE WHEN p_action='quarantine' THEN 'quarantine' ELSE 'available' END,a,p_request_key);
   END IF;
  END IF;
 END IF;
 result_value:=jsonb_build_object('ok',true,'ledger_id',ledger_id,'batch_id',batch.id,'item_id',item.id,'balance',item.stock_qty);
 INSERT INTO rs_stock_requests VALUES(t,p_request_key,a,input_value,result_value);RETURN result_value;
END $$;

DO $$DECLARE n text;BEGIN
 FOREACH n IN ARRAY ARRAY['rs_lot_positions','rs_stock_initializations','rs_stock_requests','rs_stock_order_lots'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);
 END LOOP;
END $$;
CREATE POLICY rs_lot_positions_read ON rs_lot_positions FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND EXISTS(SELECT 1 FROM user_profiles WHERE id=auth.uid() AND tenant_id=current_tenant_id() AND lower(role) IN ('super_admin','head_operation','direktur','admin_faskes','pharmacist','apoteker','cssd','lab','analis','nutrition','housekeeping','facility','nurse','perawat')));
CREATE POLICY rs_stock_init_read ON rs_stock_initializations FOR SELECT TO authenticated USING(tenant_id=current_tenant_id());
CREATE POLICY rs_stock_order_lot_read ON rs_stock_order_lots FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND EXISTS(SELECT 1 FROM rs_work_orders o WHERE id=order_id AND rs_can_read(o.kind)));
GRANT SELECT ON rs_lot_positions,rs_stock_initializations,rs_stock_order_lots TO authenticated;
REVOKE ALL ON FUNCTION rs_stock_command(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_stock_command(text,jsonb,text) TO authenticated;
CREATE FUNCTION rs_stock_setup(p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();result jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','pharmacist','apoteker','cssd','lab','analis','nutrition','housekeeping','facility','nurse','perawat']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid'; END IF;
 SELECT jsonb_build_object(
 'batches',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM (SELECT b.id,b.batch_no,b.expiry_date,b.qty_remaining,i.item_name,i.item_code,init.domain,init.policy_id FROM inventory_batches b JOIN inventory_items i ON i.id=b.item_id LEFT JOIN rs_stock_initializations init ON init.batch_id=b.id WHERE rs_inventory_tenant('item',i.id)=t ORDER BY b.id DESC LIMIT 51 OFFSET p_offset)b),'[]'),
 'warehouses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',w.id,'name',to_jsonb(w)->>'name')) FROM warehouses w WHERE rs_inventory_tenant('warehouse',w.id)=t),'[]'),
 'positions',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM rs_lot_positions p WHERE p.tenant_id=t AND p.batch_id IN (SELECT b.id FROM inventory_batches b JOIN inventory_items i ON i.id=b.item_id WHERE rs_inventory_tenant('item',i.id)=t ORDER BY b.id DESC LIMIT 50 OFFSET p_offset)),'[]'),
 'ledger',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM (SELECT l.id,l.created_at,l.rs_batch_id,l.rs_warehouse_id,l.rs_operation,l.rs_qty_delta,l.rs_state,l.rs_return_of,l.rs_admission_id,l.rs_order_id,l.notes FROM stock_ledger l WHERE l.tenant_id=t AND l.rs_batch_id IN (SELECT b.id FROM inventory_batches b JOIN inventory_items i ON i.id=b.item_id WHERE rs_inventory_tenant('item',i.id)=t ORDER BY b.id DESC LIMIT 50 OFFSET p_offset) ORDER BY l.id DESC LIMIT 100)l),'[]')
 ) INTO result;RETURN result;
END $$;
REVOKE ALL ON FUNCTION rs_stock_setup(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_stock_setup(integer) TO authenticated;
INSERT INTO role_pages(role_kode,page) SELECT kode,'rs-shared-stock' FROM roles WHERE lower(kode) IN ('super_admin','head_operation','direktur','admin_faskes','pharmacist','apoteker','cssd','lab','analis','nutrition','housekeeping','facility','nurse','perawat') ON CONFLICT DO NOTHING;
ALTER TABLE rs_inventory_source_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rs_inventory_source_owners FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_stock_bind_sources(p_scope text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p jsonb;x jsonb;t uuid:=current_tenant_id();a uuid;owner uuid;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes']);
 p:=ops_active_policy('stock_ownership',p_scope);
 IF p->>'reviewed_by' IS NULL THEN RAISE EXCEPTION 'Review ownership wajib';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'payload'->'sources') ORDER BY value->>'kind',(value->>'id')::bigint LOOP
  PERFORM pg_advisory_xact_lock(hashtext('stock-source:'||(x->>'kind')||':'||(x->>'id')));
  IF x->>'kind'='item' THEN PERFORM 1 FROM inventory_items WHERE id=(x->>'id')::bigint FOR UPDATE;ELSE PERFORM 1 FROM warehouses WHERE id=(x->>'id')::bigint FOR UPDATE;END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sumber telah dihapus';END IF;
  owner:=rs_inventory_tenant(x->>'kind',(x->>'id')::bigint);
  IF owner IS NOT NULL AND owner<>t THEN RAISE EXCEPTION 'Sumber milik tenant lain';END IF;
  INSERT INTO rs_inventory_source_owners(tenant_id,source_kind,source_id,policy_id,bound_by) VALUES(t,x->>'kind',(x->>'id')::bigint,(p->>'id')::bigint,a) ON CONFLICT(source_kind,source_id) DO NOTHING;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'policy_id',p->'id');
END $$;
REVOKE ALL ON FUNCTION rs_stock_bind_sources(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_stock_bind_sources(text) TO authenticated;
COMMIT;
