-- ══════════════════════════════════════════════════════════════
-- OneLab Growth Platform — Schema v3 COMPLETE
-- Jalankan SELURUH file ini di Supabase > SQL Editor > New Query
-- ══════════════════════════════════════════════════════════════

-- ── 1. SETTINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id         bigint generated always as identity primary key,
  key        text not null unique,
  value      text,
  label      text,
  updated_at timestamp default now()
);

-- ── 2. ACTIVITY LOGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          bigint generated always as identity primary key,
  action      text,
  table_name  text,
  record_id   text,
  record_name text,
  description text,
  user_id     uuid,
  user_name   text,
  created_at  timestamp default now()
);

-- ── 3. USER PROFILES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text default 'sales',
  phone      text,
  avatar_url text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- ── 4. PARTNERS (complete) ──────────────────────────────────────
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS partner_code    text,
  ADD COLUMN IF NOT EXISTS pic_name        text,
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS address         text,
  ADD COLUMN IF NOT EXISTS latitude        text,
  ADD COLUMN IF NOT EXISTS longitude       text,
  ADD COLUMN IF NOT EXISTS rating          numeric,
  ADD COLUMN IF NOT EXISTS total_reviews   integer default 0,
  ADD COLUMN IF NOT EXISTS status          text default 'Prospect',
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS assigned_to     uuid,
  ADD COLUMN IF NOT EXISTS assigned_name   text,
  ADD COLUMN IF NOT EXISTS source          text default 'Manual',
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 5. PARTNER CONTACTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_contacts (
  id           bigint generated always as identity primary key,
  partner_id   bigint not null references public.partners(id) on delete cascade,
  name         text not null,
  role         text,
  phone        text,
  email        text,
  is_primary   boolean default false,
  notes        text,
  created_at   timestamp default now()
);

-- ── 6. PARTNER DEALS (output kerjasama) ────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_deals (
  id           bigint generated always as identity primary key,
  partner_id   bigint not null references public.partners(id) on delete cascade,
  deal_name    text not null,
  deal_type    text not null,  -- MCU, Wellness, Branding, OfficeCare, HomeCare, Personal, LabDiagnostic, Screening, HealthDay, Lainnya
  description  text,
  value        numeric default 0,
  frequency    text,           -- Sekali, Per Event, Bulanan, Kuartalan, Tahunan, Ongoing
  status       text default 'Active',  -- Active, Inactive, Expired, Completed
  start_date   date,
  end_date     date,
  pic_partner  text,
  participant_count integer default 0,
  notes        text,
  next_action  text,           -- next step yang perlu dilakukan
  next_action_date date,
  requires_mou boolean default false,
  mou_id       bigint,         -- link ke MOU jika ada
  project_id   bigint,         -- link ke Project jika ada
  created_by   uuid,
  created_by_name text,
  created_at   timestamp default now(),
  updated_at   timestamp default now()
);

-- ── 7. MOU (Memorandum of Understanding) ───────────────────────
CREATE TABLE IF NOT EXISTS public.mous (
  id              bigint generated always as identity primary key,
  mou_number      text unique,
  title           text not null,
  partner_id      bigint references public.partners(id),
  partner_name    text,
  deal_id         bigint references public.partner_deals(id),
  status          text default 'Draft',  -- Draft, Review, Signed, Active, Expired, Terminated
  signed_date     date,
  start_date      date,
  end_date        date,
  value           numeric default 0,
  terms           text,
  file_url        text,    -- URL file MOU di Supabase Storage
  file_name       text,
  notes           text,
  created_by      uuid,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── 8. PROJECTS (MCU, Event, Campaign) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id              bigint generated always as identity primary key,
  project_code    text unique,
  project_name    text not null,
  project_type    text,   -- MCU, HealthDay, Screening, Wellness, Branding, Lainnya
  partner_id      bigint references public.partners(id),
  partner_name    text,
  deal_id         bigint references public.partner_deals(id),
  mou_id          bigint references public.mous(id),
  status          text default 'Planning', -- Planning, Active, Completed, Cancelled
  start_date      date,
  end_date        date,
  target_participants integer default 0,
  actual_participants integer default 0,
  value           numeric default 0,
  location        text,
  pic_onelab      text,
  pic_partner     text,
  description     text,
  notes           text,
  created_by      uuid,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── 9. MARKETING TEMPLATES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id            bigint generated always as identity primary key,
  title         text not null,
  type          text not null,  -- wa_message, proposal, flyer, email, script, surat, mou_template
  channel       text,           -- komunitas, dokter, apotek, perusahaan, gym, sekolah
  content       text,           -- isi teks template
  file_url      text,           -- URL file upload (jpg/pdf/doc) di Supabase Storage
  file_name     text,
  file_type     text,           -- image/jpeg, application/pdf, application/docx
  thumbnail_url text,           -- preview thumbnail untuk doc/pdf
  tags          text,
  variables     text,           -- JSON array of placeholders e.g. ["NAMA","TANGGAL","PERIHAL"]
  is_active     boolean default true,
  created_by    uuid,
  created_by_name text,
  created_at    timestamp default now(),
  updated_at    timestamp default now()
);

