-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 5 (Diagnostik & Pemulihan)
-- - Reaper dengan ambang menit fleksibel + wrapper public (tombol UI
--   "Bebaskan Task Macet")
-- PRASYARAT: Fase 0–4 sudah terpasang. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- Ganti reaper lama (tanpa parameter) dengan versi berparameter menit
DROP FUNCTION IF EXISTS agentic.reap_stuck_tasks();
CREATE OR REPLACE FUNCTION agentic.reap_stuck_tasks(p_minutes INT DEFAULT 15) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  WITH stuck AS (
    SELECT id, attempts, max_attempts FROM agentic.tasks
    WHERE status='PROCESSING' AND locked_at < now() - make_interval(mins => GREATEST(p_minutes,1))
  ), upd AS (
    UPDATE agentic.tasks t
       SET status = CASE WHEN s.attempts >= s.max_attempts THEN 'FAILED' ELSE 'QUEUED' END,
           error_message = CASE WHEN s.attempts >= s.max_attempts
             THEN 'Worker timeout berulang (' || s.attempts || 'x). Cek Tes Koneksi AI di tab Monitor — kemungkinan provider/model LLM bermasalah.'
             ELSE error_message END,
           locked_at=NULL, run_after=now(), updated_at=now()
      FROM stuck s WHERE t.id=s.id RETURNING t.id, t.status
  )
  INSERT INTO agentic.task_events(task_id, from_status, to_status, actor_type, note)
  SELECT id, 'PROCESSING', status, 'SYSTEM', 'reaper: worker timeout (>' || p_minutes || ' menit)' FROM upd;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.agentic_reap(p_minutes INT DEFAULT 15)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object('reaped', agentic.reap_stuck_tasks(p_minutes));
$$;

GRANT EXECUTE ON FUNCTION public.agentic_reap(INT) TO anon, authenticated, service_role;

-- Catatan cron reaper (blok §CRON fase 0 tetap berlaku; panggilannya kini):
--   select cron.schedule('agentic-reaper','*/5 * * * *', $$ select agentic.reap_stuck_tasks(15); $$);

SELECT 'Agentic Fase 5 siap — reaper berparameter + wrapper public' AS status;
