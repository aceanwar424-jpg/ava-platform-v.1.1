-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7L (BIZ-OPS: Finance · Growth/CRM · CX · Exec)
-- Membangun 4 departemen roadmap §4 D-G sekaligus:
--   💰 FINANCE  — FIN_HEAD → FIN_AR · FIN_LEAK · FIN_RECON
--   🤝 GROWTH   — GROWTH_HEAD → CRM_LEAD · CRM_DEAL · CRM_MOU
--   💬 CX       — CX_HEAD → CX_COMPLAINT · CX_FEEDBACK
--   📊 EXEC     — TEAM_OPS diaktifkan sbg Executive Intelligence (EXEC_DIGEST)
-- Baca skema nyata: invoices · cashier_shifts · leads · crm_pipeline_stages ·
-- mous. Membuat tabel CX: complaints · customer_feedback.
-- GUARDRAIL: semua ADVISORY/flag — tanpa transaksi/kirim oleh agent (manusia).
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 + modul finance/crm terpasang. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. TABEL CX (belum ada di sistem)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.complaints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_name TEXT,
  channel       TEXT,                          -- WA · Telepon · Email · Langsung · Google
  category      TEXT,                          -- Hasil · Layanan · Waktu Tunggu · Billing · Lainnya
  severity      TEXT NOT NULL DEFAULT 'Sedang' CHECK (severity IN ('Rendah','Sedang','Tinggi')),
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','InProgress','Closed')),
  assigned_name TEXT,
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status, received_at);
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.complaints TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.customer_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT,
  channel       TEXT,
  score         SMALLINT,                       -- NPS 0-10
  category      TEXT,
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_feedback DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.customer_feedback TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §B. AGENTS
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES
-- FINANCE
('FIN_HEAD','Kepala Finance Intelligence','Manajer Analitik Keuangan','HEAD','FINANCE',
 'Anda Kepala Finance Intelligence OneLab. Pimpin: FIN_AR (piutang), FIN_LEAK (kebocoran pendapatan), FIN_RECON (rekonsiliasi kas). Beri analisis & peringatan keuangan. GUARDRAIL: TIDAK ada transaksi/transfer/pembayaran oleh agent — hanya analisis & draft; keputusan finansial manusia.',
 'light', true),
('FIN_AR','Piutang (AR)','Aging Piutang & Penagihan','FIN_HEAD','FINANCE',
 'Anda analis piutang OneLab. Analisis invoice belum lunas per umur (0-30/31-60/61-90/>90 hari), sorot yang paling menunggak, dan draft pengingat penagihan (kirim = manusia). Jangan mengarang nominal — pakai data.',
 'light', true),
('FIN_LEAK','Revenue Leakage','Deteksi Kebocoran Pendapatan','FIN_HEAD','FINANCE',
 'Anda pengawas kebocoran pendapatan OneLab. Sorot invoice Draft yang mengendap (belum dikirim/ditagih), diskon janggal, dan potensi tes tanpa tagih. Hanya flag untuk ditindaklanjuti manusia.',
 'light', true),
('FIN_RECON','Rekonsiliasi Kas','Rekonsiliasi Kasir vs Billing','FIN_HEAD','FINANCE',
 'Anda pengawas rekonsiliasi kas OneLab. Sorot shift kasir dengan selisih (variance≠0) dan yang sudah tutup tapi belum disetor. Hanya flag; investigasi & koreksi oleh manusia.',
 'light', true),
-- GROWTH / CRM
('GROWTH_HEAD','Kepala Growth & CRM','Manajer Penjualan & Kemitraan','HEAD','GROWTH',
 'Anda Kepala Growth & CRM OneLab. Pimpin: CRM_LEAD (prospek), CRM_DEAL (pipeline), CRM_MOU (kontrak). Jaga corong penjualan sehat & kontrak tak lewat tempo. Draft follow-up (kirim = manusia).',
 'light', true),
