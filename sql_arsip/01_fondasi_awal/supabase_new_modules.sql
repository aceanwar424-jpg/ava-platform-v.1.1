-- ══════════════════════════════════════════════════
-- OneLab — New Modules Schema
-- Jalankan di Supabase SQL Editor
-- ══════════════════════════════════════════════════

-- INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
  id              bigint generated always as identity primary key,
  invoice_number  text unique,
  invoice_date    date default current_date,
  partner_id      bigint references public.partners(id),
  partner_name    text,
  service_type    text,
  deal_id         bigint,
  project_id      bigint,
  subtotal        numeric default 0,
  discount        numeric default 0,
  ppn_percent     integer default 0,
  total_amount    numeric default 0,
  status          text default 'Draft',
  due_date        date,
  paid_at         timestamp,
  notes           text,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id              bigint generated always as identity primary key,
  lead_name       text not null,
  company         text,
  category        text,
  source          text default 'Manual',
  status          text default 'Baru',
  pic_name        text,
  phone           text,
  email           text,
  address         text,
  estimated_value numeric default 0,
  notes           text,
  next_follow_up  date,
  assigned_to     text,
  converted_to    bigint,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- OKR
CREATE TABLE IF NOT EXISTS public.okr_targets (
  id              bigint generated always as identity primary key,
  period          text not null,
  year            integer,
  quarter         integer,
  metric          text,
  target_value    numeric default 0,
  actual_value    numeric default 0,
  unit            text,
  assigned_to     text,
  notes           text,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- EMPLOYEES (HRD)
CREATE TABLE IF NOT EXISTS public.employees (
  id              bigint generated always as identity primary key,
  employee_code   text unique,
  full_name       text not null,
  division        text,
  position        text,
  status          text default 'Aktif',
  join_date       date,
  contract_end    date,
  phone           text,
  email           text,
  address         text,
  salary          numeric default 0,
  bank_name       text,
  bank_account    text,
  photo_url       text,
  notes           text,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id              bigint generated always as identity primary key,
  employee_id     bigint references public.employees(id),
  employee_name   text,
  leave_type      text,
  start_date      date,
  end_date        date,
  total_days      integer default 1,
  reason          text,
  status          text default 'Pending',
  approved_by     text,
  approved_at     timestamp,
  notes           text,
  created_at      timestamp default now()
);

-- INVENTORY ITEMS
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id              bigint generated always as identity primary key,
  item_code       text unique,
  item_name       text not null,
  category        text,
  unit            text,
  stock_qty       numeric default 0,
  min_stock       numeric default 0,
  max_stock       numeric default 0,
  unit_price      numeric default 0,
  location        text,
  supplier_id     bigint,
  notes           text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- PURCHASE REQUESTS
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id              bigint generated always as identity primary key,
  pr_number       text unique,
  requested_by    text,
  division        text,
  status          text default 'Draft',
  total_amount    numeric default 0,
  notes           text,
  approved_by     text,
  approved_at     timestamp,
  items           text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  id              bigint generated always as identity primary key,
  supplier_name   text not null,
  category        text,
  pic_name        text,
  phone           text,
  email           text,
  address         text,
  payment_terms   text,
  rating          integer default 5,
  notes           text,
  is_active       boolean default true,
  created_at      timestamp default now()
);

-- HOME CARE ORDERS
CREATE TABLE IF NOT EXISTS public.homecare_orders (
  id              bigint generated always as identity primary key,
  order_number    text unique,
  patient_name    text not null,
  patient_phone   text,
  patient_address text,
  service_type    text,
  scheduled_date  date,
  scheduled_time  text,
  assigned_staff  text,
  status          text default 'Baru',
  total_amount    numeric default 0,
  notes           text,
  partner_id      bigint,
  created_by_name text,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
);

-- DISABLE RLS for all new tables
ALTER TABLE public.invoices          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_targets       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.homecare_orders   DISABLE ROW LEVEL SECURITY;

-- VERIFY
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
