-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 1 & 2
-- Fase 1: Approval Engine (approve / reject+feedback / retry / publish)
-- Fase 2: Document Agent (registry, gap analysis, prompt templates,
--         compliance score, review cycle, seed ISO 15189:2022)
-- ----------------------------------------------------------------------
-- PRASYARAT : supabase_agentic.sql (Fase 0) sudah dijalankan.
-- IDEMPOTEN : aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. STORAGE BUCKET "agentic" (upload dokumen ingest)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('agentic','agentic', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "agentic_read"   ON storage.objects;
DROP POLICY IF EXISTS "agentic_insert" ON storage.objects;
DROP POLICY IF EXISTS "agentic_update" ON storage.objects;
DROP POLICY IF EXISTS "agentic_delete" ON storage.objects;
CREATE POLICY "agentic_read"   ON storage.objects FOR SELECT USING (bucket_id = 'agentic');
CREATE POLICY "agentic_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agentic');
CREATE POLICY "agentic_update" ON storage.objects FOR UPDATE USING (bucket_id = 'agentic');
CREATE POLICY "agentic_delete" ON storage.objects FOR DELETE USING (bucket_id = 'agentic');

-- ══════════════════════════════════════════════════════════════════════
-- §B. FASE 1 — APPROVAL ENGINE (public RPC, SECURITY DEFINER)
--     Semua lewat agentic.transition_task → matriks §4.2 + audit trail.
-- ══════════════════════════════════════════════════════════════════════

-- Setujui task. Alur §4.2:
--   DRAFT + needs_medical_review  → IN_MEDICAL_REVIEW (diteruskan ke reviewer medis)
--   DRAFT (tanpa review medis)    → APPROVED
--   IN_MEDICAL_REVIEW             → APPROVED
CREATE OR REPLACE FUNCTION public.agentic_approve(
  p_task_id UUID, p_actor_id UUID DEFAULT NULL, p_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_t agentic.tasks;
BEGIN
  SELECT * INTO v_t FROM agentic.tasks WHERE id = p_task_id;
  IF v_t.id IS NULL THEN RAISE EXCEPTION 'Task % tidak ditemukan', p_task_id; END IF;

  IF v_t.status = 'DRAFT' AND v_t.needs_medical_review THEN
    RETURN to_jsonb(agentic.transition_task(p_task_id, 'IN_MEDICAL_REVIEW', 'USER', p_actor_id,
      COALESCE(p_note,'Diteruskan ke review medis (wajib untuk konten medis)')));
  ELSIF v_t.status IN ('DRAFT','IN_MEDICAL_REVIEW') THEN
    RETURN to_jsonb(agentic.transition_task(p_task_id, 'APPROVED', 'USER', p_actor_id,
      COALESCE(p_note,'Disetujui')));
  ELSE
    RAISE EXCEPTION 'Task berstatus % — tidak bisa di-approve (hanya DRAFT / IN_MEDICAL_REVIEW)', v_t.status;
  END IF;
END $$;

-- Tolak task + feedback → langsung antri ulang (REJECTED → QUEUED),
-- feedback disuntik ke payload.rejection_feedback sbg konteks retry (§5.1).
CREATE OR REPLACE FUNCTION public.agentic_reject(
  p_task_id UUID, p_feedback TEXT, p_actor_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_row agentic.tasks;
BEGIN
  IF COALESCE(trim(p_feedback),'') = '' THEN
    RAISE EXCEPTION 'Feedback wajib diisi saat menolak (dipakai sebagai konteks perbaikan)';
  END IF;
  PERFORM agentic.transition_task(p_task_id, 'REJECTED', 'USER', p_actor_id, p_feedback);

  UPDATE agentic.tasks
     SET payload = jsonb_set(payload, '{rejection_feedback}', to_jsonb(p_feedback), true),
         attempts = 0, error_message = NULL
   WHERE id = p_task_id;

  v_row := agentic.transition_task(p_task_id, 'QUEUED', 'USER', p_actor_id,
             'Antri ulang dengan feedback penolakan');
  RETURN to_jsonb(v_row);
END $$;

-- Retry task FAILED → QUEUED (manual). Reset attempt bila budget habis (§9.6).
CREATE OR REPLACE FUNCTION public.agentic_retry(
  p_task_id UUID, p_actor_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_t agentic.tasks;
BEGIN
  SELECT * INTO v_t FROM agentic.tasks WHERE id = p_task_id;
  IF v_t.id IS NULL THEN RAISE EXCEPTION 'Task % tidak ditemukan', p_task_id; END IF;
  IF v_t.status <> 'FAILED' THEN
    RAISE EXCEPTION 'Hanya task FAILED yang bisa di-retry (status saat ini: %)', v_t.status;
  END IF;
  IF v_t.attempts >= v_t.max_attempts THEN
    UPDATE agentic.tasks SET attempts = 0 WHERE id = p_task_id; -- reset budget (retry manual)
  END IF;
  UPDATE agentic.tasks SET error_message = NULL WHERE id = p_task_id;
  RETURN to_jsonb(agentic.transition_task(p_task_id, 'QUEUED', 'USER', p_actor_id, 'Retry manual'));
END $$;

-- Batalkan task antrian
CREATE OR REPLACE FUNCTION public.agentic_cancel(
  p_task_id UUID, p_actor_id UUID DEFAULT NULL, p_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT to_jsonb(agentic.transition_task(p_task_id, 'CANCELLED', 'USER', p_actor_id,
    COALESCE(p_note,'Dibatalkan user')));
$$;

-- Publish task APPROVED → PUBLISHED.
-- Utk agent DOCUMENT: assign doc_number otomatis OL/{TYPE}/{DEPT}/{seq},
-- insert document_revisions, effective_date=hari ini, next_review = +2 tahun (§5.1).
-- Utk agent CONTENT : slot kalender → READY.
CREATE OR REPLACE FUNCTION public.agentic_publish(
  p_task_id UUID, p_actor_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE
  v_t agentic.tasks; v_doc agentic.document_registry;
  v_doc_id UUID; v_cal_id UUID; v_num TEXT; v_seq INT; v_rev INT;
BEGIN
  SELECT * INTO v_t FROM agentic.tasks WHERE id = p_task_id;
  IF v_t.id IS NULL THEN RAISE EXCEPTION 'Task % tidak ditemukan', p_task_id; END IF;

  v_t := agentic.transition_task(p_task_id, 'PUBLISHED', 'USER', p_actor_id, 'Dipublikasikan');

  -- ── Side-effect DOCUMENT: registrasi resmi dokumen ──
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
              COALESCE(v_t.result->>'change_note', v_t.title),
              p_actor_id, now())
      ON CONFLICT (document_id, revision) DO NOTHING;

      UPDATE agentic.document_registry
         SET doc_number = v_num, status = 'PUBLISHED', current_revision = v_rev,
             effective_date = CURRENT_DATE,
             next_review_date = CURRENT_DATE + INTERVAL '2 years',
             current_file_path = COALESCE(NULLIF(v_t.result->>'file_path',''), current_file_path),
             linked_task_id = v_t.id, updated_at = now()
       WHERE id = v_doc.id;
    END IF;
  END IF;

  -- ── Side-effect CONTENT: kalender → READY ──
  v_cal_id := NULLIF(v_t.payload->>'calendar_id','')::uuid;
  IF v_cal_id IS NOT NULL THEN
    UPDATE agentic.content_calendar SET status = 'READY' WHERE id = v_cal_id;
  END IF;

  RETURN to_jsonb(v_t) || jsonb_build_object('doc_number', v_num);
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- §C. FASE 2 — RPC PENDUKUNG DOCUMENT AGENT (dipakai worker & UI)
-- ══════════════════════════════════════════════════════════════════════

-- Ambil prompt template aktif berdasarkan code
CREATE OR REPLACE FUNCTION public.agentic_get_prompt(p_code TEXT)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT to_jsonb(t) FROM agentic.prompt_templates t WHERE code = p_code AND active LIMIT 1;
$$;

-- Upsert registry dari hasil ingest.
-- Cocokkan: id > doc_number > (title+department). Return row jsonb.
CREATE OR REPLACE FUNCTION public.agentic_registry_upsert(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_id UUID; v_row agentic.document_registry;
BEGIN
  SELECT id INTO v_id FROM agentic.document_registry
   WHERE (NULLIF(p->>'id','') IS NOT NULL AND id = (p->>'id')::uuid)
      OR (NULLIF(p->>'doc_number','') IS NOT NULL AND doc_number = p->>'doc_number')
      OR (lower(title) = lower(p->>'title') AND department = COALESCE(p->>'department','MUTU'))
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO agentic.document_registry
      (title, doc_level, doc_type, department, iso_clause, status,
       effective_date, source_file_path, extracted_meta, gap_notes, doc_number)
    VALUES (
      COALESCE(NULLIF(p->>'title',''),'(tanpa judul)'),
      COALESCE(NULLIF(p->>'doc_level','')::smallint, 2),
      COALESCE(NULLIF(p->>'doc_type',''),'SOP'),
      COALESCE(NULLIF(p->>'department',''),'MUTU'),
      NULLIF(p->>'iso_clause',''),
      COALESCE(NULLIF(p->>'status',''),'DISCOVERED'),
      NULLIF(p->>'effective_date','')::date,
      NULLIF(p->>'source_file_path',''),
      COALESCE(p->'extracted_meta','{}'::jsonb),
      NULLIF(p->>'gap_notes',''),
      NULLIF(p->>'doc_number','')
    ) RETURNING * INTO v_row;
  ELSE
    UPDATE agentic.document_registry SET
      title           = COALESCE(NULLIF(p->>'title',''), title),
      doc_level       = COALESCE(NULLIF(p->>'doc_level','')::smallint, doc_level),
      doc_type        = COALESCE(NULLIF(p->>'doc_type',''), doc_type),
      department      = COALESCE(NULLIF(p->>'department',''), department),
      iso_clause      = COALESCE(NULLIF(p->>'iso_clause',''), iso_clause),
      status          = COALESCE(NULLIF(p->>'status',''), status),
      effective_date  = COALESCE(NULLIF(p->>'effective_date','')::date, effective_date),
      source_file_path= COALESCE(NULLIF(p->>'source_file_path',''), source_file_path),
      extracted_meta  = COALESCE(extracted_meta,'{}'::jsonb) || COALESCE(p->'extracted_meta','{}'::jsonb),
      gap_notes       = COALESCE(NULLIF(p->>'gap_notes',''), gap_notes),
      updated_at      = now()
    WHERE id = v_id RETURNING * INTO v_row;
  END IF;
  RETURN to_jsonb(v_row);
END $$;

-- Update parsial registry (dipakai worker: set DRAFT / NEEDS_REPAIR / link task)
CREATE OR REPLACE FUNCTION public.agentic_doc_update(p_id UUID, p JSONB)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  UPDATE agentic.document_registry SET
    status          = COALESCE(NULLIF(p->>'status',''), status),
    gap_notes       = COALESCE(NULLIF(p->>'gap_notes',''), gap_notes),
    linked_task_id  = COALESCE(NULLIF(p->>'linked_task_id','')::uuid, linked_task_id),
    current_file_path = COALESCE(NULLIF(p->>'current_file_path',''), current_file_path),
    extracted_meta  = COALESCE(extracted_meta,'{}'::jsonb) || COALESCE(p->'extracted_meta','{}'::jsonb),
    updated_at      = now()
  WHERE id = p_id
  RETURNING to_jsonb(document_registry);
$$;

-- Detail 1 dokumen (worker repair butuh full_text di extracted_meta)
CREATE OR REPLACE FUNCTION public.agentic_doc_get(p_id UUID)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT to_jsonb(d) FROM agentic.document_registry d WHERE id = p_id;
$$;

-- Detail 1 baris checklist (worker generate)
CREATE OR REPLACE FUNCTION public.agentic_checklist_get(p_id UUID)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT to_jsonb(c) FROM agentic.compliance_checklist c WHERE id = p_id;
$$;

-- Data utk gap analysis worker: checklist aktif + inventaris dokumen ringkas
CREATE OR REPLACE FUNCTION public.agentic_gap_data()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'checklist', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'framework', c.framework, 'clause_ref', c.clause_ref,
        'requirement', c.requirement, 'required_doc_type', c.required_doc_type,
        'required_doc_level', c.required_doc_level, 'department', c.department,
        'is_mandatory', c.is_mandatory) ORDER BY c.clause_ref)
      FROM agentic.compliance_checklist c WHERE c.active), '[]'::jsonb),
    'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'doc_type', d.doc_type, 'doc_level', d.doc_level,
        'department', d.department, 'iso_clause', d.iso_clause,
        'doc_number', d.doc_number, 'status', d.status) ORDER BY d.title)
      FROM agentic.document_registry d WHERE d.status <> 'MISSING'), '[]'::jsonb)
  );
