-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7G (PERLUASAN IT: INTEGRASI + BACKUP)
-- Memberi IT_DATA fungsi nyata:
--   • INTEGRATION_HEALTH — deteksi sampel tertahan (alat/LIS tak mengirim) +
--     analyzer terintegrasi yang "diam" (tak ada hasil auto) → alert.
--   • BACKUP_VERIFY — verifikasi kesegaran backup (pg_dump terjadwal) via
--     tabel agentic.backup_log; alert bila backup basi / tak ada.
-- Membaca skema lab nyata: public.lab_samples · lab_results · analyzers.
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 + 7F terpasang. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. LOG BACKUP — diisi oleh cron pg_dump Anda (lihat §CRON di bawah)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.backup_log (
  id         BIGSERIAL PRIMARY KEY,
  run_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     VARCHAR(12) NOT NULL DEFAULT 'OK' CHECK (status IN ('OK','FAILED','PARTIAL')),
  method     VARCHAR(30) NOT NULL DEFAULT 'pg_dump',
  size_bytes BIGINT,
  location   TEXT,
  note       TEXT
);
CREATE INDEX IF NOT EXISTS idx_backup_run ON agentic.backup_log(run_at DESC);
ALTER TABLE agentic.backup_log DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.backup_log TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE agentic.backup_log_id_seq TO anon, authenticated, service_role;

-- Catat 1 kali backup (dipanggil skrip pg_dump Anda setelah dump selesai)
CREATE OR REPLACE FUNCTION public.agentic_backup_log_add(p JSONB)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  INSERT INTO agentic.backup_log(run_at, status, method, size_bytes, location, note)
  VALUES (COALESCE(NULLIF(p->>'run_at','')::timestamptz, now()),
          CASE WHEN upper(COALESCE(p->>'status','')) IN ('OK','FAILED','PARTIAL') THEN upper(p->>'status') ELSE 'OK' END,
          COALESCE(NULLIF(p->>'method',''),'pg_dump'),
          NULLIF(p->>'size_bytes','')::bigint, NULLIF(p->>'location',''), NULLIF(p->>'note',''))
  RETURNING to_jsonb(backup_log);
$$;

-- Status backup: backup terakhir + apakah basi (> p_max_hours)
CREATE OR REPLACE FUNCTION public.agentic_backup_status(p_max_hours INT DEFAULT 26)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'last', (SELECT to_jsonb(b) FROM agentic.backup_log b ORDER BY run_at DESC LIMIT 1),
    'last_ok', (SELECT to_jsonb(b) FROM agentic.backup_log b WHERE status='OK' ORDER BY run_at DESC LIMIT 1),
    'hours_since_ok', (SELECT round(EXTRACT(EPOCH FROM (now() - max(run_at)))/3600.0, 1)
                        FROM agentic.backup_log WHERE status='OK'),
    'stale', COALESCE((SELECT max(run_at) FROM agentic.backup_log WHERE status='OK')
                       < now() - (COALESCE(p_max_hours,26) || ' hours')::interval, true),
    'has_any', EXISTS (SELECT 1 FROM agentic.backup_log),
    'failed_7d', (SELECT count(*) FROM agentic.backup_log WHERE status='FAILED' AND run_at > now()-interval '7 days'),
    'max_hours', COALESCE(p_max_hours,26)
  );
$$;

-- ══════════════════════════════════════════════════════════════════════
-- §B. RPC — kesehatan integrasi lab (baca lab_samples/results/analyzers)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_integration_scan(p_stuck_hours INT DEFAULT 6, p_silent_hours INT DEFAULT 24)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    -- Sampel tertahan "In Process" terlalu lama → hasil tak kunjung masuk
    'stuck_samples', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'barcode', barcode, 'patient_name', patient_name, 'analyzer_name', analyzer_name,
        'hours', round(EXTRACT(EPOCH FROM (now() - COALESCE(updated_at, received_at, created_at)))/3600.0, 1))
      ORDER BY COALESCE(updated_at, received_at, created_at))
      FROM public.lab_samples
      WHERE status = 'In Process'
        AND COALESCE(updated_at, received_at, created_at) < now() - (COALESCE(p_stuck_hours,6) || ' hours')::interval), '[]'::jsonb),
    -- Analyzer terintegrasi & aktif tapi TAK ada hasil auto belakangan → integrasi diam
    'silent_analyzers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'nama_alat', a.nama_alat, 'kategori', a.kategori, 'protocol', a.integrasi_protocol,
        'last_auto_result', lr.last_res))
      FROM public.analyzers a
      LEFT JOIN LATERAL (SELECT max(created_at) AS last_res FROM public.lab_results r
                          WHERE r.analyzer_id = a.id AND r.is_auto) lr ON true
      WHERE COALESCE(a.integrasi_aktif,false) AND a.status = 'Aktif'
        AND (lr.last_res IS NULL OR lr.last_res < now() - (COALESCE(p_silent_hours,24) || ' hours')::interval)), '[]'::jsonb),
    -- Alat bermasalah (Rusak/Maintenance)
    'down_analyzers', COALESCE((SELECT jsonb_agg(jsonb_build_object('nama_alat', nama_alat, 'status', status))
      FROM public.analyzers WHERE status IN ('Rusak','Maintenance')), '[]'::jsonb),
    'summary', jsonb_build_object(
      'stuck', (SELECT count(*) FROM public.lab_samples WHERE status='In Process'
        AND COALESCE(updated_at, received_at, created_at) < now() - (COALESCE(p_stuck_hours,6) || ' hours')::interval),
      'auto_results_24h', (SELECT count(*) FROM public.lab_results WHERE is_auto AND created_at > now()-interval '24 hours'),
      'integrated_analyzers', (SELECT count(*) FROM public.analyzers WHERE COALESCE(integrasi_aktif,false)))
  );
$$;

-- ══════════════════════════════════════════════════════════════════════
-- §C. DECISION RIGHTS (perbaiki BACKUP_VERIFY 7F → R1 agar tidak macet DRAFT)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('INTEGRATION_HEALTH','R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Kesehatan integrasi lab (IT_DATA)'),
('BACKUP_VERIFY',     'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Verifikasi kesegaran backup (IT_DATA)')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, qa_agent=NULL, note=EXCLUDED.note;

GRANT EXECUTE ON FUNCTION
  public.agentic_backup_log_add(JSONB),
  public.agentic_backup_status(INT),
  public.agentic_integration_scan(INT,INT)
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §CRON — contoh: skrip pg_dump Anda MENCATAT hasil ke log agar bisa diverifikasi
--   (jalankan dari server tempat pg_dump berjalan, SETELAH dump sukses):
--
--   curl -s -X POST 'https://<PROJECT>.supabase.co/rest/v1/rpc/agentic_backup_log_add' \
--     -H "apikey: <SERVICE_ROLE_KEY>" -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
--     -H "Content-Type: application/json" \
--     -d '{"p":{"status":"OK","method":"pg_dump","size_bytes":'"$SIZE"',"location":"s3://backup/onelab"}}'
--
--   -- BACKUP_VERIFY & INTEGRATION_HEALTH tiap 6 jam (via IT dept):
--   -- (dipicu tombol di UI, atau tambahkan create_task terjadwal bila mau)
-- ══════════════════════════════════════════════════════════════════════

SELECT 'Agentic Fase 7G siap — IT: Integration Health + Backup Verify (IT_DATA aktif)' AS status;
