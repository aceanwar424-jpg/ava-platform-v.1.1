-- 0003 — Peran & izin (RBAC)
--
-- Sebelum ini, kendali akses sepenuhnya di sisi klien: applyRoleMenu()
-- membaca daftar halaman yang boleh dibuka dari localStorage
-- ('ol_user_pages_<id>'). Siapa pun bisa menulis ulang nilai itu lewat
-- DevTools dan membuka seluruh modul. Peran hanya mengatur tampilan.
--
-- Migrasi ini memindahkan matriks yang sudah ada di modules/settings_users.js
-- ke basis data, supaya bisa ditegakkan di sisi server dan bisa diaudit.
-- Nilai seed disalin PERSIS dari matriks yang berlaku sekarang — bukan
-- ditafsirkan ulang — agar perilaku tidak berubah diam-diam saat dipasang.

CREATE TABLE IF NOT EXISTS public.roles (
  kode        text PRIMARY KEY,
  label       text NOT NULL,
  keterangan  text,
  warna       text,
  urutan      integer DEFAULT 100,
  is_system   boolean DEFAULT true,     -- peran bawaan: tidak boleh dihapus
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  kode        text PRIMARY KEY,         -- mis. 'data.delete'
  modul       text,
  keterangan  text
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_kode       text NOT NULL REFERENCES public.roles(kode) ON DELETE CASCADE,
  permission_kode text NOT NULL REFERENCES public.permissions(kode) ON DELETE CASCADE,
  PRIMARY KEY (role_kode, permission_kode)
);

-- Halaman yang boleh dibuka per peran. Menggantikan daftar di localStorage.
CREATE TABLE IF NOT EXISTS public.role_pages (
  role_kode  text NOT NULL REFERENCES public.roles(kode) ON DELETE CASCADE,
  page       text NOT NULL,
  PRIMARY KEY (role_kode, page)
);

-- ── Izin ──────────────────────────────────────────────────────────────
INSERT INTO public.permissions (kode, modul, keterangan) VALUES
  ('data.delete',      'umum',     'Menghapus satu baris data'),
  ('data.bulk_delete', 'umum',     'Menghapus banyak baris sekaligus'),
  ('data.export',      'umum',     'Mengekspor data ke berkas'),
  ('user.manage',      'pengguna', 'Membuat, mengubah, menonaktifkan pengguna'),
  ('logbook.approve',  'mutu',     'Menyetujui logbook'),
  ('task.assign',      'tugas',    'Menugaskan pekerjaan ke orang lain'),
  ('team.board.view',  'tugas',    'Melihat papan kerja seluruh tim')
ON CONFLICT (kode) DO NOTHING;

-- ── Peran (disalin dari ROLES di modules/settings_users.js) ───────────
INSERT INTO public.roles (kode, label, warna, urutan) VALUES
  ('super_admin',   'Super Admin',                            '#7B1FA2', 10),
  ('direktur',      'Direktur',                               '#0A2342', 20),
  ('manager',       'Manager',                                '#00897B', 30),
  ('spv',           'SPV / Supervisor',                       '#0E7490', 40),
  ('dokter',        'Dokter Telehealth',                      '#0EA5E9', 50),
  ('operasional',   'Operasional Lab',                        '#2E7D32', 60),
  ('finance_staff', 'Finance Staff',                          '#00838F', 70),
  ('hrd_staff',     'HRD Staff',                              '#E65100', 80),
  ('sales',         'Sales',                                  '#1565C0', 90),
  ('vendor',        'Vendor Alkes / Lab Kalibrasi',           '#F59E0B', 100),
  ('patient',       'Pasien / Customer (Registrasi Mandiri)', '#10B981', 110),
  ('viewer',        'Viewer',                                 '#546E7A', 120)
ON CONFLICT (kode) DO NOTHING;

-- ── Matriks peran → izin ──────────────────────────────────────────────
INSERT INTO public.role_permissions (role_kode, permission_kode) VALUES
  ('super_admin','data.delete'), ('super_admin','data.bulk_delete'),
  ('super_admin','data.export'), ('super_admin','user.manage'),
  ('super_admin','logbook.approve'), ('super_admin','task.assign'),
  ('super_admin','team.board.view'),

  ('direktur','data.delete'), ('direktur','data.export'),
  ('direktur','logbook.approve'), ('direktur','task.assign'),
  ('direktur','team.board.view'),

  ('manager','data.delete'), ('manager','data.export'),
  ('manager','logbook.approve'), ('manager','task.assign'),
  ('manager','team.board.view'),

  ('spv','data.export'), ('spv','logbook.approve'),
  ('spv','task.assign'), ('spv','team.board.view'),

  ('dokter','data.export'),
  ('finance_staff','data.export')
ON CONFLICT DO NOTHING;

-- Peran tanpa baris di atas (sales, operasional, hrd_staff, vendor,
-- patient, viewer) memang tidak memegang satu pun izin istimewa —
-- sesuai matriks yang berlaku sekarang.

-- ── Pemeriksaan izin, dipakai sisi server ─────────────────────────────
CREATE OR REPLACE FUNCTION public.role_has_permission(p_role text, p_perm text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
     WHERE role_kode = p_role AND permission_kode = p_perm
  );
$$ LANGUAGE sql STABLE;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions (role_kode);
CREATE INDEX IF NOT EXISTS idx_role_pages_role       ON public.role_pages (role_kode);
