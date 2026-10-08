-- OWNED_BY: generic. Team scoped planning, immutable closed snapshots.
BEGIN;
CREATE TABLE public.tech_team_sprints (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
 team text NOT NULL, title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 150),
 policy_id bigint NOT NULL REFERENCES ops_policy_versions(id),
 state text NOT NULL DEFAULT 'planning' CHECK(state IN ('planning','active','closed')),
 started_at timestamptz, planned_end_at timestamptz, closed_at timestamptz,
 closed_points numeric, closed_items jsonb, created_by uuid NOT NULL,
 version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX tech_one_active_sprint ON tech_team_sprints(tenant_id,team) WHERE state='active';
CREATE TABLE public.tech_backlog_items (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 team text NOT NULL,title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 200),
 points numeric NOT NULL CHECK(points>=0),sprint_id bigint REFERENCES tech_team_sprints(id),
 state text NOT NULL DEFAULT 'backlog' CHECK(state IN ('backlog','planned','doing','done')),
 done_evidence jsonb NOT NULL DEFAULT '{}',created_by uuid NOT NULL,version integer NOT NULL DEFAULT 1
);
CREATE TABLE public.tech_sprint_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 team text NOT NULL,actor_id uuid NOT NULL,action text NOT NULL,object_id bigint,
 evidence jsonb NOT NULL, happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_sprint_requests (
 tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,
 actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key)
);
CREATE OR REPLACE FUNCTION public.tech_sprint_command(p_action text,p_data jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid;t uuid:=current_tenant_id();p jsonb;s tech_team_sprints;i tech_backlog_items;
 q tech_sprint_requests;team_name text;res jsonb;input_data jsonb:=jsonb_build_object('action',p_action,'data',p_data);
 x jsonb;total numeric;carry bigint;obj bigint;previous jsonb;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','tech']);
 IF p_action IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 150 THEN RAISE EXCEPTION 'Input/request key tidak valid'; END IF;
 team_name:=trim(p_data->>'team'); IF coalesce(length(team_name),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Tim wajib'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'sprint'||team_name));
 SELECT * INTO q FROM tech_sprint_requests WHERE tenant_id=t AND request_key=p_request_key;
 IF FOUND THEN
  IF q.actor_id<>a OR q.input IS DISTINCT FROM input_data THEN RAISE EXCEPTION 'Retry input/actor berbeda'; END IF;
  RETURN q.result;
 END IF;
 IF coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Alasan wajib'; END IF;
 p:=ops_active_policy('sprint',team_name);
 IF NOT(p->'payload'->'members' ? a::text) THEN RAISE EXCEPTION 'Bukan anggota tim'; END IF;
 IF p_action IN ('create_sprint','create_item') THEN
  p:=ops_active_policy('sprint',team_name);
  IF p_action='create_sprint' THEN
   INSERT INTO tech_team_sprints(tenant_id,team,title,policy_id,created_by) VALUES(t,team_name,p_data->>'title',(p->>'id')::bigint,a) RETURNING * INTO s;
   res:=to_jsonb(s);obj:=s.id;
  ELSE
   IF p_data->>'points' IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'payload'->'points') z WHERE (z.value#>>'{}')::numeric=(p_data->>'points')::numeric) THEN RAISE EXCEPTION 'Poin tidak sesuai skala tim'; END IF;
   INSERT INTO tech_backlog_items(tenant_id,team,title,points,created_by) VALUES(t,team_name,p_data->>'title',(p_data->>'points')::numeric,a) RETURNING * INTO i;
   res:=to_jsonb(i);obj:=i.id;
  END IF;
 ELSIF p_action='edit_item' THEN
  SELECT * INTO i FROM tech_backlog_items WHERE id=(p_data->>'id')::bigint AND tenant_id=t AND team=team_name FOR UPDATE;
  IF NOT FOUND OR i.state<>'backlog' OR i.sprint_id IS NOT NULL THEN RAISE EXCEPTION 'Estimasi hanya dapat diubah pada backlog'; END IF;
  IF (p_data->>'version')::integer IS DISTINCT FROM i.version THEN RAISE EXCEPTION 'Data berubah'; END IF;
  IF p_data->>'points' IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'payload'->'points') z WHERE (z.value#>>'{}')::numeric=(p_data->>'points')::numeric) THEN RAISE EXCEPTION 'Poin tidak sesuai skala tim'; END IF;
  previous:=to_jsonb(i);
  UPDATE tech_backlog_items SET title=p_data->>'title',points=(p_data->>'points')::numeric,version=version+1 WHERE id=i.id RETURNING * INTO i;
  res:=to_jsonb(i);obj:=i.id;
 ELSIF p_action IN ('start','close') THEN
  SELECT * INTO s FROM tech_team_sprints WHERE id=(p_data->>'id')::bigint AND tenant_id=t AND team=team_name FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sprint tidak ditemukan'; END IF;
  IF (p_data->>'version')::integer IS DISTINCT FROM s.version THEN RAISE EXCEPTION 'Data berubah'; END IF;
  previous:=to_jsonb(s);
  SELECT to_jsonb(v) INTO p FROM ops_policy_versions v WHERE id=s.policy_id AND tenant_id=t;
  IF p_action='start' THEN
   IF s.state<>'planning' THEN RAISE EXCEPTION 'Sprint bukan planning'; END IF;
   IF p->>'state'<>'active' OR (p->>'effective_at')::timestamptz>now() THEN RAISE EXCEPTION 'Konfigurasi sprint tidak aktif'; END IF;
   UPDATE tech_team_sprints SET state='active',started_at=now(),planned_end_at=now()+((p->'payload'->>'duration_days')::integer*interval '1 day'),version=version+1 WHERE id=s.id RETURNING * INTO s;
  ELSE
   IF s.state<>'active' THEN RAISE EXCEPTION 'Sprint bukan active'; END IF;
   SELECT coalesce(sum(points),0),coalesce(jsonb_agg(to_jsonb(b)),'[]') INTO total,x FROM tech_backlog_items b WHERE tenant_id=t AND sprint_id=s.id AND state='done';
   UPDATE tech_team_sprints SET state='closed',closed_at=now(),closed_points=total,closed_items=x,version=version+1 WHERE id=s.id RETURNING * INTO s;
   IF p->'payload'->>'carry_over'='next_planning' THEN
    INSERT INTO tech_team_sprints(tenant_id,team,title,policy_id,created_by) VALUES(t,team_name,'Carry-over: '||left(s.title,100),s.policy_id,a) RETURNING id INTO carry;
   END IF;
   INSERT INTO tech_sprint_events(tenant_id,team,actor_id,action,object_id,evidence)
    SELECT t,team_name,a,'carry_over',b.id,jsonb_build_object('from',s.id,'to',carry,'previous',to_jsonb(b)) FROM tech_backlog_items b WHERE tenant_id=t AND sprint_id=s.id AND state<>'done';
   UPDATE tech_backlog_items SET sprint_id=carry,state=CASE WHEN carry IS NULL THEN 'backlog' ELSE 'planned' END,version=version+1,done_evidence='{}' WHERE tenant_id=t AND sprint_id=s.id AND state<>'done';
  END IF;
  res:=to_jsonb(s);obj:=s.id;
 ELSIF p_action IN ('assign','doing','done','return','reopen') THEN
  SELECT * INTO i FROM tech_backlog_items WHERE id=(p_data->>'id')::bigint AND tenant_id=t AND team=team_name FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item tidak ditemukan'; END IF;
  IF (p_data->>'version')::integer IS DISTINCT FROM i.version THEN RAISE EXCEPTION 'Data berubah'; END IF;
  previous:=to_jsonb(i);
  IF i.sprint_id IS NOT NULL THEN
   SELECT * INTO s FROM tech_team_sprints WHERE id=i.sprint_id AND tenant_id=t FOR UPDATE;
   IF s.state='closed' THEN RAISE EXCEPTION 'Sprint tertutup tidak dapat diubah'; END IF;
  END IF;
  IF p_action='assign' THEN
   IF i.state<>'backlog' THEN RAISE EXCEPTION 'Hanya item backlog dapat ditugaskan'; END IF;
   SELECT * INTO s FROM tech_team_sprints WHERE id=(p_data->>'sprint_id')::bigint AND tenant_id=t AND team=team_name FOR UPDATE;
   IF NOT FOUND OR s.state<>'planning' THEN RAISE EXCEPTION 'Sprint tujuan harus planning dalam tim yang sama'; END IF;
   SELECT to_jsonb(v) INTO p FROM ops_policy_versions v WHERE id=s.policy_id;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'payload'->'points') z WHERE (z.value#>>'{}')::numeric=i.points) THEN RAISE EXCEPTION 'Poin tidak sesuai versi sprint'; END IF;
   UPDATE tech_backlog_items SET sprint_id=s.id,state='planned',version=version+1 WHERE id=i.id RETURNING * INTO i;
  ELSIF p_action='doing' THEN
   IF i.state<>'planned' OR s.state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Item/sprint belum aktif'; END IF;
   UPDATE tech_backlog_items SET state='doing',version=version+1 WHERE id=i.id RETURNING * INTO i;
  ELSIF p_action='done' THEN
   IF i.state<>'doing' OR s.state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Item belum dikerjakan'; END IF;
   SELECT to_jsonb(v) INTO p FROM ops_policy_versions v WHERE id=s.policy_id;
   IF jsonb_typeof(p_data->'checks') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Checklist DoD wajib'; END IF;
   FOR x IN SELECT value FROM jsonb_array_elements(p->'payload'->'done_checks') LOOP
    IF p_data->'checks'->(x#>>'{}') IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'DoD belum lengkap'; END IF;
   END LOOP;
   IF coalesce(length(trim(p_data->>'evidence')),0)<3 THEN RAISE EXCEPTION 'Bukti selesai wajib'; END IF;
   UPDATE tech_backlog_items SET state='done',done_evidence=jsonb_build_object('checks',p_data->'checks','evidence',p_data->>'evidence','actor',a,'at',now()),version=version+1 WHERE id=i.id RETURNING * INTO i;
  ELSIF p_action='reopen' THEN
   IF i.state<>'done' OR s.state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Hanya Done pada sprint aktif dapat dikoreksi'; END IF;
   UPDATE tech_backlog_items SET state='doing',done_evidence='{}',version=version+1 WHERE id=i.id RETURNING * INTO i;
  ELSE
   IF i.state NOT IN ('planned','doing') THEN RAISE EXCEPTION 'Item tidak dapat kembali ke backlog'; END IF;
   UPDATE tech_backlog_items SET state='backlog',sprint_id=NULL,version=version+1 WHERE id=i.id RETURNING * INTO i;
  END IF;
  res:=to_jsonb(i);obj:=i.id;
 ELSE RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
 INSERT INTO tech_sprint_events(tenant_id,team,actor_id,action,object_id,evidence) VALUES(t,team_name,a,p_action,obj,jsonb_build_object('input',p_data,'before',previous));
 INSERT INTO tech_sprint_requests VALUES(t,p_request_key,a,input_data,res);
 RETURN res;
END $$;
CREATE OR REPLACE FUNCTION public.tech_sprint_board(p_team text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();p jsonb;s jsonb;i jsonb;velocity numeric;n integer;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech']);
 p:=ops_active_policy('sprint',p_team);
 IF NOT(p->'payload'->'members' ? auth.uid()::text) THEN RAISE EXCEPTION 'Bukan anggota tim'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id DESC),'[]') INTO s FROM (SELECT * FROM tech_team_sprints WHERE tenant_id=t AND team=p_team ORDER BY id DESC LIMIT 100) x;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id DESC),'[]') INTO i FROM (SELECT * FROM tech_backlog_items WHERE tenant_id=t AND team=p_team ORDER BY id DESC LIMIT 500) x;
 SELECT avg(closed_points),count(*) INTO velocity,n FROM (SELECT closed_points FROM tech_team_sprints WHERE tenant_id=t AND team=p_team AND state='closed' ORDER BY closed_at DESC,id DESC LIMIT (p->'payload'->>'velocity_window')::integer) h;
 RETURN jsonb_build_object('policy',p,'sprints',s,'items',i,'velocity',velocity,'sample_size',n,'sprint_limit',100,'item_limit',500);
END $$;
DO $$DECLARE n text;BEGIN
 FOREACH n IN ARRAY ARRAY['tech_team_sprints','tech_backlog_items','tech_sprint_events','tech_sprint_requests'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.tech_sprint_command(text,jsonb,text),public.tech_sprint_board(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tech_sprint_command(text,jsonb,text),public.tech_sprint_board(text) TO authenticated;
COMMIT;