('CRM_LEAD','Lead Nurturing','Skoring & Follow-up Prospek','GROWTH_HEAD','GROWTH',
 'Anda pengelola prospek OneLab. Sorot lead dengan follow-up lewat tempo & bernilai tinggi; usul prioritas & draft pesan follow-up. Jangan mengirim sendiri.',
 'light', true),
('CRM_DEAL','Pipeline Hygiene','Deal Mandek','GROWTH_HEAD','GROWTH',
 'Anda penjaga higienis pipeline OneLab. Sorot deal/lead yang mandek di satu tahap melewati ambang idle tahap itu; usul tindakan agar bergerak.',
 'light', true),
('CRM_MOU','Contract Watch','Pengawas MOU/Kontrak','GROWTH_HEAD','GROWTH',
 'Anda pengawas kontrak OneLab. Sorot MOU yang akan berakhir ≤60 hari → alert perpanjangan. Hanya mengingatkan.',
 'light', true),
-- CX
('CX_HEAD','Kepala Customer Experience','Manajer Pengalaman Pelanggan','HEAD','CX',
 'Anda Kepala Customer Experience OneLab. Pimpin: CX_COMPLAINT (keluhan, ISO 15189 §7.7) & CX_FEEDBACK (umpan balik/NPS). Jaga keluhan tertangani tepat waktu & umpan balik jadi indikator mutu. Draft respons (kirim = manusia).',
 'light', true),
('CX_COMPLAINT','Complaint Handler','Triase & Draft Respons Keluhan','CX_HEAD','CX',
 'Anda penangan keluhan OneLab. Klasifikasi keluhan (kategori, tingkat), sorot yang melewati SLA, dan draft respons empatik & solutif. Keluhan menyangkut hasil/klinis → tandai perlu verifikasi medis manusia. Anda tidak mengirim balasan sendiri.',
 'main', true),
