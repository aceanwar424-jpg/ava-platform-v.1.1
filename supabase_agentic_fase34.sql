-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 3 & 4
-- Fase 3: Content & Branding Agent (kalender, planner mingguan, MAKE_*)
-- Fase 4: Hardening (housekeeping/retensi; notifikasi via secret worker)
-- ----------------------------------------------------------------------
-- PRASYARAT : supabase_agentic.sql (F0) + supabase_agentic_fase12.sql (F1-2)
-- IDEMPOTEN : aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. HARI KESEHATAN (seed statis §5.2 — referensi planner)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.health_days (
  id        SERIAL PRIMARY KEY,
  month     SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  day       SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 31),
  name      VARCHAR(160) NOT NULL,
  scope     VARCHAR(20) NOT NULL DEFAULT 'INTL',   -- INTL | NASIONAL
  test_hint TEXT,                                  -- kode tes terkait (koma)
  UNIQUE(month, day, name)
);
ALTER TABLE agentic.health_days DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.health_days TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE agentic.health_days_id_seq TO anon, authenticated, service_role;

INSERT INTO agentic.health_days (month, day, name, scope, test_hint) VALUES
( 1,25,'Hari Gizi Nasional','NASIONAL','ALB,PROT,FE'),
( 2, 4,'Hari Kanker Sedunia','INTL','PSA,CEA,AFP,CA125'),
( 3,12,'Hari Ginjal Sedunia (Kamis ke-2 Maret, tanggal perkiraan)','INTL','UREUM,CREAT,UA,eGFR'),
( 3,24,'Hari Tuberkulosis Sedunia','INTL','TCM,BTA,LED'),
( 4, 7,'Hari Kesehatan Sedunia','INTL',''),
( 4,25,'Hari Malaria Sedunia','INTL','MAL,DDR'),
( 5,17,'Hari Hipertensi Sedunia','INTL','CHOL,LDL,HDL,TG'),
( 5,31,'Hari Tanpa Tembakau Sedunia','INTL',''),
( 6,14,'Hari Donor Darah Sedunia','INTL','HB,GOLDA,HBSAG'),
( 7,28,'Hari Hepatitis Sedunia','INTL','HBSAG,ANTIHCV,SGOT,SGPT'),
( 9,17,'Hari Keselamatan Pasien Sedunia','INTL',''),
( 9,29,'Hari Jantung Sedunia','INTL','CHOL,LDL,HDL,TG,CKMB,TROP'),
(10,10,'Hari Kesehatan Jiwa Sedunia','INTL',''),
(10,15,'Hari Cuci Tangan Sedunia','INTL',''),
(11,12,'Hari Kesehatan Nasional','NASIONAL',''),
(11,14,'Hari Diabetes Sedunia','INTL','GLU,HBA1C,GDP,GD2PP'),
(12, 1,'Hari AIDS Sedunia','INTL','ANTIHIV,CD4')
ON CONFLICT (month, day, name) DO NOTHING;

CREATE OR REPLACE VIEW public.agentic_health_days_v AS SELECT * FROM agentic.health_days;
GRANT SELECT ON public.agentic_health_days_v TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §B. RPC CONTENT AGENT
-- ══════════════════════════════════════════════════════════════════════

-- Data untuk planner mingguan: slot 14 hari ke depan + hari kesehatan dlm window
CREATE OR REPLACE FUNCTION public.agentic_planner_data()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'today', CURRENT_DATE,
    'window_end', CURRENT_DATE + 14,
    'existing_slots', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'target_date', c.target_date, 'content_type', c.content_type,
        'topic', c.topic, 'status', c.status) ORDER BY c.target_date)
      FROM agentic.content_calendar c
      WHERE c.target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14
        AND c.status <> 'SKIPPED'), '[]'::jsonb),
    'health_days', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'date', make_date(EXTRACT(YEAR FROM d)::int, h.month, h.day),
        'name', h.name, 'scope', h.scope, 'test_hint', h.test_hint))
      FROM agentic.health_days h,
           LATERAL (SELECT CURRENT_DATE + 0 AS d) x
      WHERE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, h.month, h.day)
            BETWEEN CURRENT_DATE AND CURRENT_DATE + 21), '[]'::jsonb)
  );
$$;

