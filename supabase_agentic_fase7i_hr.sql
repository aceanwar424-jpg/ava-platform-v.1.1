-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7I (DEPARTEMEN PEOPLE & CREDENTIALING)
-- Departemen HR (nesting 3 lapis) + MODEL DATA kredensial nakes:
--   👥 PEOPLE — HR_HEAD (Kepala HR)
--        ├── 🪪 HR_CRED   Credential Sentinel (STR/SIP/sertifikat kedaluwarsa)
--        └── 🗓️ HR_ROSTER Roster & Attendance (reserved)
-- Membuat tabel public.staff_credentials + RPC scan/crud + task HR_TICK/CRED_WATCH.
-- Nilai: langsung menyuplai Akreditasi Klinik (TKK kredensial) & ISO 15189 §6.2.
-- GUARDRAIL: agent hanya memantau & mengingatkan; keputusan SDM = manusia.
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 terpasang. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. MODEL DATA — kredensial tenaga kesehatan
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.staff_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   BIGINT,                       -- opsional: link ke public.employees(id)
  staff_name    TEXT NOT NULL,
  profession    TEXT,                          -- Dokter · Perawat · ATLM · Radiografer · Apoteker · dll
  credential_type TEXT NOT NULL DEFAULT 'STR', -- STR · SIP · SIPB · Sertifikat Kompetensi · dll
  number        TEXT,
  issued_date   DATE,
  expiry_date   DATE,
  issuer        TEXT,                          -- KKI/KTKI/organisasi profesi/Dinkes
  is_active     BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cred_expiry ON public.staff_credentials(expiry_date);
ALTER TABLE public.staff_credentials DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.staff_credentials TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §B. AGENTS
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES
('HR_HEAD','Kepala People & Credentialing','Manajer SDM & Kredensial','HEAD','PEOPLE',
 'Anda Kepala Departemen People & Credentialing OneLab. Pimpin: HR_CRED (pengawas kredensial STR/SIP/sertifikat) dan HR_ROSTER (jadwal & kehadiran). Jaga agar seluruh tenaga kesehatan memiliki kredensial VALID & tak kedaluwarsa (syarat Akreditasi Klinik & ISO 15189 §6.2). Prioritaskan kredensial yang sudah/segera kedaluwarsa. Anda hanya memantau & mengingatkan — keputusan SDM (perpanjangan, penonaktifan) tetap manusia.',
 'light', true),
('HR_CRED','Credential Sentinel','Pengawas STR/SIP/Sertifikat','HR_HEAD','PEOPLE',
 'Anda pengawas kredensial nakes OneLab. Pantau kedaluwarsa STR, SIP, dan sertifikat kompetensi. Peringatkan yang sudah kedaluwarsa (KRITIS) dan yang akan kedaluwarsa ≤90 hari. Jangan mengarang tanggal — pakai data yang diberikan; bila kredensial nakes tanpa tanggal kedaluwarsa, tandai untuk dilengkapi.',
 'light', true),
