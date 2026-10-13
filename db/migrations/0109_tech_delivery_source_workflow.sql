-- OWNED_BY: generic. Recorded contractual delivery; no network/deploy side effects.
BEGIN;
CREATE TABLE tech_delivery_projects(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 title text NOT NULL,contract_reference text NOT NULL,license_id bigint NOT NULL REFERENCES tech_lisensi(id),
 license_snapshot jsonb NOT NULL,modules jsonb NOT NULL,installation_id text NOT NULL,environment text NOT NULL,
 timezone text NOT NULL,sla jsonb NOT NULL,state text NOT NULL DEFAULT 'draft',ops_version integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL,approved_by uuid,accepted_by uuid,created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz,started_at timestamptz,handed_over_at timestamptz,accepted_at timestamptz,closed_at timestamptz,
 acceptance_reference text,followup_reference text,followup_outcome text,
 CHECK(state IN ('draft','review','approved','running','handover','accepted','closed','cancelled')),
 CHECK(environment IN ('test','staging','production'))
);
CREATE TABLE tech_delivery_milestones(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 project_id bigint NOT NULL REFERENCES tech_delivery_projects(id),code text NOT NULL,title text NOT NULL,
 mandatory boolean NOT NULL,module_key text,due_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','submitted','accepted')),
 deployment_id bigint REFERENCES tech_module_deployments(id),evidence text,submitted_by uuid,accepted_by uuid,
 submitted_at timestamptz,accepted_at timestamptz,ops_version integer NOT NULL DEFAULT 1,UNIQUE(project_id,code)
);
CREATE TABLE tech_delivery_ticket_links(
 tenant_id uuid NOT NULL REFERENCES tenants(id),project_id bigint NOT NULL REFERENCES tech_delivery_projects(id),
 ticket_id bigint PRIMARY KEY REFERENCES tech_support_tickets(id),priority text NOT NULL,
 response_minutes integer NOT NULL,resolution_minutes integer NOT NULL,linked_by uuid NOT NULL,linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tech_delivery_requests(tenant_id uuid NOT NULL,request_key text NOT NULL,actor_id uuid NOT NULL,input jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE tech_delivery_history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL,project_id bigint NOT NULL REFERENCES tech_delivery_projects(id),milestone_id bigint,action text NOT NULL,actor_id uuid NOT NULL,reason text NOT NULL,before_row jsonb,after_row jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());

CREATE FUNCTION tech_delivery_license_snapshot(p_id bigint,p_tenant uuid,p_lock boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l tech_lisensi; p tech_paket;
BEGIN
 IF p_lock THEN SELECT * INTO l FROM tech_lisensi WHERE id=p_id AND tenant_id=p_tenant FOR SHARE; ELSE SELECT * INTO l FROM tech_lisensi WHERE id=p_id AND tenant_id=p_tenant; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lisensi tenant tidak ditemukan';END IF;
 IF p_lock THEN SELECT * INTO p FROM tech_paket WHERE id=l.paket_id FOR SHARE;ELSE SELECT * INTO p FROM tech_paket WHERE id=l.paket_id;END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Paket sumber tidak ditemukan';END IF;
 RETURN jsonb_build_object('id',l.id,'package_id',l.paket_id,'status',l.status,'from',l.tgl_mulai,'until',l.tgl_berakhir,'package_status',p.status,'modules',p.modul_termasuk);
END $$;

CREATE FUNCTION tech_delivery_health(p_id bigint,p_lock boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p tech_delivery_projects; s jsonb; issues jsonb:='[]';m tech_delivery_milestones;d tech_module_deployments;c tech_changes;today date;v text;
BEGIN
 SELECT * INTO p FROM tech_delivery_projects WHERE id=p_id AND tenant_id=current_tenant_id();
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery tidak ditemukan';END IF;
 today:=(now() AT TIME ZONE p.timezone)::date;
 s:=tech_delivery_license_snapshot(p.license_id,p.tenant_id,p_lock);
 IF s IS DISTINCT FROM p.license_snapshot THEN issues:=issues||jsonb_build_array('Lisensi/paket sumber berubah; perlu scope baru');END IF;
 IF s->>'status'<>'Aktif' OR s->>'package_status'<>'Aktif' OR (s->>'from')::date IS NULL OR (s->>'from')::date>today OR ((s->>'until') IS NOT NULL AND (s->>'until')::date<today) THEN issues:=issues||jsonb_build_array('Lisensi/paket tidak efektif');END IF;
 -- Lock changes before deployments, matching rollback source lock order.
 IF p_lock THEN
  PERFORM 1 FROM tech_changes WHERE id IN(SELECT d1.change_id FROM tech_module_deployments d1 JOIN tech_delivery_milestones m1 ON m1.deployment_id=d1.id WHERE m1.project_id=p.id) ORDER BY id FOR SHARE;
  PERFORM 1 FROM tech_module_deployments WHERE id IN(SELECT deployment_id FROM tech_delivery_milestones WHERE project_id=p.id) ORDER BY id FOR SHARE;
  PERFORM 1 FROM tech_support_tickets WHERE id IN(SELECT ticket_id FROM tech_delivery_ticket_links WHERE project_id=p.id) ORDER BY id FOR SHARE;
 END IF;
 FOR m IN SELECT * FROM tech_delivery_milestones WHERE project_id=p.id ORDER BY id LOOP
  IF m.mandatory AND m.state<>'accepted' THEN issues:=issues||jsonb_build_array('Milestone belum diterima: '||m.code);END IF;
  IF m.module_key IS NOT NULL AND m.state='accepted' THEN
   SELECT * INTO d FROM tech_module_deployments WHERE id=m.deployment_id AND tenant_id=p.tenant_id;
   SELECT * INTO c FROM tech_changes WHERE id=d.change_id AND tenant_id=p.tenant_id;
   IF d.id IS NULL OR d.state<>'verified' OR d.module_key<>m.module_key OR d.installation_id<>p.installation_id OR d.environment<>p.environment OR c.id IS NULL OR c.status<>'SUCCEEDED' OR c.release_version IS DISTINCT FROM d.release_version THEN issues:=issues||jsonb_build_array('Deployment sumber tidak sah: '||m.code);END IF;
  END IF;
 END LOOP;
 FOR v IN SELECT jsonb_array_elements_text(p.modules) LOOP
  IF NOT EXISTS(SELECT 1 FROM tech_delivery_milestones WHERE project_id=p.id AND module_key=v AND mandatory AND state='accepted') THEN issues:=issues||jsonb_build_array('Modul belum diterima: '||v);END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM tech_delivery_ticket_links l JOIN tech_support_tickets t ON t.id=l.ticket_id WHERE l.project_id=p.id AND t.status<>'CLOSED') THEN issues:=issues||jsonb_build_array('Tiket delivery belum CLOSED');END IF;
 RETURN jsonb_build_object('current_source_valid',jsonb_array_length(issues)=0,'issues',issues);
END $$;

CREATE FUNCTION tech_delivery_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;p tech_delivery_projects;m tech_delivery_milestones;old jsonb;out_value jsonb;inp jsonb:=jsonb_build_object('action',p_action,'data',p_data);req tech_delivery_requests;
 s jsonb;x jsonb;v text;next_state text;health jsonb;tk tech_support_tickets;d tech_module_deployments;c tech_changes;today date;
BEGIN
 a:=ops_actor(ARRAY['super_admin','head_operation','direktur','tech','admin_faskes']);
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR coalesce(length(trim(p_data->>'reason')),0)<3 THEN RAISE EXCEPTION 'Input/alasan/request key wajib';END IF;
 IF p_data->>'tenant_id' IS NOT NULL AND (p_data->>'tenant_id')::uuid IS DISTINCT FROM t THEN RAISE EXCEPTION 'Tenant akun harus sama';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(t::text||'tech-delivery:'||p_key));
 SELECT * INTO req FROM tech_delivery_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF req.actor_id<>a OR req.input IS DISTINCT FROM inp THEN RAISE EXCEPTION 'Retry input/actor berbeda';END IF;RETURN req.result;END IF;
 IF p_action='create' THEN
  IF coalesce(length(trim(p_data->>'title')),0) NOT BETWEEN 3 AND 200 OR coalesce(length(trim(p_data->>'contract_reference')),0) NOT BETWEEN 3 AND 2000 OR coalesce(length(trim(p_data->>'installation')),0) NOT BETWEEN 1 AND 200 OR coalesce(p_data->>'environment','') NOT IN ('test','staging','production') OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_data->>'timezone') THEN RAISE EXCEPTION 'Judul/kontrak/instalasi/environment/timezone wajib';END IF;
  IF jsonb_typeof(p_data->'modules') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'modules') NOT BETWEEN 1 AND 100 OR jsonb_typeof(p_data->'milestones') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'milestones') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Scope modul dan milestone wajib';END IF;
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(p_data->'modules'))<>jsonb_array_length(p_data->'modules') THEN RAISE EXCEPTION 'Modul duplikat';END IF;
  s:=tech_delivery_license_snapshot((p_data->>'license_id')::bigint,t,true);
  today:=(now() AT TIME ZONE(p_data->>'timezone'))::date;
  IF s->>'status'<>'Aktif' OR s->>'package_status'<>'Aktif' OR (s->>'from')::date IS NULL OR (s->>'from')::date>today OR ((s->>'until') IS NOT NULL AND (s->>'until')::date<today) THEN RAISE EXCEPTION 'Lisensi/paket tidak efektif';END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p_data->'modules') LOOP
   IF jsonb_typeof(x)<>'string' OR (x#>>'{}') !~ '^[a-z][a-z0-9-]{0,99}$' OR NOT coalesce((s->'modules') ? (x#>>'{}'),false) THEN RAISE EXCEPTION 'Modul scope tidak termasuk paket';END IF;
  END LOOP;
  IF jsonb_typeof(p_data->'sla') IS DISTINCT FROM 'object' OR p_data->'sla'->>'clock' IS DISTINCT FROM 'elapsed_24x7' THEN RAISE EXCEPTION 'SLA elapsed_24x7 eksplisit wajib';END IF;
  FOREACH v IN ARRAY ARRAY['P0','P1','P2','P3'] LOOP
   x:=p_data->'sla'->v;
   IF coalesce(x->>'response_minutes','') !~ '^[1-9][0-9]{0,6}$' OR coalesce(x->>'resolution_minutes','') !~ '^[1-9][0-9]{0,6}$' THEN RAISE EXCEPTION 'SLA setiap prioritas wajib menit positif';END IF;
   IF (x->>'response_minutes')::integer>(x->>'resolution_minutes')::integer THEN RAISE EXCEPTION 'SLA response melebihi resolution';END IF;
  END LOOP;
  INSERT INTO tech_delivery_projects(tenant_id,title,contract_reference,license_id,license_snapshot,modules,installation_id,environment,timezone,sla,created_by) VALUES(t,trim(p_data->>'title'),p_data->>'contract_reference',(p_data->>'license_id')::bigint,s,p_data->'modules',p_data->>'installation',p_data->>'environment',p_data->>'timezone',p_data->'sla',a) RETURNING * INTO p;
  FOR x IN SELECT value FROM jsonb_array_elements(p_data->'milestones') LOOP
   IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR coalesce(x->>'code','') !~ '^[a-z][a-z0-9-]{0,99}$' OR coalesce(length(trim(x->>'title')),0) NOT BETWEEN 3 AND 200 OR jsonb_typeof(x->'mandatory') IS DISTINCT FROM 'boolean' OR coalesce(x->>'due_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' OR NOT isfinite((x->>'due_at')::timestamptz) THEN RAISE EXCEPTION 'Milestone/code/title/mandatory/deadline dengan offset wajib';END IF;
   IF x->>'module' IS NOT NULL AND (NOT((p.modules) ? (x->>'module')) OR NOT(x->>'mandatory')::boolean) THEN RAISE EXCEPTION 'Milestone modul wajib mandatory dan termasuk scope';END IF;
   INSERT INTO tech_delivery_milestones(tenant_id,project_id,code,title,mandatory,module_key,due_at) VALUES(t,p.id,x->>'code',x->>'title',(x->>'mandatory')::boolean,x->>'module',(x->>'due_at')::timestamptz);
  END LOOP;
  FOR v IN SELECT jsonb_array_elements_text(p.modules) LOOP IF NOT EXISTS(SELECT 1 FROM tech_delivery_milestones WHERE project_id=p.id AND module_key=v AND mandatory) THEN RAISE EXCEPTION 'Setiap modul memerlukan milestone deployment';END IF;END LOOP;
  out_value:=to_jsonb(p);
 ELSE
  SELECT * INTO p FROM tech_delivery_projects WHERE id=(p_data->>'id')::bigint AND tenant_id=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery tidak ditemukan';END IF;
  IF p.ops_version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Data berubah; muat ulang';END IF;
  old:=to_jsonb(p);
  IF p_action IN ('milestone_submit','milestone_accept','milestone_return') THEN
   IF p.state<>'running' THEN RAISE EXCEPTION 'Milestone hanya pada delivery running';END IF;
   SELECT * INTO m FROM tech_delivery_milestones WHERE id=(p_data->>'milestone_id')::bigint AND project_id=p.id AND tenant_id=t FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Milestone tidak ditemukan';END IF;
   IF m.ops_version IS DISTINCT FROM (p_data->>'milestone_version')::integer THEN RAISE EXCEPTION 'Milestone berubah';END IF;
   old:=to_jsonb(m);
   IF p_action='milestone_submit' AND m.state='pending' THEN
    IF coalesce(length(trim(p_data->>'evidence')),0) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'Bukti milestone wajib';END IF;
    IF m.module_key IS NOT NULL THEN
     SELECT * INTO d FROM tech_module_deployments WHERE id=(p_data->>'deployment_id')::bigint AND tenant_id=t;
     SELECT * INTO c FROM tech_changes WHERE id=d.change_id AND tenant_id=t FOR SHARE;
     SELECT * INTO d FROM tech_module_deployments WHERE id=d.id AND tenant_id=t FOR SHARE;
     IF d.id IS NULL OR d.state<>'verified' OR d.module_key<>m.module_key OR d.installation_id<>p.installation_id OR d.environment<>p.environment OR c.id IS NULL OR c.status<>'SUCCEEDED' OR c.release_version IS DISTINCT FROM d.release_version THEN RAISE EXCEPTION 'Deployment verified sumber harus cocok scope';END IF;
    END IF;
    UPDATE tech_delivery_milestones SET state='submitted',evidence=p_data->>'evidence',deployment_id=d.id,submitted_by=a,submitted_at=now(),ops_version=ops_version+1 WHERE id=m.id RETURNING * INTO m;
   ELSIF p_action IN ('milestone_accept','milestone_return') AND m.state='submitted' THEN
    PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes']);
    IF a=m.submitted_by THEN RAISE EXCEPTION 'Verifier milestone harus berbeda';END IF;
    IF p_action='milestone_accept' THEN
     IF m.module_key IS NOT NULL THEN
      SELECT * INTO d FROM tech_module_deployments WHERE id=m.deployment_id AND tenant_id=t;
      SELECT * INTO c FROM tech_changes WHERE id=d.change_id AND tenant_id=t FOR SHARE;
      SELECT * INTO d FROM tech_module_deployments WHERE id=d.id AND tenant_id=t FOR SHARE;
      IF d.id IS NULL OR d.state<>'verified' OR d.module_key<>m.module_key OR d.installation_id<>p.installation_id OR d.environment<>p.environment OR c.id IS NULL OR c.status<>'SUCCEEDED' OR c.release_version IS DISTINCT FROM d.release_version THEN RAISE EXCEPTION 'Deployment sumber berubah sebelum penerimaan';END IF;
     END IF;
     UPDATE tech_delivery_milestones SET state='accepted',accepted_by=a,accepted_at=now(),ops_version=ops_version+1 WHERE id=m.id RETURNING * INTO m;
    ELSE UPDATE tech_delivery_milestones SET state='pending',ops_version=ops_version+1 WHERE id=m.id RETURNING * INTO m; END IF;
   ELSE RAISE EXCEPTION 'Transisi milestone tidak sah';END IF;
   UPDATE tech_delivery_projects SET ops_version=ops_version+1 WHERE id=p.id RETURNING * INTO p;
   out_value:=to_jsonb(p)||jsonb_build_object('milestone',to_jsonb(m));
  ELSIF p_action='ticket_link' THEN
   IF p.state NOT IN ('running','handover','accepted') THEN RAISE EXCEPTION 'Link tiket hanya delivery berjalan';END IF;
   SELECT * INTO tk FROM tech_support_tickets WHERE id=(p_data->>'ticket_id')::bigint AND tenant_id=t FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tenant tidak ditemukan';END IF;
   x:=p.sla->tk.priority;
   INSERT INTO tech_delivery_ticket_links VALUES(t,p.id,tk.id,tk.priority,(x->>'response_minutes')::integer,(x->>'resolution_minutes')::integer,a,now());
   UPDATE tech_delivery_projects SET ops_version=ops_version+1 WHERE id=p.id RETURNING * INTO p;out_value:=to_jsonb(p)||jsonb_build_object('ticket_id',tk.id);
  ELSE
   next_state:=CASE WHEN p_action='submit' AND p.state='draft' THEN 'review' WHEN p_action='approve' AND p.state='review' THEN 'approved' WHEN p_action='start' AND p.state='approved' THEN 'running' WHEN p_action='handover' AND p.state='running' THEN 'handover' WHEN p_action='accept' AND p.state='handover' THEN 'accepted' WHEN p_action='close' AND p.state='accepted' THEN 'closed' WHEN p_action='cancel' AND p.state NOT IN ('closed','cancelled') THEN 'cancelled' END;
   IF next_state IS NULL THEN RAISE EXCEPTION 'Transisi delivery tidak sah';END IF;
   IF p_action IN ('approve','accept','close','cancel') THEN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes']);END IF;
   IF p_action IN ('approve','accept') AND a=p.created_by THEN RAISE EXCEPTION 'Reviewer delivery harus berbeda pembuat';END IF;
   IF p_action='start' THEN
    s:=tech_delivery_license_snapshot(p.license_id,t,true);today:=(now() AT TIME ZONE p.timezone)::date;
    IF s IS DISTINCT FROM p.license_snapshot OR (s->>'from')::date>today OR ((s->>'until') IS NOT NULL AND (s->>'until')::date<today) THEN RAISE EXCEPTION 'Lisensi scope berubah/tidak efektif';END IF;
   END IF;
   IF p_action IN ('handover','accept','close') THEN health:=tech_delivery_health(p.id,true);IF NOT(health->>'current_source_valid')::boolean THEN RAISE EXCEPTION 'Delivery belum siap: %',health->'issues';END IF;END IF;
   IF p_action='accept' AND coalesce(length(trim(p_data->>'acceptance_reference')),0) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'Bukti penerimaan pelanggan wajib';END IF;
   IF p_action='close' AND (coalesce(length(trim(p_data->>'followup_reference')),0) NOT BETWEEN 3 AND 2000 OR coalesce(length(trim(p_data->>'followup_outcome')),0) NOT BETWEEN 3 AND 2000) THEN RAISE EXCEPTION 'Bukti follow-up dan outcome wajib';END IF;
   UPDATE tech_delivery_projects SET state=next_state,ops_version=ops_version+1,approved_by=CASE WHEN p_action='approve' THEN a ELSE approved_by END,approved_at=CASE WHEN p_action='approve' THEN now() ELSE approved_at END,started_at=CASE WHEN p_action='start' THEN now() ELSE started_at END,handed_over_at=CASE WHEN p_action='handover' THEN now() ELSE handed_over_at END,accepted_by=CASE WHEN p_action='accept' THEN a ELSE accepted_by END,accepted_at=CASE WHEN p_action='accept' THEN now() ELSE accepted_at END,acceptance_reference=CASE WHEN p_action='accept' THEN p_data->>'acceptance_reference' ELSE acceptance_reference END,closed_at=CASE WHEN p_action='close' THEN now() ELSE closed_at END,followup_reference=CASE WHEN p_action='close' THEN p_data->>'followup_reference' ELSE followup_reference END,followup_outcome=CASE WHEN p_action='close' THEN p_data->>'followup_outcome' ELSE followup_outcome END WHERE id=p.id RETURNING * INTO p;
   out_value:=to_jsonb(p);
  END IF;
 END IF;
 INSERT INTO tech_delivery_history(tenant_id,project_id,milestone_id,action,actor_id,reason,before_row,after_row) VALUES(t,p.id,m.id,p_action,a,p_data->>'reason',old,out_value);
 INSERT INTO tech_delivery_requests VALUES(t,p_key,a,inp,out_value);RETURN out_value;
END $$;

CREATE FUNCTION tech_delivery_board(p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();rows_value jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech','admin_faskes']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('health',tech_delivery_health(p.id),'milestones',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM tech_delivery_milestones m WHERE m.project_id=p.id),'[]'),'tickets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',tk.id,'title',tk.title,'status',tk.status,'priority',l.priority,'first_response_at',tk.first_response_at,'resolved_at',tk.resolved_at,'response_due',tk.created_at+make_interval(mins=>l.response_minutes),'resolution_due',tk.created_at+make_interval(mins=>l.resolution_minutes),'response_breached',coalesce(tk.first_response_at,now())>tk.created_at+make_interval(mins=>l.response_minutes),'resolution_breached',coalesce(tk.resolved_at,now())>tk.created_at+make_interval(mins=>l.resolution_minutes)) ORDER BY tk.id) FROM tech_delivery_ticket_links l JOIN tech_support_tickets tk ON tk.id=l.ticket_id WHERE l.project_id=p.id),'[]')) ORDER BY p.id DESC),'[]') INTO rows_value FROM(SELECT * FROM tech_delivery_projects WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)p;
 RETURN jsonb_build_object('rows',rows_value);
END $$;
CREATE FUNCTION tech_delivery_sources(p_kind text,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();v jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech','admin_faskes']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 IF p_kind='license' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'package',p.nama,'status',l.status,'from',l.tgl_mulai,'until',l.tgl_berakhir,'modules',p.modul_termasuk) ORDER BY l.id DESC),'[]') INTO v FROM(SELECT * FROM tech_lisensi WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)l JOIN tech_paket p ON p.id=l.paket_id;
 ELSIF p_kind='deployment' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'module',d.module_key,'installation',d.installation_id,'environment',d.environment,'release',d.release_version,'state',d.state) ORDER BY d.id DESC),'[]') INTO v FROM(SELECT * FROM tech_module_deployments WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)d;
 ELSIF p_kind='ticket' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'priority',priority) ORDER BY id DESC),'[]') INTO v FROM(SELECT * FROM tech_support_tickets WHERE tenant_id=t ORDER BY id DESC LIMIT 51 OFFSET p_offset)tk;
 ELSE RAISE EXCEPTION 'Jenis source tidak sah';END IF;
 RETURN jsonb_build_object('rows',v);
