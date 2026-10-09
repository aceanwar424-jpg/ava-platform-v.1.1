-- OWNED_BY: generic. Operational metadata; the charge source remains inpatient_charges.
BEGIN;
CREATE TABLE rs_billing_setups(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),stay_id bigint NOT NULL REFERENCES inpatient_stays(id),policy_id bigint NOT NULL REFERENCES ops_policy_versions(id),policy_snapshot jsonb NOT NULL,source_timezone text NOT NULL,cutover_at timestamptz NOT NULL,billed_through_at timestamptz NOT NULL,opening_total numeric NOT NULL,source_snapshot jsonb NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','active','rejected')),created_by uuid NOT NULL,reviewed_by uuid,version integer NOT NULL DEFAULT 1,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,CHECK(billed_through_at>=cutover_at));
CREATE UNIQUE INDEX rs_billing_one_active_stay ON rs_billing_setups(stay_id) WHERE state='active';
CREATE TABLE rs_room_rate_segments(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),setup_id bigint NOT NULL REFERENCES rs_billing_setups(id),bed_id bigint NOT NULL REFERENCES inpatient_beds(id),class_code text NOT NULL,rate numeric NOT NULL CHECK(rate>=0),starts_at timestamptz NOT NULL,ends_at timestamptz,CHECK(ends_at IS NULL OR ends_at>=starts_at));
CREATE UNIQUE INDEX rs_room_one_open_segment ON rs_room_rate_segments(setup_id) WHERE ends_at IS NULL;
CREATE TABLE rs_billing_proposals(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),setup_id bigint NOT NULL REFERENCES rs_billing_setups(id),setup_version integer NOT NULL,ends_at timestamptz NOT NULL,quote jsonb NOT NULL,previous_net numeric NOT NULL,delta numeric NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','posting','posted','rejected')),created_by uuid NOT NULL,reviewed_by uuid,source_charge_id bigint REFERENCES inpatient_charges(id),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz);
CREATE TABLE rs_billing_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE rs_billing_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),setup_id bigint REFERENCES rs_billing_setups(id),actor_id uuid NOT NULL,action text NOT NULL,evidence jsonb NOT NULL,before_row jsonb,after_row jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION rs_charge_source_owner(p_stay bigint,p_admission bigint) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_value uuid;s inpatient_stays;
BEGIN
 IF p_stay IS NOT NULL THEN SELECT * INTO s FROM inpatient_stays WHERE id=p_stay;IF NOT FOUND OR p_admission IS NOT NULL AND p_admission IS DISTINCT FROM s.admission_id THEN RETURN NULL;END IF;p_admission:=s.admission_id;END IF;
 SELECT tenant_id INTO owner_value FROM admissions WHERE id=p_admission;RETURN owner_value;
END $$;
CREATE FUNCTION rs_charge_source_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE proposal rs_billing_proposals;b rs_billing_setups;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','finance','cashier','finance_staff','doctor','dokter','nurse','perawat','pharmacist','apoteker','lab','analis','operasional']);
 IF rs_charge_source_owner(NEW.stay_id,NEW.admission_id) IS DISTINCT FROM current_tenant_id() THEN RAISE EXCEPTION 'Biaya sumber bukan milik tenant';END IF;
 IF TG_OP='UPDATE' THEN
  IF rs_charge_source_owner(OLD.stay_id,OLD.admission_id) IS DISTINCT FROM current_tenant_id() OR NEW.stay_id IS DISTINCT FROM OLD.stay_id OR NEW.admission_id IS DISTINCT FROM OLD.admission_id THEN RAISE EXCEPTION 'Identitas sumber biaya tidak dapat diganti';END IF;
  IF OLD.ref_tabel='rs_billing_proposals' THEN RAISE EXCEPTION 'Biaya engine immutable; koreksi lewat proposal adjustment';END IF;
 END IF;
 IF TG_OP='INSERT' OR NEW.qty IS DISTINCT FROM OLD.qty OR NEW.unit_price IS DISTINCT FROM OLD.unit_price OR NEW.amount IS DISTINCT FROM OLD.amount THEN
  IF NEW.qty IS NULL OR NEW.unit_price IS NULL OR NEW.amount IS NULL OR NEW.unit_price<0 OR NEW.amount<>NEW.qty*NEW.unit_price THEN RAISE EXCEPTION 'Kuantitas/tarif/nominal sumber tidak konsisten';END IF;
  IF NEW.qty<0 OR NEW.ref_tabel='rs_billing_proposals' THEN
   SELECT * INTO proposal FROM rs_billing_proposals WHERE id=NEW.ref_id AND tenant_id=current_tenant_id() AND state='posting';SELECT * INTO b FROM rs_billing_setups WHERE id=proposal.setup_id;
   IF NEW.ref_tabel IS DISTINCT FROM 'rs_billing_proposals' OR proposal.id IS NULL OR b.stay_id IS DISTINCT FROM NEW.stay_id OR proposal.delta IS DISTINCT FROM NEW.amount THEN RAISE EXCEPTION 'Adjustment sumber harus proposal review yang sedang diposting';END IF;
  END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_charge_source_guard BEFORE INSERT OR UPDATE ON inpatient_charges FOR EACH ROW EXECUTE FUNCTION rs_charge_source_guard();
