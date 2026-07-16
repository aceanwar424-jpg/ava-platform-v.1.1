-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 0 (Fondasi)
-- Implementasi §4 ONELAB_AGENTIC_SPEC.md, diadaptasi ke Supabase-native.
-- Idempoten — aman dijalankan ulang.
-- ----------------------------------------------------------------------
-- SETELAH MENJALANKAN INI:
--   1) Settings → API → Exposed schemas → tambahkan: agentic
--      (agar UI bisa baca/tulis via PostgREST dgn header Accept-Profile)
--   2) Deploy Edge Function: llm-gateway, agentic-worker
--   3) Secrets: NVIDIA_API_KEYS, GEMINI_API_KEYS (boleh koma), NVIDIA_MODEL_MAIN, dll
--   4) (opsional) aktifkan pg_cron untuk scheduler — lihat §CRON di bawah
-- ══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS agentic;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ============ 4.1 USERS & ROLES ============
CREATE TABLE IF NOT EXISTS agentic.users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id VARCHAR(64) NOT NULL UNIQUE,
  display_name     VARCHAR(120) NOT NULL,
  role             VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','APPROVER','REVIEWER_MEDIS','VIEWER')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ 4.2 TASKS: STATE MACHINE UTAMA ============
CREATE TABLE IF NOT EXISTS agentic.tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent         VARCHAR(20) NOT NULL CHECK (agent IN ('DOCUMENT','CONTENT')),
  task_type     VARCHAR(40) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
                CHECK (status IN ('QUEUED','PROCESSING','DRAFT','IN_MEDICAL_REVIEW',
                                  'APPROVED','PUBLISHED','REJECTED','FAILED','CANCELLED')),
  priority      SMALLINT NOT NULL DEFAULT 5,
  title         VARCHAR(300) NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  result        JSONB,
  error_message TEXT,
  needs_medical_review BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID REFERENCES agentic.users(id),
  assigned_approver UUID REFERENCES agentic.users(id),
  parent_task_id UUID REFERENCES agentic.tasks(id),
  scheduled_for TIMESTAMPTZ,
  -- kolom operasional queue (Supabase-native, pengganti BullMQ)
  attempts      SMALLINT NOT NULL DEFAULT 0,
  max_attempts  SMALLINT NOT NULL DEFAULT 3,
  locked_at     TIMESTAMPTZ,
  locked_by     TEXT,
  run_after     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON agentic.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_type  ON agentic.tasks(agent, task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled   ON agentic.tasks(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_claim       ON agentic.tasks(status, run_after, priority);

-- ============ 4.3 TASK EVENTS: AUDIT TRAIL ============
CREATE TABLE IF NOT EXISTS agentic.task_events (
  id          BIGSERIAL PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES agentic.tasks(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status   VARCHAR(20) NOT NULL,
  actor_type  VARCHAR(10) NOT NULL CHECK (actor_type IN ('SYSTEM','WORKER','USER')),
  actor_id    UUID,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON agentic.task_events(task_id);

-- ============ 4.4 DOCUMENT REGISTRY ============
CREATE TABLE IF NOT EXISTS agentic.document_registry (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number     VARCHAR(60) UNIQUE,
  title          VARCHAR(300) NOT NULL,
  doc_level      SMALLINT NOT NULL CHECK (doc_level BETWEEN 1 AND 4),
  doc_type       VARCHAR(30) NOT NULL,
  department     VARCHAR(60) NOT NULL,
  iso_clause     VARCHAR(120),
  status         VARCHAR(20) NOT NULL DEFAULT 'DISCOVERED'
                 CHECK (status IN ('DISCOVERED','NEEDS_REPAIR','DRAFT','PUBLISHED',
                                   'DUE_FOR_REVIEW','OBSOLETE','MISSING')),
  current_revision SMALLINT NOT NULL DEFAULT 0,
  effective_date DATE,
  next_review_date DATE,
  source_file_path VARCHAR(500),
  current_file_path VARCHAR(500),
  extracted_meta JSONB,
  gap_notes      TEXT,
  linked_task_id UUID REFERENCES agentic.tasks(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docreg_status     ON agentic.document_registry(status);
CREATE INDEX IF NOT EXISTS idx_docreg_dept_level ON agentic.document_registry(department, doc_level);

-- ============ 4.5 DOCUMENT REVISIONS ============
CREATE TABLE IF NOT EXISTS agentic.document_revisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES agentic.document_registry(id) ON DELETE CASCADE,
  revision    SMALLINT NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  change_note TEXT,
  approved_by UUID REFERENCES agentic.users(id),
  approved_at TIMESTAMPTZ,
  UNIQUE(document_id, revision)
);

-- ============ 4.6 COMPLIANCE CHECKLIST ============
CREATE TABLE IF NOT EXISTS agentic.compliance_checklist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework     VARCHAR(40) NOT NULL,
  clause_ref    VARCHAR(60) NOT NULL,
  requirement   TEXT NOT NULL,
  required_doc_level SMALLINT,
  required_doc_type  VARCHAR(30),
  department    VARCHAR(60),
  is_mandatory  BOOLEAN NOT NULL DEFAULT true,
  matched_document_id UUID REFERENCES agentic.document_registry(id),
  match_confidence NUMERIC(3,2),
  active        BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(framework, clause_ref, required_doc_type, department)
);

-- ============ 4.7 CONTENT CALENDAR ============
CREATE TABLE IF NOT EXISTS agentic.content_calendar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type  VARCHAR(30) NOT NULL
                CHECK (content_type IN ('SOSMED_POST','SOSMED_CAROUSEL','ARTIKEL',
                                        'PPTX_DOKTER','EVENT','FLYER')),
  topic         VARCHAR(300) NOT NULL,
  angle         TEXT,
  framework     VARCHAR(10) DEFAULT 'PAS' CHECK (framework IN ('PAS','AIDA','EDU')),
  target_date   DATE NOT NULL,
  target_time   TIME,
  channel       VARCHAR(30),
  related_test_codes TEXT[],
  health_day_ref VARCHAR(120),
  source        VARCHAR(20) NOT NULL DEFAULT 'IMPORT'
                CHECK (source IN ('IMPORT','PLANNER_AI','MANUAL')),
  task_id       UUID REFERENCES agentic.tasks(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
                CHECK (status IN ('PLANNED','IN_PRODUCTION','READY','PUBLISHED','SKIPPED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON agentic.content_calendar(target_date);

-- ============ 4.8 CONTENT ASSETS ============
CREATE TABLE IF NOT EXISTS agentic.content_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id  UUID REFERENCES agentic.content_calendar(id) ON DELETE SET NULL,
  task_id      UUID NOT NULL REFERENCES agentic.tasks(id) ON DELETE CASCADE,
  asset_type   VARCHAR(20) NOT NULL CHECK (asset_type IN ('COPY','IMAGE','PDF','PPTX','HTML','DOCX')),
  file_path    VARCHAR(500),
  text_content TEXT,
  meta         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ 4.9 LLM REQUESTS: LOG & COST METER ============
CREATE TABLE IF NOT EXISTS agentic.llm_requests (
  id            BIGSERIAL PRIMARY KEY,
  task_id       UUID REFERENCES agentic.tasks(id) ON DELETE SET NULL,
  provider      VARCHAR(20) NOT NULL,
  model         VARCHAR(80) NOT NULL,
  key_alias     VARCHAR(40),
  prompt_hash   CHAR(64),
  prompt_preview TEXT,
  response_preview TEXT,
  input_tokens  INT,
  output_tokens INT,
  latency_ms    INT,
  status        VARCHAR(15) NOT NULL,   -- OK|RATE_LIMITED|ERROR|CACHED|FALLBACK
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llm_req_created ON agentic.llm_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_req_key_time ON agentic.llm_requests(key_alias, created_at);

-- ============ 4.10 PROMPT TEMPLATES ============
CREATE TABLE IF NOT EXISTS agentic.prompt_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(60) NOT NULL UNIQUE,
  version     SMALLINT NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  model_hint  VARCHAR(80),
  temperature NUMERIC(2,1) DEFAULT 0.4,
  active      BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ LLM CACHE (pengganti Redis cache §3.1) ============
CREATE TABLE IF NOT EXISTS agentic.llm_cache (
  prompt_hash CHAR(64) PRIMARY KEY,
  model       VARCHAR(80) NOT NULL,
  response    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_cache_exp ON agentic.llm_cache(expires_at);

-- ══════════════════════════════════════════════════════════════════════
-- QUEUE ENGINE (pengganti BullMQ) — klaim atomik SKIP LOCKED
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION agentic.claim_task(p_worker TEXT, p_agent TEXT DEFAULT NULL)
RETURNS SETOF agentic.tasks
LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  SELECT t.id INTO v_id
  FROM agentic.tasks t
  WHERE t.status = 'QUEUED'
    AND t.run_after <= now()
    AND (p_agent IS NULL OR t.agent = p_agent)
  ORDER BY t.priority ASC, t.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN RETURN; END IF;

  UPDATE agentic.tasks
     SET status='PROCESSING', locked_at=now(), locked_by=p_worker,
         attempts=attempts+1, updated_at=now()
   WHERE id = v_id;

  INSERT INTO agentic.task_events(task_id, from_status, to_status, actor_type, actor_id, note)
  VALUES (v_id, 'QUEUED', 'PROCESSING', 'WORKER', NULL, p_worker);

  RETURN QUERY SELECT * FROM agentic.tasks WHERE id = v_id;
END $$;

-- Transisi status + audit trail dalam satu pintu (enforce §4.2)
CREATE OR REPLACE FUNCTION agentic.transition_task(
  p_task_id UUID, p_to TEXT, p_actor_type TEXT, p_actor_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL, p_result JSONB DEFAULT NULL, p_error TEXT DEFAULT NULL
) RETURNS agentic.tasks
LANGUAGE plpgsql AS $$
DECLARE v_from TEXT; v_row agentic.tasks; v_ok BOOLEAN;
BEGIN
  SELECT status INTO v_from FROM agentic.tasks WHERE id=p_task_id FOR UPDATE;
  IF v_from IS NULL THEN RAISE EXCEPTION 'Task % tidak ditemukan', p_task_id; END IF;

  -- Matriks transisi sah (§4.2)
  v_ok := CASE
    WHEN v_from='QUEUED'            AND p_to IN ('PROCESSING','CANCELLED') THEN true
    WHEN v_from='PROCESSING'        AND p_to IN ('DRAFT','FAILED')         THEN true
    WHEN v_from='DRAFT'             AND p_to IN ('IN_MEDICAL_REVIEW','APPROVED','REJECTED','CANCELLED') THEN true
    WHEN v_from='IN_MEDICAL_REVIEW' AND p_to IN ('APPROVED','REJECTED')    THEN true
    WHEN v_from='APPROVED'          AND p_to='PUBLISHED'                   THEN true
    WHEN v_from='REJECTED'          AND p_to='QUEUED'                      THEN true
    WHEN v_from='FAILED'            AND p_to='QUEUED'                      THEN true
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Transisi tidak sah: % → %', v_from, p_to; END IF;

  UPDATE agentic.tasks
     SET status=p_to,
         result = COALESCE(p_result, result),
         error_message = CASE WHEN p_to='FAILED' THEN p_error ELSE error_message END,
         locked_at = CASE WHEN p_to IN ('DRAFT','FAILED') THEN NULL ELSE locked_at END,
         run_after = CASE WHEN p_to='QUEUED' THEN now() ELSE run_after END,
         updated_at = now()
   WHERE id=p_task_id
   RETURNING * INTO v_row;

  INSERT INTO agentic.task_events(task_id, from_status, to_status, actor_type, actor_id, note)
  VALUES (p_task_id, v_from, p_to, p_actor_type, p_actor_id, p_note);

  RETURN v_row;
END $$;

-- Reaper: task PROCESSING yang macet > 15 menit → QUEUED lagi (atau FAILED bila habis attempt)
CREATE OR REPLACE FUNCTION agentic.reap_stuck_tasks() RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  WITH stuck AS (
    SELECT id, attempts, max_attempts FROM agentic.tasks
    WHERE status='PROCESSING' AND locked_at < now() - INTERVAL '15 minutes'
  ), upd AS (
    UPDATE agentic.tasks t
       SET status = CASE WHEN s.attempts >= s.max_attempts THEN 'FAILED' ELSE 'QUEUED' END,
           error_message = CASE WHEN s.attempts >= s.max_attempts THEN 'Timeout worker (stuck)' ELSE error_message END,
           locked_at=NULL, run_after=now(), updated_at=now()
      FROM stuck s WHERE t.id=s.id RETURNING t.id, t.status
  )
  INSERT INTO agentic.task_events(task_id, from_status, to_status, actor_type, note)
  SELECT id, 'PROCESSING', status, 'SYSTEM', 'reaper: worker timeout' FROM upd;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- RLS — mengikuti pola platform saat ini (dikendalikan di application layer).
-- CATATAN: untuk produksi, aktifkan RLS + policy berbasis role (§1 human-in-the-loop:
-- hanya APPROVER yang boleh APPROVED/PUBLISHED).
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE agentic.users               DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.tasks               DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.task_events         DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.document_registry   DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.document_revisions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.compliance_checklist DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.content_calendar    DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.content_assets      DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.llm_requests        DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.prompt_templates    DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic.llm_cache           DISABLE ROW LEVEL SECURITY;

-- Hak akses untuk PostgREST (anon/authenticated) setelah schema di-expose
GRANT USAGE ON SCHEMA agentic TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA agentic TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA agentic TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA agentic TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA agentic GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §CRON (opsional, Fase 0 boleh manual dulu)
-- Aktifkan di Database → Extensions: pg_cron & pg_net. Lalu:
--
--   select cron.schedule('agentic-worker-tick','* * * * *', $$
--     select net.http_post(
--       url:='https://<PROJECT>.supabase.co/functions/v1/agentic-worker',
--       headers:='{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--       body:='{}'::jsonb);
--   $$);
--   select cron.schedule('agentic-reaper','*/5 * * * *', $$ select agentic.reap_stuck_tasks(); $$);
-- ══════════════════════════════════════════════════════════════════════

SELECT 'Agentic schema (Fase 0) siap — expose schema "agentic" di Settings → API' AS status;
