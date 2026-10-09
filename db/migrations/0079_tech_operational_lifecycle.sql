-- OWNED_BY: generic. Recorded operations only; never deploys or contacts vendors.
BEGIN;
ALTER TABLE tech_support_tickets ADD COLUMN ops_version integer NOT NULL DEFAULT 1;
ALTER TABLE tech_changes ADD COLUMN ops_version integer NOT NULL DEFAULT 1;
CREATE TABLE tech_ops_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE tech_ops_history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),entity_kind text NOT NULL,entity_id bigint NOT NULL,action text NOT NULL,actor_id uuid NOT NULL,reason text NOT NULL,before_row jsonb,after_row jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tech_module_deployments(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),change_id bigint NOT NULL REFERENCES tech_changes(id),installation_id text NOT NULL,module_key text NOT NULL,release_version text NOT NULL,environment text NOT NULL CHECK(environment IN ('test','staging','production')),evidence text NOT NULL,state text NOT NULL DEFAULT 'reported' CHECK(state IN ('reported','verified','revoked')),reported_by uuid NOT NULL,verified_by uuid,reported_at timestamptz NOT NULL DEFAULT now(),verified_at timestamptz,ops_version integer NOT NULL DEFAULT 1);
CREATE FUNCTION tech_ops_command(p_kind text,p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;r text;req tech_ops_requests;ticket tech_support_tickets;change_row tech_changes;deployment tech_module_deployments;before_value jsonb;result_value jsonb;input_value jsonb:=jsonb_build_object('kind',p_kind,'action',p_action,'data',p_data);next_state text;owner uuid;id_value bigint;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','tech','admin_faskes']);SELECT lower(role) INTO r FROM user_profiles WHERE id=a;
 IF p_data->>'tenant_id' IS NOT NULL AND (p_data->>'tenant_id')::uuid IS DISTINCT FROM t THEN RAISE EXCEPTION 'Tiket/operasi harus memakai konteks tenant akun';END IF;
 IF p_kind IS NULL OR p_action IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input, alasan dan request key wajib';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'tech-ops:'||p_key));SELECT * INTO req FROM tech_ops_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF req.actor_id<>a OR req.input IS DISTINCT FROM input_value THEN RAISE EXCEPTION 'Retry input/actor berbeda';END IF;RETURN req.result;END IF;
 owner:=(p_data->>'owner')::uuid;
 IF owner IS NOT NULL AND NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=owner AND tenant_id=t AND lower(role) IN ('super_admin','head_operation','direktur','tech','admin_faskes')) THEN RAISE EXCEPTION 'Pemilik tugas bukan tim tenant';END IF;
 IF p_kind='ticket' THEN
  IF owner IS NOT NULL AND p_action<>'triage' THEN RAISE EXCEPTION 'Perubahan pemilik hanya saat triage';END IF;
  IF p_action='create' THEN
   IF coalesce(length(trim(p_data->>'title')),0) NOT BETWEEN 3 AND 200 OR coalesce(length(trim(p_data->>'description')),0)<3 OR p_data->>'priority' IS NULL OR p_data->>'priority' NOT IN ('P0','P1','P2','P3') THEN RAISE EXCEPTION 'Judul, uraian dan prioritas wajib';END IF;
   INSERT INTO tech_support_tickets(ticket_no,tenant_id,reporter,channel,title,description,priority,status,correlation_id) VALUES('OPS-'||p_key,t,a::text,'internal',p_data->>'title',p_data->>'description',p_data->>'priority','OPEN',p_key) RETURNING * INTO ticket;
  ELSE
   SELECT * INTO ticket FROM tech_support_tickets WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tidak ditemukan';END IF;before_value:=to_jsonb(ticket);
   IF ticket.ops_version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Data berubah; muat ulang';END IF;
   next_state:=CASE WHEN p_action='triage' AND ticket.status='OPEN' THEN 'TRIAGED' WHEN p_action='start' AND ticket.status IN ('TRIAGED','WAITING_CLIENT') THEN 'IN_PROGRESS' WHEN p_action='wait' AND ticket.status='IN_PROGRESS' THEN 'WAITING_CLIENT' WHEN p_action='resolve' AND ticket.status='IN_PROGRESS' THEN 'RESOLVED' WHEN p_action='close' AND ticket.status='RESOLVED' THEN 'CLOSED' WHEN p_action='reopen' AND ticket.status IN ('RESOLVED','CLOSED') THEN 'TRIAGED' END;
   IF next_state IS NULL THEN RAISE EXCEPTION 'Transisi tiket tidak sah';END IF;
   IF p_action='triage' AND owner IS NULL THEN RAISE EXCEPTION 'Triage memerlukan pemilik tugas';END IF;
   IF p_action IN ('start','wait','resolve') AND ticket.owner_user_id IS DISTINCT FROM a AND r NOT IN ('super_admin','head_operation','direktur') THEN RAISE EXCEPTION 'Hanya pemilik tugas dapat menjalankan tiket';END IF;
   IF p_action='resolve' AND coalesce(length(trim(p_data->>'resolution')),0)<3 THEN RAISE EXCEPTION 'Bukti penyelesaian wajib';END IF;
   IF p_action='close' AND ticket.owner_user_id=a THEN RAISE EXCEPTION 'Verifikator penutupan harus berbeda';END IF;
   UPDATE tech_support_tickets SET status=next_state,owner_user_id=coalesce(owner,owner_user_id),first_response_at=CASE WHEN p_action='triage' THEN coalesce(first_response_at,now()) ELSE first_response_at END,resolved_at=CASE WHEN p_action='resolve' THEN now() WHEN p_action='reopen' THEN NULL ELSE resolved_at END,resolution=CASE WHEN p_action='resolve' THEN p_data->>'resolution' ELSE resolution END,ops_version=ops_version+1 WHERE id=ticket.id RETURNING * INTO ticket;
  END IF;id_value:=ticket.id;result_value:=to_jsonb(ticket);
 ELSIF p_kind='change' THEN
  IF p_action='create' THEN
   IF coalesce(length(trim(p_data->>'title')),0) NOT BETWEEN 3 AND 200 OR coalesce(length(trim(p_data->>'risk')),0)<3 OR coalesce(length(trim(p_data->>'rollback')),0)<3 OR p_data->>'type' IS NULL OR p_data->>'type' NOT IN ('code','config','schema','secret','infrastructure','content') THEN RAISE EXCEPTION 'Judul, jenis, risiko dan rollback wajib';END IF;
   INSERT INTO tech_changes(change_no,tenant_id,change_type,title,risk,rollback_plan,requested_by) VALUES('CHG-'||p_key,t,p_data->>'type',p_data->>'title',p_data->>'risk',p_data->>'rollback',a) RETURNING * INTO change_row;
  ELSE
   SELECT * INTO change_row FROM tech_changes WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Perubahan tidak ditemukan';END IF;before_value:=to_jsonb(change_row);
   IF change_row.ops_version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Data berubah; muat ulang';END IF;
   next_state:=CASE WHEN p_action='submit' AND change_row.status='DRAFT' THEN 'REVIEW' WHEN p_action='approve' AND change_row.status='REVIEW' THEN 'APPROVED' WHEN p_action='reject' AND change_row.status='REVIEW' THEN 'REJECTED' WHEN p_action='start' AND change_row.status='APPROVED' THEN 'RUNNING' WHEN p_action='complete' AND change_row.status='RUNNING' THEN 'SUCCEEDED' WHEN p_action='rollback' AND change_row.status IN ('RUNNING','SUCCEEDED') THEN 'ROLLED_BACK' END;
   IF next_state IS NULL THEN RAISE EXCEPTION 'Transisi perubahan tidak sah';END IF;
   IF p_action IN ('approve','reject') THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur']);IF change_row.requested_by=a THEN RAISE EXCEPTION 'Reviewer harus berbeda';END IF;END IF;
   IF p_action='start' AND (jsonb_typeof(p_data->'preflight') IS DISTINCT FROM 'object' OR coalesce(length(trim(p_data->'preflight'->>'reference')),0)<3) THEN RAISE EXCEPTION 'Bukti preflight wajib';END IF;
   IF p_action IN ('complete','rollback') AND (jsonb_typeof(p_data->'result') IS DISTINCT FROM 'object' OR coalesce(length(trim(p_data->'result'->>'reference')),0)<3) THEN RAISE EXCEPTION 'Bukti hasil wajib';END IF;
   IF p_action='complete' AND coalesce(p_data->>'release','') !~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,99}$' THEN RAISE EXCEPTION 'Versi rilis wajib';END IF;
   UPDATE tech_changes SET status=next_state,approved_by=CASE WHEN p_action='approve' THEN a ELSE approved_by END,preflight_evidence=CASE WHEN p_action='start' THEN p_data->'preflight' ELSE preflight_evidence END,result_evidence=CASE WHEN p_action IN ('complete','rollback') THEN p_data->'result' ELSE result_evidence END,release_version=CASE WHEN p_action='complete' THEN p_data->>'release' ELSE release_version END,completed_at=CASE WHEN p_action IN ('complete','rollback','reject') THEN now() ELSE completed_at END,ops_version=ops_version+1 WHERE id=change_row.id RETURNING * INTO change_row;
   IF p_action='rollback' THEN UPDATE tech_module_deployments SET state='revoked',ops_version=ops_version+1 WHERE tenant_id=t AND change_id=change_row.id AND state<>'revoked';END IF;
  END IF;id_value:=change_row.id;result_value:=to_jsonb(change_row);
 ELSIF p_kind='deployment' THEN
  IF p_action='report' THEN
   SELECT * INTO change_row FROM tech_changes WHERE id=(p_data->>'change_id')::bigint AND tenant_id=t AND status='SUCCEEDED' FOR UPDATE;
   IF NOT FOUND OR change_row.release_version IS DISTINCT FROM p_data->>'release' THEN RAISE EXCEPTION 'Rilis sukses sumber dan versi yang sama wajib';END IF;
   IF coalesce(p_data->>'module','') !~ '^[a-z][a-z0-9-]{0,99}$' OR coalesce(length(trim(p_data->>'installation')),0) NOT BETWEEN 1 AND 200 OR coalesce(length(trim(p_data->>'evidence')),0)<3 OR p_data->>'environment' IS NULL OR p_data->>'environment' NOT IN ('test','staging','production') THEN RAISE EXCEPTION 'Modul, instalasi, environment dan bukti wajib';END IF;
   INSERT INTO tech_module_deployments(tenant_id,change_id,installation_id,module_key,release_version,environment,evidence,reported_by) VALUES(t,change_row.id,p_data->>'installation',p_data->>'module',p_data->>'release',p_data->>'environment',p_data->>'evidence',a) RETURNING * INTO deployment;
  ELSE
   SELECT * INTO deployment FROM tech_module_deployments WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Deployment tidak ditemukan';END IF;before_value:=to_jsonb(deployment);
   IF deployment.ops_version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Data berubah; muat ulang';END IF;
   IF p_action='verify' AND deployment.state='reported' THEN
    PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur']);IF a=deployment.reported_by THEN RAISE EXCEPTION 'Verifier harus berbeda';END IF;
    IF coalesce(length(trim(p_data->>'evidence')),0)<3 THEN RAISE EXCEPTION 'Bukti verifikasi instalasi wajib';END IF;
    IF NOT EXISTS(SELECT 1 FROM tech_changes WHERE id=deployment.change_id AND tenant_id=t AND status='SUCCEEDED') THEN RAISE EXCEPTION 'Rilis sumber telah dibatalkan';END IF;
    UPDATE tech_module_deployments SET state='verified',verified_by=a,verified_at=now(),evidence=evidence||E'\nVERIFIED: '||(p_data->>'evidence'),ops_version=ops_version+1 WHERE id=deployment.id RETURNING * INTO deployment;
   ELSIF p_action='revoke' AND deployment.state IN ('reported','verified') THEN
    PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur']);UPDATE tech_module_deployments SET state='revoked',ops_version=ops_version+1 WHERE id=deployment.id RETURNING * INTO deployment;
   ELSE RAISE EXCEPTION 'Transisi deployment tidak sah';END IF;
  END IF;id_value:=deployment.id;result_value:=to_jsonb(deployment);
 ELSE RAISE EXCEPTION 'Jenis operasi tidak dikenal';END IF;
 INSERT INTO tech_ops_history(tenant_id,entity_kind,entity_id,action,actor_id,reason,before_row,after_row) VALUES(t,p_kind,id_value,p_action,a,p_data->>'reason',before_value,result_value);
 INSERT INTO tech_ops_requests VALUES(t,p_key,a,input_value,result_value);RETURN result_value;
END $$;
CREATE FUNCTION tech_ops_board(p_kind text,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();rows_value jsonb;table_name text;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech','admin_faskes']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 table_name:=CASE p_kind WHEN 'ticket' THEN 'tech_support_tickets' WHEN 'change' THEN 'tech_changes' WHEN 'deployment' THEN 'tech_module_deployments' END;
 IF table_name IS NULL THEN RAISE EXCEPTION 'Jenis board tidak valid';END IF;
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM (SELECT * FROM %I WHERE tenant_id=$1 ORDER BY id DESC LIMIT 51 OFFSET $2)r',table_name) INTO rows_value USING t,p_offset;
 RETURN jsonb_build_object('rows',rows_value,'staff',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role)) FROM user_profiles WHERE tenant_id=t AND lower(role) IN ('super_admin','head_operation','direktur','tech','admin_faskes')),'[]'));
END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['tech_ops_requests','tech_ops_history','tech_module_deployments'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);END LOOP;END $$;
REVOKE ALL ON FUNCTION tech_ops_command(text,text,jsonb,text),tech_ops_board(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tech_ops_command(text,text,jsonb,text),tech_ops_board(text,integer) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON tech_support_tickets,tech_changes FROM authenticated,anon;
COMMIT;