CREATE FUNCTION rs_charge_source_visible(p_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM user_profiles u WHERE u.id=auth.uid() AND u.tenant_id=current_tenant_id() AND lower(u.role) IN ('super_admin','head_operation','direktur','admin','admin_faskes','finance','cashier','finance_staff')) AND EXISTS(SELECT 1 FROM inpatient_charges c WHERE c.id=p_id AND rs_charge_source_owner(c.stay_id,c.admission_id)=current_tenant_id())
$$;
-- Legacy views execute as their owner: qualify every charge before projecting patient identifiers.
CREATE OR REPLACE VIEW public.tagihan_layanan WITH (security_barrier=true) AS
SELECT c.id,c.admission_id,c.stay_id,c.charge_date AS tanggal,c.charge_type AS jenis,c.description AS uraian,c.qty,c.unit_price AS harga,c.amount AS jumlah,c.source AS sumber,c.ref_tabel,c.ref_id,c.posted_by AS diposting_oleh,c.dibatalkan_at,c.alasan_batal,a.visit_number,a.patient_name,a.mr_number,(c.dibatalkan_at IS NULL) AS aktif
FROM inpatient_charges c LEFT JOIN admissions a ON a.id=c.admission_id WHERE rs_charge_source_visible(c.id);
CREATE OR REPLACE VIEW public.tagihan_ringkas WITH (security_barrier=true) AS
SELECT admission_id,count(*) FILTER(WHERE dibatalkan_at IS NULL) AS jml_item,coalesce(sum(amount) FILTER(WHERE dibatalkan_at IS NULL),0) AS total,coalesce(sum(amount) FILTER(WHERE dibatalkan_at IS NULL AND charge_type='Tindakan'),0) AS total_tindakan,coalesce(sum(amount) FILTER(WHERE dibatalkan_at IS NULL AND charge_type='Penunjang'),0) AS total_penunjang,max(charge_date) AS tanggal_terakhir
FROM inpatient_charges WHERE admission_id IS NOT NULL AND rs_charge_source_visible(id) GROUP BY admission_id;
REVOKE ALL ON public.tagihan_layanan,public.tagihan_ringkas FROM PUBLIC,anon;
GRANT SELECT ON public.tagihan_layanan,public.tagihan_ringkas TO authenticated;
-- Protect existing source RPCs before their idempotent lookup can expose another tenant's charge.
ALTER FUNCTION tagihan_posting(text,bigint,text,text,numeric,numeric,bigint,bigint,text) RENAME TO tagihan_posting_before_rs_guard;
REVOKE ALL ON FUNCTION tagihan_posting_before_rs_guard(text,bigint,text,text,numeric,numeric,bigint,bigint,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION tagihan_posting(p_ref_tabel text,p_ref_id bigint,p_jenis text,p_uraian text,p_qty numeric DEFAULT 1,p_harga numeric DEFAULT 0,p_admission_id bigint DEFAULT NULL,p_stay_id bigint DEFAULT NULL,p_oleh text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c inpatient_charges;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','finance','cashier','finance_staff','doctor','dokter','nurse','perawat','pharmacist','apoteker','lab','analis','operasional']);
 IF rs_charge_source_owner(p_stay_id,p_admission_id) IS DISTINCT FROM current_tenant_id() THEN RAISE EXCEPTION 'Biaya sumber bukan milik tenant';END IF;
 SELECT * INTO c FROM inpatient_charges WHERE ref_tabel=p_ref_tabel AND ref_id=p_ref_id AND dibatalkan_at IS NULL;
 IF FOUND AND (rs_charge_source_owner(c.stay_id,c.admission_id) IS DISTINCT FROM current_tenant_id() OR c.stay_id IS DISTINCT FROM p_stay_id OR c.admission_id IS DISTINCT FROM p_admission_id) THEN RAISE EXCEPTION 'Referensi biaya bukan sumber yang sama';END IF;
 RETURN tagihan_posting_before_rs_guard(p_ref_tabel,p_ref_id,p_jenis,p_uraian,p_qty,p_harga,p_admission_id,p_stay_id,p_oleh);
END $$;
ALTER FUNCTION tagihan_batalkan(bigint,text,text) RENAME TO tagihan_batalkan_before_rs_guard;
REVOKE ALL ON FUNCTION tagihan_batalkan_before_rs_guard(bigint,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION tagihan_batalkan(p_charge_id bigint,p_alasan text,p_oleh text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c inpatient_charges;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','finance','cashier','finance_staff','doctor','dokter','nurse','perawat','pharmacist','apoteker','lab','analis','operasional']);SELECT * INTO c FROM inpatient_charges WHERE id=p_charge_id;
 IF NOT FOUND OR rs_charge_source_owner(c.stay_id,c.admission_id) IS DISTINCT FROM current_tenant_id() THEN RAISE EXCEPTION 'Biaya sumber bukan milik tenant';END IF;
 IF c.ref_tabel='rs_billing_proposals' THEN RAISE EXCEPTION 'Biaya engine immutable; koreksi lewat proposal adjustment';END IF;RETURN tagihan_batalkan_before_rs_guard(p_charge_id,p_alasan,p_oleh);
END $$;
ALTER TABLE inpatient_charges ENABLE ROW LEVEL SECURITY;
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='inpatient_charges' LOOP EXECUTE format('DROP POLICY %I ON inpatient_charges',p.policyname);END LOOP;END $$;
CREATE POLICY rs_charge_source_read ON inpatient_charges FOR SELECT TO authenticated USING(rs_charge_source_visible(id));
REVOKE INSERT,UPDATE,DELETE ON inpatient_charges FROM PUBLIC,anon,authenticated;
GRANT SELECT ON inpatient_charges TO authenticated;
CREATE FUNCTION rs_billing_source_snapshot(p_stay bigint) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT jsonb_build_object('charges',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'amount',c.amount,'charge_date',c.charge_date,'type',c.charge_type,'cancelled_at',c.dibatalkan_at) ORDER BY c.id) FROM inpatient_charges c WHERE c.stay_id=p_stay),'[]'),'bed_id',s.bed_id,'class_code',s.class_code,'rate',s.room_rate,'status',s.status,'last_transfer',coalesce((SELECT max(id) FROM inpatient_transfers WHERE stay_id=p_stay),0)) FROM inpatient_stays s WHERE s.id=p_stay
$$;
CREATE FUNCTION rs_billing_calculate(p_setup bigint,p_until timestamptz) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE b rs_billing_setups;s inpatient_stays;segments jsonb;end_value timestamptz;
BEGIN
 SELECT * INTO b FROM rs_billing_setups WHERE id=p_setup AND tenant_id=current_tenant_id() AND state='active';IF NOT FOUND THEN RAISE EXCEPTION 'Setup aktif tidak ditemukan';END IF;SELECT * INTO s FROM inpatient_stays WHERE id=b.stay_id;
 end_value:=coalesce(s.discharged_at AT TIME ZONE b.source_timezone,clock_timestamp());
 IF p_until IS NULL OR p_until>end_value OR p_until>clock_timestamp() THEN RAISE EXCEPTION 'Waktu quote melewati waktu sumber';END IF;
 IF p_until<=b.billed_through_at THEN RETURN jsonb_build_object('starts_at',b.billed_through_at,'ends_at',p_until,'raw_units',0,'billed_units',0,'total',0,'lines','[]'::jsonb,'opening_covers_interval',true);END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('starts_at',starts_at,'ends_at',least(coalesce(ends_at,p_until),p_until),'rate',rate,'class_code',class_code) ORDER BY starts_at,id),'[]') INTO segments FROM rs_room_rate_segments WHERE setup_id=b.id AND starts_at<p_until AND (ends_at IS NULL OR ends_at>starts_at);
 RETURN rs_room_billing_quote(b.policy_snapshot,b.billed_through_at,p_until,segments);
