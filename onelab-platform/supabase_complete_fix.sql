-- ══════════════════════════════════════════════════════════════
-- OneLab Growth Platform — Complete Column Fix
-- Jalankan SELURUH file ini di Supabase SQL Editor
-- Aman dijalankan berulang (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════════

-- ── 1. PARTNERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partners (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS partner_code    text,
  ADD COLUMN IF NOT EXISTS partner_name    text,
  ADD COLUMN IF NOT EXISTS category        text,
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
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS source          text default 'Manual',
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 2. PARTNER DEALS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_deals (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.partner_deals
  ADD COLUMN IF NOT EXISTS partner_id       bigint,
  ADD COLUMN IF NOT EXISTS deal_name        text,
  ADD COLUMN IF NOT EXISTS deal_type        text,
  ADD COLUMN IF NOT EXISTS description      text,
  ADD COLUMN IF NOT EXISTS value            numeric default 0,
  ADD COLUMN IF NOT EXISTS frequency        text,
  ADD COLUMN IF NOT EXISTS status           text default 'Active',
  ADD COLUMN IF NOT EXISTS start_date       date,
  ADD COLUMN IF NOT EXISTS end_date         date,
  ADD COLUMN IF NOT EXISTS pic_partner      text,
  ADD COLUMN IF NOT EXISTS participant_count integer default 0,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS next_action      text,
  ADD COLUMN IF NOT EXISTS next_action_date date,
  ADD COLUMN IF NOT EXISTS requires_mou     boolean default false,
  ADD COLUMN IF NOT EXISTS mou_id           bigint,
  ADD COLUMN IF NOT EXISTS project_id       bigint,
  ADD COLUMN IF NOT EXISTS created_by       uuid,
  ADD COLUMN IF NOT EXISTS created_by_name  text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamp default now();

-- ── 3. PARTNER CONTACTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_contacts (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.partner_contacts
  ADD COLUMN IF NOT EXISTS partner_id  bigint,
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS role        text,
  ADD COLUMN IF NOT EXISTS phone       text,
  ADD COLUMN IF NOT EXISTS email       text,
  ADD COLUMN IF NOT EXISTS is_primary  boolean default false,
  ADD COLUMN IF NOT EXISTS notes       text;

-- ── 4. LEADS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_name        text,
  ADD COLUMN IF NOT EXISTS company          text,
  ADD COLUMN IF NOT EXISTS category         text,
  ADD COLUMN IF NOT EXISTS contact_name     text,
  ADD COLUMN IF NOT EXISTS pic_name         text,
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS address          text,
  ADD COLUMN IF NOT EXISTS source           text default 'Manual',
  ADD COLUMN IF NOT EXISTS status           text default 'Baru',
  ADD COLUMN IF NOT EXISTS estimated_value  numeric default 0,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS followup_date    date,
  ADD COLUMN IF NOT EXISTS followup_note    text,
  ADD COLUMN IF NOT EXISTS assigned_name    text,
  ADD COLUMN IF NOT EXISTS partner_name     text,
  ADD COLUMN IF NOT EXISTS converted_to     bigint,
  ADD COLUMN IF NOT EXISTS created_by_name  text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamp default now();

-- ── 5. OKR TARGETS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.okr_targets (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.okr_targets
  ADD COLUMN IF NOT EXISTS period        text,
  ADD COLUMN IF NOT EXISTS year          integer,
  ADD COLUMN IF NOT EXISTS quarter       integer,
  ADD COLUMN IF NOT EXISTS objective     text,
  ADD COLUMN IF NOT EXISTS metric_type   text,
  ADD COLUMN IF NOT EXISTS target        numeric default 0,
  ADD COLUMN IF NOT EXISTS actual        numeric default 0,
  ADD COLUMN IF NOT EXISTS unit          text,
  ADD COLUMN IF NOT EXISTS assigned_name text,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

-- ── 6. MOU ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mous (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.mous
  ADD COLUMN IF NOT EXISTS mou_number      text,
  ADD COLUMN IF NOT EXISTS title           text,
  ADD COLUMN IF NOT EXISTS partner_id      bigint,
  ADD COLUMN IF NOT EXISTS partner_name    text,
  ADD COLUMN IF NOT EXISTS deal_id         bigint,
  ADD COLUMN IF NOT EXISTS status          text default 'Draft',
  ADD COLUMN IF NOT EXISTS signed_date     date,
  ADD COLUMN IF NOT EXISTS start_date      date,
  ADD COLUMN IF NOT EXISTS end_date        date,
  ADD COLUMN IF NOT EXISTS value           numeric default 0,
  ADD COLUMN IF NOT EXISTS terms           text,
  ADD COLUMN IF NOT EXISTS file_url        text,
  ADD COLUMN IF NOT EXISTS file_name       text,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS created_by      uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 7. PROJECTS (MCU) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_code        text,
  ADD COLUMN IF NOT EXISTS project_name        text,
  ADD COLUMN IF NOT EXISTS project_type        text,
  ADD COLUMN IF NOT EXISTS partner_id          bigint,
  ADD COLUMN IF NOT EXISTS partner_name        text,
  ADD COLUMN IF NOT EXISTS deal_id             bigint,
  ADD COLUMN IF NOT EXISTS mou_id              bigint,
  ADD COLUMN IF NOT EXISTS status              text default 'Planning',
  ADD COLUMN IF NOT EXISTS current_step        integer default 1,
  ADD COLUMN IF NOT EXISTS start_date          date,
  ADD COLUMN IF NOT EXISTS end_date            date,
  ADD COLUMN IF NOT EXISTS target_participants integer default 0,
  ADD COLUMN IF NOT EXISTS actual_participants integer default 0,
  ADD COLUMN IF NOT EXISTS rab_total           numeric default 0,
  ADD COLUMN IF NOT EXISTS value               numeric default 0,
  ADD COLUMN IF NOT EXISTS location            text,
  ADD COLUMN IF NOT EXISTS pic_onelab          text,
  ADD COLUMN IF NOT EXISTS pic_partner         text,
  ADD COLUMN IF NOT EXISTS description         text,
  ADD COLUMN IF NOT EXISTS notes               text,
  ADD COLUMN IF NOT EXISTS created_by_name     text,
  ADD COLUMN IF NOT EXISTS updated_at          timestamp default now();

-- ── 8. PROJECT STEPS (25 tahapan MCU) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.project_steps (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.project_steps
  ADD COLUMN IF NOT EXISTS project_id   bigint,
  ADD COLUMN IF NOT EXISTS step_number  integer,
  ADD COLUMN IF NOT EXISTS step_name    text,
  ADD COLUMN IF NOT EXISTS step_group   text,
  ADD COLUMN IF NOT EXISTS status       text default 'Pending',
  ADD COLUMN IF NOT EXISTS due_date     date,
  ADD COLUMN IF NOT EXISTS done_date    date,
  ADD COLUMN IF NOT EXISTS done_by      text,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS attachments  text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

-- ── 9. RAB (Rencana Anggaran Biaya) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.rab_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.rab_items
  ADD COLUMN IF NOT EXISTS project_id   bigint,
  ADD COLUMN IF NOT EXISTS category     text,
  ADD COLUMN IF NOT EXISTS item_name    text,
  ADD COLUMN IF NOT EXISTS unit         text,
  ADD COLUMN IF NOT EXISTS qty          numeric default 0,
  ADD COLUMN IF NOT EXISTS unit_price   numeric default 0,
  ADD COLUMN IF NOT EXISTS total_price  numeric default 0,
  ADD COLUMN IF NOT EXISTS notes        text;

-- ── 10. MARKETING TEMPLATES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.marketing_templates
  ADD COLUMN IF NOT EXISTS title           text,
  ADD COLUMN IF NOT EXISTS type            text,
  ADD COLUMN IF NOT EXISTS channel         text,
  ADD COLUMN IF NOT EXISTS content         text,
  ADD COLUMN IF NOT EXISTS file_url        text,
  ADD COLUMN IF NOT EXISTS file_name       text,
  ADD COLUMN IF NOT EXISTS file_type       text,
  ADD COLUMN IF NOT EXISTS thumbnail_url   text,
  ADD COLUMN IF NOT EXISTS tags            text,
  ADD COLUMN IF NOT EXISTS variables       text,
  ADD COLUMN IF NOT EXISTS is_active       boolean default true,
  ADD COLUMN IF NOT EXISTS created_by      uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 11. VOUCHER CAMPAIGNS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voucher_campaigns (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.voucher_campaigns
  ADD COLUMN IF NOT EXISTS campaign_name   text,
  ADD COLUMN IF NOT EXISTS campaign_code   text,
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS discount_type   text default 'percent',
  ADD COLUMN IF NOT EXISTS discount_value  numeric default 0,
  ADD COLUMN IF NOT EXISTS min_purchase    numeric default 0,
  ADD COLUMN IF NOT EXISTS services        text,
  ADD COLUMN IF NOT EXISTS valid_from      date,
  ADD COLUMN IF NOT EXISTS valid_until     date,
  ADD COLUMN IF NOT EXISTS max_usage       integer default 0,
  ADD COLUMN IF NOT EXISTS bg_color        text default '#0A2342',
  ADD COLUMN IF NOT EXISTS primary_color   text default '#00897B',
  ADD COLUMN IF NOT EXISTS bg_image_url    text,
  ADD COLUMN IF NOT EXISTS bg_image_name   text,
  ADD COLUMN IF NOT EXISTS wa_template     text,
  ADD COLUMN IF NOT EXISTS email_template  text,
  ADD COLUMN IF NOT EXISTS terms           text,
  ADD COLUMN IF NOT EXISTS is_active       boolean default true,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 12. VOUCHERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vouchers (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS campaign_id     bigint,
  ADD COLUMN IF NOT EXISTS campaign_name   text,
  ADD COLUMN IF NOT EXISTS code            text,
  ADD COLUMN IF NOT EXISTS sequence_num    integer,
  ADD COLUMN IF NOT EXISTS status          text default 'Active',
  ADD COLUMN IF NOT EXISTS recipient_name  text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS partner_id      bigint,
  ADD COLUMN IF NOT EXISTS partner_name    text,
  ADD COLUMN IF NOT EXISTS issued_at       timestamp default now(),
  ADD COLUMN IF NOT EXISTS used_at         timestamp,
  ADD COLUMN IF NOT EXISTS expires_at      timestamp,
  ADD COLUMN IF NOT EXISTS shared_via      text,
  ADD COLUMN IF NOT EXISTS shared_at       timestamp,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS created_by      uuid;

-- ── 13. OUTGOING LETTERS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outgoing_letters (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.outgoing_letters
  ADD COLUMN IF NOT EXISTS doc_number      text,
  ADD COLUMN IF NOT EXISTS sequence_num    integer,
  ADD COLUMN IF NOT EXISTS title           text,
  ADD COLUMN IF NOT EXISTS letter_type     text,
  ADD COLUMN IF NOT EXISTS letter_date     date default current_date,
  ADD COLUMN IF NOT EXISTS to_name         text,
  ADD COLUMN IF NOT EXISTS to_address      text,
  ADD COLUMN IF NOT EXISTS to_pic          text,
  ADD COLUMN IF NOT EXISTS template_id     bigint,
  ADD COLUMN IF NOT EXISTS template_name   text,
  ADD COLUMN IF NOT EXISTS content         text,
  ADD COLUMN IF NOT EXISTS file_url        text,
  ADD COLUMN IF NOT EXISTS file_name       text,
  ADD COLUMN IF NOT EXISTS status          text default 'Draft',
  ADD COLUMN IF NOT EXISTS partner_id      bigint,
  ADD COLUMN IF NOT EXISTS partner_name    text,
  ADD COLUMN IF NOT EXISTS signer          text,
  ADD COLUMN IF NOT EXISTS jabatan         text,
  ADD COLUMN IF NOT EXISTS created_by      uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 14. LETTER SEQUENCES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.letter_sequences (
  id bigint generated always as identity primary key
);
ALTER TABLE public.letter_sequences
  ADD COLUMN IF NOT EXISTS year      integer,
  ADD COLUMN IF NOT EXISTS month     integer,
  ADD COLUMN IF NOT EXISTS type_code text,
  ADD COLUMN IF NOT EXISTS last_seq  integer default 0;

-- ── 15. INVOICES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number  text,
  ADD COLUMN IF NOT EXISTS invoice_date    date default current_date,
  ADD COLUMN IF NOT EXISTS partner_id      bigint,
  ADD COLUMN IF NOT EXISTS partner_name    text,
  ADD COLUMN IF NOT EXISTS service_type    text,
  ADD COLUMN IF NOT EXISTS deal_id         bigint,
  ADD COLUMN IF NOT EXISTS project_id      bigint,
  ADD COLUMN IF NOT EXISTS subtotal        numeric default 0,
  ADD COLUMN IF NOT EXISTS discount        numeric default 0,
  ADD COLUMN IF NOT EXISTS ppn_percent     integer default 0,
  ADD COLUMN IF NOT EXISTS total_amount    numeric default 0,
  ADD COLUMN IF NOT EXISTS status          text default 'Draft',
  ADD COLUMN IF NOT EXISTS due_date        date,
  ADD COLUMN IF NOT EXISTS paid_at         timestamp,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 16. INVENTORY ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS item_code    text,
  ADD COLUMN IF NOT EXISTS item_name    text,
  ADD COLUMN IF NOT EXISTS category     text,
  ADD COLUMN IF NOT EXISTS unit         text,
  ADD COLUMN IF NOT EXISTS stock_qty    numeric default 0,
  ADD COLUMN IF NOT EXISTS min_stock    numeric default 0,
  ADD COLUMN IF NOT EXISTS max_stock    numeric default 0,
  ADD COLUMN IF NOT EXISTS unit_price   numeric default 0,
  ADD COLUMN IF NOT EXISTS location     text,
  ADD COLUMN IF NOT EXISTS supplier_id  bigint,
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

-- ── 17. PURCHASE REQUESTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS pr_number      text,
  ADD COLUMN IF NOT EXISTS requested_by   text,
  ADD COLUMN IF NOT EXISTS division       text,
  ADD COLUMN IF NOT EXISTS status         text default 'Draft',
  ADD COLUMN IF NOT EXISTS total_amount   numeric default 0,
  ADD COLUMN IF NOT EXISTS items          text,
  ADD COLUMN IF NOT EXISTS item_categories text,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS approved_by    text,
  ADD COLUMN IF NOT EXISTS approved_at    timestamp,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

-- ── 18. SUPPLIERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS supplier_name  text,
  ADD COLUMN IF NOT EXISTS category       text,
  ADD COLUMN IF NOT EXISTS contact_name   text,
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS address        text,
  ADD COLUMN IF NOT EXISTS payment_terms  text,
  ADD COLUMN IF NOT EXISTS rating         integer default 5,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS is_active      boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

-- ── 19. EMPLOYEES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_id     text,
  ADD COLUMN IF NOT EXISTS full_name       text,
  ADD COLUMN IF NOT EXISTS division        text,
  ADD COLUMN IF NOT EXISTS position        text,
  ADD COLUMN IF NOT EXISTS status          text default 'Aktif',
  ADD COLUMN IF NOT EXISTS join_date       date,
  ADD COLUMN IF NOT EXISTS end_date        date,
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS address         text,
  ADD COLUMN IF NOT EXISTS base_salary     numeric default 0,
  ADD COLUMN IF NOT EXISTS bpjs_kesehatan  numeric default 0,
  ADD COLUMN IF NOT EXISTS bpjs_ketenagakerjaan numeric default 0,
  ADD COLUMN IF NOT EXISTS npwp            text,
  ADD COLUMN IF NOT EXISTS bank_name       text,
  ADD COLUMN IF NOT EXISTS bank_account    text,
  ADD COLUMN IF NOT EXISTS photo_url       text,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 20. LEAVE REQUESTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS employee_id    bigint,
  ADD COLUMN IF NOT EXISTS employee_name  text,
  ADD COLUMN IF NOT EXISTS leave_type     text,
  ADD COLUMN IF NOT EXISTS start_date     date,
  ADD COLUMN IF NOT EXISTS end_date       date,
  ADD COLUMN IF NOT EXISTS total_days     integer default 1,
  ADD COLUMN IF NOT EXISTS reason         text,
  ADD COLUMN IF NOT EXISTS status         text default 'Pending',
  ADD COLUMN IF NOT EXISTS approved_by    text,
  ADD COLUMN IF NOT EXISTS approved_at    timestamp,
  ADD COLUMN IF NOT EXISTS requested_by   text,
  ADD COLUMN IF NOT EXISTS notes          text;

-- ── 21. HOMECARE ORDERS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.homecare_orders (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.homecare_orders
  ADD COLUMN IF NOT EXISTS order_number    text,
  ADD COLUMN IF NOT EXISTS patient_name    text,
  ADD COLUMN IF NOT EXISTS patient_phone   text,
  ADD COLUMN IF NOT EXISTS patient_address text,
  ADD COLUMN IF NOT EXISTS service_type    text,
  ADD COLUMN IF NOT EXISTS scheduled_date  date,
  ADD COLUMN IF NOT EXISTS scheduled_time  text,
  ADD COLUMN IF NOT EXISTS assigned_staff  text,
  ADD COLUMN IF NOT EXISTS status          text default 'Baru',
  ADD COLUMN IF NOT EXISTS total_amount    numeric default 0,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS partner_id      bigint,
  ADD COLUMN IF NOT EXISTS partner_name    text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

-- ── 22. ACTIVITY LOGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS action      text,
  ADD COLUMN IF NOT EXISTS table_name  text,
  ADD COLUMN IF NOT EXISTS record_id   text,
  ADD COLUMN IF NOT EXISTS record_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS user_id     uuid,
  ADD COLUMN IF NOT EXISTS user_name   text;

-- ── 23. USER PROFILES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid primary key,
  created_at timestamp default now()
);
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name  text,
  ADD COLUMN IF NOT EXISTS role       text default 'sales',
  ADD COLUMN IF NOT EXISTS phone      text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

-- ── 24. SETTINGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id bigint generated always as identity primary key
);
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS key        text,
  ADD COLUMN IF NOT EXISTS value      text,
  ADD COLUMN IF NOT EXISTS label      text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

-- ── 25. DOCUMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS title           text,
  ADD COLUMN IF NOT EXISTS doc_type        text,
  ADD COLUMN IF NOT EXISTS file_url        text,
  ADD COLUMN IF NOT EXISTS file_name       text,
  ADD COLUMN IF NOT EXISTS file_size       integer,
  ADD COLUMN IF NOT EXISTS file_type       text,
  ADD COLUMN IF NOT EXISTS thumbnail_url   text,
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS tags            text,
  ADD COLUMN IF NOT EXISTS partner_id      bigint,
  ADD COLUMN IF NOT EXISTS related_id      bigint,
  ADD COLUMN IF NOT EXISTS related_type    text,
  ADD COLUMN IF NOT EXISTS created_by      uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- ══════════════════════════════════════════════════════════════
-- FOREIGN KEYS (aman - skip jika sudah ada)
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE public.partner_deals ADD CONSTRAINT fk_deals_partner
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.vouchers ADD CONSTRAINT fk_vouchers_campaign
    FOREIGN KEY (campaign_id) REFERENCES public.voucher_campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.mous ADD CONSTRAINT fk_mous_partner
    FOREIGN KEY (partner_id) REFERENCES public.partners(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.projects ADD CONSTRAINT fk_projects_partner
    FOREIGN KEY (partner_id) REFERENCES public.partners(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.project_steps ADD CONSTRAINT fk_steps_project
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rab_items ADD CONSTRAINT fk_rab_project
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.leave_requests ADD CONSTRAINT fk_leave_employee
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_partners_status    ON public.partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_category  ON public.partners(category);
CREATE INDEX IF NOT EXISTS idx_deals_partner      ON public.partner_deals(partner_id);
CREATE INDEX IF NOT EXISTS idx_deals_status       ON public.partner_deals(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_campaign  ON public.vouchers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status    ON public.vouchers(status);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_activity_created   ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status    ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_projects_partner   ON public.projects(partner_id);
CREATE INDEX IF NOT EXISTS idx_steps_project      ON public.project_steps(project_id);

-- ══════════════════════════════════════════════════════════════
-- DISABLE RLS SEMUA TABEL
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.partners           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_deals      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_contacts   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_targets        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mous               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_steps      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_items          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_campaigns  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outgoing_letters   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_sequences   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.homecare_orders    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents          DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('templates',  'templates',  true, 52428800,
   ARRAY['image/jpeg','image/png','image/webp','application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('voucher-bg', 'voucher-bg', true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('documents',  'documents',  true, 52428800,
   ARRAY['image/jpeg','image/png','application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('avatars',    'avatars',    true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public read templates"    ON storage.objects;
DROP POLICY IF EXISTS "Upload templates"         ON storage.objects;
DROP POLICY IF EXISTS "Public read voucher-bg"   ON storage.objects;
DROP POLICY IF EXISTS "Upload voucher-bg"        ON storage.objects;
DROP POLICY IF EXISTS "Public read documents"    ON storage.objects;
DROP POLICY IF EXISTS "Upload documents"         ON storage.objects;

CREATE POLICY "Public read templates"  ON storage.objects FOR SELECT USING (bucket_id = 'templates');
CREATE POLICY "Upload templates"       ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'templates');
CREATE POLICY "Public read voucher-bg" ON storage.objects FOR SELECT USING (bucket_id = 'voucher-bg');
CREATE POLICY "Upload voucher-bg"      ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'voucher-bg');
CREATE POLICY "Public read documents"  ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Upload documents"       ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');

-- ══════════════════════════════════════════════════════════════
-- VERIFIKASI AKHIR
-- ══════════════════════════════════════════════════════════════
SELECT
  t.table_name,
  COUNT(c.column_name) as jumlah_kolom
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
  ON c.table_name = t.table_name AND c.table_schema = 'public'
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
