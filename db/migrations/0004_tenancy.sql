-- 0004 — Registri tenant (model hibrida)
--
-- Model yang dipilih: satu basis data per klinik untuk instalasi desktop
-- (isolasi terkuat, dan memang sudah begitu sejak awal), ditambah tenant_id
-- untuk mode cloud tempat beberapa klinik berbagi satu Supabase.
--
-- Migrasi ini membangun REGISTRI dan MEKANISME-nya. Penambahan kolom
-- tenant_id ke tabel operasional satu per satu menyusul saat mode cloud
-- multi-klinik benar-benar digelar — menambahkannya sekarang ke ~178 tabel
-- adalah pekerjaan spekulatif yang belum divalidasi satu klien pun
-- (lihat disiplin scope di ONELAB.md §5.6).

CREATE TABLE IF NOT EXISTS public.tenants (
  id          uuid PRIMARY KEY,
  kode        text UNIQUE NOT NULL,      -- dipakai di URL/berkas, huruf kecil
  nama        text NOT NULL,
  jenis       text DEFAULT 'klinik',     -- klinik | lab | wellness | suite
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Setiap instalasi punya satu tenant lokal. Baris ini yang dirujuk seluruh
-- data pada mode desktop, sehingga kode yang sama bisa berjalan di dua mode
-- tanpa percabangan.
INSERT INTO public.tenants (id, kode, nama, jenis)
VALUES ('00000000-0000-0000-0000-000000000001', 'lokal', 'Instalasi Lokal', 'suite')
ON CONFLICT (kode) DO NOTHING;

-- Pengguna melekat pada satu tenant. Pada instalasi desktop semuanya
-- menunjuk tenant 'lokal'.
ALTER TABLE public.local_auth_users
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.local_auth_users
   SET tenant_id = '00000000-0000-0000-0000-000000000001'
 WHERE tenant_id IS NULL;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.user_profiles
   SET tenant_id = '00000000-0000-0000-0000-000000000001'
 WHERE tenant_id IS NULL;

-- Tenant aktif untuk sesi berjalan. Pada mode desktop selalu 'lokal';
-- pada mode cloud diisi dari klaim token.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$ LANGUAGE sql STABLE;

CREATE INDEX IF NOT EXISTS idx_local_auth_users_tenant ON public.local_auth_users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant    ON public.user_profiles (tenant_id);
