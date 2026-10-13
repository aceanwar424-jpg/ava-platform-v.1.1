-- OWNED_BY: generic. Observed-source history after explicit reviewed cutover, never guessed history.
BEGIN;
CREATE TABLE rs_capacity_setups(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 policy jsonb NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','review','approved','active','retired','cancelled')),
 created_by uuid NOT NULL,reviewed_by uuid,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,
 cutover_at timestamptz,coverage_ended_at timestamptz,version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX rs_capacity_active ON rs_capacity_setups(tenant_id) WHERE state='active';
CREATE TABLE rs_capacity_source_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 setup_id bigint NOT NULL REFERENCES rs_capacity_setups(id),kind text NOT NULL CHECK(kind IN ('bed','stay')),
 source_id bigint NOT NULL,snapshot jsonb NOT NULL,observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor_id uuid,event_type text NOT NULL CHECK(event_type IN ('opening','insert','update'))
);
CREATE INDEX rs_capacity_source_lookup ON rs_capacity_source_events(setup_id,kind,source_id,observed_at DESC,id DESC);
CREATE TABLE rs_capacity_requests(tenant_id uuid NOT NULL,request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE rs_capacity_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL,setup_id bigint NOT NULL REFERENCES rs_capacity_setups(id),actor_id uuid NOT NULL,action text NOT NULL,reason text NOT NULL,before_row jsonb,after_row jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION rs_capacity_snapshot(p_kind text,p_row jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN p_kind='bed' THEN jsonb_build_object('id',p_row->'id','is_active',p_row->'is_active','status',p_row->'status','ward_id',p_row->'ward_id') ELSE jsonb_build_object('id',p_row->'id','bed_id',p_row->'bed_id','admission_id',p_row->'admission_id','status',p_row->'status','admitted_at',p_row->'admitted_at','discharged_at',p_row->'discharged_at') END
$$;
CREATE FUNCTION rs_capacity_epoch_snapshot(p_kind text,p_row jsonb,p_zone text,p_basis text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb:=rs_capacity_snapshot(p_kind,p_row);prev jsonb;entry_time timestamptz;exit_time timestamptz;
BEGIN
 IF p_kind='bed' THEN RETURN v;END IF;
 SELECT snapshot INTO prev FROM rs_capacity_source_events WHERE tenant_id=(p_row->>'tenant_id')::uuid AND kind='stay' AND source_id=(p_row->>'id')::bigint ORDER BY observed_at DESC,id DESC LIMIT 1;
 IF prev->>'admitted_at' IS NOT DISTINCT FROM v->>'admitted_at' AND prev->>'admitted_epoch' IS NOT NULL THEN entry_time:=(prev->>'admitted_epoch')::timestamptz;ELSE entry_time:=(v->>'admitted_at')::timestamp AT TIME ZONE p_zone;END IF;
 IF prev->>'discharged_at' IS NOT DISTINCT FROM v->>'discharged_at' AND prev->>'discharged_epoch' IS NOT NULL THEN exit_time:=(prev->>'discharged_epoch')::timestamptz;ELSE exit_time:=(v->>'discharged_at')::timestamp AT TIME ZONE p_zone;END IF;
 RETURN v||jsonb_build_object('admitted_epoch',entry_time,'discharged_epoch',exit_time,'timestamp_zone',p_zone,'epoch_basis',p_basis);
END $$;
CREATE FUNCTION rs_capacity_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg rs_capacity_setups;k text;v jsonb;owner_value uuid;
BEGIN
 k:=CASE TG_TABLE_NAME WHEN 'inpatient_beds' THEN 'bed' ELSE 'stay' END;
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM rs_capacity_source_events WHERE tenant_id=OLD.tenant_id AND kind=k AND source_id=OLD.id) THEN RAISE EXCEPTION 'Source kapasitas berhistori tidak dapat dihapus';END IF;RETURN OLD;END IF;
 owner_value:=NEW.tenant_id;SELECT * INTO cfg FROM rs_capacity_setups WHERE tenant_id=owner_value AND state='active';
 IF NOT FOUND THEN RETURN NEW;END IF;
 v:=rs_capacity_snapshot(k,to_jsonb(NEW));
 IF TG_OP='UPDATE' AND v IS NOT DISTINCT FROM rs_capacity_snapshot(k,to_jsonb(OLD)) THEN RETURN NEW;END IF;
 v:=rs_capacity_epoch_snapshot(k,to_jsonb(NEW),current_setting('TimeZone'),'source_write_session');
 INSERT INTO rs_capacity_source_events(tenant_id,setup_id,kind,source_id,snapshot,actor_id,event_type) VALUES(owner_value,cfg.id,k,NEW.id,v,auth.uid(),lower(TG_OP));RETURN NEW;
END $$;
CREATE TRIGGER rs_capacity_capture AFTER INSERT OR UPDATE OR DELETE ON inpatient_beds FOR EACH ROW EXECUTE FUNCTION rs_capacity_capture();
CREATE TRIGGER rs_capacity_capture AFTER INSERT OR UPDATE OR DELETE ON inpatient_stays FOR EACH ROW EXECUTE FUNCTION rs_capacity_capture();
CREATE FUNCTION rs_capacity_validate(p jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->>'method' IS DISTINCT FROM 'observed_daily_v1' OR p->>'patient_day_method' IS NULL OR p->>'patient_day_method' NOT IN ('calendar_inclusive','census') OR p->>'bed_denominator' IS NULL OR p->>'bed_denominator' NOT IN ('active','active_nonrepair') OR p->>'los_method' IS DISTINCT FROM 'calendar_date_difference' OR coalesce(p->>'census_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Metode sensus/hari/denominator/LOS eksplisit wajib';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone') OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'source_timezone') THEN RAISE EXCEPTION 'Timezone laporan dan source wajib';END IF;
 IF jsonb_typeof(p->'same_day_patient_days') IS DISTINCT FROM 'number' OR (p->>'same_day_patient_days')::numeric NOT IN (0,1) OR jsonb_typeof(p->'same_day_los_days') IS DISTINCT FROM 'number' OR (p->>'same_day_los_days')::numeric NOT IN (0,1) THEN RAISE EXCEPTION 'Aturan pasien masuk-keluar sehari wajib 0 atau 1';END IF;
 IF coalesce(length(trim(p->>'source_reference')),0) NOT BETWEEN 3 AND 2000 OR coalesce(length(trim(p->>'source_version')),0) NOT BETWEEN 1 AND 200 OR coalesce(length(trim(p->>'review_reference')),0) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'Sumber/versi/evidence definisi statistik wajib';END IF;
END $$;
CREATE FUNCTION rs_capacity_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;p rs_capacity_setups;old jsonb;req rs_capacity_requests;inp jsonb:=jsonb_build_object('action',p_action,'data',p_data);v jsonb;next_state text;cutover timestamptz;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes']);
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input/alasan/request key wajib';END IF;
 IF p_data->>'tenant_id' IS NOT NULL AND (p_data->>'tenant_id')::uuid IS DISTINCT FROM t THEN RAISE EXCEPTION 'Tenant tidak sama';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'capacity:'||p_key));SELECT * INTO req FROM rs_capacity_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF req.actor_id<>a OR req.input IS DISTINCT FROM inp THEN RAISE EXCEPTION 'Retry input/actor berbeda';END IF;RETURN req.result;END IF;
 IF p_action='create' THEN
  PERFORM rs_capacity_validate(p_data->'policy');
  INSERT INTO rs_capacity_setups(tenant_id,policy,created_by) VALUES(t,p_data->'policy',a) RETURNING * INTO p;
 ELSE
  SELECT * INTO p FROM rs_capacity_setups WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Setup tidak ditemukan';END IF;
  IF p.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Setup berubah';END IF;old:=to_jsonb(p);
  next_state:=CASE WHEN p_action='submit' AND p.state='draft' THEN 'review' WHEN p_action='approve' AND p.state='review' THEN 'approved' WHEN p_action='activate' AND p.state='approved' THEN 'active' WHEN p_action='cancel' AND p.state IN ('draft','review','approved') THEN 'cancelled' END;
  IF next_state IS NULL THEN RAISE EXCEPTION 'Transisi setup tidak sah';END IF;
  IF p_action='approve' AND p.created_by=a THEN RAISE EXCEPTION 'Reviewer statistik harus berbeda';END IF;
  IF p_action='activate' THEN
   PERFORM 1 FROM user_profiles WHERE id=p.reviewed_by AND tenant_id=t FOR SHARE;
   IF p.reviewed_by IS NULL OR NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=p.reviewed_by AND tenant_id=t AND lower(role) IN ('super_admin','head_operation','direktur','admin_faskes')) THEN RAISE EXCEPTION 'Reviewer setup tidak lagi berwenang';END IF;
   -- Fail promptly while source writes are running. Retry after completion; no partial opening.
   BEGIN LOCK TABLE inpatient_stays,inpatient_beds IN SHARE ROW EXCLUSIVE MODE NOWAIT;
   EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Sumber sedang berubah; coba aktivasi lagi setelah selesai';END;
   IF EXISTS(SELECT 1 FROM inpatient_beds WHERE tenant_id=t AND is_active IS NULL) OR EXISTS(SELECT 1 FROM inpatient_stays s LEFT JOIN inpatient_beds b ON b.id=s.bed_id WHERE s.tenant_id=t AND s.status='Dirawat' AND (b.tenant_id IS DISTINCT FROM t OR NOT coalesce(b.is_active,false) OR s.admitted_at IS NULL OR s.discharged_at IS NOT NULL)) THEN RAISE EXCEPTION 'Opening ownership/flag bed atau timestamp stay belum lengkap';END IF;
   cutover:=clock_timestamp();
   UPDATE rs_capacity_setups SET state='retired',coverage_ended_at=cutover,version=version+1 WHERE tenant_id=t AND state='active';
   INSERT INTO rs_capacity_source_events(tenant_id,setup_id,kind,source_id,snapshot,observed_at,actor_id,event_type) SELECT t,p.id,'bed',id,rs_capacity_snapshot('bed',to_jsonb(b)),cutover,a,'opening' FROM inpatient_beds b WHERE tenant_id=t;
   INSERT INTO rs_capacity_source_events(tenant_id,setup_id,kind,source_id,snapshot,observed_at,actor_id,event_type) SELECT t,p.id,'stay',id,rs_capacity_epoch_snapshot('stay',to_jsonb(s),p.policy->>'source_timezone','reviewed_opening'),cutover,a,'opening' FROM inpatient_stays s WHERE tenant_id=t AND status='Dirawat';
  END IF;
  UPDATE rs_capacity_setups SET state=next_state,reviewed_by=CASE WHEN p_action='approve' THEN a ELSE reviewed_by END,reviewed_at=CASE WHEN p_action='approve' THEN now() ELSE reviewed_at END,cutover_at=CASE WHEN p_action='activate' THEN cutover ELSE cutover_at END,version=version+1 WHERE id=p.id RETURNING * INTO p;
 END IF;
 v:=to_jsonb(p);INSERT INTO rs_capacity_audit(tenant_id,setup_id,actor_id,action,reason,before_row,after_row) VALUES(t,p.id,a,p_action,p_data->>'reason',old,v);INSERT INTO rs_capacity_requests VALUES(t,p_key,a,inp,v);RETURN v;
END $$;

CREATE FUNCTION rs_capacity_report(p_id bigint,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p rs_capacity_setups;d date;census timestamptz;day_end timestamptz;period_end timestamptz;n_beds integer;n_patients integer;n_same integer;bed_days numeric:=0;patient_days numeric:=0;out_count integer:=0;los_total numeric:=0;days integer;avg_beds numeric;rows_value jsonb:='[]';r record;entry_time timestamptz;exit_time timestamptz;issues jsonb:='[]';los integer;watermark bigint;result_value jsonb;bed_snapshot jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','nurse','perawat','doctor','dokter']);
 SELECT * INTO p FROM rs_capacity_setups WHERE id=p_id AND tenant_id=current_tenant_id() AND state IN ('active','retired');IF NOT FOUND THEN RAISE EXCEPTION 'Setup aktif/arsip tidak ditemukan';END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>365 OR p_from<((p.cutover_at AT TIME ZONE(p.policy->>'timezone'))::date+1) OR p_to>=(clock_timestamp() AT TIME ZONE(p.policy->>'timezone'))::date THEN RAISE EXCEPTION 'Periode wajib hari penuh sesudah cutover dan sudah selesai, maksimal 366 hari';END IF;
 period_end:=((p_to+1)::timestamp AT TIME ZONE(p.policy->>'timezone'));
 IF p.coverage_ended_at IS NOT NULL AND period_end>p.coverage_ended_at THEN RAISE EXCEPTION 'Periode melewati coverage setup lama';END IF;
 days:=p_to-p_from+1;d:=p_from;
 SELECT coalesce(max(id),0) INTO watermark FROM rs_capacity_source_events WHERE setup_id=p.id;
 FOR r IN SELECT DISTINCT ON(source_id) source_id,snapshot,observed_at FROM rs_capacity_source_events WHERE setup_id=p.id AND id<=watermark AND kind='stay' ORDER BY source_id,observed_at DESC,id DESC LOOP
  IF r.snapshot->>'status'='Dirawat' THEN CONTINUE;END IF;
  exit_time:=coalesce((r.snapshot->>'discharged_epoch')::timestamptz,(r.snapshot->>'discharged_at')::timestamp AT TIME ZONE(p.policy->>'source_timezone'));
  IF (exit_time AT TIME ZONE(p.policy->>'timezone'))::date BETWEEN p_from AND p_to AND (exit_time AT TIME ZONE(p.policy->>'timezone'))::date<>(r.observed_at AT TIME ZONE(p.policy->>'timezone'))::date THEN RAISE EXCEPTION 'Keluar backdate perlu rekonsiliasi sumber stay #% sebelum laporan periode ini',r.source_id;END IF;
 END LOOP;
 WHILE d<=p_to LOOP
  census:=(d+(p.policy->>'census_time')::time) AT TIME ZONE(p.policy->>'timezone');day_end:=((d+1)::timestamp AT TIME ZONE(p.policy->>'timezone'));
  SELECT count(*) INTO n_beds FROM(SELECT DISTINCT ON(source_id) snapshot FROM rs_capacity_source_events WHERE setup_id=p.id AND id<=watermark AND kind='bed' AND observed_at<=census ORDER BY source_id,observed_at DESC,id DESC)b WHERE (snapshot->>'is_active')::boolean AND (p.policy->>'bed_denominator'='active' OR snapshot->>'status'<>'Perbaikan');
  n_patients:=0;n_same:=0;
  FOR r IN SELECT DISTINCT ON(source_id) source_id,snapshot,observed_at FROM rs_capacity_source_events WHERE setup_id=p.id AND id<=watermark AND kind='stay' AND observed_at<CASE WHEN p.policy->>'patient_day_method'='census' THEN census ELSE day_end END ORDER BY source_id,observed_at DESC,id DESC LOOP
   entry_time:=coalesce((r.snapshot->>'admitted_epoch')::timestamptz,(r.snapshot->>'admitted_at')::timestamp AT TIME ZONE(p.policy->>'source_timezone'));exit_time:=coalesce((r.snapshot->>'discharged_epoch')::timestamptz,(r.snapshot->>'discharged_at')::timestamp AT TIME ZONE(p.policy->>'source_timezone'));
   IF entry_time IS NULL OR entry_time>r.observed_at+interval '1 minute' OR exit_time IS NOT NULL AND exit_time<entry_time THEN issues:=issues||jsonb_build_array('Timestamp source tidak sah pada stay #'||r.source_id);CONTINUE;END IF;
   IF r.snapshot->>'status'='Dirawat' THEN
    SELECT snapshot INTO bed_snapshot FROM rs_capacity_source_events WHERE setup_id=p.id AND id<=watermark AND kind='bed' AND source_id=(r.snapshot->>'bed_id')::bigint AND observed_at<CASE WHEN p.policy->>'patient_day_method'='census' THEN census ELSE day_end END ORDER BY observed_at DESC,id DESC LIMIT 1;
    IF bed_snapshot IS NULL OR NOT coalesce((bed_snapshot->>'is_active')::boolean,false) OR bed_snapshot->>'status' IS DISTINCT FROM 'Terisi' THEN issues:=issues||jsonb_build_array('Bed/stay sensus tidak konsisten #'||r.source_id);CONTINUE;END IF;
    n_patients:=n_patients+1;
   ELSIF exit_time IS NULL THEN issues:=issues||jsonb_build_array('Timestamp keluar belum ada pada stay #'||r.source_id);
   ELSIF p.policy->>'patient_day_method'='calendar_inclusive' AND (exit_time AT TIME ZONE(p.policy->>'timezone'))::date=d THEN
    IF (entry_time AT TIME ZONE(p.policy->>'timezone'))::date=d THEN n_patients:=n_patients+(p.policy->>'same_day_patient_days')::integer;ELSE n_patients:=n_patients+1;END IF;
   END IF;
  END LOOP;
  IF p.policy->>'patient_day_method'='census' AND (p.policy->>'same_day_patient_days')::integer=1 THEN
   -- Only add same-day stays not already present at the census instant.
   SELECT count(*) INTO n_same FROM(SELECT DISTINCT ON(e.source_id) e.source_id,e.snapshot FROM rs_capacity_source_events e WHERE e.setup_id=p.id AND e.id<=watermark AND e.kind='stay' AND e.observed_at<day_end ORDER BY e.source_id,e.observed_at DESC,e.id DESC)s WHERE s.snapshot->>'status'<>'Dirawat' AND (coalesce((s.snapshot->>'admitted_epoch')::timestamptz,(s.snapshot->>'admitted_at')::timestamp AT TIME ZONE(p.policy->>'source_timezone')) AT TIME ZONE(p.policy->>'timezone'))::date=d AND (coalesce((s.snapshot->>'discharged_epoch')::timestamptz,(s.snapshot->>'discharged_at')::timestamp AT TIME ZONE(p.policy->>'source_timezone')) AT TIME ZONE(p.policy->>'timezone'))::date=d AND NOT EXISTS(SELECT 1 FROM(SELECT e2.snapshot FROM rs_capacity_source_events e2 WHERE e2.setup_id=p.id AND e2.id<=watermark AND e2.kind='stay' AND e2.source_id=s.source_id AND e2.observed_at<census ORDER BY e2.observed_at DESC,e2.id DESC LIMIT 1)c WHERE c.snapshot->>'status'='Dirawat');
  END IF;
  n_patients:=n_patients+n_same;bed_days:=bed_days+n_beds;patient_days:=patient_days+n_patients;
  rows_value:=rows_value||jsonb_build_array(jsonb_build_object('date',d,'census_at',census,'beds',n_beds,'patient_days',n_patients));d:=d+1;
 END LOOP;
 FOR r IN SELECT DISTINCT ON(source_id) source_id,snapshot,observed_at FROM rs_capacity_source_events WHERE setup_id=p.id AND id<=watermark AND kind='stay' AND observed_at<period_end ORDER BY source_id,observed_at DESC,id DESC LOOP
  IF r.snapshot->>'status'='Dirawat' THEN CONTINUE;END IF;
  entry_time:=coalesce((r.snapshot->>'admitted_epoch')::timestamptz,(r.snapshot->>'admitted_at')::timestamp AT TIME ZONE(p.policy->>'source_timezone'));exit_time:=coalesce((r.snapshot->>'discharged_epoch')::timestamptz,(r.snapshot->>'discharged_at')::timestamp AT TIME ZONE(p.policy->>'source_timezone'));
  IF exit_time IS NULL OR entry_time IS NULL OR exit_time<entry_time OR exit_time>r.observed_at+interval '1 minute' THEN issues:=issues||jsonb_build_array('Tanggal keluar/masuk tidak sah pada stay #'||r.source_id);CONTINUE;END IF;
  IF (exit_time AT TIME ZONE(p.policy->>'timezone'))::date BETWEEN p_from AND p_to THEN
   IF r.snapshot->>'status' NOT IN ('Pulang','Dirujuk','Meninggal','Pulang APS') THEN issues:=issues||jsonb_build_array('Status keluar tidak dikenal #'||r.source_id);CONTINUE;END IF;
   IF (exit_time AT TIME ZONE(p.policy->>'timezone'))::date<>(r.observed_at AT TIME ZONE(p.policy->>'timezone'))::date THEN issues:=issues||jsonb_build_array('Keluar backdate perlu rekonsiliasi sumber #'||r.source_id);CONTINUE;END IF;
   los:=(exit_time AT TIME ZONE(p.policy->>'timezone'))::date-(entry_time AT TIME ZONE(p.policy->>'timezone'))::date;
   IF los=0 THEN los:=(p.policy->>'same_day_los_days')::integer;END IF;out_count:=out_count+1;los_total:=los_total+los;
  END IF;
 END LOOP;
 IF jsonb_array_length(issues)>0 THEN RAISE EXCEPTION 'Sumber belum lengkap/rekonsiliasi: %',issues;END IF;
 avg_beds:=bed_days/days;
 result_value:=jsonb_build_object('setup_id',p.id,'setup_version',p.version,'source_watermark',watermark,'policy',p.policy,'cutover_at',p.cutover_at,'from',p_from,'to',p_to,'days',days,'bed_days',bed_days,'patient_days',patient_days,'discharges',out_count,'los_total',los_total,'average_beds',avg_beds,'BOR',round(patient_days/nullif(bed_days,0)*100,4),'ALOS',round(los_total/nullif(out_count,0),4),'TOI',round((bed_days-patient_days)/nullif(out_count,0),4),'BTO',round(out_count/nullif(avg_beds,0),4),'rows',rows_value,'national_submission',false);
 INSERT INTO rs_capacity_audit(tenant_id,setup_id,actor_id,action,reason,before_row,after_row) VALUES(p.tenant_id,p.id,auth.uid(),'report','Derived observed-source statistical report',jsonb_build_object('from',p_from,'to',p_to,'source_watermark',watermark,'setup_version',p.version),result_value);
 RETURN result_value;
END $$;
CREATE OR REPLACE FUNCTION rs_bed_capacity() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','nurse','perawat','doctor','dokter']);
 SELECT jsonb_build_object('active',count(*),'occupied',count(*) FILTER(WHERE b.status='Terisi'),'cleaning',count(*) FILTER(WHERE b.status='Dibersihkan'),'repair',count(*) FILTER(WHERE b.status='Perbaikan'),'reserved',count(*) FILTER(WHERE b.status='Kosong' AND EXISTS(SELECT 1 FROM rs_bed_reservations r WHERE r.bed_id=b.id AND r.status='reserved' AND r.expires_at>now())),'available',count(*) FILTER(WHERE b.status='Kosong' AND NOT EXISTS(SELECT 1 FROM rs_bed_reservations r WHERE r.bed_id=b.id AND r.status='reserved' AND r.expires_at>now()))) INTO v FROM inpatient_beds b WHERE b.tenant_id=current_tenant_id() AND coalesce(b.is_active,true);
 RETURN v;
END $$;
CREATE FUNCTION rs_capacity_board(p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes','nurse','perawat','doctor','dokter']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id DESC),'[]') INTO v FROM(SELECT s.*,(SELECT count(*) FROM rs_capacity_source_events WHERE setup_id=s.id) AS source_events FROM rs_capacity_setups s WHERE tenant_id=current_tenant_id() ORDER BY id DESC LIMIT 51 OFFSET p_offset)r;
 RETURN jsonb_build_object('rows',v,'current',rs_bed_capacity());
END $$;
CREATE FUNCTION rs_capacity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME<>'rs_capacity_setups' OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Capacity source/audit append-only';END IF;
 IF (to_jsonb(OLD)-ARRAY['state','reviewed_by','reviewed_at','cutover_at','coverage_ended_at','version']) IS DISTINCT FROM(to_jsonb(NEW)-ARRAY['state','reviewed_by','reviewed_at','cutover_at','coverage_ended_at','version']) OR OLD.state IN ('retired','cancelled') THEN RAISE EXCEPTION 'Capacity setup original immutable';END IF;RETURN NEW;
END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['rs_capacity_setups','rs_capacity_source_events','rs_capacity_requests','rs_capacity_audit'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);EXECUTE format('CREATE TRIGGER capacity_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION rs_capacity_immutable()',n);END LOOP;END $$;
REVOKE ALL ON FUNCTION rs_capacity_snapshot(text,jsonb),rs_capacity_epoch_snapshot(text,jsonb,text,text),rs_capacity_capture(),rs_capacity_validate(jsonb),rs_capacity_immutable() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rs_capacity_command(text,jsonb,text),rs_capacity_report(bigint,date,date),rs_capacity_board(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_capacity_command(text,jsonb,text),rs_capacity_report(bigint,date,date),rs_capacity_board(integer) TO authenticated;
COMMIT;