END $$;
CREATE FUNCTION tech_delivery_audit(p_id bigint,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech','admin_faskes']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 IF NOT EXISTS(SELECT 1 FROM tech_delivery_projects WHERE id=p_id AND tenant_id=current_tenant_id()) THEN RAISE EXCEPTION 'Delivery tidak ditemukan';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY id DESC),'[]') INTO v FROM(SELECT id,action,actor_id,reason,milestone_id,created_at FROM tech_delivery_history WHERE project_id=p_id AND tenant_id=current_tenant_id() ORDER BY id DESC LIMIT 51 OFFSET p_offset)h;
 RETURN jsonb_build_object('rows',v);
END $$;
CREATE FUNCTION tech_delivery_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME IN ('tech_delivery_history','tech_delivery_requests','tech_delivery_ticket_links') OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Delivery audit/source link append-only';END IF;
 IF TG_TABLE_NAME='tech_delivery_projects' AND (to_jsonb(OLD)-ARRAY['state','ops_version','approved_by','accepted_by','approved_at','started_at','handed_over_at','accepted_at','closed_at','acceptance_reference','followup_reference','followup_outcome']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','ops_version','approved_by','accepted_by','approved_at','started_at','handed_over_at','accepted_at','closed_at','acceptance_reference','followup_reference','followup_outcome']) THEN RAISE EXCEPTION 'Scope delivery immutable; buat scope baru';END IF;
 IF TG_TABLE_NAME='tech_delivery_milestones' AND (OLD.state='accepted' OR (to_jsonb(OLD)-ARRAY['state','deployment_id','evidence','submitted_by','accepted_by','submitted_at','accepted_at','ops_version']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','deployment_id','evidence','submitted_by','accepted_by','submitted_at','accepted_at','ops_version'])) THEN RAISE EXCEPTION 'Scope/accepted milestone immutable';END IF;
 IF TG_TABLE_NAME='tech_delivery_projects' AND OLD.state IN ('closed','cancelled') THEN RAISE EXCEPTION 'Delivery final immutable';END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION tech_ops_board(p_kind text,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();v jsonb;rows_value jsonb;table_name text;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech','admin_faskes']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset tidak valid';END IF;
 table_name:=CASE p_kind WHEN 'ticket' THEN 'tech_support_tickets' WHEN 'change' THEN 'tech_changes' WHEN 'deployment' THEN 'tech_module_deployments' END;
 IF table_name IS NULL THEN RAISE EXCEPTION 'Jenis board tidak valid';END IF;
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM (SELECT * FROM %I WHERE tenant_id=$1 ORDER BY id DESC LIMIT 51 OFFSET $2)r',table_name) INTO v USING t,p_offset;
 SELECT coalesce(jsonb_agg(r||jsonb_build_object('deliveries',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'state',p.state) ORDER BY p.id) FROM tech_delivery_projects p WHERE p.tenant_id=t AND (p_kind='ticket' AND EXISTS(SELECT 1 FROM tech_delivery_ticket_links l WHERE l.project_id=p.id AND l.ticket_id=(r->>'id')::bigint) OR p_kind IN ('change','deployment') AND EXISTS(SELECT 1 FROM tech_delivery_milestones m JOIN tech_module_deployments d ON d.id=m.deployment_id WHERE m.project_id=p.id AND CASE WHEN p_kind='change' THEN d.change_id ELSE d.id END=(r->>'id')::bigint))),'[]'))),'[]') INTO rows_value FROM jsonb_array_elements(v)r;
 RETURN jsonb_build_object('rows',rows_value,'staff',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role)) FROM user_profiles WHERE tenant_id=t AND lower(role) IN ('super_admin','head_operation','direktur','tech','admin_faskes')),'[]'));
END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['tech_delivery_projects','tech_delivery_milestones','tech_delivery_history','tech_delivery_requests','tech_delivery_ticket_links'] LOOP EXECUTE format('CREATE TRIGGER delivery_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tech_delivery_immutable()',n);END LOOP;END $$;
DO $$DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['tech_delivery_projects','tech_delivery_milestones','tech_delivery_ticket_links','tech_delivery_requests','tech_delivery_history'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',n);END LOOP;END $$;
REVOKE ALL ON FUNCTION tech_delivery_license_snapshot(bigint,uuid,boolean),tech_delivery_health(bigint,boolean),tech_delivery_immutable() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION tech_delivery_command(text,jsonb,text),tech_delivery_board(integer),tech_delivery_sources(text,integer),tech_delivery_audit(bigint,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tech_delivery_command(text,jsonb,text),tech_delivery_board(integer),tech_delivery_sources(text,integer),tech_delivery_audit(bigint,integer) TO authenticated;
COMMIT;
