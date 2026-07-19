-- ══════════════════════════════════════════════════════
-- OneLab Growth Platform — Schema v2
-- Run di: Supabase > SQL Editor > New Query
-- ══════════════════════════════════════════════════════

-- SETTINGS
CREATE TABLE IF NOT EXISTS public.settings (
  id         bigint generated always as identity primary key,
  key        text not null unique,
  value      text,
  label      text,
  updated_at timestamp default now()
);

-- ACTIVITY LOGS
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

-- USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text default 'sales',
  phone      text,
  avatar_url text,
  created_at timestamp default now()
);

-- PARTNERS (ensure all columns)
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS partner_code  text,
  ADD COLUMN IF NOT EXISTS pic_name      text,
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS address       text,
  ADD COLUMN IF NOT EXISTS latitude      text,
  ADD COLUMN IF NOT EXISTS longitude     text,
  ADD COLUMN IF NOT EXISTS rating        numeric,
  ADD COLUMN IF NOT EXISTS total_reviews integer,
  ADD COLUMN IF NOT EXISTS status        text default 'Prospect',
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS assigned_to   uuid,
  ADD COLUMN IF NOT EXISTS assigned_name text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

-- PARTNER DEALS (kerjasama per partner, bisa banyak)
CREATE TABLE IF NOT EXISTS public.partner_deals (
  id           bigint generated always as identity primary key,
  partner_id   bigint not null references public.partners(id) on delete cascade,
  deal_name    text not null,
  deal_type    text,     -- MCU, Wellness, Branding, OfficeCare, HomeCare, Personal, Lainnya
  description  text,
  value        numeric default 0,
  frequency    text,     -- Sekali, Bulanan, Tahunan, Per Event
  status       text default 'Active',  -- Active, Inactive, Expired
  start_date   date,
  end_date     date,
  pic_partner  text,
  notes        text,
  created_by   uuid,
  created_at   timestamp default now(),
  updated_at   timestamp default now()
);

-- PARTNER CONTACTS (multiple contacts per partner)
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

-- MARKETING TEMPLATES
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id          bigint generated always as identity primary key,
  title       text not null,
  type        text,
  channel     text,
  content     text,
  tags        text,
  is_active   boolean default true,
  created_by  uuid,
  created_at  timestamp default now(),
  updated_at  timestamp default now()
);

-- OUTGOING LETTERS
CREATE TABLE IF NOT EXISTS public.outgoing_letters (
  id              bigint generated always as identity primary key,
  doc_number      text unique,
  sequence_num    integer,
  title           text,
  letter_type     text,
  to_name         text,
  to_address      text,
  to_pic          text,
  letter_date     date default current_date,
  template_id     bigint,
  template_name   text,
  content         text,
  status          text default 'Draft',
  partner_id      bigint,
  created_by      uuid,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- LETTER SEQUENCES
CREATE TABLE IF NOT EXISTS public.letter_sequences (
  id        bigint generated always as identity primary key,
  year      integer not null,
  month     integer not null,
  type_code text not null,
  last_seq  integer default 0,
  unique(year, month, type_code)
);

-- VOUCHER CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.voucher_campaigns (
  id              bigint generated always as identity primary key,
  campaign_name   text not null,
  description     text,
  discount_type   text default 'percent',
  discount_value  numeric default 0,
  services        text,
  valid_from      date,
  valid_until     date,
  bg_color        text default '#0A2342',
  primary_color   text default '#00897B',
  bg_image_url    text,
  wa_template     text,
  qr_data         text,
  is_active       boolean default true,
  created_by      uuid,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- VOUCHERS
CREATE TABLE IF NOT EXISTS public.vouchers (
  id              bigint generated always as identity primary key,
  campaign_id     bigint references public.voucher_campaigns(id),
  code            text unique not null,
  sequence_num    integer,
  status          text default 'Active',
  recipient_name  text,
  recipient_phone text,
  recipient_email text,
  partner_id      bigint,
  partner_name    text,
  issued_at       timestamp default now(),
  used_at         timestamp,
  expires_at      timestamp,
  shared_via      text,
  created_by      uuid,
  created_at      timestamp default now()
);

-- Verify tables
SELECT table_name, 
  (SELECT count(*) FROM information_schema.columns c 
   WHERE c.table_name=t.table_name AND c.table_schema='public') as col_count
FROM information_schema.tables t
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