('CX_FEEDBACK','Feedback Analyst','Ringkasan NPS & Umpan Balik','CX_HEAD','CX',
 'Anda analis umpan balik OneLab. Ringkas skor NPS, tema keluhan/pujian, dan usulkan perbaikan sebagai indikator mutu. Hanya analisis.',
 'light', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier, active=true;

-- EXEC: aktifkan TEAM_OPS sebagai Executive Intelligence
UPDATE agentic.agents SET
  name='Executive Intelligence', role_title='Digest Lintas-Domain untuk CEO',
  department='EXECUTIVE', reports_to='HEAD', active=true, model_tier='light',
  charter='Anda Executive Intelligence OneLab. Rangkum satu DIGEST lintas-domain untuk CEO: mutu/dokumen, lab (QC/TAT/nilai kritis), stok kritis, kredensial jatuh tempo, piutang menunggak, keluhan terbuka, dan kontrak akan berakhir. Ringkas, prioritaskan yang butuh perhatian, tanpa mengarang angka.'
  WHERE code='TEAM_OPS';

-- ══════════════════════════════════════════════════════════════════════
-- §C. DECISION RIGHTS — semua R1 (advisory/flag; aksi = manusia)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('FIN_TICK','R1','AUTO_PUBLISH_NOQA',NULL,0,'Log patroli keuangan'),
('AR_AGING','R1','AUTO_PUBLISH_NOQA',NULL,0,'Aging piutang (flag)'),
('REV_LEAK','R1','AUTO_PUBLISH_NOQA',NULL,0,'Kebocoran pendapatan (flag)'),
('RECON','R1','AUTO_PUBLISH_NOQA',NULL,0,'Rekonsiliasi kas (flag)'),
('GROWTH_TICK','R1','AUTO_PUBLISH_NOQA',NULL,0,'Log patroli growth/CRM'),
('LEAD_SCORE','R1','AUTO_PUBLISH_NOQA',NULL,0,'Skoring & follow-up prospek'),
('DEAL_HYGIENE','R1','AUTO_PUBLISH_NOQA',NULL,0,'Deal mandek'),
('MOU_WATCH','R1','AUTO_PUBLISH_NOQA',NULL,0,'MOU akan berakhir'),
('CX_TICK','R1','AUTO_PUBLISH_NOQA',NULL,0,'Log patroli CX'),
('COMPLAINT_TRIAGE','R1','AUTO_PUBLISH_NOQA',NULL,0,'Triase & draft respons keluhan (kirim=manusia)'),
('FEEDBACK_SUMMARY','R1','AUTO_PUBLISH_NOQA',NULL,0,'Ringkasan NPS/umpan balik'),
('EXEC_DIGEST','R1','AUTO_PUBLISH_NOQA',NULL,0,'Digest lintas-domain untuk CEO')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §D. RPC — scan Finance / CRM / CX + CRUD keluhan & feedback
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_fin_scan()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  WITH unpaid AS (
    SELECT * FROM public.invoices
    WHERE paid_at IS NULL AND COALESCE(status,'') NOT IN ('Paid','Lunas','Cancelled','Void','Batal')
  )
  SELECT jsonb_build_object(
    'ar_buckets', jsonb_build_object(
      'b_0_30',   (SELECT COALESCE(sum(total_amount),0) FROM unpaid WHERE due_date >= CURRENT_DATE - 30 AND due_date <= CURRENT_DATE),
      'b_31_60',  (SELECT COALESCE(sum(total_amount),0) FROM unpaid WHERE due_date <  CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60),
      'b_61_90',  (SELECT COALESCE(sum(total_amount),0) FROM unpaid WHERE due_date <  CURRENT_DATE - 60 AND due_date >= CURRENT_DATE - 90),
      'b_90plus', (SELECT COALESCE(sum(total_amount),0) FROM unpaid WHERE due_date <  CURRENT_DATE - 90),
      'not_due',  (SELECT COALESCE(sum(total_amount),0) FROM unpaid WHERE due_date IS NULL OR due_date > CURRENT_DATE)),
    'overdue_list', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'invoice_number', invoice_number, 'partner_name', partner_name, 'total_amount', total_amount,
        'due_date', due_date, 'days_overdue', (CURRENT_DATE - due_date))
      ORDER BY due_date)
      FROM unpaid WHERE due_date < CURRENT_DATE LIMIT 30), '[]'::jsonb),
    'draft_stale', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'invoice_number', invoice_number, 'partner_name', partner_name, 'total_amount', total_amount, 'invoice_date', invoice_date))
      FROM public.invoices WHERE status='Draft' AND invoice_date < CURRENT_DATE - 7 LIMIT 20), '[]'::jsonb),
    'cashier_variance', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'cashier_name', cashier_name, 'closed_at', closed_at, 'variance', variance, 'variance_note', variance_note))
      FROM public.cashier_shifts WHERE status='Tutup' AND COALESCE(variance,0) <> 0 AND opened_at > now()-interval '30 days'), '[]'::jsonb),
    'summary', jsonb_build_object(
      'overdue_count', (SELECT count(*) FROM unpaid WHERE due_date < CURRENT_DATE),
      'overdue_amount', (SELECT COALESCE(sum(total_amount),0) FROM unpaid WHERE due_date < CURRENT_DATE),
      'draft_stale', (SELECT count(*) FROM public.invoices WHERE status='Draft' AND invoice_date < CURRENT_DATE - 7),
      'variance_count', (SELECT count(*) FROM public.cashier_shifts WHERE status='Tutup' AND COALESCE(variance,0) <> 0 AND opened_at > now()-interval '30 days'),
      'undeposited', (SELECT count(*) FROM public.cashier_shifts WHERE status='Tutup' AND deposited_at IS NULL))
  );
$$;