END $$;
CREATE FUNCTION rs_billing_capture_segment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b rs_billing_setups;seg rs_room_rate_segments;event_time timestamptz:=now();before_value jsonb;
BEGIN
 SELECT * INTO b FROM rs_billing_setups WHERE stay_id=NEW.id AND state='active' FOR UPDATE;IF NOT FOUND THEN RETURN NEW;END IF;
 IF NEW.bed_id IS DISTINCT FROM OLD.bed_id OR NEW.class_code IS DISTINCT FROM OLD.class_code OR NEW.room_rate IS DISTINCT FROM OLD.room_rate THEN
  IF NEW.room_rate IS NULL OR NEW.room_rate<0 OR coalesce(length(trim(NEW.class_code)),0)=0 THEN RAISE EXCEPTION 'Tarif/kelas sumber harus sah';END IF;
  SELECT * INTO seg FROM rs_room_rate_segments WHERE setup_id=b.id AND ends_at IS NULL FOR UPDATE;before_value:=to_jsonb(seg);
  IF event_time<=seg.starts_at THEN UPDATE rs_room_rate_segments SET bed_id=NEW.bed_id,class_code=NEW.class_code,rate=NEW.room_rate WHERE id=seg.id;ELSE UPDATE rs_room_rate_segments SET ends_at=event_time WHERE id=seg.id;INSERT INTO rs_room_rate_segments(tenant_id,setup_id,bed_id,class_code,rate,starts_at) VALUES(b.tenant_id,b.id,NEW.bed_id,NEW.class_code,NEW.room_rate,event_time);END IF;
  UPDATE rs_billing_setups SET version=version+1 WHERE id=b.id;
  INSERT INTO rs_billing_events(tenant_id,setup_id,actor_id,action,evidence,before_row,after_row) VALUES(b.tenant_id,b.id,auth.uid(),'source_transfer',jsonb_build_object('stay_id',NEW.id,'event_at',event_time),before_value,jsonb_build_object('bed_id',NEW.bed_id,'class_code',NEW.class_code,'rate',NEW.room_rate));
 END IF;
 IF NEW.discharged_at IS DISTINCT FROM OLD.discharged_at OR NEW.status IS DISTINCT FROM OLD.status THEN UPDATE rs_billing_setups SET version=version+1 WHERE id=b.id;END IF;RETURN NEW;
