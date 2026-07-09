-- ══════════════════════════════════════════════
-- OneLab Growth Platform — Supabase Schema Update
-- Jalankan di: Supabase > SQL Editor > New Query
-- ══════════════════════════════════════════════

-- 1. Tabel settings (simpan konfigurasi app: API keys, dll)
CREATE TABLE IF NOT EXISTS public.settings (
  id          bigint generated always as identity primary key,
  key         text not null unique,
  value       text,
  label       text,
  created_at  timestamp without time zone default now(),
  updated_at  timestamp without time zone default now()
);

-- 2. Update tabel activity_logs (pastikan kolom lengkap)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          bigint generated always as identity primary key,
  action      text,             -- create, update, delete, import, export
  table_name  text,             -- partners, vouchers, dll
  record_id   text,
  record_name text,
  description text,
  user_id     text,             -- untuk nanti setelah auth
  user_name   text,
  created_at  timestamp without time zone default now()
);

-- 3. Tambah kolom yang mungkin belum ada di partners
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS latitude    text,
  ADD COLUMN IF NOT EXISTS longitude   text,
  ADD COLUMN IF NOT EXISTS rating      numeric,
  ADD COLUMN IF NOT EXISTS total_reviews integer,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp without time zone default now();

-- 4. Insert API key placeholder (opsional, ganti dengan key asli via app)
-- INSERT INTO public.settings (key, value, label) 
-- VALUES ('maps_api_key', 'AIza...', 'Google Maps API Key')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verifikasi
SELECT 'settings' as tabel, count(*) FROM public.settings
UNION ALL
SELECT 'activity_logs', count(*) FROM public.activity_logs
UNION ALL  
SELECT 'partners', count(*) FROM public.partners;