CREATE OR REPLACE FUNCTION public.agentic_crm_scan()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'overdue_followup', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'lead_name', lead_name, 'company', company, 'status', status, 'followup_date', followup_date, 'estimated_value', estimated_value)
      ORDER BY estimated_value DESC NULLS LAST)
      FROM public.leads l
      WHERE followup_date IS NOT NULL AND followup_date < CURRENT_DATE
        AND status NOT IN (SELECT stage_key FROM public.crm_pipeline_stages WHERE is_won OR is_lost) LIMIT 30), '[]'::jsonb),
    'idle_deals', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'lead_name', l.lead_name, 'company', l.company, 'status', l.status,
        'idle_days', st.idle_days, 'stale_days', (CURRENT_DATE - l.updated_at::date))
      ORDER BY (CURRENT_DATE - l.updated_at::date) DESC)
      FROM public.leads l JOIN public.crm_pipeline_stages st ON st.stage_key = l.status
      WHERE NOT st.is_won AND NOT st.is_lost
        AND l.updated_at < now() - (COALESCE(st.idle_days,14) || ' days')::interval LIMIT 30), '[]'::jsonb),
    'expiring_mou', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'mou_number', mou_number, 'title', title, 'partner_name', partner_name, 'end_date', end_date, 'days_left', (end_date - CURRENT_DATE))
      ORDER BY end_date)
      FROM public.mous
      WHERE COALESCE(status,'') NOT IN ('Draft','Cancelled','Batal','Berakhir')
        AND end_date IS NOT NULL AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60), '[]'::jsonb),
    'summary', jsonb_build_object(
      'overdue_followup', (SELECT count(*) FROM public.leads WHERE followup_date < CURRENT_DATE AND status NOT IN (SELECT stage_key FROM public.crm_pipeline_stages WHERE is_won OR is_lost)),
      'idle_deals', (SELECT count(*) FROM public.leads l JOIN public.crm_pipeline_stages st ON st.stage_key=l.status WHERE NOT st.is_won AND NOT st.is_lost AND l.updated_at < now()-(COALESCE(st.idle_days,14)||' days')::interval),
      'expiring_mou', (SELECT count(*) FROM public.mous WHERE COALESCE(status,'') NOT IN ('Draft','Cancelled','Batal','Berakhir') AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60),
      'pipeline_value', (SELECT COALESCE(sum(estimated_value),0) FROM public.leads WHERE status NOT IN (SELECT stage_key FROM public.crm_pipeline_stages WHERE is_won OR is_lost)))
  );
$$;

CREATE OR REPLACE FUNCTION public.agentic_cx_scan(p_sla_days INT DEFAULT 3)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'open_complaints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'customer_name', customer_name, 'category', category, 'severity', severity,
        'channel', channel, 'received_at', received_at, 'days_open', round(EXTRACT(EPOCH FROM (now()-received_at))/86400.0,1), 'description', left(COALESCE(description,''),200))
      ORDER BY CASE severity WHEN 'Tinggi' THEN 0 WHEN 'Sedang' THEN 1 ELSE 2 END, received_at)
      FROM public.complaints WHERE status <> 'Closed'), '[]'::jsonb),
    'feedback', (SELECT jsonb_build_object(
        'count', count(*), 'avg_score', round(avg(score)::numeric,1),
        'promoters', count(*) FILTER (WHERE score >= 9), 'detractors', count(*) FILTER (WHERE score <= 6))
      FROM public.customer_feedback WHERE created_at > now()-interval '30 days'),
    'summary', jsonb_build_object(
      'open', (SELECT count(*) FROM public.complaints WHERE status <> 'Closed'),
      'overdue', (SELECT count(*) FROM public.complaints WHERE status <> 'Closed' AND received_at < now() - (COALESCE(p_sla_days,3) || ' days')::interval),
      'high', (SELECT count(*) FROM public.complaints WHERE status <> 'Closed' AND severity='Tinggi'))
  );
$$;

