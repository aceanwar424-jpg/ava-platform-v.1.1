-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 6 (ORGANISASI AGENT)
-- Dari "human-in-the-loop semua" → "human-ON-the-loop dengan mandat":
--   HEAD (decision maker) · QA Mutu · QA Konten · Kepala IT
--   Matriks Mandat R1/R2/R3 · bus pesan antar-agent · standup harian
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 0–5 terpasang. IDEMPOTEN — aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. TASKS: izinkan agent 'ORG' (task organ: HEAD_TICK, QA_REVIEW, IT_CHECK)
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE agentic.tasks DROP CONSTRAINT IF EXISTS tasks_agent_check;
ALTER TABLE agentic.tasks ADD CONSTRAINT tasks_agent_check
  CHECK (agent IN ('DOCUMENT','CONTENT','ORG'));

-- ══════════════════════════════════════════════════════════════════════
-- §B. REGISTRY ORGAN — siapa saja, job desc (charter), lapor ke siapa
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.agents (
  code        VARCHAR(30) PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  role_title  VARCHAR(120) NOT NULL,
  reports_to  VARCHAR(30),                 -- code atasan; NULL = lapor ke CEO (Ace)
  charter     TEXT NOT NULL,               -- system prompt = job desc + rubrik
  model_tier  VARCHAR(10) NOT NULL DEFAULT 'main' CHECK (model_tier IN ('main','light')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE agentic.agents DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.agents TO anon, authenticated, service_role;

INSERT INTO agentic.agents (code, name, role_title, reports_to, charter, model_tier, active) VALUES
('HEAD','Kepala Agentic','Chief of Staff — decision maker', NULL,
 'Anda adalah HEAD organisasi agent OneLab (lab klinik Indonesia). Tugas: mengubah tujuan menjadi task, menugaskan QA, dan MEMUTUSKAN sesuai Matriks Mandat: R1 = putuskan & terbitkan sendiri; R2 = setujui, publish tetap CEO; R3 = hanya rekomendasi ke CEO. Setiap keputusan wajib beralasan singkat dan tercatat. Eskalasi hanya untuk hal di luar mandat atau anomali. Jangan pernah menerbitkan konten klaim medis tanpa manusia.',
 'main', true),
('QA_KONTEN','QA Konten','Quality Assurance — Konten & Branding','HEAD',
 'Anda QA Konten OneLab. Nilai draft konten (caption/artikel/brief) dengan rubrik ketat, balas HANYA JSON {"score":0-100,"verdict":"PASS"|"FAIL","findings":[string],"saran":string}. Rubrik: (25) akurasi & tanpa klaim medis berlebihan — kata "menyembuhkan/dijamin/100%" = FAIL; (20) 70/30 edukasi vs promosi; (20) bahasa Indonesia luwes, bebas typo; (15) CTA jelas & hashtag relevan ≤12; (10) placeholder [[KONFIRMASI]] dipakai utk data tak pasti (mengarang angka/harga = FAIL); (10) sesuai brief/topik. PASS bila score≥ambang DAN tanpa temuan fatal.',
 'main', true),
('QA_MUTU','QA Mutu','Quality Assurance — Dokumen QMS / ISO 15189','HEAD',
 'Anda QA Mutu OneLab (ISO 15189:2022). Nilai draft dokumen QMS, balas HANYA JSON {"score":0-100,"verdict":"PASS"|"FAIL","findings":[string],"saran":string}. Rubrik: (25) struktur standar lengkap (SOP: 7 bagian — Tujuan, Ruang Lingkup, Referensi, Definisi, Tanggung Jawab, Prosedur bernomor, Dokumen Terkait); (25) memenuhi klausul ISO terkait secara eksplisit; (20) tidak mengarang nilai operasional — angka klinis/nama PJ tanpa [[KONFIRMASI]] = FAIL; (15) prosedur logis & dapat dieksekusi; (15) konsistensi istilah lab. PASS bila score≥ambang DAN tanpa temuan fatal.',
 'main', true),
('IT_HEAD','Kepala IT','Site Reliability — kesehatan sistem AI','HEAD',
 'Anda Kepala IT organisasi agent OneLab. Tugas: menjaga sistem hidup — menjalankan Tes Koneksi AI, membebaskan task macet, memantau error & token 7 hari, dan melaporkan ringkas. Eskalasi ke CEO hanya bila ada jalur mati atau kegagalan berulang, sertakan penyebab & saran tindakan.',
 'light', true),
('TEAM_OPS','Kepala Team','Ops Lead — SLA & standup harian','HEAD',
 'Anda Kepala Team Ops. Awasi SLA task (macet/terlambat), rangkum aktivitas harian utk CEO.',
 'light', false),
('LOGISTIK','Agent Logistik','Inventory & Procurement','HEAD',
 'Anda Agent Logistik. Pantau stok reagen/BHP: menipis & kedaluwarsa → draft PO (placeholder harga [[KONFIRMASI]]).',
 'light', false)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier;

-- ══════════════════════════════════════════════════════════════════════
-- §C. MATRIKS MANDAT (decision rights) — per task_type
--   auto_action: AUTO_PUBLISH (butuh QA PASS) | AUTO_PUBLISH_NOQA |
--                AUTO_APPROVE (butuh QA PASS; publish tetap CEO) |
--                RECOMMEND (R3: hanya rekomendasi)
--   needs_medical_review pada task SELALU memaksa R3/RECOMMEND.
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.decision_rights (
  task_type   VARCHAR(40) PRIMARY KEY,
  risk_class  VARCHAR(2)  NOT NULL CHECK (risk_class IN ('R1','R2','R3')),
  auto_action VARCHAR(20) NOT NULL CHECK (auto_action IN ('AUTO_PUBLISH','AUTO_PUBLISH_NOQA','AUTO_APPROVE','RECOMMEND')),
  qa_agent    VARCHAR(30) REFERENCES agentic.agents(code),
  min_score   SMALLINT NOT NULL DEFAULT 75,
  note        TEXT,
  active      BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE agentic.decision_rights DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.decision_rights TO anon, authenticated, service_role;

INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('MAKE_SOSMED',      'R1','AUTO_PUBLISH',      'QA_KONTEN', 75,'Konten edukasi non-medis — mandat penuh HEAD'),
('PLAN_WEEKLY',      'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Perencanaan internal, efek sudah di kalender'),
('DOC_INGEST',       'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Hanya ekstraksi metadata'),
('GAP_ANALYSIS',     'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Analisis internal'),
('DOC_REVIEW_CYCLE', 'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Pemicu jadwal'),
('SMOKE_TEST',       'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Uji sistem'),
('HEAD_TICK',        'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Log kerja organ'),
('QA_REVIEW',        'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Log kerja organ'),
('IT_CHECK',         'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Log kerja organ'),
('MAKE_EVENT_BRIEF', 'R2','AUTO_APPROVE',      'QA_KONTEN', 70,'Brief internal; publish oleh CEO'),
('DOC_REPAIR',       'R2','AUTO_APPROVE',      'QA_MUTU',   75,'SOP: approve otomatis; nomor resmi tetap CEO'),
('DOC_GENERATE',     'R2','AUTO_APPROVE',      'QA_MUTU',   75,'Dokumen baru: approve otomatis; publish CEO'),
('MAKE_ARTIKEL',     'R3','RECOMMEND',         'QA_KONTEN', 80,'Klaim medis — manusia + review medis wajib'),
('MAKE_PPTX_DOKTER', 'R3','RECOMMEND',         'QA_KONTEN', 80,'Materi medis — manusia + review medis wajib')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action,
  qa_agent=EXCLUDED.qa_agent, min_score=EXCLUDED.min_score, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §D. HASIL QA & BUS PESAN ANTAR-AGENT
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.qa_reviews (
  id          BIGSERIAL PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES agentic.tasks(id) ON DELETE CASCADE,
  agent_code  VARCHAR(30) NOT NULL REFERENCES agentic.agents(code),
  score       SMALLINT NOT NULL,
  verdict     VARCHAR(6) NOT NULL CHECK (verdict IN ('PASS','FAIL')),
  findings    JSONB NOT NULL DEFAULT '[]',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qa_task ON agentic.qa_reviews(task_id, created_at DESC);
ALTER TABLE agentic.qa_reviews DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.qa_reviews TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE agentic.qa_reviews_id_seq TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS agentic.agent_messages (
  id          BIGSERIAL PRIMARY KEY,
  from_agent  VARCHAR(30) NOT NULL,          -- code agent / 'ACE'
  to_agent    VARCHAR(30) NOT NULL,          -- code agent / 'ACE' (=CEO)
  task_id     UUID REFERENCES agentic.tasks(id) ON DELETE SET NULL,
  kind        VARCHAR(20) NOT NULL DEFAULT 'INFO', -- INFO|ESCALATION|STANDUP|ALERT
  body        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_to ON agentic.agent_messages(to_agent, created_at DESC);
ALTER TABLE agentic.agent_messages DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.agent_messages TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE agentic.agent_messages_id_seq TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §E. publish & reject: tambah p_actor_type agar keputusan HEAD tercatat
--     sebagai SYSTEM (bukan USER) di audit trail. Signature lama di-drop.
-- ══════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.agentic_publish(UUID, UUID);
CREATE OR REPLACE FUNCTION public.agentic_publish(
  p_task_id UUID, p_actor_id UUID DEFAULT NULL, p_actor_type TEXT DEFAULT 'USER'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE
  v_t agentic.tasks; v_doc agentic.document_registry;
  v_doc_id UUID; v_cal_id UUID; v_num TEXT; v_seq INT; v_rev INT;
BEGIN
  SELECT * INTO v_t FROM agentic.tasks WHERE id = p_task_id;
  IF v_t.id IS NULL THEN RAISE EXCEPTION 'Task % tidak ditemukan', p_task_id; END IF;

  v_t := agentic.transition_task(p_task_id, 'PUBLISHED', p_actor_type, p_actor_id, 'Dipublikasikan');

  v_doc_id := COALESCE(NULLIF(v_t.result->>'document_id',''), NULLIF(v_t.payload->>'document_id',''))::uuid;
  IF v_doc_id IS NOT NULL THEN
    SELECT * INTO v_doc FROM agentic.document_registry WHERE id = v_doc_id FOR UPDATE;
    IF v_doc.id IS NOT NULL THEN
      v_num := v_doc.doc_number;
      IF v_num IS NULL THEN
        SELECT count(*) + 1 INTO v_seq FROM agentic.document_registry
         WHERE doc_type = v_doc.doc_type AND department = v_doc.department AND doc_number IS NOT NULL;
        LOOP
          v_num := 'OL/' || v_doc.doc_type || '/' || v_doc.department || '/' || lpad(v_seq::text, 3, '0');
          EXIT WHEN NOT EXISTS (SELECT 1 FROM agentic.document_registry WHERE doc_number = v_num);
          v_seq := v_seq + 1;
        END LOOP;
      END IF;
      v_rev := v_doc.current_revision + 1;
      INSERT INTO agentic.document_revisions(document_id, revision, file_path, change_note, approved_by, approved_at)
      VALUES (v_doc.id, v_rev,
              COALESCE(NULLIF(v_t.result->>'file_path',''), 'task:' || v_t.id || ':markdown'),
              COALESCE(v_t.result->>'change_note', v_t.title), p_actor_id, now())
      ON CONFLICT (document_id, revision) DO NOTHING;
      UPDATE agentic.document_registry
         SET doc_number = v_num, status = 'PUBLISHED', current_revision = v_rev,
             effective_date = CURRENT_DATE, next_review_date = CURRENT_DATE + INTERVAL '2 years',
             current_file_path = COALESCE(NULLIF(v_t.result->>'file_path',''), current_file_path),
             linked_task_id = v_t.id, updated_at = now()
       WHERE id = v_doc.id;
    END IF;
  END IF;

  v_cal_id := NULLIF(v_t.payload->>'calendar_id','')::uuid;
  IF v_cal_id IS NOT NULL THEN
    UPDATE agentic.content_calendar SET status = 'READY' WHERE id = v_cal_id;
  END IF;

  RETURN to_jsonb(v_t) || jsonb_build_object('doc_number', v_num);
END $$;

DROP FUNCTION IF EXISTS public.agentic_reject(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.agentic_reject(
  p_task_id UUID, p_feedback TEXT, p_actor_id UUID DEFAULT NULL, p_actor_type TEXT DEFAULT 'USER'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_row agentic.tasks;
BEGIN
  IF COALESCE(trim(p_feedback),'') = '' THEN
    RAISE EXCEPTION 'Feedback wajib diisi saat menolak (dipakai sebagai konteks perbaikan)';
  END IF;
  PERFORM agentic.transition_task(p_task_id, 'REJECTED', p_actor_type, p_actor_id, p_feedback);
  UPDATE agentic.tasks
     SET payload = jsonb_set(payload, '{rejection_feedback}', to_jsonb(p_feedback), true),
         attempts = 0, error_message = NULL
   WHERE id = p_task_id;
  v_row := agentic.transition_task(p_task_id, 'QUEUED', p_actor_type, p_actor_id,
             'Antri ulang dengan feedback penolakan');
  RETURN to_jsonb(v_row);
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- §F. RPC ORGAN
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.agentic_task_get(p_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT to_jsonb(t) FROM agentic.tasks t WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.agentic_agent_get(p_code TEXT)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT to_jsonb(a) FROM agentic.agents a WHERE code = p_code AND active;
$$;

CREATE OR REPLACE FUNCTION public.agentic_qa_add(p JSONB)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  INSERT INTO agentic.qa_reviews(task_id, agent_code, score, verdict, findings, notes)
  VALUES ((p->>'task_id')::uuid, p->>'agent_code',
          LEAST(100, GREATEST(0, COALESCE(NULLIF(p->>'score','')::int, 0))),
          CASE WHEN p->>'verdict' = 'PASS' THEN 'PASS' ELSE 'FAIL' END,
          COALESCE(p->'findings','[]'::jsonb), NULLIF(p->>'notes',''))
  RETURNING to_jsonb(qa_reviews);
$$;

CREATE OR REPLACE FUNCTION public.agentic_msg_add(p JSONB)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  INSERT INTO agentic.agent_messages(from_agent, to_agent, task_id, kind, body)
  VALUES (COALESCE(NULLIF(p->>'from_agent',''),'HEAD'),
          COALESCE(NULLIF(p->>'to_agent',''),'ACE'),
          NULLIF(p->>'task_id','')::uuid,
          COALESCE(NULLIF(p->>'kind',''),'INFO'),
          COALESCE(p->>'body','(kosong)'))
  RETURNING to_jsonb(agent_messages);
$$;

-- Data kerja HEAD dalam satu panggilan:
--   drafts  : task DRAFT + kelas risiko + QA terakhir + status QA/eskalasi
--   failed  : task FAILED yang masih punya sisa retry budget
--   standup : ringkasan 24 jam (utk digest)
CREATE OR REPLACE FUNCTION public.agentic_head_data()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'drafts', COALESCE((SELECT jsonb_agg(row ORDER BY row->>'created_at') FROM (
      SELECT jsonb_build_object(
        'id', t.id, 'task_type', t.task_type, 'agent', t.agent, 'title', t.title,
        'needs_medical_review', t.needs_medical_review, 'created_at', t.created_at,
        'risk',        CASE WHEN t.needs_medical_review THEN 'R3' ELSE COALESCE(r.risk_class,'R2') END,
        'auto_action', CASE WHEN t.needs_medical_review THEN 'RECOMMEND' ELSE COALESCE(r.auto_action,'AUTO_APPROVE') END,
        'qa_agent',    r.qa_agent, 'min_score', COALESCE(r.min_score,75),
        'qa', (SELECT jsonb_build_object('score',q.score,'verdict',q.verdict,'findings',q.findings,'notes',q.notes)
                 FROM agentic.qa_reviews q WHERE q.task_id=t.id ORDER BY q.created_at DESC LIMIT 1),
        'qa_open', EXISTS (SELECT 1 FROM agentic.tasks x
                     WHERE x.task_type='QA_REVIEW' AND x.status IN ('QUEUED','PROCESSING')
                       AND x.payload->>'target_task_id' = t.id::text),
        'escalated', EXISTS (SELECT 1 FROM agentic.agent_messages m
                       WHERE m.task_id=t.id AND m.kind='ESCALATION')
      ) AS row
      FROM agentic.tasks t
      LEFT JOIN agentic.decision_rights r ON r.task_type = t.task_type AND r.active
      WHERE t.status='DRAFT') s), '[]'::jsonb),
    'failed', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'attempts', attempts, 'max_attempts', max_attempts,
        'error', left(COALESCE(error_message,''),200)))
      FROM agentic.tasks WHERE status='FAILED' AND attempts < max_attempts), '[]'::jsonb),
    'approved_waiting', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title))
      FROM agentic.tasks WHERE status='APPROVED'), '[]'::jsonb),
    'standup', (SELECT jsonb_build_object(
        'published_24h', count(*) FILTER (WHERE status='PUBLISHED' AND updated_at > now()-interval '24 hours'),
        'failed_24h',    count(*) FILTER (WHERE status='FAILED'    AND updated_at > now()-interval '24 hours'),
        'queued_now',    count(*) FILTER (WHERE status='QUEUED'),
        'draft_now',     count(*) FILTER (WHERE status='DRAFT'))
      FROM agentic.tasks)
  );
