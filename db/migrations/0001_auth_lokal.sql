-- 0001 — Autentikasi lokal
-- Kredensial pengguna untuk mode desktop/offline. Peran TIDAK disimpan di sini;
-- peran tetap dibaca dari public.user_profiles agar sumber kebenarannya sama
-- dengan mode cloud.
--
-- Idempoten: aman dijalankan pada basis data yang sudah berisi data.

CREATE TABLE IF NOT EXISTS public.local_auth_users (
  id              uuid PRIMARY KEY,
  email           text UNIQUE NOT NULL,
  password_hash   text NOT NULL,          -- scrypt(password, salt), heksadesimal
  password_salt   text NOT NULL,          -- acak 16 byte per pengguna
  is_active       boolean DEFAULT true,
  failed_attempts integer DEFAULT 0,
  locked_until    timestamptz,            -- diisi saat percobaan gagal melewati ambang
  last_login_at   timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Pencarian saat login selalu memakai lower(email).
CREATE INDEX IF NOT EXISTS idx_local_auth_users_email_lower
  ON public.local_auth_users (lower(email));
