-- OWNED_BY: generic. Existing master resources, no automatic production seed.
BEGIN;
ALTER TABLE ops_policy_versions DROP CONSTRAINT IF EXISTS ops_policy_versions_kind_check;
ALTER TABLE ops_policy_versions ADD CONSTRAINT ops_policy_versions_kind_check CHECK(kind IN ('administrative','clinical_template','authority','sprint','resources'));
ALTER FUNCTION ops_validate_policy(text,jsonb) RENAME TO ops_validate_policy_v1;
CREATE FUNCTION ops_validate_policy(p_kind text,p jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r jsonb;ids bigint[]:='{}';id_value bigint;physical_capacity integer;
BEGIN
 IF p_kind<>'resources' OR p_kind IS NULL THEN PERFORM ops_validate_policy_v1(p_kind,p);RETURN;END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'resources') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'resources') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Daftar sumber daya wajib (1–50)'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone') THEN RAISE EXCEPTION 'Timezone tidak valid'; END IF;
 IF jsonb_typeof(p->'expiry_minutes') IS DISTINCT FROM 'number' OR (p->>'expiry_minutes')::numeric NOT BETWEEN 1 AND 1440 OR mod((p->>'expiry_minutes')::numeric,1)<>0 THEN RAISE EXCEPTION 'Expiry menit wajib 1–1440'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'resources') LOOP
  IF jsonb_typeof(r->'master_id') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Master ID wajib'; END IF;
  id_value:=(r->>'master_id')::bigint;
  IF id_value=ANY(ids) THEN RAISE EXCEPTION 'Resource duplikat'; END IF;ids:=array_append(ids,id_value);
  IF NOT EXISTS(SELECT 1 FROM his_master_records WHERE id=id_value AND tenant_id=current_tenant_id() AND domain_key IN ('unit_room','equipment','service_capacity') AND status='active') THEN RAISE EXCEPTION 'Resource harus master aktif tenant'; END IF;
  IF jsonb_typeof(r->'capacity') IS DISTINCT FROM 'number' OR (r->>'capacity')::numeric NOT BETWEEN 1 AND 10000 OR mod((r->>'capacity')::numeric,1)<>0 THEN RAISE EXCEPTION 'Kapasitas wajib integer positif'; END IF;
  SELECT CASE WHEN domain_key='equipment' THEN 1 ELSE (payload->>'capacity')::integer END INTO physical_capacity FROM his_master_records WHERE id=id_value;
  IF physical_capacity IS NULL OR physical_capacity<1 OR (r->>'capacity')::integer>physical_capacity THEN RAISE EXCEPTION 'Kapasitas melebihi master fisik atau master belum lengkap'; END IF;
  IF jsonb_typeof(r->'buffer_before_minutes') IS DISTINCT FROM 'number' OR jsonb_typeof(r->'buffer_after_minutes') IS DISTINCT FROM 'number' OR (r->>'buffer_before_minutes')::numeric NOT BETWEEN 0 AND 1440 OR (r->>'buffer_after_minutes')::numeric NOT BETWEEN 0 AND 1440 THEN RAISE EXCEPTION 'Buffer wajib 0–1440 menit'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION ops_validate_policy(text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE TABLE rs_resource_bookings (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 scope text NOT NULL,policy_id bigint NOT NULL REFERENCES ops_policy_versions(id),
 admission_id bigint REFERENCES admissions(id),order_id bigint REFERENCES rs_work_orders(id),
 purpose text NOT NULL CHECK(purpose IN ('service','maintenance')),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 expires_at timestamptz NOT NULL,state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','confirmed','in_progress','completed','cancelled','expired')),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 reason text NOT NULL,completed_at timestamptz
);
CREATE TABLE rs_resource_booking_items (
 booking_id bigint NOT NULL REFERENCES rs_resource_bookings(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 master_id bigint NOT NULL REFERENCES his_master_records(id),units integer NOT NULL CHECK(units>0),resource_name text NOT NULL,
 occupied tstzrange NOT NULL CHECK(NOT isempty(occupied)),PRIMARY KEY(booking_id,master_id)
);
CREATE INDEX rs_resource_occupied ON rs_resource_booking_items(master_id);
CREATE INDEX rs_resource_booking_board ON rs_resource_bookings(tenant_id,starts_at DESC,id DESC);
CREATE FUNCTION rs_booking_board(p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE headers jsonb;items jsonb;ids bigint[];
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','dokter','doctor','nurse','perawat','midwife','bidan','porter','facility','cssd']);
 IF p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'Offset tidak valid'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY starts_at DESC,id DESC),'[]'),array_agg(id) INTO headers,ids FROM (SELECT * FROM rs_resource_bookings WHERE tenant_id=current_tenant_id() AND rs_can_read(scope) ORDER BY starts_at DESC,id DESC LIMIT 51 OFFSET p_offset) x;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM rs_resource_booking_items x WHERE tenant_id=current_tenant_id() AND booking_id=ANY(ids);
 RETURN jsonb_build_object('bookings',headers,'items',items);
END $$;
CREATE FUNCTION rs_booking_setup()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;p jsonb;o jsonb;w jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','dokter','doctor','nurse','perawat','midwife','bidan','porter','facility','cssd']);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'domain',domain_key,'capacity',CASE WHEN domain_key='equipment' THEN 1 ELSE (payload->>'capacity')::integer END) ORDER BY name),'[]') INTO r FROM his_master_records WHERE tenant_id=current_tenant_id() AND status='active' AND domain_key IN ('unit_room','equipment','service_capacity');
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO p FROM (SELECT DISTINCT ON(scope) * FROM ops_policy_versions WHERE tenant_id=current_tenant_id() AND kind='resources' AND state='active' AND effective_at<=now() ORDER BY scope,effective_at DESC,revision DESC) x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,'admission_id',admission_id)),'[]') INTO o FROM (SELECT * FROM rs_work_orders WHERE tenant_id=current_tenant_id() AND status='active' AND rs_can_read(kind) ORDER BY created_at DESC LIMIT 200) x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'label',label) ORDER BY label),'[]') INTO w FROM rs_workflow_types;
 RETURN jsonb_build_object('resources',r,'policies',p,'orders',o,'workflows',w);
