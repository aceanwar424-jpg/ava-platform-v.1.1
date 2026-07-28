-- ═══════════════════════════════════════════════════════════════
-- Corporate MCU — alur Requestor → Approval (1 layer Manager)
-- Requestor membuat batch (Requested); Approver menyetujui/menolak.
-- Yang disetujui → dibuatkan admissions (masuk pipeline lab).
-- Aman diulang (IF NOT EXISTS). Jalankan SEBELUM hard-refresh.
-- ═══════════════════════════════════════════════════════════════

-- 1) Peran corporate melekat di akun: 'requestor' | 'approver' | null
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS corp_role text;

-- 2) Permintaan pemeriksaan (1 baris per karyawan per batch)
CREATE TABLE IF NOT EXISTS public.corp_exam_requests (
  id                bigint generated always as identity primary key,
  corporate_id      bigint references public.corporates(id) on delete cascade,
  booking_batch     text,                 -- kode batch, mis. 27A6.20260726.3001
  branch            text,
  book_date         date,
  type_of_test      text default 'MCU',
  package_id        bigint references public.packages(id),
  package_name      text,
  -- Data peserta (disalin dari corporate_employees)
  corporate_employee_id bigint references public.corporate_employees(id) on delete set null,
  patient_name      text,
  patient_id_number text,                 -- NIK / KTP
  department        text,
  job_position      text,
  -- Alur approval
  exam_status       text default 'Requested',  -- Requested | Approved | Rejected
  requested_by      text,
  requested_at      timestamp default now(),
  approved_by       text,
  approved_at       timestamp,
  reject_reason     text,
  admission_id      bigint,               -- diisi saat Approved → admissions dibuat
  created_at        timestamp default now(),
  updated_at        timestamp default now()
);

ALTER TABLE public.corp_exam_requests DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cer_corp   ON public.corp_exam_requests(corporate_id);
CREATE INDEX IF NOT EXISTS idx_cer_status ON public.corp_exam_requests(exam_status);
CREATE INDEX IF NOT EXISTS idx_cer_batch  ON public.corp_exam_requests(booking_batch);

SELECT 'corp exam requestor/approval flow ready' AS status;