$$;

-- Terapkan hasil gap analysis (dipanggil worker).
-- p = { matches: [ {checklist_id, matched_document_id|null, confidence, gap_note} ] }
-- Klausul wajib tanpa dokumen → buat row registry MISSING + task DOC_GENERATE (dedupe).
CREATE OR REPLACE FUNCTION public.agentic_gap_apply(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE
  m JSONB; v_cl agentic.compliance_checklist;
  v_doc UUID; v_conf NUMERIC; v_note TEXT;
  n_matched INT := 0; n_missing INT := 0; n_tasks INT := 0;
  v_reg_id UUID; v_task JSONB;
BEGIN
  FOR m IN SELECT * FROM jsonb_array_elements(COALESCE(p->'matches','[]'::jsonb)) LOOP
    SELECT * INTO v_cl FROM agentic.compliance_checklist WHERE id = NULLIF(m->>'checklist_id','')::uuid;
    CONTINUE WHEN v_cl.id IS NULL;

    v_doc  := NULLIF(m->>'matched_document_id','')::uuid;
    v_conf := LEAST(1, GREATEST(0, COALESCE(NULLIF(m->>'confidence','')::numeric, 0)));
    v_note := NULLIF(m->>'gap_note','');

    -- pastikan dokumen yang di-refer LLM benar-benar ada (anti-halusinasi §9)
    IF v_doc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agentic.document_registry WHERE id = v_doc) THEN
      v_doc := NULL; v_conf := 0;
      v_note := COALESCE(v_note,'') || ' [ID dokumen dari LLM tidak valid — dianulir]';
    END IF;

    UPDATE agentic.compliance_checklist
       SET matched_document_id = v_doc, match_confidence = v_conf
     WHERE id = v_cl.id;
    IF v_doc IS NOT NULL THEN n_matched := n_matched + 1; END IF;

    -- klausul wajib tanpa dokumen → registry MISSING + task DOC_GENERATE
    IF v_doc IS NULL AND v_cl.is_mandatory THEN
      SELECT id INTO v_reg_id FROM agentic.document_registry
       WHERE status = 'MISSING' AND extracted_meta->>'checklist_id' = v_cl.id::text LIMIT 1;

      IF v_reg_id IS NULL THEN
        INSERT INTO agentic.document_registry
          (title, doc_level, doc_type, department, iso_clause, status, gap_notes, extracted_meta)
        VALUES (
          '[WAJIB ' || v_cl.clause_ref || '] ' || left(v_cl.requirement, 200),
          COALESCE(v_cl.required_doc_level, 2),
          COALESCE(v_cl.required_doc_type, 'SOP'),
          COALESCE(v_cl.department, 'MUTU'),
          v_cl.framework || ' ' || v_cl.clause_ref,
          'MISSING', v_note,
          jsonb_build_object('checklist_id', v_cl.id)
        ) RETURNING id INTO v_reg_id;
        n_missing := n_missing + 1;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM agentic.tasks
          WHERE task_type = 'DOC_GENERATE' AND payload->>'checklist_id' = v_cl.id::text
            AND status IN ('QUEUED','PROCESSING','DRAFT','IN_MEDICAL_REVIEW','APPROVED')) THEN
        INSERT INTO agentic.tasks(agent, task_type, title, payload)
        VALUES ('DOCUMENT','DOC_GENERATE',
          'Generate ' || COALESCE(v_cl.required_doc_type,'SOP') || ' — klausul ' || v_cl.clause_ref,
          jsonb_build_object('checklist_id', v_cl.id, 'document_id', v_reg_id,
            'doc_type', COALESCE(v_cl.required_doc_type,'SOP'),
            'doc_level', COALESCE(v_cl.required_doc_level,2),
            'department', COALESCE(v_cl.department,'MUTU')))
        RETURNING to_jsonb(tasks) INTO v_task;
        INSERT INTO agentic.task_events(task_id, from_status, to_status, actor_type, note)
        VALUES ((v_task->>'id')::uuid, NULL, 'QUEUED', 'WORKER', 'auto dari gap analysis');
        n_tasks := n_tasks + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('matched', n_matched, 'missing_created', n_missing, 'tasks_created', n_tasks);
