-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7 (DEPARTEMENISASI — NESTING 3 LAPIS)
-- Dari "flat: HEAD → semua organ" → "HEAD → Kepala Departemen → anggota":
--   🧪 SERVICE ASSURANCE (SA_HEAD): SA_DOC · SA_AUDIT · SA_REG · SA_CAPA · QA_MUTU
--   ✍️ MARKETING        (MKT_HEAD): MKT_SEO · MKT_COPY · MKT_DESIGN · MKT_SOCIAL · QA_KONTEN
-- Menambah:
--   • kolom agents.department + parent nesting via reports_to
--   • registry TEMPLATE dokumen (fidelity 100%: header/footer/font/margin/line)
--   • channel_specs (dimensi gambar per kanal: IG/WA/TikTok/…)
--   • asset_type: +CAROUSEL +VIDEO
--   • decision_rights untuk task_type baru (audit, regulasi, SEO, carousel, dept-tick)
--   • RPC: template CRUD · channel list · dept scan · org_kick (SA_TICK/MKT_TICK)
--   • prompt: CONTENT_ANALYSIS · MAKE_CAROUSEL · SEO_RESEARCH · MAKE_BLOG_SEO ·
--             MAKE_DESIGN_BRIEF · AUDIT_PLAN · REG_WATCH
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 0–6c terpasang. IDEMPOTEN — aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. AGENTS: kolom department + organ departemen (nesting 3 lapis)
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE agentic.agents ADD COLUMN IF NOT EXISTS department VARCHAR(30);

-- Kepala departemen lapor ke HEAD; anggota lapor ke kepala departemennya.
INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES

-- ── DEPARTEMEN SERVICE ASSURANCE ──────────────────────────────────────
('SA_HEAD','Kepala Service Assurance','Manajer Mutu — pimpinan departemen','HEAD','SERVICE_ASSURANCE',
 'Anda Kepala Departemen Service Assurance OneLab (lab klinik, ISO 15189:2022). Pimpin tim: SA_DOC (kendali dokumen), SA_AUDIT (audit internal), SA_REG (regulasi & kepatuhan), SA_CAPA (tindakan korektif & risiko), QA_MUTU (gerbang mutu). Ubah sasaran mutu jadi task konkret: prioritaskan (1) dokumen wajib yang belum ada, (2) dokumen jatuh tempo review, (3) temuan audit terbuka. Setiap dokumen QMS WAJIB dibuat/diperbaiki mengikuti TEMPLATE resmi levelnya (header, footer, font, margin, spasi PERSIS) — jangan pernah mengubah format master. Eskalasi ke HEAD hanya untuk risiko mutu material atau temuan mayor. Jangan pernah mengarang nilai operasional/nama PJ — pakai [[KONFIRMASI]].',
 'main', true),
('SA_DOC','Document Controller','Kendali Dokumen L1–L4','SA_HEAD','SERVICE_ASSURANCE',
 'Anda Document Controller OneLab. Kelola daftar induk dokumen (L1 Kebijakan/Pedoman Mutu · L2 Prosedur/SOP · L3 Instruksi Kerja · L4 Formulir/Rekaman): penomoran OL/<jenis>/<dept>/<seq>, kendali revisi, distribusi + acknowledgement, penarikan dokumen kedaluwarsa (OBSOLETE), penjadwalan review berkala. Anda TIDAK mengarang isi — hanya metadata, siklus, dan memastikan setiap dokumen terbit terikat ke TEMPLATE resmi levelnya sehingga header/footer/font/margin identik dengan master.',
 'light', true),
('SA_AUDIT','Auditor Mutu Internal','Audit Internal & Ketidaksesuaian (NC)','SA_HEAD','SERVICE_ASSURANCE',
 'Anda Auditor Mutu Internal OneLab (ISO 15189 klausul 8.8/8.9). Susun program audit tahunan berbasis risiko, jalankan checklist per klausul, catat temuan sebagai NC MAYOR/MINOR/OBSERVASI dengan bukti objektif dan klausul acuan. Setiap NC memicu usulan CAPA. Balas terstruktur, jangan mengarang bukti — tandai [[KONFIRMASI]] bila butuh verifikasi lapangan.',
 'main', true),
