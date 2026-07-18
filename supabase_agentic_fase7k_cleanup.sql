-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7K (CLEAR-UP: task "reserved" → aktif)
-- Menuntaskan task type yang punya matriks tapi belum ada handler:
--   SA:        MASTER_LIST · DOC_DISTRIBUTE · DOC_OBSOLETE
--   Marketing: PLAN_CAMPAIGN
--   People:    ROSTER_CHECK
-- Serta MENGHAPUS IT_BACKUP_CHECK (usang — digantikan BACKUP_VERIFY 7G).
-- Menambah RPC data + prompt + memperbaiki mandat DOC_OBSOLETE (R2→R1 agar
-- tidak macet di DRAFT tanpa QA).
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 + 7G/H/I/J. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ── Hapus task usang & perbaiki mandat bermasalah ────────────────────
DELETE FROM agentic.decision_rights WHERE task_type = 'IT_BACKUP_CHECK';
UPDATE agentic.decision_rights
  SET risk_class='R1', auto_action='AUTO_PUBLISH_NOQA', qa_agent=NULL,
      note='Rekomendasi dokumen kedaluwarsa/obsolete (aksi = manusia)'
  WHERE task_type = 'DOC_OBSOLETE';

-- ══════════════════════════════════════════════════════════════════════
-- §A. RPC — admin dokumen (master list / distribusi / obsolete)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_doc_admin(p_recent_days INT DEFAULT 14)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'published', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'doc_number', doc_number, 'title', title, 'doc_type', doc_type, 'doc_level', doc_level,
        'department', department, 'revision', current_revision,
        'effective_date', effective_date, 'next_review_date', next_review_date)
      ORDER BY department, doc_type, doc_number)
      FROM agentic.document_registry WHERE status='PUBLISHED'), '[]'::jsonb),
    'recent_published', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'doc_number', doc_number, 'title', title, 'department', department, 'effective_date', effective_date)
      ORDER BY effective_date DESC)
      FROM agentic.document_registry
      WHERE status='PUBLISHED' AND effective_date >= CURRENT_DATE - (COALESCE(p_recent_days,14) || ' days')::interval), '[]'::jsonb),
    'overdue_review', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'doc_number', doc_number, 'title', title, 'department', department,
        'next_review_date', next_review_date, 'days_overdue', (CURRENT_DATE - next_review_date))
      ORDER BY next_review_date)
      FROM agentic.document_registry
      WHERE status IN ('PUBLISHED','DUE_FOR_REVIEW') AND next_review_date IS NOT NULL AND next_review_date < CURRENT_DATE), '[]'::jsonb),
    'summary', jsonb_build_object(
      'published', (SELECT count(*) FROM agentic.document_registry WHERE status='PUBLISHED'),
      'recent', (SELECT count(*) FROM agentic.document_registry WHERE status='PUBLISHED' AND effective_date >= CURRENT_DATE - (COALESCE(p_recent_days,14) || ' days')::interval),
      'overdue', (SELECT count(*) FROM agentic.document_registry WHERE status IN ('PUBLISHED','DUE_FOR_REVIEW') AND next_review_date IS NOT NULL AND next_review_date < CURRENT_DATE),
      'obsolete', (SELECT count(*) FROM agentic.document_registry WHERE status='OBSOLETE'))
  );
$$;

-- ══════════════════════════════════════════════════════════════════════
-- §B. RPC — anomali roster/absensi (baca public.attendance)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_roster_scan(p_days INT DEFAULT 14)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'alpa', COALESCE((SELECT jsonb_agg(jsonb_build_object('employee_name', employee_name, 'tanggal', tanggal) ORDER BY tanggal DESC)
      FROM public.attendance
      WHERE COALESCE(leave_type,'') ILIKE 'alpa' AND tanggal >= CURRENT_DATE - (COALESCE(p_days,14) || ' days')::interval), '[]'::jsonb),
    'no_clockout', COALESCE((SELECT jsonb_agg(jsonb_build_object('employee_name', employee_name, 'tanggal', tanggal) ORDER BY tanggal DESC)
      FROM public.attendance
      WHERE clock_in_at IS NOT NULL AND clock_out_at IS NULL AND tanggal < CURRENT_DATE
        AND tanggal >= CURRENT_DATE - (COALESCE(p_days,14) || ' days')::interval), '[]'::jsonb),
    'very_late', COALESCE((SELECT jsonb_agg(jsonb_build_object('employee_name', employee_name, 'tanggal', tanggal) ORDER BY tanggal DESC)
      FROM public.attendance
      WHERE clock_in_status = 'VeryLate' AND tanggal >= CURRENT_DATE - (COALESCE(p_days,14) || ' days')::interval), '[]'::jsonb),
    'summary', jsonb_build_object(
      'alpa', (SELECT count(*) FROM public.attendance WHERE COALESCE(leave_type,'') ILIKE 'alpa' AND tanggal >= CURRENT_DATE - (COALESCE(p_days,14) || ' days')::interval),
      'no_clockout', (SELECT count(*) FROM public.attendance WHERE clock_in_at IS NOT NULL AND clock_out_at IS NULL AND tanggal < CURRENT_DATE AND tanggal >= CURRENT_DATE - (COALESCE(p_days,14) || ' days')::interval),
      'very_late', (SELECT count(*) FROM public.attendance WHERE clock_in_status='VeryLate' AND tanggal >= CURRENT_DATE - (COALESCE(p_days,14) || ' days')::interval),
      'late', (SELECT count(*) FROM public.attendance WHERE clock_in_status='Late' AND tanggal >= CURRENT_DATE - (COALESCE(p_days,14) || ' days')::interval))
  );
