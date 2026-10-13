-- OWNED_BY: generic. Approved identity/merge workflow; immutable source IDs.
BEGIN;
CREATE TABLE patient_identity_states(person_id uuid PRIMARY KEY REFERENCES mpi_person(id),tenant_id uuid NOT NULL REFERENCES tenants(id),temporary boolean NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE patient_encounter_identities(admission_id bigint PRIMARY KEY REFERENCES admissions(id),tenant_id uuid NOT NULL REFERENCES tenants(id),person_id uuid NOT NULL REFERENCES mpi_person(id),source_snapshot jsonb NOT NULL,evidence text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE patient_identity_reviews(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),source_id uuid NOT NULL REFERENCES mpi_person(id),target_id uuid NOT NULL REFERENCES mpi_person(id),kind text NOT NULL CHECK(kind IN('duplicate','identified')),state text NOT NULL DEFAULT 'review' CHECK(state IN('review','approved','rejected')),version integer NOT NULL DEFAULT 1,source_snapshot jsonb NOT NULL,target_snapshot jsonb NOT NULL,evidence text NOT NULL,reason text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_by uuid,reviewed_at timestamptz,review_evidence jsonb,CHECK(source_id<>target_id));
CREATE TABLE patient_identity_aliases(source_id uuid PRIMARY KEY REFERENCES mpi_person(id),tenant_id uuid NOT NULL REFERENCES tenants(id),target_id uuid NOT NULL REFERENCES mpi_person(id),review_id bigint NOT NULL UNIQUE REFERENCES patient_identity_reviews(id),created_at timestamptz NOT NULL DEFAULT now(),CHECK(source_id<>target_id));
CREATE TABLE patient_identity_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor uuid NOT NULL,action text NOT NULL,input jsonb NOT NULL,output jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,request_key));
CREATE TABLE patient_identity_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),actor uuid NOT NULL,action text NOT NULL,source_id uuid,review_id bigint,input jsonb NOT NULL,output jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION patient_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Identity source history immutable';END $$;
DO $$DECLARE name text;BEGIN FOREACH name IN ARRAY ARRAY['patient_identity_states','patient_encounter_identities','patient_identity_aliases','patient_identity_requests','patient_identity_audit'] LOOP EXECUTE format('CREATE TRIGGER immutable_source BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION patient_identity_immutable()',name);END LOOP;END $$;
CREATE FUNCTION patient_identity_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' OR OLD.state<>'review' OR NEW.state NOT IN('approved','rejected') OR (to_jsonb(NEW)-ARRAY['state','version','reviewed_by','reviewed_at','review_evidence']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','version','reviewed_by','reviewed_at','review_evidence']) OR NEW.version<>OLD.version+1 OR NEW.reviewed_by IS NULL OR NEW.reviewed_by=OLD.created_by THEN RAISE EXCEPTION 'Identity review transition invalid';END IF;RETURN NEW;END $$;
CREATE TRIGGER immutable_review BEFORE UPDATE OR DELETE ON patient_identity_reviews FOR EACH ROW EXECUTE FUNCTION patient_identity_review_guard();
CREATE FUNCTION patient_identity_merge_log_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF OLD.snapshot->>'mode'='alias_preserve_sources' THEN RAISE EXCEPTION 'Reviewed identity merge log immutable';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $$;
CREATE TRIGGER reviewed_merge_log_immutable BEFORE UPDATE OR DELETE ON person_merge_log FOR EACH ROW EXECUTE FUNCTION patient_identity_merge_log_guard();
CREATE FUNCTION patient_identity_snapshot(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('person',to_jsonb(p),'identifiers',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM person_identifier i WHERE i.person_id=p.id AND i.tenant_id=p.tenant_id),'[]'),'contacts',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM person_contact i WHERE i.person_id=p.id AND i.tenant_id=p.tenant_id),'[]'),'consents',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM person_consent i WHERE i.person_id=p.id AND i.tenant_id=p.tenant_id),'[]')) FROM mpi_person p WHERE p.id=p_id AND p.tenant_id=current_tenant_id() AND NOT p.is_deleted AND p.status='ACTIVE';
$$;
CREATE FUNCTION patient_identity_root(p_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid:=p_id;n uuid;seen uuid[]:=ARRAY[]::uuid[];BEGIN
 IF NOT EXISTS(SELECT 1 FROM mpi_person WHERE id=v AND tenant_id=current_tenant_id() AND NOT is_deleted) THEN RAISE EXCEPTION 'Person tenant tidak ditemukan';END IF;
 LOOP IF v=ANY(seen) OR cardinality(seen)>100 THEN RAISE EXCEPTION 'Identity alias graph invalid';END IF;seen:=array_append(seen,v);SELECT target_id INTO n FROM patient_identity_aliases WHERE source_id=v AND tenant_id=current_tenant_id();IF NOT FOUND THEN RETURN v;END IF;v:=n;END LOOP;
END $$;
CREATE FUNCTION patient_identity_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;old patient_identity_requests;r patient_identity_reviews;s uuid;d uuid;result jsonb;ss jsonb;ds jsonb;adm admissions;identity mpi_person;review jsonb;label text;
BEGIN
 a:=ops_actor(ARRAY['super_admin','superadmin','admin','admin_faskes','head_operation','direktur']);
 IF p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Request key/data/reason wajib';END IF;
 -- One graph mutation per tenant. Lock order is fixed across links and reviews.
 PERFORM pg_advisory_xact_lock(hashtextextended('patient-identity:'||t::text,0));
 SELECT * INTO old FROM patient_identity_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF old.actor<>a OR old.action<>p_action OR old.input IS DISTINCT FROM p_data THEN RAISE EXCEPTION 'Request key conflict';END IF;RETURN old.output;END IF;
 IF p_action='create' THEN
  IF jsonb_typeof(p_data->'temporary') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Status identitas eksplisit wajib';END IF;
  label:=trim(p_data->>'full_name');IF label IS NULL OR length(label) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Label/nama identitas wajib';END IF;
  IF NOT (p_data->>'temporary')::boolean AND (nullif(p_data->>'birth_date','') IS NULL OR coalesce(p_data->>'sex','') NOT IN('MALE','FEMALE','OTHER','UNKNOWN')) THEN RAISE EXCEPTION 'Identitas definitif memerlukan tanggal lahir dan sex eksplisit';END IF;
  s:=gen_random_uuid();INSERT INTO mpi_person(id,tenant_id,ava_id,full_name,birth_date,sex,created_by) VALUES(s,t,'P'||left(replace(s::text,'-',''),19),label,nullif(p_data->>'birth_date','')::date,coalesce(nullif(p_data->>'sex',''),'UNKNOWN'),a) RETURNING * INTO identity;
  IF identity.birth_date>current_date THEN RAISE EXCEPTION 'Tanggal lahir di masa depan';END IF;
  INSERT INTO patient_identity_states VALUES(s,t,(p_data->>'temporary')::boolean,a,now());result:=jsonb_build_object('id',s,'temporary',(p_data->>'temporary')::boolean);
 ELSIF p_action='link' THEN
  s:=(p_data->>'person_id')::uuid;SELECT * INTO identity FROM mpi_person WHERE id=s AND tenant_id=t AND status='ACTIVE' AND NOT is_deleted FOR SHARE;
  IF NOT FOUND OR patient_identity_root(s)<>s THEN RAISE EXCEPTION 'Link membutuhkan identitas root aktif';END IF;
  SELECT * INTO adm FROM admissions WHERE id=(p_data->>'admission_id')::bigint AND tenant_id=t FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Encounter tenant tidak ditemukan';END IF;
  IF length(trim(coalesce(p_data->>'evidence','')))<3 THEN RAISE EXCEPTION 'Bukti identifikasi encounter wajib';END IF;
  INSERT INTO patient_encounter_identities(admission_id,tenant_id,person_id,source_snapshot,evidence,created_by) VALUES(adm.id,t,s,to_jsonb(adm),p_data->>'evidence',a);result:=jsonb_build_object('admission_id',adm.id,'person_id',s);
 ELSIF p_action='propose' THEN
  s:=(p_data->>'source_id')::uuid;d:=(p_data->>'target_id')::uuid;
  IF s=d OR patient_identity_root(s)<>s OR patient_identity_root(d)<>d THEN RAISE EXCEPTION 'Dua root identitas berbeda wajib';END IF;
  IF p_data->>'kind' NOT IN('duplicate','identified') OR p_data->>'kind' IS NULL OR length(trim(coalesce(p_data->>'evidence','')))<3 THEN RAISE EXCEPTION 'Kind dan bukti identifikasi wajib';END IF;
  IF p_data->>'kind'='identified' AND (NOT EXISTS(SELECT 1 FROM patient_identity_states WHERE person_id=s AND tenant_id=t AND temporary) OR EXISTS(SELECT 1 FROM patient_identity_states WHERE person_id=d AND tenant_id=t AND temporary)) THEN RAISE EXCEPTION 'Identifikasi harus dari sementara ke definitif';END IF;
  -- Freeze these master sources. No demographics, identifiers or consents are moved.
  LOCK TABLE mpi_person,person_identifier,person_contact,person_consent IN SHARE MODE NOWAIT;
  ss:=patient_identity_snapshot(s);ds:=patient_identity_snapshot(d);IF ss IS NULL OR ds IS NULL THEN RAISE EXCEPTION 'Identitas sumber aktif wajib';END IF;
  INSERT INTO patient_identity_reviews(tenant_id,source_id,target_id,kind,source_snapshot,target_snapshot,evidence,reason,created_by) VALUES(t,s,d,p_data->>'kind',ss,ds,p_data->>'evidence',p_data->>'reason',a) RETURNING * INTO r;result:=to_jsonb(r);
 ELSIF p_action IN('approve','reject') THEN
  SELECT * INTO r FROM patient_identity_reviews WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
  IF NOT FOUND OR r.state<>'review' OR r.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Versi/state review berubah';END IF;
  IF r.created_by=a THEN RAISE EXCEPTION 'Reviewer harus berbeda';END IF;s:=r.source_id;d:=r.target_id;review:=p_data->'review';
  IF p_action='approve' THEN
   LOCK TABLE mpi_person,person_identifier,person_contact,person_consent IN SHARE MODE NOWAIT;
   IF patient_identity_root(s)<>s OR patient_identity_root(d)<>d OR patient_identity_snapshot(s) IS DISTINCT FROM r.source_snapshot OR patient_identity_snapshot(d) IS DISTINCT FROM r.target_snapshot THEN RAISE EXCEPTION 'Source identitas berubah; ajukan review baru';END IF;
   IF jsonb_typeof(review) IS DISTINCT FROM 'object' OR review->'identity_verified' IS DISTINCT FROM 'true'::jsonb OR length(trim(coalesce(review->>'evidence','')))<3 OR length(trim(coalesce(review->>'consent_review','')))<3 OR length(trim(coalesce(review->>'allergy_review','')))<3 OR length(trim(coalesce(review->>'payer_review','')))<3 THEN RAISE EXCEPTION 'Verifikasi identitas dan review consent/alergi/penjamin wajib';END IF;
   INSERT INTO patient_identity_aliases(source_id,tenant_id,target_id,review_id) VALUES(s,t,d,r.id);
   INSERT INTO person_merge_log(id,tenant_id,surviving_person_id,merged_person_id,reason,performed_by,snapshot) VALUES(gen_random_uuid(),t,d,s,r.reason,a,jsonb_build_object('source',r.source_snapshot,'target',r.target_snapshot,'review_id',r.id,'review',review,'mode','alias_preserve_sources'));
  END IF;
  UPDATE patient_identity_reviews SET state=CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,version=version+1,reviewed_by=a,reviewed_at=now(),review_evidence=jsonb_build_object('reason',p_data->>'reason','review',review) WHERE id=r.id RETURNING * INTO r;result:=to_jsonb(r);
 ELSE RAISE EXCEPTION 'Action identitas tidak didukung';END IF;
 INSERT INTO patient_identity_requests VALUES(t,p_key,a,p_action,p_data,result,now());INSERT INTO patient_identity_audit(tenant_id,actor,action,source_id,review_id,input,output) VALUES(t,a,p_action,s,r.id,p_data,result);RETURN result;
END $$;
CREATE FUNCTION patient_identity_board(p_search text DEFAULT '',p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();persons jsonb;reviews jsonb;encounters jsonb;BEGIN
 PERFORM ops_actor(ARRAY['super_admin','superadmin','admin','admin_faskes','head_operation','direktur']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR length(coalesce(p_search,''))>200 THEN RAISE EXCEPTION 'Search/offset tidak valid';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') INTO persons FROM(SELECT m.*,coalesce(st.temporary,false) temporary,patient_identity_root(m.id) canonical_id,coalesce((SELECT jsonb_agg(jsonb_build_object('type',i.type,'value',i.value,'is_verified',i.is_verified) ORDER BY i.id) FROM person_identifier i WHERE i.person_id=m.id AND i.tenant_id=t),'[]') identifiers,coalesce((SELECT jsonb_agg(jsonb_build_object('type',i.type,'value',i.value,'is_verified',i.is_verified) ORDER BY i.id) FROM person_contact i WHERE i.person_id=m.id AND i.tenant_id=t),'[]') contacts FROM mpi_person m LEFT JOIN patient_identity_states st ON st.person_id=m.id AND st.tenant_id=t WHERE m.tenant_id=t AND NOT m.is_deleted AND (coalesce(p_search,'')='' OR m.full_name ILIKE '%'||p_search||'%' OR m.ava_id ILIKE '%'||p_search||'%') ORDER BY m.created_at DESC,m.id LIMIT 51 OFFSET p_offset)p;
 SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') INTO reviews FROM(SELECT id,source_id,target_id,kind,state,version,evidence,reason,created_by,reviewed_by,reviewed_at,created_at FROM patient_identity_reviews WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)p;
 SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') INTO encounters FROM(SELECT l.admission_id,l.person_id,patient_identity_root(l.person_id) canonical_id,a.patient_name source_patient_name,a.mr_number source_mr,l.evidence FROM patient_encounter_identities l JOIN admissions a ON a.id=l.admission_id AND a.tenant_id=l.tenant_id WHERE l.tenant_id=t ORDER BY l.admission_id DESC LIMIT 51 OFFSET p_offset)p;
 RETURN jsonb_build_object('persons',persons,'reviews',reviews,'encounters',encounters);
END $$;
CREATE FUNCTION patient_identity_encounter(p_admission bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();l patient_encounter_identities;v jsonb;BEGIN
 PERFORM ops_actor(ARRAY['super_admin','superadmin','admin','admin_faskes','head_operation','direktur','doctor','dokter','nurse','perawat','midwife','bidan','pharmacist','apoteker','lab','analis']);
 IF NOT EXISTS(SELECT 1 FROM admissions WHERE id=p_admission AND tenant_id=t) THEN RAISE EXCEPTION 'Encounter tenant tidak ditemukan';END IF;
 SELECT * INTO l FROM patient_encounter_identities WHERE admission_id=p_admission AND tenant_id=t;IF NOT FOUND THEN RETURN jsonb_build_object('linked',false,'admission_id',p_admission);END IF;
 v:=jsonb_build_object('linked',true,'admission_id',p_admission,'source_person_id',l.person_id,'canonical_id',patient_identity_root(l.person_id),'source_snapshot',l.source_snapshot,'consents_transferred',false,'allergies_transferred',false,'payer_transferred',false);RETURN v;
END $$;
ALTER FUNCTION rs_episode_board(bigint,integer) RENAME TO rs_episode_board_before_patient_identity;
CREATE FUNCTION rs_episode_board(p_admission_id bigint DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;links jsonb;BEGIN
 result:=rs_episode_board_before_patient_identity(p_admission_id,p_offset);
 SELECT coalesce(jsonb_agg(jsonb_build_object('admission_id',l.admission_id,'source_person_id',l.person_id,'canonical_id',patient_identity_root(l.person_id)) ORDER BY l.admission_id),'[]') INTO links FROM patient_encounter_identities l WHERE l.tenant_id=current_tenant_id() AND EXISTS(SELECT 1 FROM jsonb_array_elements(result->'episodes') e WHERE (e->>'admission_id')::bigint=l.admission_id);
 RETURN result||jsonb_build_object('patient_identities',links);
END $$;
REVOKE ALL ON FUNCTION rs_episode_board_before_patient_identity(bigint,integer),patient_identity_merge_log_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rs_episode_board(bigint,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_episode_board(bigint,integer) TO authenticated;
DO $$DECLARE name text;BEGIN FOREACH name IN ARRAY ARRAY['patient_identity_states','patient_encounter_identities','patient_identity_reviews','patient_identity_aliases','patient_identity_requests','patient_identity_audit'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',name);EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT TO authenticated USING(tenant_id=current_tenant_id())',name);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',name);END LOOP;END $$;
REVOKE INSERT,UPDATE,DELETE ON mpi_person,person_identifier,person_contact,person_consent,person_merge_log FROM anon,authenticated;
REVOKE ALL ON FUNCTION patient_identity_snapshot(uuid),patient_identity_root(uuid),patient_identity_immutable(),patient_identity_review_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION patient_identity_command(text,jsonb,text),patient_identity_board(text,integer),patient_identity_encounter(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION patient_identity_command(text,jsonb,text),patient_identity_board(text,integer),patient_identity_encounter(bigint) TO authenticated;
COMMIT;