-- Mapping content_type → task_type + kebutuhan review medis
CREATE OR REPLACE FUNCTION agentic.content_task_type(p_ct TEXT)
RETURNS TABLE(task_type TEXT, needs_review BOOLEAN)
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_ct
           WHEN 'ARTIKEL'       THEN 'MAKE_ARTIKEL'
           WHEN 'PPTX_DOKTER'   THEN 'MAKE_PPTX_DOKTER'
           WHEN 'EVENT'         THEN 'MAKE_EVENT_BRIEF'
           ELSE 'MAKE_SOSMED'   -- SOSMED_POST | SOSMED_CAROUSEL | FLYER
         END,
         p_ct IN ('ARTIKEL','PPTX_DOKTER');
$$;

-- Buat task produksi utk 1 slot kalender (dipakai UI & planner_apply). Dedupe.
CREATE OR REPLACE FUNCTION public.agentic_produce_slot(p_calendar_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_c agentic.content_calendar; v_tt TEXT; v_rev BOOLEAN; v_task JSONB;
BEGIN
  SELECT * INTO v_c FROM agentic.content_calendar WHERE id = p_calendar_id;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'Slot kalender % tidak ditemukan', p_calendar_id; END IF;

  IF v_c.task_id IS NOT NULL AND EXISTS (SELECT 1 FROM agentic.tasks
      WHERE id = v_c.task_id AND status IN ('QUEUED','PROCESSING','DRAFT','IN_MEDICAL_REVIEW','APPROVED')) THEN
    RAISE EXCEPTION 'Slot ini sudah punya task produksi yang berjalan';
  END IF;

  SELECT * INTO v_tt, v_rev FROM agentic.content_task_type(v_c.content_type);

  INSERT INTO agentic.tasks(agent, task_type, title, payload, needs_medical_review, scheduled_for)
  VALUES ('CONTENT', v_tt,
    v_c.content_type || ': ' || v_c.topic,
    jsonb_build_object('calendar_id', v_c.id, 'content_type', v_c.content_type,
      'topic', v_c.topic, 'angle', v_c.angle, 'framework', COALESCE(v_c.framework,'PAS'),
      'channel', COALESCE(v_c.channel,'IG'), 'target_date', v_c.target_date,
      'related_test_codes', COALESCE(to_jsonb(v_c.related_test_codes),'[]'::jsonb),
      'health_day_ref', v_c.health_day_ref),
    v_rev, v_c.target_date::timestamptz)
  RETURNING to_jsonb(tasks) INTO v_task;

  INSERT INTO agentic.task_events(task_id, from_status, to_status, actor_type, note)
  VALUES ((v_task->>'id')::uuid, NULL, 'QUEUED', 'SYSTEM', 'produksi slot kalender');

  UPDATE agentic.content_calendar
     SET status = 'IN_PRODUCTION', task_id = (v_task->>'id')::uuid
   WHERE id = v_c.id;

  RETURN v_task;
END $$;

-- Terapkan hasil planner LLM: insert slot baru + auto-produksi slot H-<horizon>.
-- p = { slots:[{content_type,topic,angle,framework,target_date,channel,
--              related_test_codes[],health_day_ref}], produce_within_days:4 }
CREATE OR REPLACE FUNCTION public.agentic_planner_apply(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE
  s JSONB; v_id UUID; n_new INT := 0; n_prod INT := 0;
  v_h INT := COALESCE(NULLIF(p->>'produce_within_days','')::int, 4);
  v_date DATE; v_ct TEXT;
BEGIN
  FOR s IN SELECT * FROM jsonb_array_elements(COALESCE(p->'slots','[]'::jsonb)) LOOP
    v_date := NULLIF(s->>'target_date','')::date;
    v_ct   := COALESCE(NULLIF(s->>'content_type',''),'SOSMED_POST');
    CONTINUE WHEN v_date IS NULL OR v_date < CURRENT_DATE;
    CONTINUE WHEN v_ct NOT IN ('SOSMED_POST','SOSMED_CAROUSEL','ARTIKEL','PPTX_DOKTER','EVENT','FLYER');
    -- dedupe: topik sama di tanggal sama
    CONTINUE WHEN EXISTS (SELECT 1 FROM agentic.content_calendar
      WHERE target_date = v_date AND lower(topic) = lower(s->>'topic'));

    INSERT INTO agentic.content_calendar
      (content_type, topic, angle, framework, target_date, channel,
       related_test_codes, health_day_ref, source, status)
    VALUES (v_ct,
      COALESCE(NULLIF(s->>'topic',''),'(tanpa topik)'),
      NULLIF(s->>'angle',''),
      CASE WHEN s->>'framework' IN ('PAS','AIDA','EDU') THEN s->>'framework' ELSE 'PAS' END,
      v_date, COALESCE(NULLIF(s->>'channel',''),'IG'),
      CASE WHEN jsonb_typeof(s->'related_test_codes')='array'
           THEN ARRAY(SELECT jsonb_array_elements_text(s->'related_test_codes')) ELSE NULL END,
      NULLIF(s->>'health_day_ref',''), 'PLANNER_AI', 'PLANNED')
    RETURNING id INTO v_id;
    n_new := n_new + 1;

    IF v_date <= CURRENT_DATE + v_h THEN
      PERFORM public.agentic_produce_slot(v_id);
      n_prod := n_prod + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('slots_created', n_new, 'production_started', n_prod);
END $$;

-- Tambah slot kalender manual (form UI)
CREATE OR REPLACE FUNCTION public.agentic_calendar_add(p JSONB)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  INSERT INTO agentic.content_calendar
    (content_type, topic, angle, framework, target_date, channel, related_test_codes, health_day_ref, source)
  VALUES (
    COALESCE(NULLIF(p->>'content_type',''),'SOSMED_POST'),
    COALESCE(NULLIF(p->>'topic',''),'(tanpa topik)'),
    NULLIF(p->>'angle',''),
    CASE WHEN p->>'framework' IN ('PAS','AIDA','EDU') THEN p->>'framework' ELSE 'PAS' END,
    COALESCE(NULLIF(p->>'target_date','')::date, CURRENT_DATE + 3),
    COALESCE(NULLIF(p->>'channel',''),'IG'),
    CASE WHEN jsonb_typeof(p->'related_test_codes')='array'
         THEN ARRAY(SELECT jsonb_array_elements_text(p->'related_test_codes')) ELSE NULL END,
    NULLIF(p->>'health_day_ref',''), 'MANUAL')
  RETURNING to_jsonb(content_calendar);
$$;

CREATE OR REPLACE FUNCTION public.agentic_calendar_get(p_id UUID)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT to_jsonb(c) FROM agentic.content_calendar c WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.agentic_calendar_set_status(p_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  UPDATE agentic.content_calendar SET status = p_status WHERE id = p_id
  RETURNING to_jsonb(content_calendar);
$$;

-- Simpan aset konten (dipanggil worker: COPY / IMAGE / dll)
CREATE OR REPLACE FUNCTION public.agentic_asset_add(p JSONB)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  INSERT INTO agentic.content_assets(calendar_id, task_id, asset_type, file_path, text_content, meta)
  VALUES (
    NULLIF(p->>'calendar_id','')::uuid,
    (p->>'task_id')::uuid,
    COALESCE(NULLIF(p->>'asset_type',''),'COPY'),
    NULLIF(p->>'file_path',''),
    NULLIF(p->>'text_content',''),
    COALESCE(p->'meta','{}'::jsonb))
  RETURNING to_jsonb(content_assets);
$$;

-- Slot promosi otomatis utk event (H-14, H-7, H-1) — dipanggil worker EVENT_BRIEF
CREATE OR REPLACE FUNCTION public.agentic_event_promo(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_date DATE; v_name TEXT; d INT; v_t DATE; n INT := 0;
BEGIN
  v_date := NULLIF(p->>'event_date','')::date;
  v_name := COALESCE(NULLIF(p->>'event_name',''),'Event OneLab');
  IF v_date IS NULL THEN RETURN jsonb_build_object('slots_created',0); END IF;
  FOREACH d IN ARRAY ARRAY[14,7,1] LOOP
    v_t := v_date - d;
    CONTINUE WHEN v_t < CURRENT_DATE;
    CONTINUE WHEN EXISTS (SELECT 1 FROM agentic.content_calendar
      WHERE target_date = v_t AND lower(topic) = lower('Promo ' || v_name || ' (H-' || d || ')'));
    INSERT INTO agentic.content_calendar(content_type, topic, angle, framework, target_date, channel, source)
    VALUES ('SOSMED_POST', 'Promo ' || v_name || ' (H-' || d || ')',
      'Ajakan mengikuti ' || v_name || ' pada ' || to_char(v_date,'DD Mon YYYY'),
      'AIDA', v_t, 'IG', 'PLANNER_AI');
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('slots_created', n);
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- §C. FASE 4 — HOUSEKEEPING / RETENSI (§Fase4 backup & retensi log)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_housekeep()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE n_cache INT; n_llm INT; n_events INT;
BEGIN
  DELETE FROM agentic.llm_cache WHERE expires_at < now();
  GET DIAGNOSTICS n_cache = ROW_COUNT;

  DELETE FROM agentic.llm_requests WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS n_llm = ROW_COUNT;

  -- audit trail task dipertahankan 1 tahun utk task final tak bernilai audit tinggi
  DELETE FROM agentic.task_events e
  USING agentic.tasks t
  WHERE e.task_id = t.id AND t.status IN ('CANCELLED','FAILED')
    AND e.created_at < now() - INTERVAL '365 days';
  GET DIAGNOSTICS n_events = ROW_COUNT;

  RETURN jsonb_build_object('cache_purged', n_cache, 'llm_logs_purged', n_llm, 'events_purged', n_events);
END $$;

-- Ringkasan monitor 7 hari (dashboard hardening)
CREATE OR REPLACE FUNCTION public.agentic_monitor_7d()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'llm_7d', COALESCE((SELECT jsonb_agg(r ORDER BY r->>'day') FROM (
        SELECT jsonb_build_object('day', date_trunc('day', created_at)::date,
          'provider', provider, 'n', count(*),
          'tokens_in', COALESCE(sum(input_tokens),0), 'tokens_out', COALESCE(sum(output_tokens),0),
          'errors', count(*) FILTER (WHERE status='ERROR')) AS r
        FROM agentic.llm_requests WHERE created_at > now() - INTERVAL '7 days'
        GROUP BY 1, provider) s), '[]'::jsonb),
    'tasks_7d', COALESCE((SELECT jsonb_agg(r) FROM (
        SELECT jsonb_build_object('status', status, 'n', count(*)) AS r
        FROM agentic.tasks WHERE updated_at > now() - INTERVAL '7 days'
        GROUP BY status) s), '[]'::jsonb),
    'failed_open', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'error', left(COALESCE(error_message,''),200),
        'attempts', attempts) ORDER BY updated_at DESC)
      FROM agentic.tasks WHERE status='FAILED'), '[]'::jsonb)
  );