$$;

-- Dedup helper: apakah ada task tipe ini yang belum selesai
CREATE OR REPLACE FUNCTION public.agentic_queued_exists(p_type TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT EXISTS (SELECT 1 FROM agentic.tasks WHERE task_type=p_type AND status IN ('QUEUED','PROCESSING','DRAFT'));
$$;

GRANT EXECUTE ON FUNCTION
  public.agentic_doc_admin(INT),
  public.agentic_roster_scan(INT),
  public.agentic_queued_exists(TEXT)
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §C. PROMPT — PLAN_CAMPAIGN
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature) VALUES
('PLAN_CAMPAIGN',
 E'Anda Kepala Marketing OneLab (lab klinik). Susun RENCANA KAMPANYE lintas-kanal dalam MARKDOWN: (1) Tujuan & KPI, (2) Audiens, (3) Pesan kunci, (4) Kanal & format (IG/WA/TikTok/Blog) dengan porsi 70/30 edukasi/promosi, (5) Kalender ringkas per pekan, (6) CTA. Tanpa klaim medis berlebihan; angka/harga tak pasti pakai [[KONFIRMASI]]. Konten yang menyentuh diagnosis/terapi tandai perlu review medis.',
 E'TUJUAN KAMPANYE: {{goal}}\nPERIODE: {{period}}\nANGGARAN/CATATAN: {{notes}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.5)
ON CONFLICT (code) DO UPDATE SET
  system_prompt=EXCLUDED.system_prompt, user_prompt_template=EXCLUDED.user_prompt_template,
  model_hint=EXCLUDED.model_hint, temperature=EXCLUDED.temperature, active=true;

-- ══════════════════════════════════════════════════════════════════════
-- §D. WIRE VIDEO (Point C) — MAKE_VIDEO: script + prompt video → gateway mode:video
--   Pipeline SIAP; produksi video aktif begitu VIDEO_ENABLED=true & NVIDIA_VIDEO_MODEL
--   diisi di Konfig AI. Bila video nonaktif, task tetap menghasilkan script (DRAFT).
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('MAKE_VIDEO','R2','AUTO_APPROVE','QA_KONTEN',75,'Video pendek — script dinilai QA; publish CEO. Klaim medis → R3')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, qa_agent=EXCLUDED.qa_agent,
  min_score=EXCLUDED.min_score, note=EXCLUDED.note;

INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature) VALUES
('MAKE_VIDEO',
 E'Anda tim konten video OneLab. Dari topik, buat konsep video pendek (15-30 dtk). Balas HANYA JSON: {"title":string,"caption":string,"hashtags":[string],"script":string,"video_prompt":string,"needs_medical_review":boolean}. Aturan: script naratif singkat per scene; video_prompt = satu prompt text-to-video deskriptif & aman (interior klinik/lab, alat, motif kesehatan abstrak — TANPA teks pada video, TANPA unsur medis menyesatkan pada orang); bahasa Indonesia untuk caption/script; tanpa klaim "menyembuhkan/dijamin/100%"; needs_medical_review=true bila menyentuh diagnosis/terapi.',
 E'TOPIK: {{topic}}\nKANAL: {{channel}}\nANGLE: {{angle}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.5)
ON CONFLICT (code) DO UPDATE SET
  system_prompt=EXCLUDED.system_prompt, user_prompt_template=EXCLUDED.user_prompt_template,
  model_hint=EXCLUDED.model_hint, temperature=EXCLUDED.temperature, active=true;

SELECT 'Agentic Fase 7K siap — task reserved diaktifkan; IT_BACKUP_CHECK dihapus; video di-wire (MAKE_VIDEO)' AS status;
