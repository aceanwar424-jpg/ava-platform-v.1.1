-- OWNED_BY: generic. Master mapping checkpoint approved 2026-10-12; local only.
BEGIN;
CREATE TABLE lis_catalog_primary_terms(code text PRIMARY KEY,primary_name text NOT NULL,metadata jsonb NOT NULL);
CREATE TABLE lis_catalog_ucum_units(code text PRIMARY KEY,validation jsonb NOT NULL);
CREATE TABLE lis_catalog_method_versions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 product_id bigint NOT NULL REFERENCES products(id),item_id bigint NOT NULL REFERENCES product_items(id),
 source_snapshot jsonb NOT NULL,analyte_code text NOT NULL,catalog_version text NOT NULL,
 method_id text NOT NULL,definition jsonb NOT NULL,revision integer NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','in_review','approved','active','retired','rejected')),
 created_by uuid NOT NULL,reviewed_by uuid,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,
 valid_from timestamptz NOT NULL,valid_until timestamptz NOT NULL,activated_at timestamptz,
 version integer NOT NULL DEFAULT 1,CHECK(valid_until>valid_from),UNIQUE(tenant_id,item_id,method_id,revision)
);
CREATE UNIQUE INDEX lis_catalog_one_active_method ON lis_catalog_method_versions(tenant_id,item_id,method_id) WHERE state='active';
CREATE TABLE lis_catalog_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE lis_catalog_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),method_version_id bigint NOT NULL REFERENCES lis_catalog_method_versions(id),actor_id uuid NOT NULL,action text NOT NULL,reason text NOT NULL,before_row jsonb,after_row jsonb,created_at timestamptz NOT NULL DEFAULT now());