$$;

-- ══════════════════════════════════════════════════════════════════════
-- §D. GRANTS
-- ══════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION
  public.agentic_planner_data(),
  public.agentic_planner_apply(JSONB),
  public.agentic_produce_slot(UUID),
  public.agentic_calendar_add(JSONB),
  public.agentic_calendar_get(UUID),
  public.agentic_calendar_set_status(UUID,TEXT),
  public.agentic_asset_add(JSONB),
  public.agentic_event_promo(JSONB),
  public.agentic_housekeep(),
  public.agentic_monitor_7d()
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §E. SEED PROMPT TEMPLATES CONTENT AGENT (§4.10)
--     Aturan lintas prompt: 70/30 education-first, anti-hyperbole (§9.5) —
--     dilarang klaim "menyembuhkan/terbaik/100% akurat", tanpa superlatif
--     tanpa data; placeholder [[KONFIRMASI: ...]] utk harga/tanggal/kontak.
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature)
VALUES
('PLAN_WEEKLY',
 'Anda adalah content planner senior untuk OneLab (laboratorium klinik & klinik utama di Indonesia). Susun slot konten baru untuk mengisi kalender. Prinsip: 70% edukasi kesehatan / 30% promosi lunak; manfaatkan hari kesehatan yang diberikan; variasikan channel (IG, LINKEDIN, WEB, WHATSAPP); jam posting optimal ditulis di angle bila relevan. Balas HANYA JSON array: [{"content_type":"SOSMED_POST"|"SOSMED_CAROUSEL"|"ARTIKEL","topic":string,"angle":string,"framework":"PAS"|"AIDA"|"EDU","target_date":"YYYY-MM-DD","channel":"IG"|"LINKEDIN"|"WEB"|"WHATSAPP","related_test_codes":[string],"health_day_ref":string|null}]. Jangan menduplikasi topik slot yang sudah ada. target_date harus di dalam window yang diberikan.',
 E'HARI INI: {{today}} · WINDOW: sampai {{window_end}}\nTARGET FREKUENSI: {{posts_per_week}} post sosmed/minggu + {{articles_per_week}} artikel/minggu.\n\nSLOT YANG SUDAH ADA:\n{{existing_slots}}\n\nHARI KESEHATAN DALAM WINDOW:\n{{health_days}}\n\nBuat slot BARU secukupnya untuk memenuhi target frekuensi.',
 'main', 0.6),