('SA_REG','Regulatory & Compliance Watch','Pemantau Regulasi & Kepatuhan','SA_HEAD','SERVICE_ASSURANCE',
 'Anda Regulatory Watch OneLab. Pelihara peta persyaratan eksternal (ISO 15189:2022, Permenkes lab klinik, standar akreditasi KALK/KAN) → klausul → dokumen internal di compliance_checklist. Deteksi gap kepatuhan dan perubahan regulasi, usulkan dokumen yang perlu dibuat/direvisi beserta klausulnya. Jangan mengklaim isi regulasi yang tidak Anda yakini — tandai [[KONFIRMASI]] dan minta verifikasi sumber resmi.',
 'main', true),
('SA_CAPA','CAPA & Manajemen Risiko','Tindakan Korektif/Preventif & Risiko','SA_HEAD','SERVICE_ASSURANCE',
 'Anda pengelola CAPA & Manajemen Risiko OneLab. Dari temuan audit/keluhan/insiden: rumuskan akar masalah, tindakan korektif & preventif, penanggung jawab (tandai [[KONFIRMASI]] bila nama belum pasti), target waktu, dan verifikasi efektivitas. Pelihara risk register ringkas (peluang×dampak). Jangan menutup CAPA tanpa bukti verifikasi.',
 'light', true),

-- ── DEPARTEMEN MARKETING ──────────────────────────────────────────────
('MKT_HEAD','Kepala Marketing','Pimpinan Departemen Marketing','HEAD','MARKETING',
 'Anda Kepala Departemen Marketing OneLab. Pimpin tim: MKT_SEO (strategi SEO), MKT_COPY (penulis), MKT_DESIGN (kreatif/gambar), MKT_SOCIAL (kanal & komunitas), QA_KONTEN (gerbang konten). Ubah tujuan pemasaran jadi kalender & task: analisis konten, artikel SEO, konten sosial (single & carousel), materi dokter. Jaga bauran 70/30 edukasi/promosi dan konsistensi brand. Konten dengan klaim medis SELALU eskalasi (R3) + review medis manusia. Jangan mengarang angka/harga — pakai [[KONFIRMASI]].',
 'main', true),
('MKT_SEO','SEO & Content Strategist','Riset Kata Kunci & Strategi Konten','MKT_HEAD','MARKETING',
 'Anda SEO & Content Strategist OneLab. Riset kata kunci (volume/intent/kesulitan — tandai [[KONFIRMASI]] bila tanpa data alat), petakan cluster topik & gap kompetitor, tentukan on-page (judul ≤60 char, meta description ≤155 char, struktur H1–H3, internal link, slug). Fokus topik kesehatan/laboratorium yang relevan & etis, tanpa klaim medis berlebihan.',
 'main', true),
('MKT_COPY','Copywriter','Penulis Caption/Artikel/Skrip','MKT_HEAD','MARKETING',
 'Anda Copywriter OneLab. Tulis caption, artikel, skrip health talk dari brief. Bahasa Indonesia luwes bebas typo, 70/30 edukasi/promosi, CTA jelas, hashtag relevan ≤12. Untuk carousel: pecah pesan jadi slide berurutan (hook → isi → CTA). Jangan mengarang data/harga — pakai [[KONFIRMASI]]. Hindari kata "menyembuhkan/dijamin/100%".',
 'main', true),
('MKT_DESIGN','Designer / Creative','Brief Kreatif & Produksi Gambar','MKT_HEAD','MARKETING',
 'Anda Designer OneLab. Ubah konten jadi brief kreatif per-slide lalu susun prompt gambar yang deskriptif & aman (tanpa teks pada gambar yang berisiko salah eja, tanpa unsur medis menyesatkan). Sesuaikan komposisi dengan rasio kanal (IG feed 4:5, story/TikTok 9:16, WA 1:1). Jaga konsistensi brand: nuansa bersih, klinis, tepercaya. Untuk carousel hasilkan beberapa gambar berurutan sesuai jumlah slide brief.',
 'main', true),