-- ── 10. OUTGOING LETTERS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outgoing_letters (
  id              bigint generated always as identity primary key,
  doc_number      text unique,
  sequence_num    integer,
  title           text not null,
  letter_type     text,   -- SP, SPK, SPN, MOU, SI, SK, SL
  to_name         text,
  to_address      text,
  to_pic          text,
  letter_date     date default current_date,
  template_id     bigint references public.marketing_templates(id),
  template_name   text,
  content         text,
  file_url        text,   -- generated PDF URL
  file_name       text,
  status          text default 'Draft',  -- Draft, Sent, Archived
  partner_id      bigint references public.partners(id),
  partner_name    text,
  created_by      uuid,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── 11. LETTER SEQUENCES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.letter_sequences (
  id        bigint generated always as identity primary key,
  year      integer not null,
  month     integer not null,
  type_code text not null,
  last_seq  integer default 0,
  unique(year, month, type_code)
);

-- ── 12. VOUCHER CAMPAIGNS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voucher_campaigns (
  id              bigint generated always as identity primary key,
  campaign_name   text not null,
  campaign_code   text unique,
  description     text,
  discount_type   text default 'percent',   -- percent, fixed
  discount_value  numeric default 0,
  min_purchase    numeric default 0,
  services        text,    -- JSON array
  valid_from      date,
  valid_until     date,
  max_usage       integer default 0,  -- 0 = unlimited
  bg_color        text default '#0A2342',
  primary_color   text default '#00897B',
  bg_image_url    text,    -- Supabase Storage URL
  bg_image_name   text,
  wa_template     text,
  email_template  text,
  terms           text,
  is_active       boolean default true,
  created_by      uuid,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- ── 13. VOUCHERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vouchers (
  id              bigint generated always as identity primary key,
  campaign_id     bigint references public.voucher_campaigns(id) on delete cascade,
  campaign_name   text,
  code            text unique not null,
  sequence_num    integer,
  status          text default 'Active',  -- Active, Used, Expired, Cancelled
  recipient_name  text,
  recipient_phone text,
  recipient_email text,
  partner_id      bigint references public.partners(id),
  partner_name    text,
  issued_at       timestamp default now(),
  used_at         timestamp,
  expires_at      timestamp,
  shared_via      text,   -- wa, email, print
  shared_at       timestamp,
  notes           text,
  created_by      uuid,
  created_at      timestamp default now()
);

-- ── 14. DOCUMENTS (file uploads general) ───────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id           bigint generated always as identity primary key,
  title        text not null,
  doc_type     text,   -- template_surat, template_mou, flyer, proposal, lainnya
  file_url     text not null,
  file_name    text,
  file_size    integer,
  file_type    text,   -- mime type
  thumbnail_url text,
  description  text,
  tags         text,
  partner_id   bigint,
  related_id   bigint,
  related_type text,
  created_by   uuid,
  created_by_name text,
  created_at   timestamp default now()
);

-- ── INDEXES untuk performa ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_category ON public.partners(category);
CREATE INDEX IF NOT EXISTS idx_partner_deals_partner ON public.partner_deals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_deals_status ON public.partner_deals(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_campaign ON public.vouchers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mous_partner ON public.mous(partner_id);
CREATE INDEX IF NOT EXISTS idx_projects_partner ON public.projects(partner_id);

-- ── SUPABASE STORAGE BUCKETS ────────────────────────────────────
-- Jalankan di Storage > New Bucket atau via SQL ini:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('templates',   'templates',   true, 52428800,  -- 50MB
   ARRAY['image/jpeg','image/png','image/webp','application/pdf',
         'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('voucher-bg',  'voucher-bg',  true, 10485760,  -- 10MB
   ARRAY['image/jpeg','image/png','image/webp']),
  ('documents',   'documents',   true, 52428800,
   ARRAY['image/jpeg','image/png','application/pdf',
         'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('avatars',     'avatars',     true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies (allow all for anon - adjust for production)
CREATE POLICY IF NOT EXISTS "Public read templates" ON storage.objects
  FOR SELECT USING (bucket_id = 'templates');
CREATE POLICY IF NOT EXISTS "Authenticated upload templates" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'templates');
CREATE POLICY IF NOT EXISTS "Public read voucher-bg" ON storage.objects
  FOR SELECT USING (bucket_id = 'voucher-bg');
CREATE POLICY IF NOT EXISTS "Authenticated upload voucher-bg" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voucher-bg');
CREATE POLICY IF NOT EXISTS "Public read documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY IF NOT EXISTS "Authenticated upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

-- ── VERIFY ──────────────────────────────────────────────────────
SELECT 
  t.table_name,
  COUNT(c.column_name) as columns
FROM information_schema.tables t
LEFT JOIN information_schema.columns c 
  ON c.table_name = t.table_name AND c.table_schema = 'public'
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
