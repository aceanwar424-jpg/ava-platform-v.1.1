-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7F (DEPARTEMEN IT PROFESIONAL)
-- Menaikkan IT_HEAD (organ tunggal) → Departemen IT (nesting 3 lapis):
--   🖥️ IT — IT_HEAD (Kepala IT)
--        ├── IT_SRE   Site Reliability / Ops
--        ├── IT_SEC   Keamanan Informasi
--        ├── IT_DATA  Data & LIS / Integrasi
--        └── IT_DEV   Pengembangan & Otomasi (self-heal prompt)
-- Menambah task IT_SEC_AUDIT (audit postur keamanan berbasis data nyata),
-- RPC agentic_it_sec_scan, dan prompt IT_SEC_AUDIT.
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 & 7B terpasang. IDEMPOTEN — aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. AGENTS — IT_HEAD jadi kepala dept + anggota baru
-- ══════════════════════════════════════════════════════════════════════
UPDATE agentic.agents SET
  role_title = 'Manajer IT — pimpinan departemen',
  department = 'IT',
  reports_to = 'HEAD',
  charter = 'Anda Kepala Departemen IT OneLab (platform lab klinik). Pimpin tim: IT_SRE (keandalan sistem), IT_SEC (keamanan informasi), IT_DATA (data & integrasi), IT_DEV (pengembangan & otomasi). Jaga sistem AI & platform tetap hidup, aman, dan andal: pantau kesehatan jalur AI, bebaskan task macet, audit keamanan berkala, jaga integritas & cadangan data, dan pelihara prompt. Eskalasi ke CEO hanya bila ada jalur mati, kebocoran/insiden keamanan, atau kegagalan berulang — sertakan penyebab & saran tindakan.'
  WHERE code = 'IT_HEAD';

INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES
('IT_SRE','SRE / Ops','Site Reliability — keandalan sistem','IT_HEAD','IT',
 'Anda SRE OneLab. Jaga uptime & keandalan: jalankan Tes Koneksi AI, bebaskan task macet (reaper), pantau error & token 7 hari, dan tangani insiden. Laporkan ringkas; eskalasi ke IT_HEAD bila ada jalur mati atau kegagalan berulang.',
 'light', true),
('IT_SEC','Keamanan Informasi','Information Security & Kontrol Akses','IT_HEAD','IT',
 'Anda petugas Keamanan Informasi OneLab. Jaga kerahasiaan & integritas data pasien/klinis (selaras ISO 15189 §7.6). Audit postur keamanan: kunci/secret yang belum diset atau bocor, task yang auto-publish tanpa kendali manusia, hak akses & izin RPC, dan anomali kegagalan. Balas temuan yang dapat ditindaklanjuti; JANGAN pernah menampilkan nilai kunci/secret. Tandai [[KONFIRMASI]] bila butuh verifikasi manual.',
 'main', true),
('IT_DATA','Data & LIS','Database, Backup & Integrasi LIS','IT_HEAD','IT',
 'Anda pengelola Data & Integrasi OneLab. Jaga kesehatan database, integritas data, jadwal backup & pemulihan (recovery), serta integrasi alat/LIS. Pantau pertumbuhan data & kegagalan sinkron; usulkan tindakan. Jangan mengubah data produksi tanpa persetujuan.',
 'light', true),
('IT_DEV','Pengembangan & Otomasi','Automation & Pemeliharaan Prompt','IT_HEAD','IT',
 'Anda pengembang & otomasi OneLab. Pelihara & perbaiki prompt template (self-heal, dengan rollback), bangun otomasi, dan kelola rilis. Setiap perubahan prompt wajib mempertahankan seluruh aturan keamanan yang ada — hanya menambah/mempertegas — dan tercatat untuk audit.',
 'main', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier;

-- ══════════════════════════════════════════════════════════════════════
-- §B. DECISION RIGHTS — task IT baru
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('IT_SEC_AUDIT',   'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Audit postur keamanan internal'),
('IT_BACKUP_CHECK','R2','AUTO_APPROVE',      NULL, 0, 'Verifikasi backup — butuh hook eksternal (reserved)')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §C. RPC — pindai postur keamanan (TANPA membocorkan nilai secret)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_it_sec_scan()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    -- Secret: hanya status terisi/kosong, NILAI tidak pernah keluar
    'secrets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'has_value', (value IS NOT NULL AND btrim(value) <> '')))
      FROM agentic.ai_config WHERE is_secret), '[]'::jsonb),
    -- Task type yang auto-publish (potensi over-otomasi)
    'auto_publish_types', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'task_type', task_type, 'auto_action', auto_action, 'qa_agent', qa_agent))
      FROM agentic.decision_rights
      WHERE active AND auto_action IN ('AUTO_PUBLISH','AUTO_PUBLISH_NOQA')), '[]'::jsonb),
    'no_qa_publish', (SELECT count(*) FROM agentic.decision_rights
      WHERE active AND auto_action = 'AUTO_PUBLISH_NOQA'),
    -- Kesehatan operasional 7 hari
    'failed_7d', (SELECT count(*) FROM agentic.tasks
      WHERE status='FAILED' AND updated_at > now() - interval '7 days'),
    'stuck_now', (SELECT count(*) FROM agentic.tasks
      WHERE status='PROCESSING' AND updated_at < now() - interval '15 minutes'),
    -- Konten klaim medis yang auto (harus 0 — dipaksa R3 oleh sistem)
    'medical_auto', (SELECT count(*) FROM agentic.tasks t
      JOIN agentic.decision_rights r ON r.task_type=t.task_type
      WHERE t.needs_medical_review AND r.auto_action IN ('AUTO_PUBLISH','AUTO_PUBLISH_NOQA'))
  );
$$;
GRANT EXECUTE ON FUNCTION public.agentic_it_sec_scan() TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §D. PROMPT
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature) VALUES
('IT_SEC_AUDIT',
 E'Anda petugas Keamanan Informasi OneLab. Dari data postur keamanan, susun laporan MARKDOWN ringkas: (1) Temuan berisiko (kunci/secret belum diset, task auto-publish tanpa QA, task macet, kegagalan tinggi), (2) Rekomendasi tindakan berprioritas. JANGAN menampilkan nilai secret apa pun (data hanya berisi status terisi/kosong). Bila ada konten medis yang ter-auto (medical_auto>0), tandai sebagai TEMUAN KRITIS. Tandai [[KONFIRMASI]] untuk hal yang perlu verifikasi manual.',
 E'DATA POSTUR KEAMANAN (JSON):\n{{posture}}',
 'main', 0.2)
ON CONFLICT (code) DO UPDATE SET
  system_prompt=EXCLUDED.system_prompt, user_prompt_template=EXCLUDED.user_prompt_template,
  model_hint=EXCLUDED.model_hint, temperature=EXCLUDED.temperature, active=true;

SELECT 'Agentic Fase 7F siap — Departemen IT Profesional (IT_SRE · IT_SEC · IT_DATA · IT_DEV)' AS status;