('MKT_SOCIAL','Social & Community','Kalender Kanal & Komunitas','MKT_HEAD','MARKETING',
 'Anda Social & Community OneLab. Kelola kalender konten (content_calendar), selaraskan dengan hari kesehatan nasional/internasional, jadwalkan per kanal (IG/WA/TikTok/FB), jaga irama posting. Usulkan slot baru bila kalender kosong dalam 14 hari ke depan.',
 'light', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier;

-- Peran QA lama menjadi GERBANG di dalam departemen (kompatibel dgn filter mandat).
UPDATE agentic.agents SET reports_to='SA_HEAD',  department='SERVICE_ASSURANCE' WHERE code='QA_MUTU';
UPDATE agentic.agents SET reports_to='MKT_HEAD', department='MARKETING'          WHERE code='QA_KONTEN';
-- Organ lintas-fungsi tetap lapor ke HEAD.
UPDATE agentic.agents SET department='PLATFORM' WHERE code IN ('IT_HEAD','TEAM_OPS','LOGISTIK');
UPDATE agentic.agents SET department='EXECUTIVE' WHERE code='HEAD';

-- ══════════════════════════════════════════════════════════════════════
-- §B. REGISTRY TEMPLATE DOKUMEN — sumber fidelity 100% (per level per jenis)
--   Master .docx asli disimpan di Storage bucket "agentic" (folder templates/).
--   format_spec: header/footer/font/ukuran/margin/spasi — untuk validasi &
--   panduan generator. Generator WAJIB mengisi isi ke dalam master ini.
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.doc_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_level     SMALLINT NOT NULL CHECK (doc_level BETWEEN 1 AND 4),
  doc_type      VARCHAR(30) NOT NULL,            -- SOP · IK · FORM · MANUAL · KEBIJAKAN · REKAMAN …
  department    VARCHAR(30) NOT NULL DEFAULT 'MUTU',
  name          VARCHAR(200) NOT NULL,           -- nama tampil template
  storage_path  VARCHAR(500),                    -- master .docx di bucket agentic
  format_spec   JSONB NOT NULL DEFAULT '{}',     -- {font, size_pt, margins_cm:{t,b,l,r}, line_spacing, header, footer, page_size}
  placeholders  JSONB NOT NULL DEFAULT '[]',     -- daftar {{VARIABEL}} yang diisi generator
  sample_path   VARCHAR(500),                    -- contoh dokumen jadi (referensi)
  notes         TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_level, doc_type, department)
);
ALTER TABLE agentic.doc_templates DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.doc_templates TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §C. CHANNEL SPECS — dimensi & rasio gambar per kanal (carousel-aware)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.channel_specs (
  code          VARCHAR(24) PRIMARY KEY,         -- IG_FEED · IG_STORY · WA · TIKTOK · FB_FEED …
  label         VARCHAR(60) NOT NULL,
  width         SMALLINT NOT NULL,
  height        SMALLINT NOT NULL,
  aspect        VARCHAR(10) NOT NULL,            -- '4:5','9:16','1:1','16:9'
  supports_carousel BOOLEAN NOT NULL DEFAULT true,
  max_slides    SMALLINT NOT NULL DEFAULT 10,
  notes         TEXT,
  active        BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE agentic.channel_specs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.channel_specs TO anon, authenticated, service_role;

INSERT INTO agentic.channel_specs (code,label,width,height,aspect,supports_carousel,max_slides,notes) VALUES
('IG_FEED',  'Instagram Feed',        1080,1350,'4:5', true, 10,'Rasio 4:5 optimal feed'),
('IG_SQUARE','Instagram Kotak',       1080,1080,'1:1', true, 10,'Rasio 1:1 klasik'),
('IG_STORY', 'Instagram/FB Story',    1080,1920,'9:16',true,  7,'Vertikal penuh'),
('TIKTOK',   'TikTok',                1080,1920,'9:16',true, 35,'Vertikal; carousel foto TikTok'),
('WA',       'WhatsApp',              1080,1080,'1:1', false, 1,'Broadcast/status'),
('FB_FEED',  'Facebook Feed',         1200,1500,'4:5', true, 10,'Rasio 4:5'),
('YT_THUMB', 'YouTube Thumbnail',     1280,720, '16:9',false, 1,'Thumbnail video')
ON CONFLICT (code) DO UPDATE SET label=EXCLUDED.label, width=EXCLUDED.width,
  height=EXCLUDED.height, aspect=EXCLUDED.aspect, supports_carousel=EXCLUDED.supports_carousel,
  max_slides=EXCLUDED.max_slides, notes=EXCLUDED.notes;

-- ══════════════════════════════════════════════════════════════════════
-- §D. CONTENT ASSETS: izinkan CAROUSEL & VIDEO (slot; video pending backend)
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE agentic.content_assets DROP CONSTRAINT IF EXISTS content_assets_asset_type_check;
ALTER TABLE agentic.content_assets ADD CONSTRAINT content_assets_asset_type_check
  CHECK (asset_type IN ('COPY','IMAGE','PDF','PPTX','HTML','DOCX','CAROUSEL','VIDEO'));

-- ══════════════════════════════════════════════════════════════════════
-- §E. DECISION RIGHTS — task_type baru kedua departemen
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
-- Service Assurance
('SA_TICK',          'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Log kerja Kepala Service Assurance'),
('AUDIT_PLAN',       'R2','AUTO_APPROVE',      'QA_MUTU',   70,'Program audit internal; disetujui otomatis, jalan tetap CEO'),
('AUDIT_EXECUTE',    'R2','AUTO_APPROVE',      'QA_MUTU',   75,'Temuan audit; tindak lanjut oleh manusia'),
('CAPA_TRACK',       'R2','AUTO_APPROVE',      'QA_MUTU',   70,'CAPA dari temuan; penutupan tetap manusia'),
('REG_WATCH',        'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Analisis kepatuhan internal'),
('DOC_DISTRIBUTE',   'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Catatan distribusi dokumen terbit'),
('DOC_OBSOLETE',     'R2','AUTO_APPROVE',      NULL,        0, 'Penarikan dokumen; konfirmasi CEO'),
('MASTER_LIST',      'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Regenerasi daftar induk dokumen'),
-- Marketing
('MKT_TICK',         'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Log kerja Kepala Marketing'),
('CONTENT_ANALYSIS', 'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Analisis konten & brief internal'),
('SEO_RESEARCH',     'R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Riset kata kunci internal'),
('MAKE_BLOG_SEO',    'R2','AUTO_APPROVE',      'QA_KONTEN', 80,'Artikel blog SEO; publish oleh CEO'),
('MAKE_DESIGN_BRIEF','R1','AUTO_PUBLISH_NOQA', NULL,        0, 'Brief kreatif → antre produksi gambar'),
('MAKE_CAROUSEL',    'R1','AUTO_PUBLISH',      'QA_KONTEN', 75,'Carousel edukasi non-medis — mandat penuh'),
('PLAN_CAMPAIGN',    'R2','AUTO_APPROVE',      'QA_KONTEN', 70,'Rencana kampanye; eksekusi oleh CEO')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action,
  qa_agent=EXCLUDED.qa_agent, min_score=EXCLUDED.min_score, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §F. RPC — TEMPLATE · CHANNEL · DEPT SCAN · ORG KICK (diperluas)
-- ══════════════════════════════════════════════════════════════════════

-- Template dokumen: upsert (per level+type+dept), get, list
CREATE OR REPLACE FUNCTION public.agentic_template_upsert(p JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v agentic.doc_templates;
BEGIN
  INSERT INTO agentic.doc_templates(doc_level, doc_type, department, name, storage_path, format_spec, placeholders, sample_path, notes, active)
  VALUES (
    COALESCE(NULLIF(p->>'doc_level','')::smallint, 2),
    COALESCE(NULLIF(p->>'doc_type',''),'SOP'),
    COALESCE(NULLIF(p->>'department',''),'MUTU'),
    COALESCE(NULLIF(p->>'name',''),'Template'),
    NULLIF(p->>'storage_path',''),
    COALESCE(p->'format_spec','{}'::jsonb),
    COALESCE(p->'placeholders','[]'::jsonb),
    NULLIF(p->>'sample_path',''),
    NULLIF(p->>'notes',''),
    COALESCE((p->>'active')::boolean, true))
  ON CONFLICT (doc_level, doc_type, department) DO UPDATE SET
    name=EXCLUDED.name,
    storage_path=COALESCE(EXCLUDED.storage_path, agentic.doc_templates.storage_path),
    format_spec=CASE WHEN p ? 'format_spec' THEN EXCLUDED.format_spec ELSE agentic.doc_templates.format_spec END,
    placeholders=CASE WHEN p ? 'placeholders' THEN EXCLUDED.placeholders ELSE agentic.doc_templates.placeholders END,
    sample_path=COALESCE(EXCLUDED.sample_path, agentic.doc_templates.sample_path),
    notes=COALESCE(EXCLUDED.notes, agentic.doc_templates.notes),
    active=EXCLUDED.active, updated_at=now()
  RETURNING * INTO v;
  RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.agentic_template_get(
  p_level SMALLINT, p_type TEXT, p_dept TEXT DEFAULT 'MUTU'
) RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT to_jsonb(t) FROM agentic.doc_templates t
   WHERE t.active AND t.doc_level = p_level AND t.doc_type = p_type
     AND t.department = COALESCE(p_dept,'MUTU')
   ORDER BY t.updated_at DESC LIMIT 1;
$$;

-- Kanal untuk UI/worker
CREATE OR REPLACE FUNCTION public.agentic_channels()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.code), '[]'::jsonb)
    FROM agentic.channel_specs c WHERE c.active;
