-- 0007 — Halaman khusus per pengguna
--
-- Memperbaiki regresi: UI admin ("atur halaman per pengguna") masih menulis
-- ke localStorage 'ol_user_pages_<id>', sementara applyRoleMenu() sudah
-- dialihkan membaca dari server pada 0005. Akibatnya tombolnya bekerja tapi
-- tidak berpengaruh apa-apa — lebih membingungkan daripada tidak ada.
--
-- localStorage memang tidak boleh jadi sumber hak akses (bisa ditulis ulang
-- lewat DevTools), jadi penyimpanannya dipindah ke sini.

CREATE TABLE IF NOT EXISTS public.user_pages (
  user_id    uuid NOT NULL,
  page       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page)
);

CREATE INDEX IF NOT EXISTS idx_user_pages_user ON public.user_pages (user_id);
