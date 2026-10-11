-- OWNED_BY: generic. Existing deployment columns; no master schema changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.tech_deployment_can_read(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id=auth.uid() AND tenant_id=current_tenant_id()
   AND lower(role) IN ('super_admin','head_operation','direktur','tech')
   AND (p_tenant=current_tenant_id() OR p_tenant IS NULL AND lower(role) IN ('super_admin','head_operation')));
$$;
REVOKE ALL ON FUNCTION public.tech_deployment_can_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tech_deployment_can_read(uuid) TO authenticated;
DROP POLICY IF EXISTS tech_deployments_read ON public.tech_deployments;
CREATE POLICY tech_deployments_read ON public.tech_deployments FOR SELECT TO authenticated USING(public.tech_deployment_can_read(tenant_id));
GRANT SELECT ON public.tech_deployments TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.tech_deployments FROM authenticated,anon;

CREATE OR REPLACE FUNCTION public.tech_ops_save_deployment(
 p_tenant uuid,p_environment text,p_project_name text,p_domain text,p_repository_url text DEFAULT NULL,
 p_branch_name text DEFAULT 'main',p_provider text DEFAULT 'vercel',p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v tech_deployments; prior tech_deployments; mode text:=coalesce(p_metadata->>'mode','upsert');
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech']);
 IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM current_tenant_id() THEN RAISE EXCEPTION 'tenant context mismatch';END IF;
 IF p_environment IS NULL OR p_project_name IS NULL OR p_domain IS NULL OR lower(trim(p_environment)) NOT IN ('staging','production','dr') OR trim(p_project_name)!~'^[a-z0-9][a-z0-9_-]{1,98}$'
   OR length(trim(p_domain))>253 OR trim(p_domain)!~'^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' THEN RAISE EXCEPTION 'Deployment input tidak valid';END IF;
 IF mode NOT IN ('create','edit','upsert') THEN RAISE EXCEPTION 'Mode perubahan tidak valid';END IF;
 SELECT * INTO prior FROM tech_deployments WHERE tenant_id=p_tenant AND environment=lower(trim(p_environment)) AND provider=lower(trim(coalesce(p_provider,'vercel'))) AND project_name=trim(p_project_name) FOR UPDATE;
 IF FOUND AND p_metadata->>'request_key' IS NOT NULL AND prior.metadata->>'request_key'=p_metadata->>'request_key' THEN
   IF prior.domain<>lower(trim(p_domain)) OR prior.repository_url IS DISTINCT FROM nullif(trim(p_repository_url),'') OR prior.branch_name<>coalesce(nullif(trim(p_branch_name),''),'main') THEN RAISE EXCEPTION 'Retry berbeda dari perubahan tersimpan';END IF;
   RETURN jsonb_build_object('ok',true,'deployment_id',prior.id,'status',prior.status,'updated_at',prior.updated_at);
 END IF;
 IF mode='edit' AND (prior.id IS NULL OR prior.id IS DISTINCT FROM (p_metadata->>'record_id')::bigint OR prior.updated_at IS DISTINCT FROM (p_metadata->>'expected_updated_at')::timestamptz) THEN RAISE EXCEPTION 'Konfigurasi sudah berubah; muat ulang sebelum edit';END IF;
 INSERT INTO tech_deployments(tenant_id,environment,provider,project_name,domain,repository_url,branch_name,status,metadata,updated_at)
 VALUES(p_tenant,lower(trim(p_environment)),lower(trim(coalesce(p_provider,'vercel'))),trim(p_project_name),lower(trim(p_domain)),nullif(trim(p_repository_url),''),coalesce(nullif(trim(p_branch_name),''),'main'),'PENDING_SYNC',coalesce(p_metadata,'{}'),clock_timestamp())
 ON CONFLICT(tenant_id,environment,provider,project_name) DO UPDATE SET domain=EXCLUDED.domain,repository_url=EXCLUDED.repository_url,branch_name=EXCLUDED.branch_name,status='PENDING_SYNC',last_error=NULL,metadata=EXCLUDED.metadata,updated_at=EXCLUDED.updated_at WHERE mode<>'create' RETURNING * INTO v;
 IF v.id IS NULL THEN
   SELECT * INTO prior FROM tech_deployments WHERE tenant_id=p_tenant AND environment=lower(trim(p_environment)) AND provider=lower(trim(coalesce(p_provider,'vercel'))) AND project_name=trim(p_project_name) FOR UPDATE;
   IF p_metadata->>'request_key' IS NOT NULL AND prior.metadata->>'request_key'=p_metadata->>'request_key' AND prior.domain=lower(trim(p_domain)) AND prior.repository_url IS NOT DISTINCT FROM nullif(trim(p_repository_url),'') AND prior.branch_name=coalesce(nullif(trim(p_branch_name),''),'main') THEN
     RETURN jsonb_build_object('ok',true,'deployment_id',prior.id,'status',prior.status,'updated_at',prior.updated_at);
   END IF;
   RAISE EXCEPTION 'Project sudah ada; buka detail untuk edit';
 END IF;
 PERFORM tech_ops_record_event(p_tenant,'deployment.configured','info',gen_random_uuid()::text,'tech-deployment-center',jsonb_build_object('deployment_id',v.id,'environment',v.environment,'domain',v.domain));
 RETURN jsonb_build_object('ok',true,'deployment_id',v.id,'status',v.status,'updated_at',v.updated_at);
END;$$;
REVOKE ALL ON FUNCTION public.tech_ops_save_deployment(uuid,text,text,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tech_ops_save_deployment(uuid,text,text,text,text,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.tech_ops_deployment_sync_result(p_id bigint,p_status text,p_error text,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v tech_deployments;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech']);
 SELECT * INTO v FROM tech_deployments WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT tech_deployment_can_read(v.tenant_id) THEN RAISE EXCEPTION 'Deployment tidak tersedia';END IF;
 IF p_expected_updated_at IS NULL OR v.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Konfigurasi sudah berubah; hasil lama ditolak';END IF;
 IF p_status IS NULL OR p_status NOT IN ('SYNCED','FAILED','DRIFT') THEN RAISE EXCEPTION 'Status sinkronisasi tidak valid';END IF;
 UPDATE tech_deployments SET status=p_status,last_error=CASE WHEN p_status='SYNCED' THEN NULL ELSE left(p_error,1000) END,
   last_synced_at=CASE WHEN p_status='SYNCED' THEN clock_timestamp() ELSE last_synced_at END,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO v;
 PERFORM tech_ops_record_event(v.tenant_id,'deployment.sync_result',CASE WHEN p_status='SYNCED' THEN 'info' ELSE 'warning' END,gen_random_uuid()::text,'tech-deployment-adapter',jsonb_build_object('deployment_id',v.id,'status',p_status));
 RETURN jsonb_build_object('ok',true,'deployment_id',v.id,'status',v.status);
END;$$;
REVOKE ALL ON FUNCTION public.tech_ops_deployment_sync_result(bigint,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tech_ops_deployment_sync_result(bigint,text,text,timestamptz) TO authenticated;
COMMIT;
