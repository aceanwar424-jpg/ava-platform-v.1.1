-- 0019 — Dokter & klinik perujuk: model data, komisi, dan portalnya
--
-- MENGAPA ADA
-- Portal rujukan di apps/index.html sudah menampilkan "24 Pasien" dan
-- "Rp 1.200.000" sejak lama. Kedua angka itu ditulis langsung di HTML —
-- tidak ada tabel, tidak ada perhitungan, tidak ada sumbernya. Layar yang
-- meyakinkan tanpa data di belakangnya lebih berbahaya daripada layar
-- kosong, karena tidak ada yang tahu ia bohong.
--
-- Berkas ini membuat data yang seharusnya ada di belakang layar itu.
--
-- KEPUTUSAN PERHITUNGAN
-- Komisi TIDAK disimpan sebagai angka. Ia dihitung ulang dari pendaftaran
-- yang benar-benar tercatat setiap kali ditanyakan. Komisi tersimpan akan
-- menyimpang begitu tarif berubah, pendaftaran dibatalkan, atau nilainya
-- dikoreksi — dan penyimpangan pada angka yang dibayarkan ke pihak luar
-- adalah jenis kesalahan yang paling mahal untuk ditemukan belakangan.
--
-- Yang disimpan hanya PENCAIRAN: uang yang benar-benar sudah dibayarkan.
-- Saldo = yang terkumpul (dihitung) − yang sudah dicairkan (disimpan).

