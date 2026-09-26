-- AVA TECH DEPLOYMENT CENTER v1
CREATE TABLE IF NOT EXISTS public.tech_deployments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('staging','production','dr')),
  provider text NOT NULL DEFAULT 'vercel',
  project_name text NOT NULL,
  domain text NOT NULL,
  repository_url text,
  branch_name text DEFAULT 'main',
  status text NOT NULL DEFAULT 'PENDING_SYNC' CHECK (status IN ('PENDING_SYNC','SYNCED','DRIFT','FAILED','DISABLED')),
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, environment, provider, project_name)
);
CREATE INDEX IF NOT EXISTS idx_tech_deployments_queue ON public.tech_deployments(status, updated_at DESC);
ALTER TABLE public.tech_deployments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tech_ops_save_deployment(
  p_tenant uuid, p_environment text, p_project_name text, p_domain text,
  p_repository_url text DEFAULT NULL, p_branch_name text DEFAULT 'main',
  p_provider text DEFAULT 'vercel', p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.tech_deployments;
BEGIN
  IF p_tenant IS NOT NULL AND p_tenant IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'tenant context mismatch';
  END IF;
  INSERT INTO public.tech_deployments(tenant_id,environment,provider,project_name,domain,repository_url,branch_name,status,metadata,updated_at)
  VALUES(p_tenant,lower(trim(p_environment)),lower(trim(coalesce(p_provider,'vercel'))),trim(p_project_name),lower(trim(p_domain)),nullif(trim(p_repository_url),''),coalesce(nullif(trim(p_branch_name),''),'main'),'PENDING_SYNC',coalesce(p_metadata,'{}'::jsonb),now())
  ON CONFLICT (tenant_id, environment, provider, project_name) DO UPDATE SET
    domain=EXCLUDED.domain, repository_url=EXCLUDED.repository_url, branch_name=EXCLUDED.branch_name,
    status='PENDING_SYNC', last_error=NULL, metadata=EXCLUDED.metadata, updated_at=now()
  RETURNING * INTO v;
  PERFORM public.tech_ops_record_event(p_tenant,'deployment.configured','info',gen_random_uuid()::text,'tech-deployment-center',jsonb_build_object('deployment_id',v.id,'environment',v.environment,'provider',v.provider,'domain',v.domain));
  RETURN jsonb_build_object('ok',true,'deployment_id',v.id,'status',v.status);
END; $$;
GRANT EXECUTE ON FUNCTION public.tech_ops_save_deployment(uuid,text,text,text,text,text,text,jsonb) TO authenticated, service_role;