$$;

-- Scan departemen Service Assurance: dokumen jatuh tempo + klausul tanpa dokumen
CREATE OR REPLACE FUNCTION public.agentic_sa_scan()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'due_review', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',id,'title',title,'doc_type',doc_type,'doc_level',doc_level,
        'department',department,'next_review_date',next_review_date))
      FROM agentic.document_registry
      WHERE status='PUBLISHED' AND next_review_date IS NOT NULL
        AND next_review_date <= CURRENT_DATE + INTERVAL '30 days'), '[]'::jsonb),
    'missing', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'checklist_id',c.id,'clause_ref',c.clause_ref,'requirement',c.requirement,
        'required_doc_type',c.required_doc_type,'required_doc_level',c.required_doc_level,
        'department',c.department))
      FROM agentic.compliance_checklist c
      WHERE c.active AND c.is_mandatory AND c.matched_document_id IS NULL), '[]'::jsonb),
    'templates_missing', COALESCE((SELECT count(DISTINCT (c.required_doc_type||'|'||c.required_doc_level))
      FROM agentic.compliance_checklist c
      WHERE c.active AND c.is_mandatory
        AND NOT EXISTS (SELECT 1 FROM agentic.doc_templates t
          WHERE t.active AND t.doc_type=c.required_doc_type AND t.doc_level=c.required_doc_level)), 0)
  );