-- ── Pihak perujuk ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perujuk (
  id              bigserial PRIMARY KEY,
  nama            text NOT NULL,
  jenis           text NOT NULL DEFAULT 'Dokter',   -- Dokter | Klinik | Lab | Individu
  partner_id      bigint,                            -- kaitan ke partners bila ada
  spesialisasi    text,
  telepon         text,
  email           text,

  -- Dua tarif yang bisa dipakai bersamaan: persentase dari nilai bersih
  -- pendaftaran, ditambah jumlah tetap per pasien. Klinik memakai persen,
  -- dokter perorangan sering memakai nominal tetap per rujukan.
  komisi_persen   numeric(5,2) NOT NULL DEFAULT 0,
  komisi_tetap    bigint       NOT NULL DEFAULT 0,

  bank_nama       text,
  bank_rekening   text,
  bank_atas_nama  text,

  aktif           boolean NOT NULL DEFAULT true,
  catatan         text,
  created_at      timestamp DEFAULT (now() AT TIME ZONE 'UTC'),
  updated_at      timestamp DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_perujuk_aktif ON public.perujuk (aktif, nama);

-- ── Siapa merujuk pendaftaran yang mana ──────────────────────────
-- Ditaruh di admissions, bukan tabel terpisah: satu pendaftaran punya
-- paling banyak satu perujuk, dan menaruhnya di tabel lain hanya menambah
-- satu sambungan yang bisa putus tanpa memberi apa pun.
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS perujuk_id bigint;
CREATE INDEX IF NOT EXISTS idx_admissions_perujuk ON public.admissions (perujuk_id);

-- Tarif SAAT dirujuk ikut dibekukan di barisnya. Kalau tarif perujuk
-- diubah bulan depan, rujukan bulan ini tidak boleh ikut berubah nilainya
-- — itu akan mengubah angka yang mungkin sudah disepakati dan dibayarkan.
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS perujuk_persen numeric(5,2);
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS perujuk_tetap  bigint;

-- ── Pencairan komisi ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perujuk_pencairan (
  id            bigserial PRIMARY KEY,
  perujuk_id    bigint NOT NULL REFERENCES public.perujuk(id),
  tanggal       date NOT NULL DEFAULT CURRENT_DATE,
  jumlah        bigint NOT NULL,
  metode        text,                  -- Transfer | Tunai | Potong tagihan
  referensi     text,
  catatan       text,
  dibuat_oleh   text,
  created_at    timestamp DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_pencairan_perujuk ON public.perujuk_pencairan (perujuk_id, tanggal DESC);

-- ── Komisi per pendaftaran ───────────────────────────────────────
-- Satu tempat perhitungan, dipakai layar admin maupun portal. Kalau rumus
-- ini ditulis dua kali, cepat atau lambat keduanya akan berbeda dan pihak
-- luar akan melihat angka yang tidak sama dengan yang dilihat staf.
--
-- Pendaftaran yang dibatalkan tidak menghasilkan komisi.
-- Dijatuhkan dulu, bukan CREATE OR REPLACE: mengganti view yang sudah ada
-- hanya boleh MENAMBAH kolom di belakang. Menyisipkan kolom di tengah
-- ditolak PostgreSQL, dan migrasi ini memang menyisipkan satu.
DROP VIEW IF EXISTS public.v_komisi_rujukan;
CREATE VIEW public.v_komisi_rujukan AS
SELECT
  a.id                AS admission_id,
  a.perujuk_id,
  a.created_at,
  a.patient_name,
  a.status,
  a.payment_status,
  CASE WHEN COALESCE(a.status,'') ILIKE 'batal%' THEN 0
       ELSE COALESCE(a.net_amount, 0) END          AS nilai_bersih,
  (COALESCE(a.status,'') ILIKE 'batal%')          AS batal,
  COALESCE(a.perujuk_persen, p.komisi_persen, 0)  AS persen_dipakai,
  COALESCE(a.perujuk_tetap,  p.komisi_tetap,  0)  AS tetap_dipakai,
  CASE WHEN COALESCE(a.status,'') ILIKE 'batal%' THEN 0
       ELSE round(COALESCE(a.net_amount,0)
                  * COALESCE(a.perujuk_persen, p.komisi_persen, 0) / 100.0)
            + COALESCE(a.perujuk_tetap, p.komisi_tetap, 0)
  END AS komisi
FROM public.admissions a
JOIN public.perujuk p ON p.id = a.perujuk_id
WHERE a.perujuk_id IS NOT NULL;

-- Ringkasan per perujuk, untuk layar admin.
-- Sama seperti view di atas: mengganti fungsi yang sudah ada tidak boleh
-- mengubah tipe kembaliannya, dan migrasi ini menambah satu kolom.
DROP FUNCTION IF EXISTS public.perujuk_ringkasan();
CREATE FUNCTION public.perujuk_ringkasan()
RETURNS TABLE (
  perujuk_id bigint, nama text, jenis text, aktif boolean,
  jumlah_rujukan bigint, jumlah_batal bigint, nilai_rujukan bigint,
  komisi_terkumpul bigint, sudah_dicairkan bigint, saldo bigint,
  rujukan_terakhir timestamp)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.nama, p.jenis, p.aktif,
    COALESCE(k.jml, 0), COALESCE(k.batal, 0), COALESCE(k.nilai, 0)::bigint,
    COALESCE(k.komisi, 0)::bigint,
    COALESCE(c.dibayar, 0)::bigint,
    (COALESCE(k.komisi, 0) - COALESCE(c.dibayar, 0))::bigint,
    k.terakhir
  FROM public.perujuk p
  LEFT JOIN (
    SELECT perujuk_id, count(*) AS jml,
           count(*) FILTER (WHERE batal) AS batal,
           sum(nilai_bersih) AS nilai,
           sum(komisi) AS komisi, max(created_at) AS terakhir
      FROM public.v_komisi_rujukan GROUP BY perujuk_id) k ON k.perujuk_id = p.id
  LEFT JOIN (
    SELECT perujuk_id, sum(jumlah) AS dibayar
      FROM public.perujuk_pencairan GROUP BY perujuk_id) c ON c.perujuk_id = p.id
  ORDER BY (COALESCE(k.komisi,0) - COALESCE(c.dibayar,0)) DESC, p.nama;
$$;

GRANT EXECUTE ON FUNCTION public.perujuk_ringkasan() TO authenticated, service_role;

-- ── Portal perujuk ───────────────────────────────────────────────
-- Aturan yang sama dengan portal korporat: cakupan ditentukan SEPENUHNYA
-- dari token di sisi server, dan yang ditampilkan adalah STATUS pemeriksaan
-- — bukan hasil medis. Dokter perujuk memang mengenal pasiennya, tetapi
-- hasil laboratorium bukan sesuatu yang dibagikan lewat tautan yang bisa
-- diteruskan ke siapa saja.
CREATE OR REPLACE FUNCTION public.portal_perujuk(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_a record; v_p record; v_hasil jsonb;
BEGIN
  SELECT * INTO v_a FROM public.portal_akses
   WHERE token = p_token AND jenis = 'perujuk';

  IF NOT FOUND OR NOT v_a.aktif
     OR (v_a.berlaku_sampai IS NOT NULL AND v_a.berlaku_sampai < CURRENT_DATE) THEN
    INSERT INTO public.portal_akses_log (akses_id, jenis, berhasil, sebab)
    VALUES (COALESCE(v_a.id, NULL), 'perujuk', false, 'token tidak berlaku');
    RETURN jsonb_build_object('error', 'Tautan tidak berlaku atau sudah berakhir. Hubungi OneLab untuk tautan baru.');
  END IF;

  SELECT * INTO v_p FROM public.perujuk WHERE id = v_a.ref_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tautan tidak berlaku atau sudah berakhir. Hubungi OneLab untuk tautan baru.');
  END IF;

  UPDATE public.portal_akses
     SET terakhir_dipakai = now(), jumlah_akses = jumlah_akses + 1
   WHERE id = v_a.id;
  INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil)
  VALUES (v_a.id, 'perujuk', v_a.ref_id, true);

  SELECT jsonb_build_object(
    'perujuk', jsonb_build_object(
      'nama', v_p.nama, 'jenis', v_p.jenis, 'spesialisasi', v_p.spesialisasi,
      'komisi_persen', v_p.komisi_persen, 'komisi_tetap', v_p.komisi_tetap),

    'ringkas', (
      SELECT jsonb_build_object(
        'jumlah_rujukan',   COALESCE(count(*), 0),
        'jumlah_batal',     COALESCE(count(*) FILTER (WHERE batal), 0),
        'nilai_rujukan',    COALESCE(sum(nilai_bersih), 0),
        'komisi_terkumpul', COALESCE(sum(komisi), 0))
        FROM public.v_komisi_rujukan WHERE perujuk_id = v_a.ref_id),

    'sudah_dicairkan', COALESCE((
      SELECT sum(jumlah) FROM public.perujuk_pencairan WHERE perujuk_id = v_a.ref_id), 0),

    -- Status pemeriksaan, TANPA hasil klinis.
    'rujukan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tanggal', created_at, 'pasien', patient_name,
        'status', status, 'pembayaran', payment_status, 'batal', batal,
        'nilai', nilai_bersih, 'komisi', komisi) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.v_komisi_rujukan
               WHERE perujuk_id = v_a.ref_id
               ORDER BY created_at DESC LIMIT 200) x), '[]'::jsonb),

    'pencairan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tanggal', tanggal, 'jumlah', jumlah, 'metode', metode,
        'referensi', referensi) ORDER BY tanggal DESC)
        FROM public.perujuk_pencairan WHERE perujuk_id = v_a.ref_id), '[]'::jsonb),

    'berlaku_sampai', v_a.berlaku_sampai
  ) INTO v_hasil;

  RETURN v_hasil;
