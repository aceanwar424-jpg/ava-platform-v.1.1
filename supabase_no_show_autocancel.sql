-- ═══════════════════════════════════════════════════════════════
-- No-show auto-cancel (server-side, robust) — OPSIONAL.
-- Booking MCU (status 'Booking') yang tanggal kunjungannya sudah lewat
-- lebih dari 1x24 jam & belum check-in → otomatis 'Cancelled'.
-- Sisi klien sudah menyapu saat modul Admisi dibuka; ini memastikan
-- pembatalan tetap jalan walau aplikasi tidak dibuka.
-- Butuh extension pg_cron (aktifkan di Supabase: Database → Extensions).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cancel_no_show_bookings()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE public.admissions
     SET status = 'Cancelled', updated_at = now()
   WHERE status = 'Booking'
     AND visit_date < (current_date - INTERVAL '1 day');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Jadwalkan tiap jam (butuh pg_cron). Aman diulang: unschedule dulu jika ada.
-- SELECT cron.unschedule('no-show-autocancel');
-- SELECT cron.schedule('no-show-autocancel', '0 * * * *', $$SELECT public.cancel_no_show_bookings();$$);

SELECT 'no-show autocancel function ready' AS status;
