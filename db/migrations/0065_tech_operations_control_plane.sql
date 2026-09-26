-- AVA TECH OPERATIONS CONTROL PLANE v1
-- Durable alert -> incident -> problem -> change -> release evidence.
-- No patient data, secrets, tokens, or backup payloads belong here.

CREATE TABLE IF NOT EXISTS public.tech_operational_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope_type text NOT NULL DEFAULT 'tenant' CHECK (scope_type IN ('platform','tenant','installation')),
  installation_id text,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('debug','info','warning','error','critical')),
  correlation_id text NOT NULL,
  request_id text,
  source text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correlation_id, event_type, occurred_at)
);
CREATE INDEX IF NOT EXISTS idx_tech_ops_events_tenant_time ON public.tech_operational_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tech_ops_events_correlation ON public.tech_operational_events(correlation_id);

CREATE TABLE IF NOT EXISTS public.tech_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  installation_id text,
  fingerprint text NOT NULL,
  rule_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('P0','P1','P2','P3')),
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','SUPPRESSED','RESOLVED')),
  owner_user_id uuid,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  maintenance_until timestamptz,
  correlation_id text NOT NULL,
  UNIQUE (fingerprint, status) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_tech_alerts_queue ON public.tech_alerts(status, severity, last_seen DESC);

CREATE TABLE IF NOT EXISTS public.tech_incidents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_no text UNIQUE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  installation_id text,
  severity text NOT NULL CHECK (severity IN ('P0','P1','P2','P3')),
  title text NOT NULL,
  impact text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','MITIGATING','MONITORING','RESOLVED','CLOSED')),
  owner_user_id uuid,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  mitigated_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  sla_ack_due_at timestamptz,
  sla_restore_due_at timestamptz,
  root_cause text,
  workaround text,
  customer_update text,
  correlation_id text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tech_incidents_queue ON public.tech_incidents(status, severity, detected_at DESC);

CREATE TABLE IF NOT EXISTS public.tech_problems (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  problem_no text UNIQUE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  risk_statement text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ANALYSIS','ACTIONED','VERIFYING','CLOSED')),
  owner_user_id uuid,
  due_at timestamptz,
  root_cause text,
  preventive_action text,
  residual_risk text,
  verification_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tech_problems_due ON public.tech_problems(status, due_at);

CREATE TABLE IF NOT EXISTS public.tech_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  change_no text UNIQUE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('code','config','schema','secret','infrastructure','content')),
  title text NOT NULL,
  risk text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW','APPROVED','RUNNING','SUCCEEDED','ROLLED_BACK','REJECTED')),
  requested_by uuid,
  approved_by uuid,
  release_version text,
  rollback_plan text NOT NULL,
  preflight_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tech_changes_status ON public.tech_changes(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tech_backup_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  installation_id text,
  environment text NOT NULL CHECK (environment IN ('staging','production','dr')),
  backup_kind text NOT NULL CHECK (backup_kind IN ('full','incremental','logical','snapshot')),
  status text NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','FAILED','EXPIRED')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  retention_until timestamptz,
  size_bytes bigint,
  checksum text,
  storage_reference text,
  rpo_minutes integer,
  error_detail text,
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_tech_backups_freshness ON public.tech_backup_runs(tenant_id, environment, finished_at DESC);

CREATE TABLE IF NOT EXISTS public.tech_restore_drills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  environment text NOT NULL,
  backup_run_id bigint REFERENCES public.tech_backup_runs(id),
  status text NOT NULL CHECK (status IN ('PLANNED','RUNNING','PASSED','FAILED')),
  started_at timestamptz,
  finished_at timestamptz,
  rto_minutes integer,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  gap text,
  next_drill_at timestamptz,
  verified_by uuid
);

CREATE TABLE IF NOT EXISTS public.tech_support_tickets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_no text UNIQUE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  reporter text,
  channel text NOT NULL DEFAULT 'portal' CHECK (channel IN ('portal','email','whatsapp','phone','internal')),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','TRIAGED','IN_PROGRESS','WAITING_CLIENT','RESOLVED','CLOSED')),
  priority text NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3')),
  incident_id bigint REFERENCES public.tech_incidents(id),
  problem_id bigint REFERENCES public.tech_problems(id),
  correlation_id text,
  owner_user_id uuid,
  first_response_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tech_support_queue ON public.tech_support_tickets(status, priority, created_at DESC);

CREATE OR REPLACE FUNCTION public.tech_ops_record_event(
  p_tenant uuid, p_event_type text, p_severity text, p_correlation_id text,
  p_source text, p_payload jsonb DEFAULT '{}'::jsonb, p_installation_id text DEFAULT NULL,
  p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  IF p_tenant IS NOT NULL AND p_tenant IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'tenant context mismatch';
  END IF;
  INSERT INTO public.tech_operational_events
    (tenant_id, scope_type, installation_id, event_type, severity, correlation_id, request_id, source, payload)
  VALUES (p_tenant, CASE WHEN p_tenant IS NULL THEN 'platform' ELSE 'tenant' END,
    p_installation_id, trim(p_event_type), trim(p_severity), trim(p_correlation_id), p_request_id,
    trim(p_source), COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'event_id', v_id, 'correlation_id', p_correlation_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.tech_ops_record_event(uuid,text,text,text,text,jsonb,text,text) TO authenticated, service_role;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['tech_operational_events','tech_alerts','tech_incidents','tech_problems','tech_changes','tech_backup_runs','tech_restore_drills','tech_support_tickets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