END $$;

-- Compliance score per framework × departemen (dashboard §5.1)
CREATE OR REPLACE FUNCTION public.agentic_compliance_score()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'framework', row->>'department'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'framework', framework,
      'department', COALESCE(department,'—'),
      'total',     count(*),
      'matched',   count(*) FILTER (WHERE matched_document_id IS NOT NULL AND COALESCE(match_confidence,0) >= 0.7),
      'low_conf',  count(*) FILTER (WHERE matched_document_id IS NOT NULL AND COALESCE(match_confidence,0) < 0.7),
      'missing',   count(*) FILTER (WHERE matched_document_id IS NULL),
      'pct',       round(100.0 * count(*) FILTER (WHERE matched_document_id IS NOT NULL AND COALESCE(match_confidence,0) >= 0.7) / count(*), 1)
    ) AS row
    FROM agentic.compliance_checklist
    WHERE active AND is_mandatory
    GROUP BY framework, department
  ) s;
$$;

-- Review cycle (cron harian §5.1): dokumen PUBLISHED yang jatuh tempo review
-- ≤30 hari → DUE_FOR_REVIEW + task DOC_REPAIR mode periodic_review (dedupe).
CREATE OR REPLACE FUNCTION public.agentic_review_cycle()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE r RECORD; n INT := 0; v_task JSONB;
BEGIN
  FOR r IN SELECT * FROM agentic.document_registry
            WHERE status = 'PUBLISHED' AND next_review_date IS NOT NULL
              AND next_review_date <= CURRENT_DATE + 30 LOOP
    UPDATE agentic.document_registry SET status='DUE_FOR_REVIEW', updated_at=now() WHERE id = r.id;

    IF NOT EXISTS (SELECT 1 FROM agentic.tasks
        WHERE task_type='DOC_REPAIR' AND payload->>'document_id' = r.id::text
          AND status IN ('QUEUED','PROCESSING','DRAFT','IN_MEDICAL_REVIEW','APPROVED')) THEN
      INSERT INTO agentic.tasks(agent, task_type, title, payload)
      VALUES ('DOCUMENT','DOC_REPAIR', 'Review berkala: ' || r.title,
        jsonb_build_object('document_id', r.id, 'mode', 'periodic_review', 'prompt_code', 'DOC_REPAIR_SOP'))
      RETURNING to_jsonb(tasks) INTO v_task;
      INSERT INTO agentic.task_events(task_id, from_status, to_status, actor_type, note)
      VALUES ((v_task->>'id')::uuid, NULL, 'QUEUED', 'SYSTEM', 'review cycle otomatis');
      n := n + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('due_for_review', n);
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- §D. VIEW UNTUK UI (read-only, PostgREST)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.agentic_registry_v  AS SELECT * FROM agentic.document_registry;
CREATE OR REPLACE VIEW public.agentic_checklist_v AS SELECT * FROM agentic.compliance_checklist;
CREATE OR REPLACE VIEW public.agentic_revisions_v AS SELECT * FROM agentic.document_revisions;
CREATE OR REPLACE VIEW public.agentic_prompts_v   AS SELECT * FROM agentic.prompt_templates;
CREATE OR REPLACE VIEW public.agentic_calendar_v  AS SELECT * FROM agentic.content_calendar;
CREATE OR REPLACE VIEW public.agentic_assets_v    AS SELECT * FROM agentic.content_assets;