END $$;
CREATE TABLE rs_resource_booking_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 booking_id bigint NOT NULL REFERENCES rs_resource_bookings(id),actor_id uuid NOT NULL,action text NOT NULL,
 input jsonb NOT NULL,before_state text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rs_resource_booking_requests (
 tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,
 input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key)
);
CREATE FUNCTION rs_booking_command(p_action text,p_data jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;b rs_resource_bookings;q rs_resource_booking_requests;
 policy jsonb;cfg jsonb;x jsonb;start_time timestamptz;end_time timestamptz;bounds tstzrange;
 rid bigint;units_value integer;cap integer;physical_capacity integer;peak integer;prior text;result_value jsonb;
 inp jsonb:=jsonb_build_object('action',p_action,'data',p_data);seen bigint[]:='{}';
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','dokter','doctor','nurse','perawat','midwife','bidan','porter','facility','cssd']);
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input, alasan dan request key wajib'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'booking-key'||p_request_key));
 SELECT * INTO q FROM rs_resource_booking_requests WHERE tenant_id=t AND request_key=p_request_key;
 IF FOUND THEN IF q.actor_id<>a OR q.input IS DISTINCT FROM inp THEN RAISE EXCEPTION 'Retry input/actor berbeda'; END IF;RETURN q.result;END IF;
 IF p_action='reserve' THEN
  policy:=ops_active_policy('resources',p_data->>'scope');PERFORM ops_assert_permission(p_data->>'scope','resource.reserve');
  start_time:=(p_data->>'starts_at')::timestamptz;end_time:=(p_data->>'ends_at')::timestamptz;
  IF start_time IS NULL OR end_time IS NULL OR end_time<=start_time OR end_time<=now() OR start_time<now()-interval '1 minute' THEN RAISE EXCEPTION 'Rentang waktu tidak valid'; END IF;
  IF p_data->>'purpose' IS NULL OR p_data->>'purpose' NOT IN ('service','maintenance') THEN RAISE EXCEPTION 'Jenis booking wajib'; END IF;
  IF p_data->>'purpose'='service' THEN
   IF NOT EXISTS(SELECT 1 FROM rs_work_orders WHERE id=(p_data->>'order_id')::bigint AND tenant_id=t AND kind=p_data->>'scope' AND status='active' AND admission_id IS NOT DISTINCT FROM (p_data->>'admission_id')::bigint) THEN RAISE EXCEPTION 'Order sumber aktif dan kunjungan yang sesuai wajib'; END IF;
  END IF;
  IF p_data->>'admission_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM admissions WHERE id=(p_data->>'admission_id')::bigint AND tenant_id=t) THEN RAISE EXCEPTION 'Kunjungan bukan milik tenant'; END IF;
  IF jsonb_typeof(p_data->'resources') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'resources') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Pilih sumber daya'; END IF;
  -- All resource locks are acquired in stable order before checking/inserting.
  FOR x IN SELECT value FROM jsonb_array_elements(p_data->'resources') ORDER BY (value->>'master_id')::bigint LOOP
   IF jsonb_typeof(x->'master_id') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'units') IS DISTINCT FROM 'number' OR mod((x->>'units')::numeric,1)<>0 THEN RAISE EXCEPTION 'Resource/units wajib integer'; END IF;
   rid:=(x->>'master_id')::bigint;IF rid=ANY(seen) THEN RAISE EXCEPTION 'Resource duplikat'; END IF;seen:=array_append(seen,rid);
   PERFORM pg_advisory_xact_lock(hashtext(t::text||'resource'||rid::text));
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(p_data->'resources') LOOP
   rid:=(x->>'master_id')::bigint;units_value:=(x->>'units')::integer;
   SELECT value INTO cfg FROM jsonb_array_elements(policy->'payload'->'resources') WHERE (value->>'master_id')::bigint=rid;
   IF cfg IS NULL THEN RAISE EXCEPTION 'Resource belum disahkan untuk unit'; END IF;cap:=(cfg->>'capacity')::integer;
   SELECT CASE WHEN domain_key='equipment' THEN 1 ELSE (payload->>'capacity')::integer END INTO physical_capacity FROM his_master_records WHERE id=rid;
   IF physical_capacity IS NULL OR physical_capacity<1 THEN RAISE EXCEPTION 'Kapasitas master belum lengkap'; END IF;cap:=least(cap,physical_capacity);
   IF units_value<1 OR units_value>cap THEN RAISE EXCEPTION 'Units melebihi kapasitas'; END IF;
   IF NOT EXISTS(SELECT 1 FROM his_master_records WHERE id=rid AND tenant_id=t AND status='active' AND (effective_from IS NULL OR effective_from<=(start_time AT TIME ZONE (policy->'payload'->>'timezone'))::date) AND (effective_to IS NULL OR effective_to>=((end_time-interval '1 microsecond') AT TIME ZONE (policy->'payload'->>'timezone'))::date)) THEN RAISE EXCEPTION 'Resource tidak aktif pada waktu booking'; END IF;
   bounds:=tstzrange(start_time-((cfg->>'buffer_before_minutes')::numeric*interval '1 minute'),end_time+((cfg->>'buffer_after_minutes')::numeric*interval '1 minute'),'[)');
   -- Exact peak at interval start events; disjoint overlapping slots aren't summed together.
   WITH occupied_slots AS (SELECT i.occupied,i.units FROM rs_resource_booking_items i JOIN rs_resource_bookings h ON h.id=i.booking_id WHERE i.tenant_id=t AND i.master_id=rid AND i.occupied&&bounds AND h.state IN ('reserved','confirmed','in_progress','completed') AND (h.state<>'reserved' OR h.expires_at>now())),
   points AS (SELECT lower(bounds) AS at UNION SELECT lower(occupied) FROM occupied_slots WHERE lower(occupied)>=lower(bounds))
   SELECT coalesce(max((SELECT coalesce(sum(o.units),0) FROM occupied_slots o WHERE o.occupied @> points.at)),0) INTO peak FROM points;
   IF peak+units_value>cap THEN RAISE EXCEPTION 'Benturan jadwal/kapasitas resource %',rid; END IF;
  END LOOP;
  INSERT INTO rs_resource_bookings(tenant_id,scope,policy_id,admission_id,order_id,purpose,starts_at,ends_at,expires_at,created_by,reason)
   VALUES(t,p_data->>'scope',(policy->>'id')::bigint,(p_data->>'admission_id')::bigint,(p_data->>'order_id')::bigint,p_data->>'purpose',start_time,end_time,least(end_time,now()+((policy->'payload'->>'expiry_minutes')::integer*interval '1 minute')),a,p_data->>'reason') RETURNING * INTO b;
  FOR x IN SELECT value FROM jsonb_array_elements(p_data->'resources') LOOP
   rid:=(x->>'master_id')::bigint;SELECT value INTO cfg FROM jsonb_array_elements(policy->'payload'->'resources') WHERE (value->>'master_id')::bigint=rid;
   INSERT INTO rs_resource_booking_items(booking_id,tenant_id,master_id,units,resource_name,occupied)
    SELECT b.id,t,rid,(x->>'units')::integer,name,tstzrange(start_time-((cfg->>'buffer_before_minutes')::numeric*interval '1 minute'),end_time+((cfg->>'buffer_after_minutes')::numeric*interval '1 minute'),'[)') FROM his_master_records WHERE id=rid AND tenant_id=t;
  END LOOP;
 ELSE
  SELECT * INTO b FROM rs_resource_bookings WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking tidak ditemukan'; END IF;
  IF (p_data->>'version')::integer IS DISTINCT FROM b.version THEN RAISE EXCEPTION 'Data berubah'; END IF;
  PERFORM ops_assert_permission(b.scope,'resource.'||p_action,b.created_by);prior:=b.state;
  FOR rid IN SELECT master_id FROM rs_resource_booking_items WHERE booking_id=b.id ORDER BY master_id LOOP PERFORM pg_advisory_xact_lock(hashtext(t::text||'resource'||rid::text));END LOOP;
  IF p_action='confirm' AND b.state='reserved' AND b.expires_at>now() THEN b.state:='confirmed';
  ELSIF p_action='start' AND b.state='confirmed' THEN
   IF now()<b.starts_at OR now()>=b.ends_at THEN RAISE EXCEPTION 'Mulai harus dalam slot terkonfirmasi'; END IF;
   SELECT to_jsonb(v) INTO policy FROM ops_policy_versions v WHERE id=b.policy_id;
   FOR x IN SELECT to_jsonb(i) FROM rs_resource_booking_items i WHERE booking_id=b.id LOOP
    rid:=(x->>'master_id')::bigint;SELECT value INTO cfg FROM jsonb_array_elements(policy->'payload'->'resources') WHERE (value->>'master_id')::bigint=rid;
    SELECT CASE WHEN domain_key='equipment' THEN 1 ELSE (payload->>'capacity')::integer END INTO physical_capacity FROM his_master_records WHERE id=rid AND tenant_id=t AND status='active';
    IF physical_capacity IS NULL OR physical_capacity<1 THEN RAISE EXCEPTION 'Resource tidak aktif atau kapasitas master belum lengkap'; END IF;
    SELECT coalesce(sum(i.units),0) INTO peak FROM rs_resource_booking_items i JOIN rs_resource_bookings h ON h.id=i.booking_id WHERE i.tenant_id=t AND i.master_id=rid AND h.state='in_progress' AND h.id<>b.id;
    IF peak+(x->>'units')::integer>least((cfg->>'capacity')::integer,physical_capacity) THEN RAISE EXCEPTION 'Resource masih dipakai layanan sebelumnya'; END IF;
   END LOOP;
   UPDATE rs_resource_booking_items SET occupied=tstzrange(lower(occupied),NULL,'[)') WHERE booking_id=b.id;b.state:='in_progress';
  ELSIF p_action='complete' AND b.state='in_progress' THEN
   SELECT to_jsonb(v) INTO policy FROM ops_policy_versions v WHERE id=b.policy_id;
   FOR x IN SELECT to_jsonb(i) FROM rs_resource_booking_items i WHERE booking_id=b.id LOOP
    rid:=(x->>'master_id')::bigint;SELECT value INTO cfg FROM jsonb_array_elements(policy->'payload'->'resources') WHERE (value->>'master_id')::bigint=rid;
    UPDATE rs_resource_booking_items SET occupied=tstzrange(lower(occupied),greatest(now(),b.ends_at)+((cfg->>'buffer_after_minutes')::numeric*interval '1 minute'),'[)') WHERE booking_id=b.id AND master_id=rid;
   END LOOP;b.state:='completed';
  ELSIF p_action='cancel' AND b.state IN ('reserved','confirmed') THEN b.state:='cancelled';
  ELSIF p_action='expire' AND b.state='reserved' AND b.expires_at<=now() THEN b.state:='expired';
  ELSE RAISE EXCEPTION 'Transisi booking tidak diizinkan'; END IF;
  UPDATE rs_resource_bookings SET state=b.state,version=version+1,reason=p_data->>'reason',completed_at=CASE WHEN b.state='completed' THEN now() ELSE completed_at END WHERE id=b.id RETURNING * INTO b;
 END IF;
 INSERT INTO rs_resource_booking_events(tenant_id,booking_id,actor_id,action,input,before_state) VALUES(t,b.id,a,p_action,p_data,prior);
 result_value:=to_jsonb(b);INSERT INTO rs_resource_booking_requests VALUES(t,p_request_key,a,inp,result_value);RETURN result_value;