END $$;
CREATE TRIGGER rs_billing_capture_segment AFTER UPDATE OF bed_id,class_code,room_rate,status,discharged_at ON inpatient_stays FOR EACH ROW EXECUTE FUNCTION rs_billing_capture_segment();
CREATE FUNCTION rs_billing_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;r rs_billing_requests;b rs_billing_setups;s inpatient_stays;p ops_policy_versions;proposal rs_billing_proposals;input_value jsonb:=jsonb_build_object('action',p_action,'data',p_data);result_value jsonb;before_value jsonb;source_value jsonb;stay_value bigint;end_value timestamptz;net_value numeric;quote_value jsonb;posted jsonb;options jsonb;k text;cutover_value timestamptz;through_value timestamptz;total_value numeric;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);
 IF p_action IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input/alasan/request key wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'billing:'||p_key));SELECT * INTO r FROM rs_billing_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF r.actor_id<>a OR r.input IS DISTINCT FROM input_value THEN RAISE EXCEPTION 'Retry input/actor berbeda';END IF;RETURN r.result;END IF;
 IF p_action='create_setup' THEN stay_value:=(p_data->>'stay_id')::bigint;ELSIF p_action IN ('approve_proposal','reject_proposal') THEN SELECT setup_id INTO stay_value FROM rs_billing_proposals WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO b FROM rs_billing_setups WHERE id=stay_value AND tenant_id=t;stay_value:=b.stay_id;ELSE SELECT * INTO b FROM rs_billing_setups WHERE id=(p_data->>'setup_id')::bigint AND tenant_id=t;stay_value:=b.stay_id;END IF;
 SELECT * INTO s FROM inpatient_stays WHERE id=stay_value AND tenant_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Perawatan bukan milik tenant';END IF;
 IF b.id IS NOT NULL THEN SELECT * INTO b FROM rs_billing_setups WHERE id=b.id FOR UPDATE;before_value:=to_jsonb(b);END IF;
 PERFORM ops_assert_permission('rs-inpatient-billing','billing.'||p_action,b.created_by);
 IF p_action='create_setup' THEN
  IF s.status<>'Dirawat' OR EXISTS(SELECT 1 FROM rs_billing_setups WHERE stay_id=s.id AND state='active') THEN RAISE EXCEPTION 'Stay aktif belum enrolled wajib';END IF;
  SELECT * INTO p FROM ops_policy_versions WHERE id=(p_data->>'policy_id')::bigint AND tenant_id=t AND kind='administrative' AND state='active' AND effective_at<=now();IF NOT FOUND THEN RAISE EXCEPTION 'Kebijakan administratif aktif wajib';END IF;
  cutover_value:=(p_data->>'cutover_at')::timestamptz;through_value:=(p_data->>'billed_through_at')::timestamptz;
  IF cutover_value IS NULL OR cutover_value NOT BETWEEN now()-interval '1 minute' AND now()+interval '1 minute' OR through_value IS NULL OR through_value<cutover_value OR through_value>cutover_value+interval '365 days' OR p_data->>'source_timezone' IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_data->>'source_timezone') THEN RAISE EXCEPTION 'Cutover/coverage opening/timezone sumber eksplisit wajib';END IF;
  SELECT coalesce(sum(amount),0) INTO total_value FROM inpatient_charges WHERE stay_id=s.id AND dibatalkan_at IS NULL;
  IF jsonb_typeof(p_data->'opening_total') IS DISTINCT FROM 'number' OR (p_data->>'opening_total')::numeric<>total_value OR total_value<0 THEN RAISE EXCEPTION 'Opening harus sama biaya sumber aktif';END IF;
  options:=p_data->'calculation_options';IF jsonb_typeof(options) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Opsi kalkulasi eksplisit wajib';END IF;
  FOR k IN SELECT jsonb_object_keys(options) LOOP IF k NOT IN ('amount_decimals','rounding_rate_basis','opening_cutoff_rate','cutoff_rate_reference','minimum_units') THEN RAISE EXCEPTION 'Opsi kalkulasi tidak dikenal';END IF;END LOOP;
  IF jsonb_typeof(options->'minimum_units') IS DISTINCT FROM 'number' OR (options->>'minimum_units')::numeric<0 OR (options->>'minimum_units')::numeric>(p.payload->>'minimum_units')::numeric THEN RAISE EXCEPTION 'Sisa minimum unit opening harus eksplisit dan tidak melampaui kebijakan';END IF;
  PERFORM rs_room_billing_quote(p.payload||options,through_value,through_value,'[]');source_value:=rs_billing_source_snapshot(s.id);
  INSERT INTO rs_billing_setups(tenant_id,stay_id,policy_id,policy_snapshot,source_timezone,cutover_at,billed_through_at,opening_total,source_snapshot,created_by,reason) VALUES(t,s.id,p.id,p.payload||options,p_data->>'source_timezone',cutover_value,through_value,total_value,source_value,a,p_data->>'reason') RETURNING * INTO b;result_value:=to_jsonb(b);
 ELSIF p_action IN ('approve_setup','reject_setup') THEN
  IF b.state IS DISTINCT FROM 'draft' OR b.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Setup berubah/tidak draft';END IF;
  IF b.created_by=a THEN RAISE EXCEPTION 'Reviewer opening harus berbeda';END IF;
  IF p_action='approve_setup' THEN
   IF NOT EXISTS(SELECT 1 FROM ops_policy_versions WHERE id=b.policy_id AND tenant_id=t AND kind='administrative' AND state='active' AND effective_at<=now()) THEN RAISE EXCEPTION 'Kebijakan opening tidak aktif lagi';END IF;
   IF rs_billing_source_snapshot(s.id) IS DISTINCT FROM b.source_snapshot OR s.status<>'Dirawat' THEN RAISE EXCEPTION 'Sumber opening berubah; buat draft baru';END IF;
   IF s.room_rate IS NULL OR s.room_rate<0 OR coalesce(length(trim(s.class_code)),0)=0 THEN RAISE EXCEPTION 'Tarif/kelas sumber wajib';END IF;
   INSERT INTO rs_room_rate_segments(tenant_id,setup_id,bed_id,class_code,rate,starts_at) VALUES(t,b.id,s.bed_id,s.class_code,s.room_rate,b.billed_through_at);
  END IF;
  UPDATE rs_billing_setups SET state=CASE WHEN p_action='approve_setup' THEN 'active' ELSE 'rejected' END,reviewed_by=a,reviewed_at=now(),version=version+1 WHERE id=b.id RETURNING * INTO b;result_value:=to_jsonb(b);
 ELSIF p_action='propose' THEN
  IF b.state IS DISTINCT FROM 'active' OR b.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Setup berubah/tidak aktif';END IF;end_value:=coalesce((p_data->>'ends_at')::timestamptz,s.discharged_at AT TIME ZONE b.source_timezone,now());quote_value:=rs_billing_calculate(b.id,end_value);SELECT coalesce(sum(delta),0) INTO net_value FROM rs_billing_proposals WHERE setup_id=b.id AND state='posted';
  INSERT INTO rs_billing_proposals(tenant_id,setup_id,setup_version,ends_at,quote,previous_net,delta,created_by,reason) VALUES(t,b.id,b.version,end_value,quote_value,net_value,(quote_value->>'total')::numeric-net_value,a,p_data->>'reason') RETURNING * INTO proposal;result_value:=to_jsonb(proposal);
 ELSIF p_action IN ('approve_proposal','reject_proposal') THEN
  SELECT * INTO proposal FROM rs_billing_proposals WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
  IF proposal.state IS DISTINCT FROM 'draft' OR b.state IS DISTINCT FROM 'active' OR p_action='approve_proposal' AND proposal.setup_version<>b.version THEN RAISE EXCEPTION 'Proposal berubah; hitung ulang';END IF;
  IF proposal.created_by=a THEN RAISE EXCEPTION 'Reviewer biaya harus berbeda';END IF;
  IF p_action='approve_proposal' THEN
   SELECT coalesce(sum(delta),0) INTO net_value FROM rs_billing_proposals WHERE setup_id=b.id AND state='posted';quote_value:=rs_billing_calculate(b.id,proposal.ends_at);
   IF proposal.previous_net IS DISTINCT FROM net_value OR proposal.quote IS DISTINCT FROM quote_value THEN RAISE EXCEPTION 'Sumber kalkulasi berubah; hitung ulang';END IF;
   UPDATE rs_billing_proposals SET state='posting' WHERE id=proposal.id;
   IF proposal.delta<>0 THEN posted:=tagihan_posting('rs_billing_proposals',proposal.id,'Kamar konfigurasi','Adjustment kamar berbukti # '||proposal.id,sign(proposal.delta),abs(proposal.delta),s.admission_id,s.id,current_app_name());IF posted->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Posting sumber gagal: %',posted;END IF;END IF;
  END IF;
  UPDATE rs_billing_proposals SET state=CASE WHEN p_action='approve_proposal' THEN 'posted' ELSE 'rejected' END,reviewed_by=a,reviewed_at=now(),source_charge_id=(posted->>'id')::bigint WHERE id=proposal.id RETURNING * INTO proposal;
  IF p_action='approve_proposal' THEN UPDATE rs_billing_setups SET version=version+1 WHERE id=b.id;UPDATE inpatient_stays SET total_charges=(SELECT coalesce(sum(amount),0) FROM inpatient_charges WHERE stay_id=s.id AND dibatalkan_at IS NULL),updated_at=now() WHERE id=s.id;END IF;result_value:=to_jsonb(proposal);
 ELSE RAISE EXCEPTION 'Aksi billing belum tersedia';END IF;
 INSERT INTO rs_billing_events(tenant_id,setup_id,actor_id,action,evidence,before_row,after_row) VALUES(t,b.id,a,p_action,p_data,before_value,result_value);INSERT INTO rs_billing_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
