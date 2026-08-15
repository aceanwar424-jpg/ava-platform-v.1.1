-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC — FASE 6B (KENDALI ORGANISASI DARI UI)
-- Edit charter/job desc agent, ubah Matriks Mandat, dan pantau/jeda cron
-- langsung dari menu Agentic AI → Organisasi (tanpa SQL manual lagi).
-- PRASYARAT: fase6. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- Edit organ (charter = job desc, model, aktif/nonaktif, nama/jabatan)
CREATE OR REPLACE FUNCTION public.agentic_agent_update(p_code TEXT, p JSONB)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  UPDATE agentic.agents SET
    name       = COALESCE(NULLIF(p->>'name',''), name),
    role_title = COALESCE(NULLIF(p->>'role_title',''), role_title),
    charter    = COALESCE(NULLIF(p->>'charter',''), charter),
    model_tier = CASE WHEN p->>'model_tier' IN ('main','light') THEN p->>'model_tier' ELSE model_tier END,
    active     = COALESCE((NULLIF(p->>'active',''))::boolean, active)
  WHERE code = p_code
  RETURNING to_jsonb(agents);
$$;

-- Edit Matriks Mandat per task_type
CREATE OR REPLACE FUNCTION public.agentic_rights_update(p_task_type TEXT, p JSONB)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  UPDATE agentic.decision_rights SET
    risk_class  = CASE WHEN p->>'risk_class' IN ('R1','R2','R3') THEN p->>'risk_class' ELSE risk_class END,
    auto_action = CASE WHEN p->>'auto_action' IN ('AUTO_PUBLISH','AUTO_PUBLISH_NOQA','AUTO_APPROVE','RECOMMEND')
                       THEN p->>'auto_action' ELSE auto_action END,
    qa_agent    = CASE WHEN p ? 'qa_agent' THEN NULLIF(p->>'qa_agent','') ELSE qa_agent END,
    min_score   = COALESCE(NULLIF(p->>'min_score','')::smallint, min_score),
    active      = COALESCE((NULLIF(p->>'active',''))::boolean, active),
    note        = COALESCE(NULLIF(p->>'note',''), note)
  WHERE task_type = p_task_type
  RETURNING to_jsonb(decision_rights);
$$;

-- Status penjadwal: daftar job agentic-* + 20 eksekusi terakhir.
-- Aman dipanggil walau pg_cron belum aktif → {enabled:false}.
CREATE OR REPLACE FUNCTION public.agentic_cron_status()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v JSONB;
BEGIN
  BEGIN
    SELECT jsonb_build_object(
      'enabled', true,
      'jobs', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'jobid', j.jobid, 'jobname', j.jobname, 'schedule', j.schedule, 'active', j.active)
          ORDER BY j.jobname)
        FROM cron.job j WHERE j.jobname LIKE 'agentic-%'), '[]'::jsonb),
      'runs', COALESCE((SELECT jsonb_agg(s.r) FROM (
          SELECT jsonb_build_object('jobname', j.jobname, 'status', d.status,
            'start_time', d.start_time, 'msg', left(COALESCE(d.return_message,''),140)) AS r
          FROM cron.job_run_details d
          JOIN cron.job j ON j.jobid = d.jobid
          WHERE j.jobname LIKE 'agentic-%'
          ORDER BY d.start_time DESC LIMIT 20) s), '[]'::jsonb)
    ) INTO v;
  EXCEPTION WHEN undefined_table OR invalid_schema_name OR insufficient_privilege THEN
    RETURN jsonb_build_object('enabled', false);
  END;
  RETURN v;
END $$;

-- Jeda / aktifkan satu job (hanya job agentic-*)
CREATE OR REPLACE FUNCTION public.agentic_cron_toggle(p_jobname TEXT, p_active BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  IF p_jobname NOT LIKE 'agentic-%' THEN RAISE EXCEPTION 'Hanya job agentic-* yang boleh diubah'; END IF;
  UPDATE cron.job SET active = p_active WHERE jobname = p_jobname;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'Job % tidak ditemukan', p_jobname; END IF;
  RETURN jsonb_build_object('jobname', p_jobname, 'active', p_active);
END $$;

GRANT EXECUTE ON FUNCTION
  public.agentic_agent_update(TEXT,JSONB),
  public.agentic_rights_update(TEXT,JSONB),
  public.agentic_cron_status(),
  public.agentic_cron_toggle(TEXT,BOOLEAN)
TO anon, authenticated, service_role;

SELECT 'Agentic Fase 6B siap — kendali organisasi dari UI' AS status;