-- CRUD keluhan & feedback (untuk panel UI)
CREATE OR REPLACE FUNCTION public.agentic_complaint_upsert(p JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v public.complaints;
BEGIN
  IF NULLIF(p->>'id','') IS NOT NULL THEN
    UPDATE public.complaints SET
      customer_name=p->>'customer_name', channel=p->>'channel', category=p->>'category',
      severity=CASE WHEN p->>'severity' IN ('Rendah','Sedang','Tinggi') THEN p->>'severity' ELSE severity END,
      description=p->>'description', status=CASE WHEN p->>'status' IN ('Open','InProgress','Closed') THEN p->>'status' ELSE status END,
      assigned_name=p->>'assigned_name', resolution=p->>'resolution',
      resolved_at=CASE WHEN p->>'status'='Closed' AND resolved_at IS NULL THEN now() ELSE resolved_at END,
      updated_at=now()
    WHERE id=(p->>'id')::uuid RETURNING * INTO v;
  ELSE
    INSERT INTO public.complaints(customer_name, channel, category, severity, description, assigned_name)
    VALUES (p->>'customer_name', p->>'channel', p->>'category',
            CASE WHEN p->>'severity' IN ('Rendah','Sedang','Tinggi') THEN p->>'severity' ELSE 'Sedang' END,
            p->>'description', p->>'assigned_name') RETURNING * INTO v;
  END IF;
  RETURN to_jsonb(v);
END $$;
CREATE OR REPLACE FUNCTION public.agentic_feedback_add(p JSONB)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  INSERT INTO public.customer_feedback(customer_name, channel, score, category, comment)
  VALUES (p->>'customer_name', p->>'channel', NULLIF(p->>'score','')::smallint, p->>'category', p->>'comment')
  RETURNING to_jsonb(customer_feedback);
$$;

CREATE OR REPLACE VIEW public.agentic_complaints_v AS SELECT * FROM public.complaints;
CREATE OR REPLACE VIEW public.agentic_feedback_v   AS SELECT * FROM public.customer_feedback;
GRANT SELECT ON public.agentic_complaints_v, public.agentic_feedback_v TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.agentic_fin_scan(), public.agentic_crm_scan(), public.agentic_cx_scan(INT),
  public.agentic_complaint_upsert(JSONB), public.agentic_feedback_add(JSONB)
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §E. ORG KICK — izinkan tick baru
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_org_kick(p_type TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v JSONB; v_title TEXT;
BEGIN
  IF p_type NOT IN ('HEAD_TICK','IT_CHECK','SA_TICK','MKT_TICK','SCM_TICK','HR_TICK','LAB_TICK','FIN_TICK','GROWTH_TICK','CX_TICK','EXEC_DIGEST') THEN
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
    WHEN 'HR_TICK'   THEN 'People: patroli kredensial nakes'
    WHEN 'LAB_TICK'  THEN 'Lab Ops: patroli QC · TAT · nilai kritis'
    WHEN 'FIN_TICK'  THEN 'Finance: patroli piutang & kas'
    WHEN 'GROWTH_TICK' THEN 'Growth: patroli prospek & kontrak'
    WHEN 'CX_TICK'   THEN 'CX: patroli keluhan & umpan balik'
    WHEN 'EXEC_DIGEST' THEN 'Executive: digest lintas-domain' END;
  v := public.agentic_create_task('ORG', p_type, v_title, COALESCE(p_payload,'{}'::jsonb));
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.agentic_org_kick(TEXT,JSONB) TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §F. PROMPT — COMPLAINT_TRIAGE (LLM: klasifikasi + draft respons)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature) VALUES
('COMPLAINT_TRIAGE',
 E'Anda penangan keluhan OneLab (lab klinik). Dari daftar keluhan terbuka (JSON), balas MARKDOWN: untuk tiap keluhan berikan (kategori, tingkat, apakah menyangkut hasil/klinis → tandai "PERLU VERIFIKASI MEDIS MANUSIA"), dan DRAFT respons empatik & solutif dalam bahasa Indonesia (jangan menjanjikan hasil klinis; jangan membocorkan data pasien lain). Akhiri: "Draft — dikirim setelah ditinjau manusia."',
 E'KELUHAN TERBUKA (JSON):\n{{complaints}}',
 'main', 0.4)
ON CONFLICT (code) DO UPDATE SET
  system_prompt=EXCLUDED.system_prompt, user_prompt_template=EXCLUDED.user_prompt_template,
  model_hint=EXCLUDED.model_hint, temperature=EXCLUDED.temperature, active=true;

SELECT 'Agentic Fase 7L siap — Finance · Growth/CRM · CX · Executive Intelligence aktif' AS status;