-- The source guard grants finance updates only when all clinical/identity fields are unchanged.
DO $$DECLARE body text;needle text:='PERFORM rs_assert_actor(ARRAY[''admin'',''admin_faskes'',''nurse'',''perawat'',''doctor'',''dokter'']);';BEGIN
 SELECT pg_get_functiondef('rs_stay_guard()'::regprocedure) INTO body;IF position(needle IN body)=0 THEN RAISE EXCEPTION 'rs_stay_guard source contract changed; review required';END IF;
 body:=replace(body,needle,'IF TG_OP=''UPDATE'' AND (to_jsonb(NEW)-ARRAY[''total_charges'',''updated_at''])=(to_jsonb(OLD)-ARRAY[''total_charges'',''updated_at'']) THEN PERFORM rs_assert_actor(ARRAY[''admin'',''admin_faskes'',''nurse'',''perawat'',''doctor'',''dokter'',''finance'',''cashier'',''finance_staff'']); ELSE '||needle||' END IF;');EXECUTE body;
END $$;
ALTER FUNCTION inp_charge_room_days(bigint) RENAME TO inp_charge_room_days_before_cutover;
REVOKE ALL ON FUNCTION inp_charge_room_days_before_cutover(bigint) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION inp_charge_room_days(p_stay_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM ops_actor();IF NOT EXISTS(SELECT 1 FROM inpatient_stays WHERE id=p_stay_id AND tenant_id=current_tenant_id()) THEN RAISE EXCEPTION 'Perawatan bukan milik tenant';END IF;
 IF EXISTS(SELECT 1 FROM rs_billing_setups WHERE stay_id=p_stay_id AND state='active') THEN RETURN jsonb_build_object('ok',true,'hari_baru',0,'deferred_finance',true,'total',(SELECT coalesce(sum(amount),0) FROM inpatient_charges WHERE stay_id=p_stay_id AND dibatalkan_at IS NULL));END IF;RETURN inp_charge_room_days_before_cutover(p_stay_id);
END $$;
-- Preserve the legacy clinical discharge, but defer its journal only for explicitly enrolled stays.
DO $$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('inp_discharge_patient(bigint,text,text,text,text,text,text,text,text,text,date,text)'::regprocedure) INTO body;
 IF position('IF v_total > 0 THEN' IN body)=0 THEN RAISE EXCEPTION 'Discharge journal source contract changed; review required';END IF;
 body:=replace(body,'IF v_total > 0 THEN','IF v_total > 0 AND NOT EXISTS(SELECT 1 FROM rs_billing_setups WHERE stay_id=p_stay_id AND state=''active'') THEN');
 body:=replace(body,'sum(amount),0) INTO v_total FROM inpatient_charges WHERE stay_id = p_stay_id','sum(amount),0) INTO v_total FROM inpatient_charges WHERE stay_id = p_stay_id AND dibatalkan_at IS NULL');
 body:=replace(body,'''warning'', v_warn)', '''warning'', v_warn, ''finance_deferred'', EXISTS(SELECT 1 FROM rs_billing_setups WHERE stay_id=p_stay_id AND state=''active''))');EXECUTE body;
END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['rs_billing_setups','rs_room_rate_segments','rs_billing_proposals','rs_billing_requests','rs_billing_events'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);END LOOP;END $$;
CREATE POLICY rs_bill_setup_read ON rs_billing_setups FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));
CREATE POLICY rs_bill_proposal_read ON rs_billing_proposals FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read('rs-inpatient-billing'));
GRANT SELECT ON rs_billing_setups,rs_billing_proposals TO authenticated;
CREATE FUNCTION rs_billing_board(p_stay_id bigint DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();ids bigint[];rows_value jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_stay_id IS NOT NULL AND p_stay_id<1 THEN RAISE EXCEPTION 'Filter/offset tidak valid';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'source_snapshot'),'[]'),array_agg(r.id) INTO rows_value,ids FROM (SELECT b.*,s.patient_name,s.stay_number,s.status stay_status,s.class_code current_class,s.room_rate current_rate,(SELECT coalesce(sum(amount),0) FROM inpatient_charges c WHERE c.stay_id=b.stay_id AND c.dibatalkan_at IS NULL) source_total,(SELECT coalesce(sum(delta),0) FROM rs_billing_proposals p WHERE p.setup_id=b.id AND p.state='posted') engine_net FROM rs_billing_setups b JOIN inpatient_stays s ON s.id=b.stay_id WHERE b.tenant_id=t AND (p_stay_id IS NULL OR b.stay_id=p_stay_id) ORDER BY b.id DESC LIMIT 51 OFFSET p_offset)r;
 RETURN jsonb_build_object('setups',rows_value,'stays',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT s.id,s.stay_number,s.patient_name,s.class_code,s.room_rate,s.status,(SELECT coalesce(sum(amount),0) FROM inpatient_charges c WHERE c.stay_id=s.id AND c.dibatalkan_at IS NULL) source_total FROM inpatient_stays s WHERE s.tenant_id=t AND (p_stay_id IS NULL OR s.id=p_stay_id) ORDER BY s.id DESC LIMIT 200)s),'[]'),
 'policies',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'scope',scope,'revision',revision,'payload',payload)) FROM ops_policy_versions WHERE tenant_id=t AND kind='administrative' AND state='active' AND effective_at<=now()),'[]'),
 'source_timezone',current_setting('TimeZone'),
 'proposals',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('quote',p.quote-'lines')) FROM (SELECT p.*,s.patient_name FROM rs_billing_proposals p JOIN rs_billing_setups b ON b.id=p.setup_id JOIN inpatient_stays s ON s.id=b.stay_id WHERE p.tenant_id=t AND p.setup_id=ANY(ids) ORDER BY p.id DESC LIMIT 200)p),'[]'),
 'segments',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY starts_at,id) FROM rs_room_rate_segments s WHERE tenant_id=t AND setup_id=ANY(ids)),'[]'));
