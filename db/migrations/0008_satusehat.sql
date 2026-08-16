-- 0008 — Integrasi SATUSEHAT (Kemenkes RI)
--
-- Menggantikan "integrasi" sebelumnya di js/core/fhirConverter.js, yang
-- ternyata palsu: syncToSatuSehat() tidak memanggil apa pun, hanya mencetak
-- log lalu mengembalikan status 'SYNCED_TO_KEMENKES' dengan ID karangan.
-- Data tidak pernah sampai ke Kemenkes, tetapi aplikasi melaporkan berhasil.
--
-- Dua tabel di bawah membuat pengiriman bisa DIBUKTIKAN: apa yang dikirim,
-- kapan, hasilnya apa, dan ID resource yang dikembalikan SATUSEHAT.

-- Pemetaan catatan lokal ↔ resource SATUSEHAT.
-- Tanpa ini, pengiriman ulang akan membuat resource ganda di sistem nasional.
CREATE TABLE IF NOT EXISTS public.satusehat_resource_map (
  id             bigserial PRIMARY KEY,
  resource_type  text NOT NULL,        -- Patient | Encounter | Observation | ...
  lokal_tabel    text NOT NULL,
  lokal_id       text NOT NULL,
  satusehat_id   text NOT NULL,        -- ID resource di SATUSEHAT
  dibuat_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_type, lokal_tabel, lokal_id)
);

-- Jejak tiap pengiriman, berhasil maupun gagal. Ini bukti kepatuhan sekaligus
-- alat telusur saat Kemenkes menolak sebuah resource.
CREATE TABLE IF NOT EXISTS public.satusehat_log (
  id             bigserial PRIMARY KEY,
  resource_type  text,
  metode         text,                 -- POST | PUT | GET
  jalur          text,                 -- path FHIR yang dipanggil
  status_http    integer,
  berhasil       boolean NOT NULL DEFAULT false,
  satusehat_id   text,
  galat          text,
  muatan_ringkas text,                 -- dipangkas; JANGAN simpan payload penuh berisi data pasien
  dikirim_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_satusehat_log_waktu ON public.satusehat_log (dikirim_at DESC);
CREATE INDEX IF NOT EXISTS idx_satusehat_log_gagal ON public.satusehat_log (berhasil, dikirim_at DESC);

-- Setelan integrasi. Kredensial TIDAK disimpan di sini — client secret hanya
-- boleh hidup di desktop-app/.env pada sisi server, sama seperti kunci LLM.
INSERT INTO public.sync_state (kunci, nilai) VALUES
  ('satusehat_aktif',    'false'),
  ('satusehat_env',      'stg'),      -- stg | prod
  ('satusehat_org_id',   ''),
  ('satusehat_terakhir', '')
ON CONFLICT (kunci) DO NOTHING;
