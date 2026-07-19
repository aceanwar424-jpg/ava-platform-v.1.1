-- ══════════════════════════════════════════════════════
-- OneLab Growth Platform — Full Schema
-- Jalankan di Supabase > SQL Editor > New Query
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

-- USERS PROFILE (extend Supabase auth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text default 'sales',   -- admin, sales, viewer
  avatar_url text,
  created_at timestamp default now()
);

-- MARKETING TEMPLATES
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id          bigint generated always as identity primary key,
  title       text not null,
  type        text,   -- wa_message, proposal, flyer, email, script
  channel     text,   -- komunitas, dokter, apotek, perusahaan, gym
  content     text,
  tags        text,
  is_active   boolean default true,
  created_by  uuid,
  created_at  timestamp default now(),
  updated_at  timestamp default now()
);

-- OUTGOING LETTERS
CREATE TABLE IF NOT EXISTS public.outgoing_letters (
  id            bigint generated always as identity primary key,
  doc_number    text unique,
  sequence_num  integer,
  title         text,
  letter_type   text,   -- penawaran, permohonan, pemberitahuan, mou, lainnya
  to_name       text,
  to_address    text,
  to_pic        text,
  letter_date   date default current_date,
  template_id   bigint,
  template_name text,
  content       text,
  pdf_url       text,
  status        text default 'Draft',  -- Draft, Sent, Archived
  partner_id    bigint,
  created_by    uuid,
  created_by_name text,
  created_at    timestamp default now(),
  updated_at    timestamp default now()
);

-- VOUCHER CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.voucher_campaigns (
  id              bigint generated always as identity primary key,
  campaign_name   text not null,
  description     text,
  discount_type   text default 'percent',  -- percent, fixed
  discount_value  numeric default 0,
  min_purchase    numeric default 0,
  services        text,   -- JSON array of included services
  valid_from      date,
  valid_until     date,
  bg_image_url    text,
  bg_color        text default '#0A2342',
  primary_color   text default '#00897B',
  wa_template     text,
  email_template  text,
  qr_data         text,
  is_active       boolean default true,
  created_by      uuid,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- VOUCHERS (individual)
CREATE TABLE IF NOT EXISTS public.vouchers (
  id           bigint generated always as identity primary key,
  campaign_id  bigint references public.voucher_campaigns(id),
  code         text unique not null,
  sequence_num integer,
  status       text default 'Active',  -- Active, Used, Expired, Cancelled
  recipient_name  text,
  recipient_phone text,
  recipient_email text,
  partner_id   bigint,
  partner_name text,
  issued_at    timestamp default now(),
  used_at      timestamp,
  expires_at   timestamp,
  shared_via   text,  -- wa, email, print
  created_by   uuid,
  created_at   timestamp default now()
);

-- LETTER SEQUENCE COUNTER
CREATE TABLE IF NOT EXISTS public.letter_sequences (
  id        bigint generated always as identity primary key,
  year      integer not null,
  month     integer not null,
  type_code text not null,
  last_seq  integer default 0,
  unique(year, month, type_code)
);

-- Partners update
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS latitude      text,
  ADD COLUMN IF NOT EXISTS longitude     text,
  ADD COLUMN IF NOT EXISTS rating        numeric,
  ADD COLUMN IF NOT EXISTS total_reviews integer,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
ORDER BY table_name;