END $$;
CREATE FUNCTION rs_billing_quote_detail(p_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result_value jsonb;
BEGIN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);SELECT quote INTO result_value FROM rs_billing_proposals WHERE id=p_id AND tenant_id=current_tenant_id();IF NOT FOUND THEN RAISE EXCEPTION 'Proposal bukan milik tenant';END IF;RETURN result_value;END $$;
REVOKE ALL ON FUNCTION rs_billing_quote_detail(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_billing_quote_detail(bigint) TO authenticated;
REVOKE ALL ON FUNCTION rs_billing_board(bigint,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_billing_board(bigint,integer) TO authenticated;
REVOKE ALL ON FUNCTION rs_charge_source_owner(bigint,bigint),rs_charge_source_guard(),rs_billing_capture_segment(),rs_billing_source_snapshot(bigint),rs_billing_calculate(bigint,timestamptz),rs_billing_command(text,jsonb,text),inp_charge_room_days(bigint),rs_charge_source_visible(bigint),tagihan_posting(text,bigint,text,text,numeric,numeric,bigint,bigint,text),tagihan_batalkan(bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_billing_command(text,jsonb,text),inp_charge_room_days(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rs_charge_source_visible(bigint),tagihan_posting(text,bigint,text,text,numeric,numeric,bigint,bigint,text),tagihan_batalkan(bigint,text,text) TO authenticated;
COMMIT;
