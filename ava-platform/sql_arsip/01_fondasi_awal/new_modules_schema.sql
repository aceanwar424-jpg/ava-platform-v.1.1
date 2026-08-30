-- ══════════════════════════════════════════════════════
-- OneLab — Schema untuk Modul Baru
-- Jalankan di Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id               bigint generated always as identity primary key,
  contact_name     text not null,
  company          text,
  phone            text,
  email            text,
  source           text default 'Lainnya',
  status           text default 'Baru',
  estimated_value  numeric default 0,
  assigned_name    text,
  notes            text,
  followup_date    date,
  followup_note    text,
  converted_to_partner boolean default false,
  created_by_name  text,
  created_at       timestamp default now(),
  updated_at       timestamp default now()
);

-- OKR TARGETS
CREATE TABLE IF NOT EXISTS public.okr_targets (
  id            bigint generated always as identity primary key,
  objective     text not null,
  period        text,
  metric_type   text,
  target        numeric default 0,
  actual        numeric default 0,
  assigned_name text,
  notes         text,
  created_by    uuid,
  created_at    timestamp default now(),
  updated_at    timestamp default now()
);

-- HOME CARE ORDERS
CREATE TABLE IF NOT EXISTS public.homecare_orders (
  id             bigint generated always as identity primary key,
  order_number   text unique,
  patient_name   text not null,
  phone          text,
  date_of_birth  date,
  gender         text,
  address        text,
  services       text,
  visit_date     date,
  visit_time     text,
  petugas_name   text,
  total_fee      numeric default 0,
  status         text default 'Baru',
  notes          text,
  created_by_name text,
  created_at     timestamp default now(),
  updated_at     timestamp default now()
);

-- INVENTORY ITEMS
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id            bigint generated always as identity primary key,
  item_code     text,
  item_name     text not null,
  category      text,
  description   text,
  unit          text default 'pcs',
  stock_qty     numeric default 0,
  min_stock     numeric default 5,
  unit_price    numeric default 0,
  supplier_name text,
  location      text,
  updated_at    timestamp default now()
);

-- PURCHASE REQUESTS
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id              bigint generated always as identity primary key,
  pr_number       text unique,
  description     text not null,
  needed_date     date,
  total_estimate  numeric default 0,
  items_detail    text,
  reason          text,
  status          text default 'Menunggu Approval',
  requested_by    text,
  approved_by     text,
  reject_reason   text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  id               bigint generated always as identity primary key,
  supplier_name    text not null,
  contact_name     text,
  phone            text,
  email            text,
  address          text,
  rating           numeric,
  item_categories  text,
  notes            text,
  updated_at       timestamp default now()
);

-- EMPLOYEES
CREATE TABLE IF NOT EXISTS public.employees (
  id                    bigint generated always as identity primary key,
  full_name             text not null,
  nik                   text unique,
  phone                 text,
  email                 text,
  position              text,
  division              text,
  join_date             date,
  status                text default 'Aktif',
  base_salary           numeric default 0,
  bpjs_kesehatan        text,
  bpjs_ketenagakerjaan  text,
  npwp                  text,
  address               text,
  created_at            timestamp default now(),
  updated_at            timestamp default now()
);

-- LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id             bigint generated always as identity primary key,
  employee_id    bigint references public.employees(id),
  employee_name  text,
  leave_type     text,
  start_date     date,
  end_date       date,
  reason         text,
  status         text default 'Menunggu Approval',
  requested_by   text,
  approved_by    text,
  created_at     timestamp default now(),
  updated_at     timestamp default now()
);

-- Disable RLS semua tabel baru
ALTER TABLE public.leads               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_targets         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.homecare_orders     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests      DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_hc_visit ON public.homecare_orders(visit_date);
CREATE INDEX IF NOT EXISTS idx_inv_stock ON public.inventory_items(stock_qty);

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