$$;

-- Keputusan HEAD — satu pintu, actor SYSTEM, alasan wajib (audit §1.6)
CREATE OR REPLACE FUNCTION public.agentic_head_decide(
  p_task_id UUID, p_action TEXT, p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
BEGIN
  IF COALESCE(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'Keputusan HEAD wajib beralasan'; END IF;
  IF p_action = 'APPROVE' THEN
    RETURN to_jsonb(agentic.transition_task(p_task_id, 'APPROVED', 'SYSTEM', NULL, 'HEAD: ' || p_reason));
  ELSIF p_action = 'PUBLISH' THEN
    RETURN public.agentic_publish(p_task_id, NULL, 'SYSTEM');
  ELSIF p_action = 'REJECT' THEN
    RETURN public.agentic_reject(p_task_id, 'HEAD/QA: ' || p_reason, NULL, 'SYSTEM');
  ELSE
    RAISE EXCEPTION 'Aksi HEAD tidak dikenal: %', p_action;
  END IF;
END $$;

-- Pembuat task organ dari cron/UI — dedupe (tidak dobel bila masih antri)
CREATE OR REPLACE FUNCTION public.agentic_org_kick(p_type TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v JSONB;
BEGIN
  IF p_type NOT IN ('HEAD_TICK','IT_CHECK') THEN RAISE EXCEPTION 'Tipe organ tidak dikenal: %', p_type; END IF;
  IF EXISTS (SELECT 1 FROM agentic.tasks WHERE task_type=p_type AND status IN ('QUEUED','PROCESSING')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'masih ada yang antri/berjalan');
  END IF;
  v := public.agentic_create_task('ORG', p_type,
    CASE p_type WHEN 'HEAD_TICK' THEN 'HEAD: tick organisasi' ELSE 'Kepala IT: pemeriksaan sistem' END,
    COALESCE(p_payload,'{}'::jsonb));
  RETURN v;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- §G. VIEWS & GRANTS
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.agentic_agents_v   AS SELECT * FROM agentic.agents;
CREATE OR REPLACE VIEW public.agentic_rights_v   AS SELECT * FROM agentic.decision_rights;
CREATE OR REPLACE VIEW public.agentic_qa_v       AS SELECT * FROM agentic.qa_reviews;
CREATE OR REPLACE VIEW public.agentic_msgs_v     AS SELECT * FROM agentic.agent_messages;
GRANT SELECT ON public.agentic_agents_v, public.agentic_rights_v,
  public.agentic_qa_v, public.agentic_msgs_v TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.agentic_publish(UUID,UUID,TEXT),
  public.agentic_reject(UUID,TEXT,UUID,TEXT),
  public.agentic_task_get(UUID),
  public.agentic_agent_get(TEXT),
  public.agentic_qa_add(JSONB),
  public.agentic_msg_add(JSONB),
  public.agentic_head_data(),
  public.agentic_head_decide(UUID,TEXT,TEXT),
  public.agentic_org_kick(TEXT,JSONB)
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §CRON ORGANISASI (aktifkan pg_cron & pg_net, lalu jalankan — ganti
-- <PROJECT> dan <SERVICE_ROLE_KEY>):
--
--   -- worker tiap menit (bila belum ada dari Fase 0):
--   select cron.schedule('agentic-worker-tick','* * * * *', $$
--     select net.http_post(
--       url:='https://<PROJECT>.supabase.co/functions/v1/agentic-worker',
--       headers:='{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--       body:='{"max":3}'::jsonb); $$);
--   -- HEAD tick tiap 15 menit:
--   select cron.schedule('agentic-head-tick','*/15 * * * *',
--     $$ select public.agentic_org_kick('HEAD_TICK'); $$);
--   -- Standup harian 07:00 WIB (00:00 UTC):
--   select cron.schedule('agentic-standup','0 0 * * *',
--     $$ select public.agentic_org_kick('HEAD_TICK','{"standup":true}'::jsonb); $$);
--   -- Kepala IT tiap 6 jam:
--   select cron.schedule('agentic-it-check','0 */6 * * *',
--     $$ select public.agentic_org_kick('IT_CHECK'); $$);
--   -- Reaper tiap 5 menit:
--   select cron.schedule('agentic-reaper','*/5 * * * *',
--     $$ select agentic.reap_stuck_tasks(15); $$);
-- ══════════════════════════════════════════════════════════════════════

SELECT 'Agentic Fase 6 siap — organisasi agent (HEAD + QA + IT) dengan Matriks Mandat' AS status;
