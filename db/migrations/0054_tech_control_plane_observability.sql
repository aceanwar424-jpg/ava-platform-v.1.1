-- AVA Tech control plane: durable client health and tenant-scoped diagnostics.
-- Heartbeats contain operational metadata only; never store tokens or patient data.
-- Compatibility guard: some environments apply feature migrations selectively.
-- The control plane must still fail closed rather than fail with "tenants does
-- not exist". This creates only the minimal tenant registry contract; it does
-- not seed a default cloud tenant.
DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    CREATE TABLE public.tenants (
      id uuid PRIMARY KEY,
      kode text UNIQUE NOT NULL,
      nama text NOT NULL,
      jenis text DEFAULT 'klinik',
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')::uuid
  );
$$;

CREATE TABLE IF NOT EXISTS public.tech_client_heartbeats (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_name text,
  app_version text,
  status text NOT NULL DEFAULT 'HEALTHY'
    CHECK (status IN ('HEALTHY', 'DEGRADED', 'OFFLINE')),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_tech_client_heartbeats_last_seen
  ON public.tech_client_heartbeats (last_seen DESC);

ALTER TABLE public.tech_client_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tech_client_heartbeats_tenant_read ON public.tech_client_heartbeats;
CREATE POLICY tech_client_heartbeats_tenant_read
  ON public.tech_client_heartbeats FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tech_client_heartbeats_tenant_write ON public.tech_client_heartbeats;
CREATE POLICY tech_client_heartbeats_tenant_write
  ON public.tech_client_heartbeats FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tech_client_heartbeats_tenant_update ON public.tech_client_heartbeats;
CREATE POLICY tech_client_heartbeats_tenant_update
  ON public.tech_client_heartbeats FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE OR REPLACE FUNCTION public.tech_record_client_heartbeat(
  p_tenant uuid,
  p_client_id text,
  p_client_name text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_status text DEFAULT 'HEALTHY',
  p_latency_ms integer DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.tech_client_heartbeats;
BEGIN
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'tenant context mismatch';
  END IF;
  IF NULLIF(trim(COALESCE(p_client_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'client_id wajib diisi';
  END IF;
  IF p_status NOT IN ('HEALTHY', 'DEGRADED', 'OFFLINE') THEN
    RAISE EXCEPTION 'status heartbeat tidak valid';
  END IF;

  INSERT INTO public.tech_client_heartbeats
    (tenant_id, client_id, client_name, app_version, status, latency_ms, metadata, last_seen, updated_at)
  VALUES
    (p_tenant, trim(p_client_id), NULLIF(trim(p_client_name), ''),
     NULLIF(trim(p_app_version), ''), p_status, p_latency_ms,
     COALESCE(p_metadata, '{}'::jsonb), now(), now())
  ON CONFLICT (tenant_id, client_id) DO UPDATE SET
    client_name = EXCLUDED.client_name,
    app_version = EXCLUDED.app_version,
    status = EXCLUDED.status,
    latency_ms = EXCLUDED.latency_ms,
    metadata = EXCLUDED.metadata,
    last_seen = now(),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true, 'tenant_id', v_row.tenant_id, 'client_id', v_row.client_id,
    'status', v_row.status, 'last_seen', v_row.last_seen
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tech_record_client_heartbeat(uuid, text, text, text, text, integer, jsonb)
  TO authenticated, service_role;
