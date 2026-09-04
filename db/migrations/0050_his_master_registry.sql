-- ══════════════════════════════════════════════════════════════════
-- 0050 — REGISTRY MASTER HIS MULTI-TENANT
--
-- Kontrak CRUD bersama untuk 20 master HIS. Migrasi ini idempoten dan hanya
-- disiapkan untuk staging: jangan diterapkan pada produksi tanpa preflight,
-- backup, rollback, serta UAT pemilik proses.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.his_master_domains (
  domain_key text PRIMARY KEY,
  display_name text NOT NULL,
  config_group text NOT NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.his_master_domains
  (domain_key, display_name, config_group, requires_approval)
VALUES
  ('branch', 'Cabang / Plant', 'Fasilitas & Sumber Daya', true),
  ('unit_room', 'Unit, Ruang & Kelas Layanan', 'Fasilitas & Sumber Daya', true),
  ('equipment', 'Peralatan & Modalitas', 'Fasilitas & Sumber Daya', true),
  ('service_capacity', 'Kelas & Kapasitas Layanan', 'Fasilitas & Sumber Daya', true),
  ('specialty', 'Spesialisasi Praktisi', 'Master Klinis & SDM', false),
  ('practitioner_fee', 'Jasa Praktisi & Fee Rujukan', 'Master Klinis & SDM', true),
  ('patient_reference', 'Penjamin, Kondisi & Alergi Pasien', 'Master Klinis & SDM', false),
  ('diagnosis_reference', 'Referensi Diagnosis & Prosedur', 'Master Klinis & SDM', true),
  ('mcu_parameter', 'Parameter & Hasil MCU', 'Master Klinis & SDM', true),
  ('mcu_threshold', 'Ambang Audiometri, Spirometri & Visus', 'Master Klinis & SDM', true),
  ('medicine_reference', 'Kategori, Bentuk & Aturan Obat', 'Master Klinis & SDM', true),
  ('corporate_contract', 'Kontrak & Benefit Korporat', 'Korporat, Keuangan & Promo', true),
  ('job_master', 'Level & Posisi Jabatan', 'Korporat, Keuangan & Promo', false),
  ('bank_edc', 'Bank & Terminal EDC', 'Korporat, Keuangan & Promo', true),
  ('payment_mapping', 'Mapping Pembayaran ke Akun', 'Korporat, Keuangan & Promo', true),
  ('promotion', 'Deal, Voucher & Diskon', 'Korporat, Keuangan & Promo', true),
  ('queue_flow', 'Flow, Display & Outlet Antrean', 'Antrean & Integrasi', true),
  ('queue_device', 'Registry Kiosk & Display', 'Antrean & Integrasi', true),
  ('telemedicine', 'Setup Telemedicine', 'Antrean & Integrasi', true),
  ('satusehat_setup', 'SATUSEHAT Setup & Status', 'Antrean & Integrasi', true)
ON CONFLICT (domain_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  config_group = EXCLUDED.config_group,
  requires_approval = EXCLUDED.requires_approval;

CREATE TABLE IF NOT EXISTS public.his_master_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id()
    REFERENCES public.tenants(id),
  domain_key text NOT NULL REFERENCES public.his_master_domains(domain_key),
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  effective_from date,
  effective_to date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  archived_at timestamptz,
  archived_by uuid,
  CONSTRAINT his_master_records_effective_period
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  CONSTRAINT his_master_records_code_format
    CHECK (code ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$'),
  CONSTRAINT his_master_records_payload_object
    CHECK (jsonb_typeof(payload) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_his_master_record_current_code
  ON public.his_master_records (tenant_id, domain_key, upper(code))
  WHERE status <> 'archived';

CREATE INDEX IF NOT EXISTS idx_his_master_records_tenant_domain_status
  ON public.his_master_records (tenant_id, domain_key, status, name);

CREATE TABLE IF NOT EXISTS public.his_master_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  record_id bigint NOT NULL REFERENCES public.his_master_records(id),
  domain_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'archive', 'activate')),
  actor_user_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_his_master_audit_record
  ON public.his_master_audit (tenant_id, record_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.his_master_protect_audit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Jejak audit master bersifat append-only';
END $$;

DROP TRIGGER IF EXISTS trg_his_master_protect_audit ON public.his_master_audit;
CREATE TRIGGER trg_his_master_protect_audit
  BEFORE UPDATE OR DELETE ON public.his_master_audit
  FOR EACH ROW EXECUTE FUNCTION public.his_master_protect_audit();

ALTER TABLE public.his_master_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.his_master_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.his_master_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS his_master_domains_read ON public.his_master_domains;
CREATE POLICY his_master_domains_read ON public.his_master_domains
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS his_master_records_tenant_read ON public.his_master_records;
CREATE POLICY his_master_records_tenant_read ON public.his_master_records
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS his_master_audit_tenant_read ON public.his_master_audit;
CREATE POLICY his_master_audit_tenant_read ON public.his_master_audit
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

REVOKE INSERT, UPDATE, DELETE ON public.his_master_records FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.his_master_audit FROM anon, authenticated;
REVOKE ALL ON public.his_master_domains FROM anon;
REVOKE ALL ON public.his_master_records FROM anon;
REVOKE ALL ON public.his_master_audit FROM anon;
GRANT SELECT ON public.his_master_domains, public.his_master_records, public.his_master_audit
  TO authenticated;

-- Hak tulis master dipersempit ke peran administrasi yang sudah dipakai
-- aplikasi. Integrasi server memakai service_role dan tetap diaudit.
CREATE OR REPLACE FUNCTION public.his_master_assert_editor()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login diperlukan untuk mengubah master'; END IF;
  SELECT lower(coalesce(role, '')) INTO v_role
  FROM public.user_profiles
  WHERE id = auth.uid() AND tenant_id = public.current_tenant_id();

  IF coalesce(v_role, '') NOT IN
      ('super_admin', 'superadmin', 'head_operation', 'direktur',
       'master_super_admin', 'master super admin', 'super admin',
       'hq_executive', 'admin', 'admin_faskes', 'finance_controller',
       'clinical_governance', 'integration_admin', 'owner') THEN
    RAISE EXCEPTION 'Peran aktif tidak berwenang mengubah konfigurasi master';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.his_master_upsert_record(
  p_id bigint DEFAULT NULL,
  p_domain_key text DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_status text DEFAULT 'draft',
  p_effective_from date DEFAULT NULL,
  p_effective_to date DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT NULL
)
RETURNS public.his_master_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_old public.his_master_records%ROWTYPE;
  v_new public.his_master_records%ROWTYPE;
  v_domain public.his_master_domains%ROWTYPE;
  v_actor uuid := auth.uid();
  v_rate integer;
  v_services text[];
BEGIN
  PERFORM public.his_master_assert_editor();

  SELECT * INTO v_domain FROM public.his_master_domains
   WHERE domain_key = trim(coalesce(p_domain_key, ''));
  IF NOT FOUND THEN RAISE EXCEPTION 'Domain master tidak dikenal'; END IF;
  IF trim(coalesce(p_code, '')) !~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$' THEN
    RAISE EXCEPTION 'Kode master wajib alfanumerik dan boleh memakai . _ / -';
  END IF;
  IF length(trim(coalesce(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Nama master wajib diisi minimal 2 karakter';
  END IF;
  IF p_status NOT IN ('draft', 'active', 'inactive', 'archived') THEN
    RAISE EXCEPTION 'Status master tidak valid';
  END IF;
  IF p_status = 'archived' THEN
    RAISE EXCEPTION 'Gunakan aksi arsip agar jejak audit lengkap';
  END IF;
  IF jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Payload master harus berupa object';
  END IF;
  IF v_domain.requires_approval AND trim(coalesce(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Alasan perubahan wajib diisi untuk master ini';
  END IF;
  IF p_effective_to IS NOT NULL AND p_effective_from IS NOT NULL
     AND p_effective_to < p_effective_from THEN
    RAISE EXCEPTION 'Tanggal akhir tidak boleh sebelum tanggal mulai';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.his_master_records
      (tenant_id, domain_key, code, name, status, effective_from, effective_to,
       payload, created_by, updated_by)
    VALUES
      (v_tenant, v_domain.domain_key,
       CASE WHEN v_domain.domain_key = 'queue_device' THEN lower(trim(p_code)) ELSE upper(trim(p_code)) END,
       trim(p_name), p_status,
       p_effective_from, p_effective_to, coalesce(p_payload, '{}'::jsonb), v_actor, v_actor)
    RETURNING * INTO v_new;

    INSERT INTO public.his_master_audit
      (tenant_id, record_id, domain_key, action, actor_user_id, reason, after_data)
    VALUES (v_tenant, v_new.id, v_new.domain_key, 'create', v_actor,
            nullif(trim(coalesce(p_reason, '')), ''), to_jsonb(v_new));
  ELSE
    SELECT * INTO v_old FROM public.his_master_records
     WHERE id = p_id AND tenant_id = v_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Master tidak ditemukan pada tenant aktif'; END IF;
    IF v_old.status = 'archived' THEN RAISE EXCEPTION 'Master terarsip tidak dapat diedit'; END IF;
    IF v_old.domain_key <> v_domain.domain_key THEN
      RAISE EXCEPTION 'Domain master tidak dapat diubah';
    END IF;
    UPDATE public.his_master_records SET
      code = CASE WHEN v_domain.domain_key = 'queue_device' THEN lower(trim(p_code)) ELSE upper(trim(p_code)) END,
      name = trim(p_name), status = p_status,
      effective_from = p_effective_from, effective_to = p_effective_to,
      payload = coalesce(p_payload, '{}'::jsonb), version = version + 1,
      updated_at = now(), updated_by = v_actor
    WHERE id = v_old.id AND tenant_id = v_tenant
    RETURNING * INTO v_new;

    INSERT INTO public.his_master_audit
      (tenant_id, record_id, domain_key, action, actor_user_id, reason, before_data, after_data)
    VALUES (v_tenant, v_new.id, v_new.domain_key,
            CASE WHEN v_new.status = 'active' AND v_old.status <> 'active' THEN 'activate' ELSE 'update' END,
            v_actor, nullif(trim(coalesce(p_reason, '')), ''), to_jsonb(v_old), to_jsonb(v_new));
  END IF;

  -- Domain perangkat antrean memakai tabel publik yang sebenarnya agar Edge
  -- Function kiosk/display membaca registry sama dengan UI Configuration.
  IF v_new.domain_key = 'queue_device' THEN
    IF p_payload ? 'allowed_services'
       AND jsonb_typeof(p_payload->'allowed_services') <> 'array' THEN
      RAISE EXCEPTION 'Layanan perangkat antrean harus berupa daftar';
    END IF;
    IF coalesce(p_payload->>'max_issues_per_minute', '') !~ '^[0-9]+$' THEN
      v_rate := 6;
    ELSE
      v_rate := (p_payload->>'max_issues_per_minute')::integer;
    END IF;
    IF v_rate NOT BETWEEN 1 AND 60 THEN
      RAISE EXCEPTION 'Batas penerbitan perangkat harus 1 sampai 60 per menit';
    END IF;
    SELECT coalesce(array_agg(value), '{}') INTO v_services
    FROM jsonb_array_elements_text(coalesce(p_payload->'allowed_services', '[]'::jsonb)) AS service(value)
    WHERE trim(value) <> '';
    IF EXISTS (
      SELECT 1 FROM public.queue_public_devices
       WHERE device_id = v_new.code AND tenant_id <> v_tenant
    ) THEN
      RAISE EXCEPTION 'Device ID sudah dipakai tenant lain; pilih ID publik yang unik';
    END IF;
    INSERT INTO public.queue_public_devices
      (device_id, tenant_id, display_name, kiosk_origin, display_origin,
       allowed_services, max_issues_per_minute, is_active, updated_at)
    VALUES (
      v_new.code, v_tenant, v_new.name,
      nullif(v_new.payload->>'kiosk_origin', ''),
      nullif(v_new.payload->>'display_origin', ''),
      v_services,
      v_rate,
      v_new.status = 'active', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      display_name = EXCLUDED.display_name,
      kiosk_origin = EXCLUDED.kiosk_origin,
      display_origin = EXCLUDED.display_origin,
      allowed_services = EXCLUDED.allowed_services,
      max_issues_per_minute = EXCLUDED.max_issues_per_minute,
      is_active = EXCLUDED.is_active,
      updated_at = now();
  END IF;

  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.his_master_archive_record(
  p_id bigint, p_reason text
)
RETURNS public.his_master_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_old public.his_master_records%ROWTYPE;
  v_new public.his_master_records%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  PERFORM public.his_master_assert_editor();
  IF trim(coalesce(p_reason, '')) = '' THEN RAISE EXCEPTION 'Alasan arsip wajib diisi'; END IF;
  SELECT * INTO v_old FROM public.his_master_records
   WHERE id = p_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master tidak ditemukan pada tenant aktif'; END IF;

  UPDATE public.his_master_records SET
    status = 'archived', archived_at = now(), archived_by = v_actor,
    updated_at = now(), updated_by = v_actor, version = version + 1
  WHERE id = p_id AND tenant_id = v_tenant
  RETURNING * INTO v_new;

  IF v_new.domain_key = 'queue_device' THEN
    UPDATE public.queue_public_devices SET is_active = false, updated_at = now()
     WHERE device_id = v_new.code AND tenant_id = v_tenant;
  END IF;

  INSERT INTO public.his_master_audit
    (tenant_id, record_id, domain_key, action, actor_user_id, reason, before_data, after_data)
  VALUES (v_tenant, v_new.id, v_new.domain_key, 'archive', v_actor,
          trim(p_reason), to_jsonb(v_old), to_jsonb(v_new));
  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION public.his_master_assert_editor() FROM public;
REVOKE ALL ON FUNCTION public.his_master_upsert_record(bigint, text, text, text, text, date, date, jsonb, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.his_master_archive_record(bigint, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.his_master_upsert_record(bigint, text, text, text, text, date, date, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.his_master_archive_record(bigint, text) TO authenticated;

COMMENT ON TABLE public.his_master_records IS
  'Registry master multi-tenant HIS. Payload menyimpan field domain; transaksi menyimpan snapshot saat dipakai.';
COMMENT ON TABLE public.his_master_audit IS
  'Jejak append-only perubahan registry master HIS.';