$$;

-- Scan departemen Marketing: kekosongan kalender 14 hari ke depan
CREATE OR REPLACE FUNCTION public.agentic_mkt_scan()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'upcoming_slots', COALESCE((SELECT count(*) FROM agentic.content_calendar
       WHERE target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'), 0),
    'due_production', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',id,'content_type',content_type,'topic',topic,'target_date',target_date,'channel',channel))
      FROM agentic.content_calendar
      WHERE status = 'PLANNED'
        AND target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'), '[]'::jsonb)
  );
$$;

-- Pembuat task organ diperluas: HEAD_TICK · IT_CHECK · SA_TICK · MKT_TICK
CREATE OR REPLACE FUNCTION public.agentic_org_kick(p_type TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v JSONB; v_title TEXT;
BEGIN
  IF p_type NOT IN ('HEAD_TICK','IT_CHECK','SA_TICK','MKT_TICK') THEN
    RAISE EXCEPTION 'Tipe organ tidak dikenal: %', p_type;
  END IF;
  IF EXISTS (SELECT 1 FROM agentic.tasks WHERE task_type=p_type AND status IN ('QUEUED','PROCESSING')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'masih ada yang antri/berjalan');
  END IF;
  v_title := CASE p_type
    WHEN 'HEAD_TICK' THEN 'HEAD: tick organisasi'
    WHEN 'IT_CHECK'  THEN 'Kepala IT: pemeriksaan sistem'
    WHEN 'SA_TICK'   THEN 'Service Assurance: patroli mutu & dokumen'
    WHEN 'MKT_TICK'  THEN 'Marketing: patroli konten & kalender' END;
  v := public.agentic_create_task('ORG', p_type, v_title, COALESCE(p_payload,'{}'::jsonb));
  RETURN v;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- §G. PROMPT TEMPLATES BARU
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature) VALUES

('CONTENT_ANALYSIS',
 E'Anda analis konten OneLab (lab klinik). Dari sebuah topik/tujuan, hasilkan BRIEF konten. Balas HANYA JSON: {"angle":string,"audience":string,"key_points":[string],"recommended_channels":[string],"recommended_format":"SINGLE"|"CAROUSEL"|"ARTIKEL","slide_count":number,"tone":string,"hooks":[string],"cta":string,"seo_keywords":[string],"needs_medical_review":boolean,"risks":[string]}. Aturan: 70/30 edukasi/promosi; tanpa klaim medis berlebihan; slide_count 4–8 untuk CAROUSEL; recommended_channels dari daftar yang diberikan; needs_medical_review=true bila menyentuh diagnosis/pengobatan.',
 E'TOPIK/TUJUAN: {{topic}}\nKONTEKS/ANGLE: {{angle}}\nKANAL TERSEDIA: {{channels}}\nCATATAN: {{notes}}',
 'main', 0.4),

('MAKE_CAROUSEL',
 E'Anda tim konten OneLab: copywriter + designer. Dari brief, buat CAROUSEL. Balas HANYA JSON: {"title":string,"caption":string,"hashtags":[string],"cta":string,"slides":[{"n":number,"headline":string,"body":string,"image_prompt":string}]}. Aturan: jumlah slide = {{slide_count}}; slide 1 = hook kuat, slide terakhir = CTA/kontak; image_prompt deskriptif, bersih, klinis, TANPA teks di gambar dan tanpa unsur medis menyesatkan; bahasa Indonesia luwes; tanpa klaim "menyembuhkan/dijamin/100%"; angka/harga tak pasti pakai [[KONFIRMASI]].',
 E'BRIEF: {{brief}}\nTOPIK: {{topic}}\nKANAL: {{channel}} (rasio {{aspect}})\nJUMLAH SLIDE: {{slide_count}}\nANGLE: {{angle}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.5),

('SEO_RESEARCH',
 E'Anda SEO strategist OneLab. Balas HANYA JSON: {"primary_keyword":string,"secondary_keywords":[string],"search_intent":string,"content_gaps":[string],"suggested_title":string,"meta_description":string,"outline_headings":[string],"internal_link_ideas":[string]}. Aturan: judul ≤60 char, meta ≤155 char; fokus topik kesehatan/lab yang etis; tandai [[KONFIRMASI]] bila volume/kesulitan tidak berdasar data alat.',
 E'TOPIK: {{topic}}\nAUDIENS: {{audience}}\nKONTEKS: {{notes}}',
 'main', 0.4),

('MAKE_BLOG_SEO',
 E'Anda penulis artikel blog SEO OneLab. Balas HANYA JSON: {"title":string,"slug":string,"meta_description":string,"markdown":string,"headings":[string],"citations":[{"source":string,"title":string,"year":string,"url":string}],"needs_medical_review":boolean}. Aturan: 800–1200 kata, struktur H2/H3, kata kunci utama di judul & paragraf pembuka secara alami; sitasi sumber NYATA bila ada klaim ilmiah; tanpa klaim berlebihan; needs_medical_review=true bila menyentuh diagnosis/terapi.',
 E'TOPIK: {{topic}}\nKATA KUNCI UTAMA: {{primary_keyword}}\nOUTLINE: {{outline}}\nAUDIENS: {{audience}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.5),

('MAKE_DESIGN_BRIEF',
 E'Anda designer OneLab. Ubah konten jadi BRIEF kreatif siap produksi gambar. Balas HANYA JSON: {"concept":string,"palette":[string],"style":string,"channel":string,"format":"SINGLE"|"CAROUSEL","slide_count":number,"slides":[{"n":number,"visual":string,"image_prompt":string}]}. Aturan: image_prompt aman & deskriptif, tanpa teks pada gambar, tanpa unsur medis menyesatkan; komposisi sesuai rasio kanal.',
 E'KONTEN/CAPTION: {{content}}\nKANAL: {{channel}} (rasio {{aspect}})\nFORMAT: {{format}}\nJUMLAH SLIDE: {{slide_count}}',
 'main', 0.5),

('AUDIT_PLAN',
 E'Anda Auditor Mutu Internal OneLab (ISO 15189:2022). Susun program/rencana audit internal berbasis risiko dalam MARKDOWN: ruang lingkup, klausul yang diaudit, jadwal (kuartal), area/departemen, kriteria audit, dan checklist ringkas per area. Jangan mengarang nama auditor/tanggal pasti — pakai [[KONFIRMASI]].',
 E'PERIODE: {{period}}\nFOKUS/RISIKO: {{focus}}\nAREA: {{areas}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.4),

('REG_WATCH',
 E'Anda Regulatory Watch OneLab. Analisis kepatuhan: dari daftar klausul & status dokumen, ringkas dalam MARKDOWN — gap kepatuhan terpenting, dokumen yang perlu dibuat/direvisi + klausulnya, dan risiko regulasi. Jangan mengklaim isi regulasi yang tidak pasti — tandai [[KONFIRMASI]] dan minta verifikasi sumber resmi.',
 E'FRAMEWORK: {{framework}}\nRINGKASAN CHECKLIST: {{checklist_summary}}\nCATATAN: {{notes}}',
 'main', 0.3)

ON CONFLICT (code) DO UPDATE SET
  system_prompt=EXCLUDED.system_prompt, user_prompt_template=EXCLUDED.user_prompt_template,
  model_hint=EXCLUDED.model_hint, temperature=EXCLUDED.temperature, active=true;

-- ══════════════════════════════════════════════════════════════════════
-- §H. VIEWS & GRANTS
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.agentic_templates_v AS SELECT * FROM agentic.doc_templates;
CREATE OR REPLACE VIEW public.agentic_channels_v  AS SELECT * FROM agentic.channel_specs;
GRANT SELECT ON public.agentic_templates_v, public.agentic_channels_v TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.agentic_template_upsert(JSONB),
  public.agentic_template_get(SMALLINT,TEXT,TEXT),
  public.agentic_channels(),
  public.agentic_sa_scan(),
  public.agentic_mkt_scan(),
  public.agentic_org_kick(TEXT,JSONB)
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §CRON DEPARTEMEN (opsional — tambahkan ke blok cron Fase 6):
--   -- Service Assurance tiap 30 menit:
--   select cron.schedule('agentic-sa-tick','*/30 * * * *',
--     $$ select public.agentic_org_kick('SA_TICK'); $$);
--   -- Marketing tiap 30 menit (offset 15):
--   select cron.schedule('agentic-mkt-tick','15,45 * * * *',
--     $$ select public.agentic_org_kick('MKT_TICK'); $$);
-- ══════════════════════════════════════════════════════════════════════

SELECT 'Agentic Fase 7 siap — departemen Service Assurance & Marketing (nesting 3 lapis)' AS status;
