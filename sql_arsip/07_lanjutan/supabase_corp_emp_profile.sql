-- ═══════════════════════════════════════════════════════════════
-- Karyawan korporat = profil pasien tertaut corporate + MR unik.
-- Setiap karyawan punya No. RM sendiri (seperti pasien biasa),
-- bedanya tertaut ke corporate_id. Aman diulang (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.corporate_employees
  ADD COLUMN IF NOT EXISTS mr_number       text,        -- No. RM unik per karyawan
  ADD COLUMN IF NOT EXISTS salutation      text,
  ADD COLUMN IF NOT EXISTS place_of_birth  text,
  ADD COLUMN IF NOT EXISTS blood_type      text,
  ADD COLUMN IF NOT EXISTS marital_status  text,
  ADD COLUMN IF NOT EXISTS religion        text,
  ADD COLUMN IF NOT EXISTS id_type         text default 'KTP',
  ADD COLUMN IF NOT EXISTS id_number       text,        -- No. KTP (NIK personal; employee_id = No. karyawan)
  ADD COLUMN IF NOT EXISTS address         text,
  ADD COLUMN IF NOT EXISTS subdistrict     text,
  ADD COLUMN IF NOT EXISTS city            text,
  ADD COLUMN IF NOT EXISTS province        text,
  ADD COLUMN IF NOT EXISTS postal_code     text,
  ADD COLUMN IF NOT EXISTS country         text default 'Indonesia';

CREATE INDEX IF NOT EXISTS idx_corp_emp_mr ON public.corporate_employees(mr_number);

SELECT 'corporate_employees patient-profile columns ready' AS status;