END $$;

DO $$DECLARE n text;BEGIN
 FOREACH n IN ARRAY ARRAY['rs_resource_bookings','rs_resource_booking_items','rs_resource_booking_events','rs_resource_booking_requests'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);
 END LOOP;
END $$;
CREATE POLICY rs_bookings_read ON rs_resource_bookings FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND rs_can_read(scope));
CREATE POLICY rs_booking_items_read ON rs_resource_booking_items FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND EXISTS(SELECT 1 FROM rs_resource_bookings WHERE id=booking_id));
CREATE POLICY rs_booking_events_read ON rs_resource_booking_events FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() AND EXISTS(SELECT 1 FROM rs_resource_bookings WHERE id=booking_id));
GRANT SELECT ON rs_resource_bookings,rs_resource_booking_items,rs_resource_booking_events TO authenticated;
REVOKE ALL ON FUNCTION rs_booking_command(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_booking_command(text,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION rs_booking_setup() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_booking_setup() TO authenticated;
REVOKE ALL ON FUNCTION rs_booking_board(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_booking_board(integer) TO authenticated;
INSERT INTO role_pages(role_kode,page) SELECT kode,'rs-resource-booking' FROM roles WHERE kode IN ('super_admin','head_operation','direktur','admin','admin_faskes','dokter','doctor','nurse','perawat','midwife','bidan','porter','facility','cssd') ON CONFLICT DO NOTHING;
COMMIT;