CREATE FUNCTION lis_catalog_source_snapshot(p_product bigint,p_item bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('product_id',p.id,'item_id',i.id,'material_code',p.kode_material,'examination_name',p.nama_tes,'source_product_code',p.kode_internal,'item_code',i.code,'item_name',i.name_id,'item_active',i.is_active,'product_active',p.is_active,'item_uom',i.uom,'item_loinc',to_jsonb(i)->>'loinc_code','item_result_type',to_jsonb(i)->>'result_type','product_is_panel',to_jsonb(p)->>'is_panel','product_specimen',to_jsonb(p)->>'sampel_type','product_method',to_jsonb(p)->>'metode','item_specimen',to_jsonb(i)->>'specimen_type','item_analyzer_id',to_jsonb(i)->>'analyzer_id')
 FROM products p JOIN product_items i ON i.product_id=p.id WHERE p.id=p_product AND i.id=p_item
$$;
CREATE FUNCTION lis_catalog_lock_source(p_product bigint,p_item bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM products WHERE id=p_product FOR SHARE;
 PERFORM 1 FROM product_items WHERE id=p_item AND product_id=p_product FOR SHARE;
END $$;

CREATE FUNCTION lis_catalog_validate_definition(p jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r jsonb;s jsonb;lo numeric;hi numeric;age_lo numeric;age_hi numeric;ix integer:=0;jx integer;term lis_catalog_primary_terms;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->>'result_type' IS NULL OR p->>'result_type' NOT IN ('numeric','qualitative') OR
    coalesce(p->>'loinc','')!~ '^\d{1,5}-\d$' OR coalesce(length(trim(p->>'specimen')),0)<2 OR
    coalesce(length(trim(p->>'method')),0)<3 OR coalesce(length(trim(p->>'device_reagent')),0)<3 OR
    coalesce(length(trim(p->>'mapping_evidence')),0)<5 OR coalesce(length(trim(p->>'reference_evidence')),0)<5 OR
    coalesce(length(trim(p->>'source_version')),0)<3 OR
    coalesce(p->>'timezone','') NOT IN (SELECT name FROM pg_timezone_names) OR
    p->>'age_unit' IS NULL OR p->>'age_unit' NOT IN ('d','mo','a') OR
    coalesce(p->>'terminology_url','')!~ '^https://(loinc\.org|clinicaltables\.nlm\.nih\.gov)/' OR
    coalesce(length(trim(p->>'primary_name')),0)<3 THEN RAISE EXCEPTION 'Metode, mapping primer, specimen, IFU/acuan/version, timezone dan age unit eksplisit wajib';END IF;
 IF p->>'result_type'='numeric' AND coalesce(length(trim(p->>'ucum')),0)<1 THEN RAISE EXCEPTION 'UCUM kuantitatif wajib';END IF;
 SELECT * INTO term FROM lis_catalog_primary_terms WHERE code=p->>'loinc' FOR SHARE;
 IF NOT FOUND OR term.primary_name IS DISTINCT FROM p->>'primary_name' OR term.metadata->>'canonical_url' IS DISTINCT FROM p->>'terminology_url' THEN RAISE EXCEPTION 'Kode/nama/URL harus sama dengan snapshot sumber primer yang tersedia';END IF;
 IF p ? 'terminology_snapshot' AND p->'terminology_snapshot' IS DISTINCT FROM term.metadata THEN RAISE EXCEPTION 'Snapshot terminologi berubah; review versi baru wajib';END IF;
 IF p->>'result_type'='numeric' AND NOT EXISTS(SELECT 1 FROM lis_catalog_ucum_units WHERE code=p->>'ucum' AND validation->>'status'='valid') THEN RAISE EXCEPTION 'Unit UCUM belum tervalidasi; jangan pakai label unit bebas';END IF;
 IF jsonb_typeof(p->'ranges') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'ranges') NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Range/expected values demografi wajib';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'ranges') LOOP
  ix:=ix+1;
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR jsonb_typeof(r->'age_min') IS DISTINCT FROM 'number' OR jsonb_typeof(r->'age_max') IS DISTINCT FROM 'number' OR
     jsonb_typeof(r->'age_lower_inclusive') IS DISTINCT FROM 'boolean' OR jsonb_typeof(r->'age_upper_inclusive') IS DISTINCT FROM 'boolean' OR
     r->>'sex' IS NULL OR r->>'sex' NOT IN ('all','male','female') OR coalesce(length(trim(r->>'condition')),0)<1 THEN RAISE EXCEPTION 'Rentang usia/sex/condition/inclusivity eksplisit wajib';END IF;
  age_lo:=(r->>'age_min')::numeric;age_hi:=(r->>'age_max')::numeric;
  IF age_lo<0 OR age_hi<age_lo OR age_hi=age_lo AND (NOT(r->>'age_lower_inclusive')::boolean OR NOT(r->>'age_upper_inclusive')::boolean) THEN RAISE EXCEPTION 'Rentang usia tidak valid';END IF;
  IF p->>'result_type'='numeric' THEN
   IF r->>'operator' IS NULL OR r->>'operator' NOT IN ('BETWEEN','<','<=','>','>=','=') THEN RAISE EXCEPTION 'Operator kuantitatif wajib';END IF;
   IF r->>'operator'='BETWEEN' AND (jsonb_typeof(r->'lower') IS DISTINCT FROM 'number' OR jsonb_typeof(r->'upper') IS DISTINCT FROM 'number') OR
      r->>'operator' IN ('<','<=') AND (jsonb_typeof(r->'upper') IS DISTINCT FROM 'number' OR coalesce(r->'lower','null')<>'null') OR
      r->>'operator' IN ('>','>=','=') AND (jsonb_typeof(r->'lower') IS DISTINCT FROM 'number' OR coalesce(r->'upper','null')<>'null') THEN RAISE EXCEPTION 'Batas numerik sesuai operator wajib, tanpa konversi null ke nol';END IF;
   lo:=(r->>'lower')::numeric;hi:=(r->>'upper')::numeric;
   IF lo>hi OR r ? 'expected_values' THEN RAISE EXCEPTION 'Rentang kuantitatif tidak valid';END IF;
  ELSE
   IF jsonb_typeof(r->'expected_values') IS DISTINCT FROM 'array' OR jsonb_array_length(r->'expected_values')=0 OR
      EXISTS(SELECT 1 FROM jsonb_array_elements(r->'expected_values') x WHERE jsonb_typeof(x)<>'string' OR length(trim(x#>>'{}'))=0) OR
      r ? 'lower' OR r ? 'upper' OR r ? 'operator' THEN RAISE EXCEPTION 'Kualitatif memakai expected values, bukan batas numerik palsu';END IF;
  END IF;
  jx:=0;
  FOR s IN SELECT value FROM jsonb_array_elements(p->'ranges') LOOP
   jx:=jx+1;IF jx>=ix THEN EXIT;END IF;
   IF s->>'condition'=r->>'condition' AND (s->>'sex'=r->>'sex' OR s->>'sex'='all' OR r->>'sex'='all') AND
      (greatest((s->>'age_min')::numeric,age_lo)<least((s->>'age_max')::numeric,age_hi) OR
       (s->>'age_max')::numeric=age_lo AND (s->>'age_upper_inclusive')::boolean AND (r->>'age_lower_inclusive')::boolean OR
       age_hi=(s->>'age_min')::numeric AND (r->>'age_upper_inclusive')::boolean AND (s->>'age_lower_inclusive')::boolean) THEN RAISE EXCEPTION 'Reference group tumpang tindih; pisahkan demografi/condition/batas secara eksplisit';END IF;
  END LOOP;
 END LOOP;
END $$;

CREATE FUNCTION lis_catalog_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;req lis_catalog_requests;v lis_catalog_method_versions;old_value jsonb;snapshot_value jsonb;res jsonb;
 inp jsonb:=jsonb_build_object('action',p_action,'data',p_data);from_value timestamptz;until_value timestamptz;revision_value integer;previous_active lis_catalog_method_versions;
BEGIN
 a:=ops_actor(ARRAY['lab','analis','dokter','doctor','clinical_governance']);
 IF p_action IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Input/request key/reason wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'catalog-request:'||p_key));SELECT * INTO req FROM lis_catalog_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF req.actor_id<>a OR req.input IS DISTINCT FROM inp THEN RAISE EXCEPTION 'Retry input/actor berbeda';END IF;RETURN req.result;END IF;
 IF p_action='create' THEN
  PERFORM lis_catalog_validate_definition(p_data->'definition');
  PERFORM set_config('TimeZone',p_data->'definition'->>'timezone',true);
  PERFORM ops_assert_permission('catalog-export','clinical.catalog.configure');
  PERFORM pg_advisory_xact_lock(hashtext(t::text||'catalog-method:'||(p_data->>'item_id')||':'||(p_data->>'method_id')));
  PERFORM lis_catalog_lock_source((p_data->>'product_id')::bigint,(p_data->>'item_id')::bigint);
  snapshot_value:=lis_catalog_source_snapshot((p_data->>'product_id')::bigint,(p_data->>'item_id')::bigint);
  IF snapshot_value IS NULL OR snapshot_value->>'product_active' IS DISTINCT FROM 'true' OR snapshot_value->>'item_active' IS DISTINCT FROM 'true' OR snapshot_value IS DISTINCT FROM p_data->'source_snapshot' THEN RAISE EXCEPTION 'Master/analit sumber aktif dan snapshot tepat wajib';END IF;
  IF coalesce(p_data->>'analyte_code','')!~ '^AN-[A-F0-9]{24}$' OR coalesce(length(trim(p_data->>'catalog_version')),0)<3 OR coalesce(length(trim(p_data->>'method_id')),0) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'Kode analit, versi katalog dan metode ID wajib';END IF;
  IF p_data->>'analyte_code' IS DISTINCT FROM 'AN-'||upper(substr(encode(sha256(convert_to('['||to_json(snapshot_value->>'source_product_code')::text||','||to_json(snapshot_value->>'item_code')::text||']','UTF8')),'hex'),1,24)) THEN RAISE EXCEPTION 'Kode analit tidak sesuai identity sumber';END IF;
  PERFORM lis_catalog_validate_definition(p_data->'definition');
  IF coalesce(p_data->>'valid_from','')!~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' OR coalesce(p_data->>'valid_until','')!~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' THEN RAISE EXCEPTION 'Timestamp ISO8601 dengan timezone eksplisit wajib';END IF;
  from_value:=(p_data->>'valid_from')::timestamptz;until_value:=(p_data->>'valid_until')::timestamptz;
  IF from_value IS NULL OR until_value IS NULL OR NOT isfinite(from_value) OR NOT isfinite(until_value) OR until_value<=greatest(from_value,now()) THEN RAISE EXCEPTION 'Periode efektif terbatas wajib';END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text||'catalog-method:'||(p_data->>'item_id')||':'||(p_data->>'method_id')));
  SELECT coalesce(max(revision),0)+1 INTO revision_value FROM lis_catalog_method_versions WHERE tenant_id=t AND item_id=(p_data->>'item_id')::bigint AND method_id=p_data->>'method_id';
  INSERT INTO lis_catalog_method_versions(tenant_id,product_id,item_id,source_snapshot,analyte_code,catalog_version,method_id,definition,revision,created_by,valid_from,valid_until)
  VALUES(t,(p_data->>'product_id')::bigint,(p_data->>'item_id')::bigint,snapshot_value,p_data->>'analyte_code',p_data->>'catalog_version',p_data->>'method_id',(p_data->'definition')||jsonb_build_object('terminology_snapshot',(SELECT metadata FROM lis_catalog_primary_terms WHERE code=p_data->'definition'->>'loinc')),revision_value,a,from_value,until_value) RETURNING * INTO v;
 ELSE
  SELECT * INTO v FROM lis_catalog_method_versions WHERE id=(p_data->>'id')::bigint AND tenant_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Konfigurasi tidak ditemukan';END IF;
  PERFORM set_config('TimeZone',v.definition->>'timezone',true);
  PERFORM pg_advisory_xact_lock(hashtext(t::text||'catalog-method:'||v.item_id::text||':'||v.method_id));
  SELECT * INTO v FROM lis_catalog_method_versions WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Konfigurasi tidak ditemukan';END IF;
  old_value:=to_jsonb(v);IF v.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Data berubah; muat ulang';END IF;
  IF p_action='submit' AND v.state='draft' THEN
   PERFORM ops_assert_permission('catalog-export','clinical.catalog.configure');IF v.created_by<>a THEN RAISE EXCEPTION 'Hanya pembuat dapat submit';END IF;
   UPDATE lis_catalog_method_versions SET state='in_review',version=version+1 WHERE id=v.id RETURNING * INTO v;
  ELSIF p_action IN ('approve','reject') AND v.state='in_review' THEN
   PERFORM ops_assert_permission('catalog-export','clinical.catalog.review',v.created_by);
   IF a=v.created_by THEN RAISE EXCEPTION 'Reviewer harus berbeda';END IF;
   IF p_action='approve' THEN
    IF p_data->'mapping_reviewed' IS DISTINCT FROM 'true'::jsonb OR p_data->'method_reviewed' IS DISTINCT FROM 'true'::jsonb OR p_data->'reference_reviewed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Attestasi reviewer mapping/metode/IFU/reference wajib';END IF;
    PERFORM lis_catalog_validate_definition(v.definition);
    PERFORM lis_catalog_lock_source(v.product_id,v.item_id);
    IF v.valid_until<=now() OR lis_catalog_source_snapshot(v.product_id,v.item_id) IS DISTINCT FROM v.source_snapshot THEN RAISE EXCEPTION 'Sumber berubah atau konfigurasi kedaluwarsa';END IF;
   END IF;
   UPDATE lis_catalog_method_versions SET state=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,reviewed_by=a,reviewed_at=now(),version=version+1 WHERE id=v.id RETURNING * INTO v;
  ELSIF p_action='activate' AND v.state='approved' THEN
   PERFORM ops_assert_permission('catalog-export','clinical.catalog.configure');
   PERFORM ops_assert_individual_privilege('catalog-export','clinical.catalog.review',v.reviewed_by);
   PERFORM lis_catalog_validate_definition(v.definition);
   PERFORM lis_catalog_lock_source(v.product_id,v.item_id);
   IF now()<v.valid_from OR now()>=v.valid_until OR lis_catalog_source_snapshot(v.product_id,v.item_id) IS DISTINCT FROM v.source_snapshot THEN RAISE EXCEPTION 'Sumber/periode efektif tidak sah';END IF;
   PERFORM pg_advisory_xact_lock(hashtext(t::text||'catalog-method:'||v.item_id::text||':'||v.method_id));
   FOR previous_active IN SELECT * FROM lis_catalog_method_versions WHERE tenant_id=t AND item_id=v.item_id AND method_id=v.method_id AND state='active' FOR UPDATE LOOP
    UPDATE lis_catalog_method_versions SET state='retired',version=version+1 WHERE id=previous_active.id;
    INSERT INTO lis_catalog_events(tenant_id,method_version_id,actor_id,action,reason,before_row,after_row) VALUES(t,previous_active.id,a,'superseded',p_data->>'reason',to_jsonb(previous_active),to_jsonb(previous_active)||jsonb_build_object('state','retired','version',previous_active.version+1));
   END LOOP;
   UPDATE lis_catalog_method_versions SET state='active',activated_at=now(),version=version+1 WHERE id=v.id RETURNING * INTO v;
  ELSIF p_action='retire' AND v.state IN ('approved','active') THEN
   PERFORM ops_assert_permission('catalog-export','clinical.catalog.review',v.created_by);IF a=v.created_by THEN RAISE EXCEPTION 'Reviewer harus berbeda';END IF;UPDATE lis_catalog_method_versions SET state='retired',version=version+1 WHERE id=v.id RETURNING * INTO v;
  ELSE RAISE EXCEPTION 'Transisi konfigurasi tidak sah';END IF;
 END IF;
 res:=to_jsonb(v);INSERT INTO lis_catalog_events(tenant_id,method_version_id,actor_id,action,reason,before_row,after_row) VALUES(t,v.id,a,p_action,p_data->>'reason',old_value,res);
 INSERT INTO lis_catalog_requests VALUES(t,p_key,a,inp,res);RETURN res;
END $$;

CREATE FUNCTION lis_catalog_export(p_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();v lis_catalog_method_versions;r jsonb;rows_value jsonb:='[]';digest_value text;
BEGIN
 PERFORM ops_actor(ARRAY['lab','analis','dokter','doctor','clinical_governance']);
 SELECT * INTO v FROM lis_catalog_method_versions WHERE id=p_id AND tenant_id=t AND state='active' AND valid_from<=now() AND valid_until>now() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Konfigurasi aktif/effective wajib';END IF;
 PERFORM set_config('TimeZone',v.definition->>'timezone',true);
 PERFORM ops_assert_permission('catalog-export','clinical.catalog.export');
 PERFORM ops_assert_individual_privilege('catalog-export','clinical.catalog.review',v.reviewed_by);
 PERFORM lis_catalog_validate_definition(v.definition);
 PERFORM lis_catalog_lock_source(v.product_id,v.item_id);
 IF lis_catalog_source_snapshot(v.product_id,v.item_id) IS DISTINCT FROM v.source_snapshot THEN RAISE EXCEPTION 'Master berubah; review versi baru wajib';END IF;
 digest_value:=encode(sha256(convert_to(to_jsonb(v)::text,'UTF8')),'hex');
 FOR r IN SELECT value FROM jsonb_array_elements(v.definition->'ranges') LOOP
  rows_value:=rows_value||jsonb_build_array(jsonb_build_object('Kode Material',v.source_snapshot->>'material_code','Nama Pemeriksaan',v.source_snapshot->>'examination_name','Nama Analit',v.source_snapshot->>'item_name','Kode Analit',v.analyte_code,
   'Operator',coalesce(r->>'operator','='),'Batas Bawah',coalesce(r->>'lower',''),'Batas Atas',coalesce(r->>'upper',''),'Jenis Nilai',CASE WHEN v.definition->>'result_type'='numeric' THEN 'Kuantitatif' ELSE 'Kualitatif' END,
   'Kelompok Usia',(r->>'age_min')||'–'||(r->>'age_max')||' '||(v.definition->>'age_unit'),'Jenis Kelamin',r->>'sex','LOINC (OBX-3)',v.definition->>'loinc','UCUM (OBX-6)',coalesce(v.definition->>'ucum',''),
   'Nilai Diharapkan',coalesce(r->'expected_values','[]'::jsonb),'Usia Min',r->'age_min','Usia Max',r->'age_max','Unit Usia',v.definition->>'age_unit','Usia Min Inklusif',r->'age_lower_inclusive','Usia Max Inklusif',r->'age_upper_inclusive','Kondisi',r->>'condition',
   'Status Verifikasi Acuan','VERIFIED','Tenant ID',t,'Metode ID',v.method_id,'Reviewer ID',v.reviewed_by,'Pembuat ID',v.created_by,'Tanggal Review',v.reviewed_at,'Berlaku Sampai',v.valid_until,
   'Bukti Mapping',v.definition->>'mapping_evidence','Bukti Rentang',v.definition->>'reference_evidence','Versi Acuan',v.definition->>'source_version','SHA256 Konfigurasi',digest_value,'Versi Katalog',v.catalog_version,'Konfigurasi ID',v.id,'Sumber Acuan',v.definition->>'reference_evidence'));
 END LOOP;
 RETURN jsonb_build_object('tenant_id',t,'method_version_id',v.id,'source_product_id',v.product_id,'source_item_id',v.item_id,'definition',v.definition,'rows',rows_value,'configuration_sha256',digest_value);
END $$;

CREATE FUNCTION lis_catalog_board(p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();rows_value jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','lab','analis','dokter','doctor','clinical_governance']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO rows_value FROM (SELECT * FROM lis_catalog_method_versions WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)r;
 RETURN jsonb_build_object('rows',rows_value,'offset',p_offset);
END $$;
CREATE FUNCTION lis_catalog_sources(p_search text DEFAULT '',p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rows_value jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','lab','analis','dokter','doctor','clinical_governance']);
 IF p_search IS NULL OR length(p_search)>200 OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Search/offset tidak valid';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO rows_value FROM (SELECT p.id product_id,i.id item_id,p.nama_tes examination_name,i.name_id analyte_name,lis_catalog_source_snapshot(p.id,i.id) source_snapshot FROM products p JOIN product_items i ON i.product_id=p.id WHERE p.is_active AND i.is_active AND (p_search='' OR position(lower(p_search) IN lower(p.nama_tes||' '||i.name_id||' '||coalesce(p.kode_material,'')))>0) ORDER BY p.id,i.id LIMIT 51 OFFSET p_offset)r;
 RETURN jsonb_build_object('rows',rows_value,'offset',p_offset);
END $$;
CREATE FUNCTION lis_catalog_primary_term(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE value jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','lab','analis','dokter','doctor','clinical_governance']);
 SELECT metadata INTO value FROM lis_catalog_primary_terms WHERE code=p_code;
 IF value IS NULL THEN RAISE EXCEPTION 'Kode belum ada dalam snapshot primer; riset/import source berizin dahulu';END IF;
 RETURN value;
END $$;
CREATE FUNCTION lis_catalog_guard_version() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Histori konfigurasi tidak dapat dihapus';END IF;
 IF (to_jsonb(NEW)-ARRAY['state','reviewed_by','reviewed_at','activated_at','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','reviewed_by','reviewed_at','activated_at','version']) THEN RAISE EXCEPTION 'Definisi original immutable; buat versi baru';END IF;
 IF OLD.reviewed_by IS NOT NULL AND (NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN RAISE EXCEPTION 'Review original immutable';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lis_catalog_version_guard BEFORE UPDATE OR DELETE ON lis_catalog_method_versions FOR EACH ROW EXECUTE FUNCTION lis_catalog_guard_version();
CREATE FUNCTION lis_catalog_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$BEGIN RAISE EXCEPTION 'Audit/request katalog append-only';END $$;
CREATE TRIGGER lis_catalog_event_immutable BEFORE UPDATE OR DELETE ON lis_catalog_events FOR EACH ROW EXECUTE FUNCTION lis_catalog_append_only();
CREATE TRIGGER lis_catalog_request_immutable BEFORE UPDATE OR DELETE ON lis_catalog_requests FOR EACH ROW EXECUTE FUNCTION lis_catalog_append_only();
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['lis_catalog_primary_terms','lis_catalog_ucum_units','lis_catalog_method_versions','lis_catalog_events','lis_catalog_requests'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);END LOOP;END $$;
REVOKE ALL ON FUNCTION lis_catalog_source_snapshot(bigint,bigint),lis_catalog_lock_source(bigint,bigint),lis_catalog_validate_definition(jsonb),lis_catalog_command(text,jsonb,text),lis_catalog_export(bigint),lis_catalog_board(integer),lis_catalog_sources(text,integer),lis_catalog_primary_term(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lis_catalog_command(text,jsonb,text),lis_catalog_export(bigint),lis_catalog_board(integer),lis_catalog_sources(text,integer),lis_catalog_primary_term(text) TO authenticated;
COMMIT;