('MAKE_SOSMED',
 'Anda adalah copywriter kesehatan OneLab (lab klinik Indonesia). Buat konten sosmed dengan framework yang diminta (PAS=Problem-Agitate-Solve, AIDA=Attention-Interest-Desire-Action, EDU=edukasi murni). ATURAN KERAS: (1) 70% nilai edukasi, promosi lunak; (2) ANTI-HYPERBOLE — dilarang kata "menyembuhkan", "terbaik", "100% akurat", "dijamin", superlatif tanpa data; (3) tidak mendiagnosis — selalu arahkan konsultasi tenaga kesehatan; (4) harga/tanggal/kontak yang tidak diberikan tulis [[KONFIRMASI: ...]]; (5) Bahasa Indonesia luwes, boleh sapaan ringan. Balas HANYA JSON: {"hook":string, "caption":string, "hashtags":[string maks 12], "cta":string, "image_prompt":string (deskripsi visual flyer 1080x1350 dlm bhs Inggris, gaya clean medical, warna teal & navy OneLab, TANPA teks di gambar)}.',
 E'TOPIK: {{topic}}\nANGLE/BRIEF: {{angle}}\nFRAMEWORK: {{framework}} · CHANNEL: {{channel}} · TANGGAL TAYANG: {{target_date}}\nTES TERKAIT (kode): {{related_test_codes}}\nMOMENTUM: {{health_day_ref}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.7),

('MAKE_ARTIKEL',
 'Anda adalah penulis medis OneLab. Tulis artikel edukasi kesehatan 800-1200 kata untuk pembaca awam Indonesia. ATURAN KERAS: (1) WAJIB menyertakan minimal {{min_citations}} sumber ilmiah nyata (jurnal/WHO/Kemenkes/CDC) — bila tidak yakin sumbernya nyata, JANGAN dipakai; (2) anti-hyperbole, tidak mendiagnosis, sarankan konsultasi dokter; (3) sebutkan pemeriksaan lab relevan yang tersedia di OneLab secara natural; (4) nilai rujukan klinis spesifik tulis [[KONFIRMASI: ...]] bila tidak pasti. Balas HANYA JSON: {"title":string, "meta_description":string, "markdown":string (artikel lengkap dgn heading ##), "citations":[{"source":string,"title":string,"year":number,"url":string|null}]}.',
 E'TOPIK: {{topic}}\nANGLE: {{angle}}\nAUDIENS: {{audience}} · TARGET: {{target_words}} kata · MIN SITASI: {{min_citations}}\nTES TERKAIT: {{related_test_codes}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.5),

('MAKE_PPTX_DOKTER',
 'Anda adalah medical science liaison OneLab. Susun outline presentasi untuk audiens DOKTER (bukan awam) — bahasa teknis medis boleh. Sertakan referensi ilmiah per bagian. Nilai spesifik yang tidak pasti tulis [[KONFIRMASI: ...]]. Balas HANYA JSON: {"title":string, "audience":string, "duration_min":number, "slides":[{"n":number,"title":string,"bullets":[string 3-5],"speaker_notes":string}], "references":[string]}.',
 E'TOPIK: {{topic}}\nAUDIENS: {{audience}} · DURASI: {{duration_min}} menit · JUMLAH SLIDE ±{{slide_count_hint}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.4),

('MAKE_EVENT_BRIEF',
 'Anda adalah event organizer kesehatan OneLab. Susun brief acara lengkap: ringkasan, rundown per jam, checklist logistik (H-14/H-7/H-1/hari-H), pembagian tugas tim, brief materi promosi, dan estimasi kebutuhan. Item berbiaya tulis [[KONFIRMASI: ...]] tanpa mengarang harga. Output markdown terstruktur dengan heading ##, tanpa komentar pembuka/penutup.',
 E'NAMA EVENT: {{event_name}}\nTANGGAL: {{event_date}} · LOKASI: {{location}}\nTEMA: {{theme}} · TARGET PESERTA: {{target_participants}}\nCATATAN: {{angle}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.5)
ON CONFLICT (code) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_template = EXCLUDED.user_prompt_template,
  model_hint = EXCLUDED.model_hint,
  temperature = EXCLUDED.temperature,
  updated_at = now();

-- ══════════════════════════════════════════════════════════════════════
-- §CRON TAMBAHAN (opsional — bila pg_cron aktif)
--
--   -- planner mingguan Senin 05:00 WIB (Minggu 22:00 UTC):
--   select cron.schedule('agentic-planner-weekly','0 22 * * 0', $$
--     select public.agentic_create_task('CONTENT','PLAN_WEEKLY','Perencanaan konten mingguan','{}'::jsonb);
--   $$);
--   -- housekeeping harian 03:00 WIB (20:00 UTC):
--   select cron.schedule('agentic-housekeep','0 20 * * *', $$ select public.agentic_housekeep(); $$);
-- ══════════════════════════════════════════════════════════════════════

SELECT 'Agentic Fase 3 & 4 siap — content agent + hardening' AS status;
