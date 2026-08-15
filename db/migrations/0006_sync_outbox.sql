-- 0006 — Outbox sinkronisasi & catatan keadaan
--
-- Fondasi mode offline-first. Setiap perubahan data lokal dicatat lebih dulu
-- di outbox, lalu dikirim ke cloud saat jaringan tersedia. Klinik tetap
-- bekerja penuh ketika internet mati, dan tidak ada perubahan yang hilang
-- ketika sambungan kembali.
--
-- Kenapa outbox, bukan langsung kirim: kalau pengiriman digabung ke dalam
-- transaksi penulisan, satu gangguan jaringan akan menggagalkan pekerjaan
-- klinik yang sebenarnya sudah sah tersimpan di basis data lokal.

CREATE TABLE IF NOT EXISTS public.sync_outbox (
  id            bigserial PRIMARY KEY,
  tabel         text NOT NULL,
  operasi       text NOT NULL,                -- INSERT | UPDATE | DELETE
  penyaring     text,                         -- kueri PostgREST asli (untuk UPDATE/DELETE)
  muatan        jsonb,                        -- badan permintaan
  hasil_kunci   jsonb,                        -- id baris hasil, bila ada
  status        text NOT NULL DEFAULT 'pending',   -- pending | terkirim | gagal
  percobaan     integer NOT NULL DEFAULT 0,
  galat         text,
  dibuat_at     timestamptz NOT NULL DEFAULT now(),
  terkirim_at   timestamptz
);

-- Antrean dibaca berulang kali menurut status + urutan kejadian.
CREATE INDEX IF NOT EXISTS idx_sync_outbox_antre
  ON public.sync_outbox (status, id)
  WHERE status <> 'terkirim';

-- Catatan keadaan sinkronisasi (mis. waktu tarik terakhir, penanda tenant).
CREATE TABLE IF NOT EXISTS public.sync_state (
  kunci       text PRIMARY KEY,
  nilai       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sync_state (kunci, nilai) VALUES
  ('mode',            'lokal'),      -- lokal | dorong | dua_arah
  ('cloud_url',       ''),
  ('terakhir_dorong', ''),
  ('terakhir_tarik',  '')
ON CONFLICT (kunci) DO NOTHING;