GRANT SELECT ON public.agentic_registry_v, public.agentic_checklist_v,
  public.agentic_revisions_v, public.agentic_prompts_v,
  public.agentic_calendar_v, public.agentic_assets_v
TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.agentic_approve(UUID,UUID,TEXT),
  public.agentic_reject(UUID,TEXT,UUID),
  public.agentic_retry(UUID,UUID),
  public.agentic_cancel(UUID,UUID,TEXT),
  public.agentic_publish(UUID,UUID),
  public.agentic_get_prompt(TEXT),
  public.agentic_registry_upsert(JSONB),
  public.agentic_doc_update(UUID,JSONB),
  public.agentic_doc_get(UUID),
  public.agentic_checklist_get(UUID),
  public.agentic_gap_data(),
  public.agentic_gap_apply(JSONB),
  public.agentic_compliance_score(),
  public.agentic_review_cycle()
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §E. SEED — PROMPT TEMPLATES (§4.10, termasuk Firewall Isi vs Format §1.7
--     dan Placeholder Policy §9.3). Idempoten: upsert by code.
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature)
VALUES
('DOC_INGEST_META',
 'Anda adalah ekstraktor metadata dokumen QMS (Quality Management System) untuk laboratorium klinik OneLab. Balas HANYA JSON valid tanpa teks lain, dengan skema: {"title":string, "doc_type":"PEDOMAN"|"SOP"|"IK"|"FORMULIR"|"SK"|"PKS", "doc_level":1|2|3|4, "department":"LAB"|"FO"|"HOMECARE"|"MUTU"|"FARMASI"|"MCU"|"HRD"|"FINANCE"|"IT"|"UMUM", "doc_number":string|null, "revision":number|null, "effective_date":"YYYY-MM-DD"|null, "iso_clause":string|null, "format_ok":boolean, "format_issues":string|null}. doc_level: 1=Pedoman/Manual Mutu, 2=SOP, 3=Instruksi Kerja, 4=Formulir/Rekaman. format_ok=false bila dokumen SOP tidak memiliki struktur standar (Tujuan, Ruang Lingkup, Prosedur, dst). Jangan mengarang nilai — gunakan null bila tidak ada di dokumen.',
 E'NAMA FILE: {{file_name}}\n\nISI DOKUMEN:\n{{text}}',
 'light', 0.2),

