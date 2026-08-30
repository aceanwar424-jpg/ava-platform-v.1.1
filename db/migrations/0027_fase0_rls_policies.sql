-- ═══════════════════════════════════════════════════════════════
-- 0027 — FONDASI FASE 0: ROW LEVEL SECURITY (RLS) & ISOLASI DATA KLINIS K4
-- Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 20, ADR-07, ADR-08
-- ═══════════════════════════════════════════════════════════════

-- 1. Aktifkan RLS pada Tabel Kunci
ALTER TABLE public.mpi_person ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_identifier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_event_outbox ENABLE ROW LEVEL SECURITY;

-- 2. Kebijakan Isolasi Tenancy (ADR-08)
-- Pengguna hanya dapat membaca dan menulis data pada tenant aktifnya

DROP POLICY IF EXISTS tenant_isolation_mpi_person ON public.mpi_person;
CREATE POLICY tenant_isolation_mpi_person ON public.mpi_person
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_person_identifier ON public.person_identifier;
CREATE POLICY tenant_isolation_person_identifier ON public.person_identifier
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_person_consent ON public.person_consent;
CREATE POLICY tenant_isolation_person_consent ON public.person_consent
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_sys_event ON public.sys_event_outbox;
CREATE POLICY tenant_isolation_sys_event ON public.sys_event_outbox
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. Kebijakan Kepatuhan Audit (Hanya izinkan INSERT dan SELECT, tolak UPDATE/DELETE)
ALTER TABLE public.sys_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_insert_policy ON public.sys_audit_log;
CREATE POLICY audit_insert_policy ON public.sys_audit_log
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS audit_select_policy ON public.sys_audit_log;
CREATE POLICY audit_select_policy ON public.sys_audit_log
  FOR SELECT USING (tenant_id = public.current_tenant_id());
