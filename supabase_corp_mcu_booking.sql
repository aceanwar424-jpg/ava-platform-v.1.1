-- ═══════════════════════════════════════════════════════════════
-- Corporate MCU → Booking Admisi
-- Menyambung rantai: assign paket per karyawan → jadwalkan MCU →
-- baris admissions ter-create otomatis → muncul di list admisi.
-- Aman dijalankan berulang (IF NOT EXISTS). Jalankan SEBELUM hard-refresh.
-- ═══════════════════════════════════════════════════════════════

-- ── corporate_employees: penjadwalan & anti double-booking ──────
-- (package_id / package_name sudah ada dari supabase_config_lab.sql)
ALTER TABLE public.corporate_employees
  ADD COLUMN IF NOT EXISTS mcu_date             date,       -- tanggal MCU yang dijadwalkan
  ADD COLUMN IF NOT EXISTS booking_admission_id bigint,     -- admisi yang sudah dibuat (null = belum)
  ADD COLUMN IF NOT EXISTS assigned_by          text,       -- siapa yang meng-assign paket
  ADD COLUMN IF NOT EXISTS assigned_at          timestamp;

-- ── admissions: tautan balik ke karyawan korporat sumber booking ─
ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS corporate_employee_id bigint;

CREATE INDEX IF NOT EXISTS idx_corp_emp_booking ON public.corporate_employees(booking_admission_id);
CREATE INDEX IF NOT EXISTS idx_corp_emp_mcu     ON public.corporate_employees(mcu_date);
CREATE INDEX IF NOT EXISTS idx_adm_corp_emp     ON public.admissions(corporate_employee_id);

SELECT 'corp MCU booking columns ready' AS status;