('GAP_ANALYSIS_MATCH',
 'Anda adalah auditor mutu ISO 15189:2022 untuk laboratorium klinik. Tugas: mencocokkan persyaratan klausul dengan inventaris dokumen yang ada. Balas HANYA JSON array valid: [{"checklist_id":string, "clause_ref":string, "matched_document_id":string|null, "confidence":number 0-1, "gap_note":string|null}]. Aturan keras: (1) matched_document_id HARUS salah satu id dari daftar DOKUMEN yang diberikan, atau null — DILARANG mengarang id; (2) confidence < 0.7 bila keraguan; (3) gap_note singkat dalam Bahasa Indonesia menjelaskan kecocokan/kekurangan.',
 E'PERSYARATAN KLAUSUL (cocokkan semuanya):\n{{clauses}}\n\nINVENTARIS DOKUMEN TERSEDIA:\n{{documents}}',
 'main', 0.2),

('DOC_REPAIR_SOP',
 E'Anda adalah document controller senior laboratorium klinik (ISO 15189:2022). Tugas: memperbaiki/menstandarkan dokumen SOP OneLab.\n\nATURAN WAJIB:\n1. FIREWALL ISI vs FORMAT: referensi format HANYA untuk struktur/penyusunan — DILARANG menyalin isi substantif dari jenis dokumen lain yang tidak terkait.\n2. PLACEHOLDER POLICY: nilai yang butuh konfirmasi operator (angka klinis, harga, nama penanggung jawab, nomor telepon) TULIS sebagai [[KONFIRMASI: deskripsi]] — DILARANG dikarang.\n3. Pertahankan seluruh substansi teknis dokumen asli; perbaiki struktur, bahasa, konsistensi istilah.\n4. Struktur SOP standar 7 bagian: 1.Tujuan, 2.Ruang Lingkup, 3.Referensi, 4.Definisi, 5.Tanggung Jawab, 6.Prosedur (langkah bernomor), 7.Dokumen Terkait.\n5. Bila ada FEEDBACK PENOLAKAN, prioritaskan menindaklanjutinya.\n\nOutput: markdown dokumen lengkap saja, tanpa komentar pembuka/penutup.',
 E'METADATA:\n- Judul: {{title}}\n- Jenis: {{doc_type}} (level {{doc_level}})\n- Departemen: {{department}}\n- Klausul ISO terkait: {{iso_clause}}\n- Mode: {{mode}}\n\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}\n\nCATATAN GAP: {{gap_notes}}\n\nISI DOKUMEN ASLI:\n{{source_text}}',
 'main', 0.4),