END $$;

GRANT EXECUTE ON FUNCTION public.portal_perujuk(text) TO anon, authenticated, service_role;

-- ── Satu pintu masuk untuk semua portal ──────────────────────────
-- Mesin tidak boleh memutuskan sendiri jenis token apa ini. Kalau ia
-- membaca kolom jenis lalu memilih fungsi, aturan cakupan jadi tertulis di
-- dua tempat — dan portal baru berikutnya akan lupa disambungkan.
CREATE OR REPLACE FUNCTION public.portal_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_jenis text;
BEGIN
  SELECT jenis INTO v_jenis FROM public.portal_akses WHERE token = p_token;

  IF v_jenis IS NULL THEN
    -- Token tidak dikenal. Jawaban harus sama persis dengan jawaban untuk
    -- token kedaluwarsa dan dicabut, supaya penebak tidak belajar apa pun.
    INSERT INTO public.portal_akses_log (jenis, berhasil, sebab)
    VALUES (NULL, false, 'token tidak dikenal');
    RETURN jsonb_build_object('error', 'Tautan tidak berlaku atau sudah berakhir. Hubungi OneLab untuk tautan baru.');
  END IF;

  IF v_jenis = 'perujuk' THEN RETURN public.portal_perujuk(p_token); END IF;
  RETURN public.portal_korporat(p_token);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_data(text) TO anon, authenticated, service_role;