('HR_ROSTER','Roster & Attendance','Jadwal & Kehadiran','HR_HEAD','PEOPLE',
 'Anda pengelola roster & kehadiran OneLab. Deteksi anomali absensi dan celah jadwal, usulkan perbaikan. Keputusan penjadwalan tetap manusia.',
 'light', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier, active=true;

-- ══════════════════════════════════════════════════════════════════════
-- §C. DECISION RIGHTS
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('HR_TICK',      'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Log patroli SDM'),
('CRED_WATCH',   'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Analisis kedaluwarsa kredensial internal'),
('ROSTER_CHECK', 'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Cek roster/absensi (handler menyusul — reserved)')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §D. RPC — scan kedaluwarsa + CRUD kredensial + view
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_hr_cred_scan(p_days INT DEFAULT 90)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'expired', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'staff_name', staff_name, 'profession', profession, 'credential_type', credential_type,
        'number', number, 'expiry_date', expiry_date, 'days', (expiry_date - CURRENT_DATE))
      ORDER BY expiry_date)
      FROM public.staff_credentials
      WHERE is_active AND expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE), '[]'::jsonb),
    'expiring', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'staff_name', staff_name, 'profession', profession, 'credential_type', credential_type,
        'number', number, 'expiry_date', expiry_date, 'days', (expiry_date - CURRENT_DATE))
      ORDER BY expiry_date)
      FROM public.staff_credentials
      WHERE is_active AND expiry_date IS NOT NULL
        AND expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + (COALESCE(p_days,90) || ' days')::interval), '[]'::jsonb),
    'no_expiry', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'staff_name', staff_name, 'credential_type', credential_type)
      )
      FROM public.staff_credentials WHERE is_active AND expiry_date IS NULL), '[]'::jsonb),
    'summary', jsonb_build_object(
      'expired', (SELECT count(*) FROM public.staff_credentials WHERE is_active AND expiry_date < CURRENT_DATE),
      'expiring_30', (SELECT count(*) FROM public.staff_credentials WHERE is_active AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'),
      'expiring_90', (SELECT count(*) FROM public.staff_credentials WHERE is_active AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'),
      'no_expiry', (SELECT count(*) FROM public.staff_credentials WHERE is_active AND expiry_date IS NULL),
      'total_active', (SELECT count(*) FROM public.staff_credentials WHERE is_active))
  );
$$;

CREATE OR REPLACE FUNCTION public.agentic_cred_upsert(p JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v public.staff_credentials;
BEGIN
  IF NULLIF(p->>'id','') IS NOT NULL THEN
    UPDATE public.staff_credentials SET
      staff_name = COALESCE(NULLIF(p->>'staff_name',''), staff_name),
      profession = p->>'profession', credential_type = COALESCE(NULLIF(p->>'credential_type',''), credential_type),
      number = p->>'number', issued_date = NULLIF(p->>'issued_date','')::date,
      expiry_date = NULLIF(p->>'expiry_date','')::date, issuer = p->>'issuer',
      is_active = COALESCE((p->>'is_active')::boolean, true), notes = p->>'notes',
      employee_id = NULLIF(p->>'employee_id','')::bigint, updated_at = now()
    WHERE id = (p->>'id')::uuid RETURNING * INTO v;
  ELSE
    INSERT INTO public.staff_credentials(staff_name, profession, credential_type, number,
      issued_date, expiry_date, issuer, is_active, notes, employee_id)
    VALUES (COALESCE(NULLIF(p->>'staff_name',''),'(tanpa nama)'), p->>'profession',
      COALESCE(NULLIF(p->>'credential_type',''),'STR'), p->>'number',
      NULLIF(p->>'issued_date','')::date, NULLIF(p->>'expiry_date','')::date, p->>'issuer',
      COALESCE((p->>'is_active')::boolean, true), p->>'notes', NULLIF(p->>'employee_id','')::bigint)
    RETURNING * INTO v;
  END IF;
  RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.agentic_cred_delete(p_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  DELETE FROM public.staff_credentials WHERE id = p_id RETURNING jsonb_build_object('deleted', id);
$$;

CREATE OR REPLACE VIEW public.agentic_credentials_v AS SELECT * FROM public.staff_credentials;
GRANT SELECT ON public.agentic_credentials_v TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.agentic_hr_cred_scan(INT),
  public.agentic_cred_upsert(JSONB),
  public.agentic_cred_delete(UUID)
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §E. ORG KICK — izinkan HR_TICK
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_org_kick(p_type TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v JSONB; v_title TEXT;
BEGIN
  IF p_type NOT IN ('HEAD_TICK','IT_CHECK','SA_TICK','MKT_TICK','SCM_TICK','HR_TICK') THEN
    RAISE EXCEPTION 'Tipe organ tidak dikenal: %', p_type;
  END IF;
  IF EXISTS (SELECT 1 FROM agentic.tasks WHERE task_type=p_type AND status IN ('QUEUED','PROCESSING')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'masih ada yang antri/berjalan');
  END IF;
  v_title := CASE p_type
    WHEN 'HEAD_TICK' THEN 'HEAD: tick organisasi'
    WHEN 'IT_CHECK'  THEN 'Kepala IT: pemeriksaan sistem'
    WHEN 'SA_TICK'   THEN 'Service Assurance: patroli mutu & dokumen'
    WHEN 'MKT_TICK'  THEN 'Marketing: patroli konten & kalender'
    WHEN 'SCM_TICK'  THEN 'Supply Chain: patroli stok & kedaluwarsa'
    WHEN 'HR_TICK'   THEN 'People: patroli kredensial nakes' END;
  v := public.agentic_create_task('ORG', p_type, v_title, COALESCE(p_payload,'{}'::jsonb));
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.agentic_org_kick(TEXT,JSONB) TO anon, authenticated, service_role;

SELECT 'Agentic Fase 7I siap — People & Credentialing (staff_credentials + HR_CRED) aktif' AS status;