('DOC_GENERATE_SOP',
 E'Anda adalah document controller senior laboratorium klinik (ISO 15189:2022). Tugas: menyusun draft dokumen QMS BARU untuk OneLab (lab klinik + klinik utama di Indonesia).\n\nATURAN WAJIB:\n1. PLACEHOLDER POLICY: semua nilai operasional yang butuh konfirmasi (angka klinis, frekuensi spesifik alat, nama penanggung jawab, merek alat) TULIS sebagai [[KONFIRMASI: deskripsi]] — DILARANG dikarang.\n2. Dokumen harus memenuhi persyaratan klausul yang diminta secara eksplisit.\n3. Struktur SOP standar 7 bagian: 1.Tujuan, 2.Ruang Lingkup, 3.Referensi, 4.Definisi, 5.Tanggung Jawab, 6.Prosedur (langkah bernomor), 7.Dokumen Terkait. Untuk PEDOMAN gunakan bab yang lazim; untuk FORMULIR buat tabel kolom isian.\n4. Bahasa Indonesia formal, istilah lab yang benar.\n5. Bila ada FEEDBACK PENOLAKAN, prioritaskan menindaklanjutinya.\n\nOutput: markdown dokumen lengkap saja, tanpa komentar pembuka/penutup.',
 E'PERSYARATAN:\n- Framework: {{framework}}\n- Klausul: {{clause_ref}}\n- Persyaratan: {{requirement}}\n- Jenis dokumen: {{doc_type}} (level {{doc_level}})\n- Departemen: {{department}}\n\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.4)
ON CONFLICT (code) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_template = EXCLUDED.user_prompt_template,
  model_hint = EXCLUDED.model_hint,
  temperature = EXCLUDED.temperature,
  updated_at = now();

-- ══════════════════════════════════════════════════════════════════════
-- §F. SEED — COMPLIANCE CHECKLIST ISO 15189:2022 (klausul 4–8, ringkas)
--     Starter set; lengkapi/ubah lewat UI atau SQL sesuai kebutuhan audit.
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.compliance_checklist
  (framework, clause_ref, requirement, required_doc_level, required_doc_type, department, is_mandatory)
VALUES
-- Klausul 4 — Persyaratan umum
('ISO15189:2022','4.1','Kebijakan ketidakberpihakan (impartiality): lab dan personel bebas dari tekanan komersial/finansial yang memengaruhi hasil',1,'SK','MUTU',true),
('ISO15189:2022','4.2','Kebijakan & prosedur kerahasiaan informasi pasien dan hasil pemeriksaan',2,'SOP','MUTU',true),
('ISO15189:2022','4.3','Persyaratan terkait pasien: kesejahteraan, keselamatan, dan hak pasien menjadi pertimbangan utama',1,'PEDOMAN','MUTU',true),
-- Klausul 5 — Struktur & tata kelola
('ISO15189:2022','5.1','Bukti badan hukum yang bertanggung jawab atas kegiatan laboratorium',4,'SK','UMUM',true),
('ISO15189:2022','5.2','Penetapan direktur/kepala laboratorium: kompetensi, kewenangan, dan tanggung jawab terdokumentasi',4,'SK','MUTU',true),
('ISO15189:2022','5.3','Ruang lingkup kegiatan laboratorium terdokumentasi (pemeriksaan yang dilakukan)',1,'PEDOMAN','MUTU',true),
('ISO15189:2022','5.4','Struktur organisasi, kewenangan, dan penunjukan manajemen mutu',1,'PEDOMAN','MUTU',true),
('ISO15189:2022','5.5','Sasaran mutu dan kebijakan mutu ditetapkan, dipantau, dan dikomunikasikan',1,'PEDOMAN','MUTU',true),
('ISO15189:2022','5.6','Manajemen risiko: identifikasi, penilaian, dan mitigasi risiko terhadap pelayanan & keselamatan pasien',2,'SOP','MUTU',true),
-- Klausul 6 — Sumber daya
('ISO15189:2022','6.2','Personel: kualifikasi, uraian tugas, orientasi, pelatihan, penilaian kompetensi berkala, dan rekamannya',2,'SOP','HRD',true),
('ISO15189:2022','6.3','Fasilitas & kondisi lingkungan: pengendalian akses, pemantauan suhu/kelembaban ruang & penyimpanan',2,'SOP','LAB',true),
('ISO15189:2022','6.4','Peralatan: seleksi, verifikasi saat instalasi, pengoperasian, pemeliharaan preventif, dan penanganan kerusakan',2,'SOP','LAB',true),
('ISO15189:2022','6.5','Kalibrasi peralatan dan ketertelusuran metrologi: program kalibrasi terjadwal dengan ketertelusuran SI',2,'SOP','LAB',true),
('ISO15189:2022','6.6','Reagen & bahan habis pakai: penerimaan, penyimpanan, uji akseptabilitas, inventori, dan penelusuran lot',2,'SOP','LAB',true),
('ISO15189:2022','6.7','Perjanjian pelayanan (service agreement): tinjauan permintaan, tender, dan kontrak pelayanan lab',2,'SOP','FO',true),
('ISO15189:2022','6.8','Jasa & pasokan eksternal: evaluasi dan pemantauan pemasok serta laboratorium rujukan',2,'SOP','UMUM',true),
-- Klausul 7 — Proses (pra-analitik → pasca-analitik)
('ISO15189:2022','7.2.4','Pra-analitik: permintaan pemeriksaan — formulir/instruksi permintaan berisi informasi minimal yang dipersyaratkan',4,'FORMULIR','LAB',true),
('ISO15189:2022','7.2.5','Pra-analitik: pengambilan spesimen primer — instruksi pengambilan, identifikasi pasien, dan pelabelan',2,'SOP','LAB',true),
('ISO15189:2022','7.2.6','Pra-analitik: transportasi spesimen — syarat waktu, suhu, dan keamanan transport',2,'SOP','LAB',true),
('ISO15189:2022','7.2.7','Pra-analitik: penerimaan spesimen — kriteria penerimaan/penolakan dan penanganan spesimen suboptimal',2,'SOP','LAB',true),
('ISO15189:2022','7.3.1','Analitik: verifikasi/validasi metode pemeriksaan sebelum digunakan',2,'SOP','LAB',true),
('ISO15189:2022','7.3.2','Analitik: instruksi kerja pemeriksaan per parameter/alat tersedia dan mutakhir',3,'IK','LAB',true),
('ISO15189:2022','7.3.5','Analitik: pengendalian mutu internal (QC) — aturan kontrol, frekuensi, tindakan saat out-of-control',2,'SOP','LAB',true),
('ISO15189:2022','7.3.6','Analitik: pemantapan mutu eksternal (PME/EQA) — keikutsertaan, evaluasi hasil, tindak lanjut',2,'SOP','LAB',true),
('ISO15189:2022','7.3.7','Analitik: penetapan & tinjauan berkala rentang rujukan / nilai keputusan klinis',2,'SOP','LAB',true),
('ISO15189:2022','7.4.1','Pasca-analitik: pelaporan hasil — isi laporan, format, kewenangan pelepasan hasil',2,'SOP','LAB',true),
('ISO15189:2022','7.4.1.3','Pasca-analitik: penyampaian nilai kritis — daftar nilai kritis, alur eskalasi, dan pencatatan',2,'SOP','LAB',true),
('ISO15189:2022','7.4.2','Pasca-analitik: penanganan, penyimpanan, retensi, dan pembuangan spesimen klinis',2,'SOP','LAB',true),
('ISO15189:2022','7.4.1.6','Pasca-analitik: amandemen/koreksi laporan hasil yang sudah dirilis',2,'SOP','LAB',true),
('ISO15189:2022','7.5','Pekerjaan tidak sesuai (nonconforming work): identifikasi, penghentian, evaluasi dampak klinis, dan tindakan',2,'SOP','MUTU',true),
('ISO15189:2022','7.6','Pengendalian data & manajemen informasi: validasi LIS, hak akses, integritas data, backup & recovery',2,'SOP','IT',true),
('ISO15189:2022','7.7','Keluhan: penerimaan, evaluasi, dan tindak lanjut keluhan pasien/pengguna layanan',2,'SOP','FO',true),
('ISO15189:2022','7.8','Kesinambungan layanan & kesiapan darurat (bencana, listrik padam, LIS down)',2,'SOP','MUTU',true),
-- Klausul 8 — Sistem manajemen
('ISO15189:2022','8.2','Dokumentasi sistem manajemen: Manual Mutu / Pedoman Mutu induk',1,'PEDOMAN','MUTU',true),
('ISO15189:2022','8.3','Pengendalian dokumen: penomoran, pengesahan, distribusi, revisi, dan penarikan dokumen kedaluwarsa',2,'SOP','MUTU',true),
('ISO15189:2022','8.4','Pengendalian rekaman: identifikasi, penyimpanan, masa retensi, dan pemusnahan rekaman',2,'SOP','MUTU',true),
('ISO15189:2022','8.5','Tindakan menghadapi risiko & peluang perbaikan (risk-based thinking)',2,'SOP','MUTU',true),
('ISO15189:2022','8.6','Perbaikan berkesinambungan: umpan balik pasien/pengguna, indikator mutu, dan program peningkatan',2,'SOP','MUTU',true),
('ISO15189:2022','8.7','Ketidaksesuaian & tindakan korektif (CAPA): pencatatan, analisis akar masalah, verifikasi efektivitas',2,'SOP','MUTU',true),
('ISO15189:2022','8.8','Evaluasi: audit internal terjadwal dengan auditor kompeten dan tindak lanjut temuan',2,'SOP','MUTU',true),
('ISO15189:2022','8.9','Tinjauan manajemen: agenda minimal, frekuensi, notulen, dan tindak lanjut keputusan',2,'SOP','MUTU',true)
ON CONFLICT (framework, clause_ref, required_doc_type, department) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- §CRON TAMBAHAN (opsional — jalankan bila pg_cron aktif)
--
--   -- review cycle harian jam 02:00 WIB (19:00 UTC):
--   select cron.schedule('agentic-review-cycle','0 19 * * *',
--     $$ select public.agentic_review_cycle(); $$);
-- ══════════════════════════════════════════════════════════════════════

SELECT 'Agentic Fase 1 & 2 siap — approval engine + document agent + seed ISO 15189:2022' AS status;
