-- ══════════════════════════════════════════════════════════════════════
-- OneLab · WIKI ONELAB — Dokumen/SOP, Perbaikan SOP (AI), Content Studio,
-- dan Media/Gambar. Idempoten — aman dijalankan ulang.
-- ----------------------------------------------------------------------
-- PRASYARAT TAMBAHAN (di luar SQL):
--  1) Edge Functions → deploy fungsi "gemini-proxy" (folder supabase/functions)
--     Settings → Edge Functions → Secrets → GEMINI_API_KEY = <key AI Studio>
--  (bucket Storage "wiki" dibuat otomatis oleh skrip ini di bawah)
-- ══════════════════════════════════════════════════════════════════════

-- ── STORAGE BUCKET "wiki" + policy ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('wiki', 'wiki', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "wiki_read"   ON storage.objects;
DROP POLICY IF EXISTS "wiki_insert" ON storage.objects;
DROP POLICY IF EXISTS "wiki_update" ON storage.objects;
DROP POLICY IF EXISTS "wiki_delete" ON storage.objects;
CREATE POLICY "wiki_read"   ON storage.objects FOR SELECT USING (bucket_id = 'wiki');
CREATE POLICY "wiki_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'wiki');
CREATE POLICY "wiki_update" ON storage.objects FOR UPDATE USING (bucket_id = 'wiki');
CREATE POLICY "wiki_delete" ON storage.objects FOR DELETE USING (bucket_id = 'wiki');

-- ── DOKUMEN (SOP / Kebijakan / IK / Form / Panduan) ───────────────────
CREATE TABLE IF NOT EXISTS public.wiki_documents (
  id           bigint generated always as identity primary key,
  doc_code     text,                       -- SOP-LAB-001
  title        text not null,
  doc_type     text default 'SOP',         -- SOP | Kebijakan | Instruksi Kerja | Form | Panduan | Template
  category     text,                       -- Laboratorium, Klinik, HRD, Finance, ...
  department   text,
  version      text default '1.0',
  status       text default 'Draft',       -- Draft | Review | Approved | Obsolete
  is_template  boolean default false,      -- true = dipakai sebagai TEMPLATE ACUAN perbaikan
  effective_date date,
  review_date    date,
  file_url     text,                       -- URL publik di Storage bucket "wiki"
  file_name    text,
  file_size    integer,
  mime_type    text,
  summary      text,
  tags         text,
  owner_name   text,
  approved_by  text,
  created_by   text,
  created_at   timestamp default now(),
  updated_at   timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_wiki_doc_type     ON public.wiki_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_wiki_doc_status   ON public.wiki_documents(status);
CREATE INDEX IF NOT EXISTS idx_wiki_doc_template ON public.wiki_documents(is_template);

-- ── VERSI DOKUMEN (riwayat + hasil perbaikan AI) ──────────────────────
CREATE TABLE IF NOT EXISTS public.wiki_versions (
  id           bigint generated always as identity primary key,
  document_id  bigint references public.wiki_documents(id) on delete cascade,
  version      text,
  content_text text,                       -- hasil reengineering (markdown/teks)
  file_url     text,
  file_name    text,
  change_note  text,
  source       text default 'manual',      -- manual | ai-reengineer
  ai_model     text,
  created_by   text,
  created_at   timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_wiki_ver_doc ON public.wiki_versions(document_id);

-- ── CONTENT STUDIO (artikel, sosmed, email, caption) ──────────────────
CREATE TABLE IF NOT EXISTS public.wiki_contents (
  id           bigint generated always as identity primary key,
  title        text,
  content_type text default 'Artikel',     -- Artikel | Post Sosmed | Caption | Email | Skrip Video | Lainnya
  channel      text,                       -- Instagram, WhatsApp, Blog, ...
  tone         text default 'Profesional',
  audience     text,
  prompt       text,
  body         text,                       -- hasil generate
  status       text default 'Draft',       -- Draft | Approved | Published
  ai_model     text,
  created_by   text,
  created_at   timestamp default now(),
  updated_at   timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_wiki_content_type ON public.wiki_contents(content_type);

-- ── MEDIA / GAMBAR (hasil generate AI) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wiki_media (
  id          bigint generated always as identity primary key,
  title       text,
  prompt      text,
  style       text,
  image_url   text,                        -- URL Storage (bucket "wiki")
  file_name   text,
  ai_model    text,
  content_id  bigint references public.wiki_contents(id) on delete set null,
  created_by  text,
  created_at  timestamp default now()
);

-- ── RLS (mengikuti pola aplikasi saat ini) ────────────────────────────
-- CATATAN KEAMANAN: untuk produksi, aktifkan RLS + policy berbasis auth.uid().
ALTER TABLE public.wiki_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_versions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_contents  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_media     DISABLE ROW LEVEL SECURITY;

SELECT 'Wiki OneLab schema siap — buat bucket Storage "wiki" (public) & deploy gemini-proxy' AS status;
