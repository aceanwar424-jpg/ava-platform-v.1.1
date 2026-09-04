-- Preflight 0050 — Registry Master HIS
-- Jalankan READ-ONLY pada staging sebelum 0050_his_master_registry.sql.
-- Berkas ini sengaja menghentikan proses bila fondasi multi-tenant/antrean
-- belum tersedia; jangan gunakan hasilnya sebagai izin deploy produksi.

DO $$
DECLARE required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'public.tenants', 'public.user_profiles', 'public.queue_public_devices'
  ] LOOP
    IF to_regclass(required_table) IS NULL THEN
      RAISE EXCEPTION 'Prasyarat % tidak ditemukan. Terapkan migrasi fondasi terlebih dahulu.', required_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.user_profiles'::regclass
      AND attname = 'role' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Kolom public.user_profiles.role tidak ditemukan.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.queue_public_devices'::regclass
      AND attname = 'tenant_id' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'queue_public_devices belum memiliki tenant_id; jalankan 0048 terlebih dahulu.';
  END IF;
END $$;

SELECT
  current_database() AS database_name,
  public.current_tenant_id() AS tenant_uji,
  (SELECT count(*) FROM public.tenants WHERE is_active) AS tenant_aktif,
  (SELECT count(*) FROM public.queue_public_devices) AS perangkat_antrean_terdaftar;
