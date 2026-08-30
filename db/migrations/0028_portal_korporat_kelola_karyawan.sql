-- ══════════════════════════════════════════════════════════════════
-- PORTAL KORPORAT: dari hanya-baca menjadi bisa mengelola karyawan
--
-- Sampai migrasi ini, portal klien korporat hanya bisa DIBACA. PIC
-- perusahaan melihat kontrak, daftar pemeriksaan, dan tagihan — tapi
-- untuk menambah satu karyawan pun ia harus mengirim surel ke admin,
-- lalu menunggu. Untuk proyek MCU 500 orang itu bukan sekadar repot:
-- rosternya selalu basi.
--
-- Yang ditambahkan di sini:
--   1. portal_akses.boleh_tulis   — izin per-tautan, MATI secara bawaan
--   2. portal_korporat()          — kini juga mengembalikan daftar karyawan
--                                   dan paket yang boleh dipilih
--   3. portal_korporat_karyawan_tambah()   — tambah satu karyawan
--   4. portal_korporat_karyawan_impor()    — tambah banyak sekaligus
--   5. portal_korporat_karyawan_assign()   — tetapkan paket MCU
--   6. portal_korporat_karyawan_nonaktif() — keluarkan dari roster
--
-- ── Yang menjaga keamanannya ──────────────────────────────────────
--
-- corporate_id TIDAK PERNAH diterima dari pemanggil. Ia selalu dibaca
-- dari baris portal_akses milik token. Kalau ia boleh dikirim klien,
-- pemegang token satu perusahaan bisa menukarnya dengan id perusahaan
-- lain dan menulis ke roster mereka. Aturan yang sama sudah dipakai
-- portal_korporat() sejak 0015; migrasi ini tidak melonggarkannya.
--
-- boleh_tulis bawaannya FALSE. Seluruh tautan yang sudah terlanjur
-- beredar tetap hanya-baca sesudah migrasi ini terpasang — izin menulis
-- adalah keputusan sadar staf, bukan efek samping pembaruan.
--
-- Karyawan yang ditambahkan lewat portal berstatus 'Non-Aktif'
-- (= terdaftar, belum dibooking). Perusahaan mengisi rosternya sendiri;
-- yang menjadwalkan pemeriksaan tetap staf. Batas itu disengaja: portal
-- ini tidak boleh bisa membuat beban kerja klinis tanpa sepengetahuan
-- klinik.
--
-- Portal ini tetap TIDAK menyentuh data medis. Ia menulis identitas
-- pekerjaan (nama, NIK, departemen) dan pilihan paket — tidak ada satu
-- pun kolom hasil pemeriksaan yang bisa dijangkau dari sini.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.portal_akses
  ADD COLUMN IF NOT EXISTS boleh_tulis boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.portal_akses.boleh_tulis IS
  'Bila true, pemegang tautan korporat boleh mengelola roster karyawannya '
  'sendiri. Bawaan false — tautan lama tetap hanya-baca.';


-- ══════════════════════════════════════════════════════════════════
-- Penjaga bersama: satu tempat untuk memeriksa token.
--
-- Dipakai oleh keempat fungsi tulis di bawah. Mengembalikan jsonb:
--   {"ok":true,"id":<akses_id>,"ref_id":<corporate_id>}  bila token sah
--   {"error":"..."}                                       bila ditolak
--
-- ── Mengapa mengembalikan galat, bukan RAISE EXCEPTION ──
-- Penjaga ini MENCATAT setiap percobaan yang ditolak ke portal_akses_log.
-- RAISE EXCEPTION membatalkan transaksi, dan pembatalan itu ikut menghapus
-- baris log yang baru saja ditulis — sehingga justru percobaan yang paling
-- perlu terlihat tidak pernah tersimpan. Karena itu penolakan dikembalikan
-- sebagai nilai biasa, dan transaksinya commit bersama lognya.
--
-- Pesan penolakan token sengaja SAMA untuk "tidak ada", "kedaluwarsa", dan
-- "dicabut" — sama seperti di portal_korporat(). Membedakannya memberi tahu
-- penebak bahwa tebakannya sudah mendekati benar.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.portal_korporat_penjaga(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_a public.portal_akses;
BEGIN
  SELECT * INTO v_a FROM public.portal_akses
   WHERE token = p_token AND jenis = 'korporat';

  IF NOT FOUND OR NOT v_a.aktif
     OR (v_a.berlaku_sampai IS NOT NULL AND v_a.berlaku_sampai < CURRENT_DATE) THEN
    INSERT INTO public.portal_akses_log (akses_id, jenis, berhasil, sebab)
    VALUES (COALESCE(v_a.id, NULL), 'korporat', false, 'token tidak berlaku (tulis)');
    RETURN jsonb_build_object('error',
      'Tautan tidak berlaku atau sudah berakhir. Hubungi OneLab untuk tautan baru.');
  END IF;

  IF NOT v_a.boleh_tulis THEN
    INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
    VALUES (v_a.id, 'korporat', v_a.ref_id, false, 'tautan hanya-baca');
    RETURN jsonb_build_object('error',
      'Tautan ini hanya dapat melihat data. Hubungi OneLab untuk mengaktifkan pengelolaan roster.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_a.id, 'ref_id', v_a.ref_id);
END $$;

REVOKE ALL ON FUNCTION public.portal_korporat_penjaga(text) FROM PUBLIC, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════
-- 1. TAMBAH SATU KARYAWAN
--
-- Nama adalah satu-satunya kolom wajib. Sisanya boleh menyusul —
-- memaksa PIC mengisi NIK dan tanggal lahir lengkap di awal adalah cara
-- paling pasti membuat roster tidak pernah diisi sama sekali.
--
-- NIK ganda dalam satu perusahaan ditolak. Dua baris untuk orang yang
-- sama berarti kuota kontrak terpakai dua kali dan satu di antaranya
-- tidak akan pernah datang diperiksa.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.portal_korporat_karyawan_tambah(
  p_token      text,
  p_nama       text,
  p_nik        text DEFAULT NULL,
  p_departemen text DEFAULT NULL,
  p_gender     text DEFAULT NULL,
  p_lahir      date DEFAULT NULL,
  p_telepon    text DEFAULT NULL,
  p_surel      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_g     jsonb;
  v_akses bigint;
  v_ref   bigint;
  v_nama  text := btrim(COALESCE(p_nama, ''));
  v_nik  text := NULLIF(btrim(COALESCE(p_nik, '')), '');
  v_id   bigint;
  v_corp text;
BEGIN
  v_g := public.portal_korporat_penjaga(p_token);
  IF v_g ? 'error' THEN RETURN v_g; END IF;
  v_akses := (v_g->>'id')::bigint;
  v_ref   := (v_g->>'ref_id')::bigint;

  IF length(v_nama) < 2 THEN
    RETURN jsonb_build_object('error', 'Nama karyawan wajib diisi.');
  END IF;
  IF length(v_nama) > 120 THEN
    RETURN jsonb_build_object('error', 'Nama karyawan terlalu panjang (maksimal 120 karakter).');
  END IF;
  IF p_gender IS NOT NULL AND btrim(p_gender) <> ''
     AND upper(btrim(p_gender)) NOT IN ('M', 'F') THEN
    RETURN jsonb_build_object('error', 'Jenis kelamin harus M atau F.');
  END IF;

  IF v_nik IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.corporate_employees
        WHERE corporate_id = v_ref AND employee_id = v_nik) THEN
    RETURN jsonb_build_object('error',
      format('NIK %s sudah terdaftar pada karyawan lain.', v_nik));
  END IF;

  SELECT corporate_name INTO v_corp FROM public.corporates WHERE id = v_ref;

  INSERT INTO public.corporate_employees
    (corporate_id, corporate_name, full_name, employee_id, department,
     gender, birth_date, phone, email, status)
  VALUES
    (v_ref, v_corp, v_nama, v_nik,
     NULLIF(btrim(COALESCE(p_departemen, '')), ''),
     NULLIF(upper(btrim(COALESCE(p_gender, ''))), ''),
     p_lahir,
     NULLIF(btrim(COALESCE(p_telepon, '')), ''),
     NULLIF(btrim(COALESCE(p_surel, '')), ''),
     'Non-Aktif')
  RETURNING id INTO v_id;

  INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
  VALUES (v_akses, 'korporat', v_ref, true, 'tambah karyawan #' || v_id);

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_korporat_karyawan_tambah(
  text, text, text, text, text, date, text, text) TO anon, authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════
-- 2. IMPOR BANYAK KARYAWAN SEKALIGUS
--
-- Menerima array JSON [{nama, nik, departemen, ...}, …]. Dipakai untuk
-- tempel-dari-Excel di portal.
--
-- Baris yang bermasalah DILEWATI, bukan membatalkan seluruh impor.
-- Untuk roster 500 orang, menggagalkan semuanya karena satu NIK ganda
-- berarti PIC harus mengulang dari nol tanpa tahu baris mana yang salah.
-- Yang dilewati dikembalikan beserta alasannya supaya bisa diperbaiki.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.portal_korporat_karyawan_impor(
  p_token text,
  p_baris jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_g       jsonb;
  v_akses   bigint;
  v_ref     bigint;
  v_corp    text;
  v_item    jsonb;
  v_nama    text;
  v_nik     text;
  v_masuk   int := 0;
  v_lewat   jsonb := '[]'::jsonb;
  v_urut    int := 0;
BEGIN
  v_g := public.portal_korporat_penjaga(p_token);
  IF v_g ? 'error' THEN RETURN v_g; END IF;
  v_akses := (v_g->>'id')::bigint;
  v_ref   := (v_g->>'ref_id')::bigint;

  IF jsonb_typeof(p_baris) <> 'array' THEN
    RETURN jsonb_build_object('error', 'Format data tidak dikenali.');
  END IF;
  IF jsonb_array_length(p_baris) > 1000 THEN
    RETURN jsonb_build_object('error',
      'Maksimal 1.000 baris sekali impor. Bagi menjadi beberapa bagian.');
  END IF;

  SELECT corporate_name INTO v_corp FROM public.corporates WHERE id = v_ref;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_baris) LOOP
    v_urut := v_urut + 1;
    v_nama := btrim(COALESCE(v_item->>'nama', ''));
    v_nik  := NULLIF(btrim(COALESCE(v_item->>'nik', '')), '');

    IF length(v_nama) < 2 THEN
      v_lewat := v_lewat || jsonb_build_object(
        'baris', v_urut, 'nama', v_nama, 'sebab', 'nama kosong');
      CONTINUE;
    END IF;

    IF v_nik IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.corporate_employees
          WHERE corporate_id = v_ref AND employee_id = v_nik) THEN
      v_lewat := v_lewat || jsonb_build_object(
        'baris', v_urut, 'nama', v_nama, 'sebab', 'NIK sudah terdaftar');
      CONTINUE;
    END IF;

    INSERT INTO public.corporate_employees
      (corporate_id, corporate_name, full_name, employee_id, department,
       gender, phone, email, status)
    VALUES
      (v_ref, v_corp, left(v_nama, 120), v_nik,
       NULLIF(btrim(COALESCE(v_item->>'departemen', '')), ''),
       NULLIF(upper(btrim(COALESCE(v_item->>'gender', ''))), ''),
       NULLIF(btrim(COALESCE(v_item->>'telepon', '')), ''),
       NULLIF(btrim(COALESCE(v_item->>'surel', '')), ''),
       'Non-Aktif');

    v_masuk := v_masuk + 1;
  END LOOP;

  INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
  VALUES (v_akses, 'korporat', v_ref, true,
          format('impor roster: %s masuk, %s dilewati', v_masuk, jsonb_array_length(v_lewat)));

  RETURN jsonb_build_object('ok', true, 'masuk', v_masuk, 'dilewati', v_lewat);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_korporat_karyawan_impor(text, jsonb)
  TO anon, authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════
-- 3. TETAPKAN PAKET MCU KE KARYAWAN
--
-- Paket yang boleh dipilih dibatasi dua kali: harus aktif, DAN harus
-- paket umum atau paket milik perusahaan itu sendiri. Tanpa batas kedua,
-- satu perusahaan bisa menetapkan paket bertarif khusus milik perusahaan
-- lain kepada karyawannya.
--
-- Kuota kontrak ditegakkan di sini, bukan hanya ditampilkan. Portal yang
-- membiarkan PIC menetapkan 700 paket di atas kontrak 500 orang memindahkan
-- persoalan itu ke meja kasir beberapa minggu kemudian.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.portal_korporat_karyawan_assign(
  p_token   text,
  p_id      bigint,
  p_paket   bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_g      jsonb;
  v_akses  bigint;
  v_ref    bigint;
  v_pk     record;
  v_kuota  int;
  v_pakai  int;
  v_punya  boolean;
BEGIN
  v_g := public.portal_korporat_penjaga(p_token);
  IF v_g ? 'error' THEN RETURN v_g; END IF;
  v_akses := (v_g->>'id')::bigint;
  v_ref   := (v_g->>'ref_id')::bigint;

  SELECT true INTO v_punya FROM public.corporate_employees
   WHERE id = p_id AND corporate_id = v_ref;
  IF NOT FOUND THEN
    -- Karyawan milik perusahaan lain dijawab sama dengan yang tidak ada.
    RETURN jsonb_build_object('error', 'Karyawan tidak ditemukan.');
  END IF;

  -- Melepas paket: selalu boleh, tidak perlu cek kuota.
  IF p_paket IS NULL THEN
    UPDATE public.corporate_employees
       SET package_id = NULL, package_name = NULL,
           status = 'Non-Aktif', updated_at = now()
     WHERE id = p_id AND corporate_id = v_ref;

    INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
    VALUES (v_akses, 'korporat', v_ref, true, 'lepas paket karyawan #' || p_id);
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT id, nama_paket INTO v_pk FROM public.packages
   WHERE id = p_paket
     AND COALESCE(is_active, true)
     AND (corporate_id IS NULL OR corporate_id = v_ref);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Paket tidak tersedia untuk perusahaan Anda.');
  END IF;

  SELECT COALESCE(sum(max_peserta), 0) INTO v_kuota
    FROM public.corporate_contracts
   WHERE corporate_id = v_ref AND COALESCE(status, '') = 'Active';

  SELECT count(*) INTO v_pakai
    FROM public.corporate_employees
   WHERE corporate_id = v_ref AND package_id IS NOT NULL AND id <> p_id;

  IF v_kuota > 0 AND v_pakai >= v_kuota THEN
    RETURN jsonb_build_object('error', format(
      'Kuota kontrak sudah penuh (%s dari %s terpakai). Hubungi OneLab untuk menambah kuota.',
      v_pakai, v_kuota));
  END IF;

  UPDATE public.corporate_employees
     SET package_id = v_pk.id, package_name = v_pk.nama_paket,
         status = 'Aktif', updated_at = now()
   WHERE id = p_id AND corporate_id = v_ref;

  INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
  VALUES (v_akses, 'korporat', v_ref, true,
          format('assign paket %s ke karyawan #%s', v_pk.nama_paket, p_id));

  RETURN jsonb_build_object('ok', true, 'paket', v_pk.nama_paket);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_korporat_karyawan_assign(text, bigint, bigint)
  TO anon, authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════
-- 4. KELUARKAN KARYAWAN DARI ROSTER
--
-- Menonaktifkan, bukan menghapus. Karyawan yang sudah pernah diperiksa
-- terikat pada pemeriksaan dan tagihan; menghapus barisnya membuat
-- riwayat itu kehilangan nama. Yang resign cukup ditandai keluar.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.portal_korporat_karyawan_nonaktif(
  p_token text,
  p_id    bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_g     jsonb;
  v_akses bigint;
  v_ref   bigint;
BEGIN
  v_g := public.portal_korporat_penjaga(p_token);
  IF v_g ? 'error' THEN RETURN v_g; END IF;
  v_akses := (v_g->>'id')::bigint;
  v_ref   := (v_g->>'ref_id')::bigint;

  UPDATE public.corporate_employees
     SET status = 'Keluar', package_id = NULL, package_name = NULL, updated_at = now()
   WHERE id = p_id AND corporate_id = v_ref;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Karyawan tidak ditemukan.');
  END IF;

  INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
  VALUES (v_akses, 'korporat', v_ref, true, 'nonaktifkan karyawan #' || p_id);

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_korporat_karyawan_nonaktif(text, bigint)
  TO anon, authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════
-- 5. portal_korporat() — tambah daftar karyawan & paket yang boleh dipilih
--
-- Definisi utuh diulang di sini (bukan ditambal) karena CREATE OR REPLACE
-- FUNCTION mengganti seluruh badan fungsi. Bagian yang sudah ada di 0017
-- dipertahankan apa adanya; yang baru hanya 'karyawan', 'paket_tersedia',
-- dan 'boleh_tulis'.
--
-- 'karyawan' TETAP tanpa satu pun kolom klinis — sama seperti
-- 'pemeriksaan'. Perusahaan mengelola rosternya, bukan rekam medisnya.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.portal_korporat(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_a record; v_c record; v_hasil jsonb;
BEGIN
  SELECT * INTO v_a FROM public.portal_akses
   WHERE token = p_token AND jenis = 'korporat';

  IF NOT FOUND OR NOT v_a.aktif
     OR (v_a.berlaku_sampai IS NOT NULL AND v_a.berlaku_sampai < CURRENT_DATE) THEN
    INSERT INTO public.portal_akses_log (akses_id, jenis, berhasil, sebab)
    VALUES (COALESCE(v_a.id, NULL), 'korporat', false, 'token tidak berlaku');
    RETURN jsonb_build_object('error', 'Tautan tidak berlaku atau sudah berakhir. Hubungi OneLab untuk tautan baru.');
  END IF;

  SELECT * INTO v_c FROM public.corporates WHERE id = v_a.ref_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tautan tidak berlaku atau sudah berakhir. Hubungi OneLab untuk tautan baru.');
  END IF;

  UPDATE public.portal_akses
     SET terakhir_dipakai = now(), jumlah_akses = jumlah_akses + 1
   WHERE id = v_a.id;
  INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil)
  VALUES (v_a.id, 'korporat', v_a.ref_id, true);

  SELECT jsonb_build_object(
    'perusahaan', jsonb_build_object(
      'nama', v_c.corporate_name, 'kode', v_c.kode_corp,
      'pic', v_c.pic_name, 'industri', v_c.industry),

    'boleh_tulis', COALESCE(v_a.boleh_tulis, false),

    'kontrak', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'nomor', contract_number, 'jenis', contract_type,
        'mulai', start_date, 'selesai', end_date,
        'kuota', max_peserta, 'terpakai', used_peserta,
        'nilai', nilai_kontrak, 'status', status) ORDER BY start_date DESC)
        FROM public.corporate_contracts WHERE corporate_id = v_a.ref_id), '[]'::jsonb),

    'karyawan_ringkas', jsonb_build_object(
      'total',  (SELECT count(*) FROM public.corporate_employees
                  WHERE corporate_id = v_a.ref_id AND COALESCE(status,'') <> 'Keluar'),
      'aktif',  (SELECT count(*) FROM public.corporate_employees
                  WHERE corporate_id = v_a.ref_id AND COALESCE(status,'') = 'Aktif'),
      'belum',  (SELECT count(*) FROM public.corporate_employees
                  WHERE corporate_id = v_a.ref_id AND COALESCE(status,'') = 'Non-Aktif')),

    -- Roster yang bisa dikelola PIC. Tanpa kolom klinis apa pun.
    'karyawan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'nama', full_name, 'nik', employee_id,
        'departemen', department, 'gender', gender, 'telepon', phone,
        'surel', email, 'paket_id', package_id, 'paket', package_name,
        'status', status) ORDER BY full_name)
        FROM public.corporate_employees
       WHERE corporate_id = v_a.ref_id AND COALESCE(status,'') <> 'Keluar'), '[]'::jsonb),

    -- Paket umum + paket khusus perusahaan ini. Harga korporat dipakai
    -- bila ada, karena itulah angka yang berlaku bagi mereka.
    'paket_tersedia', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'nama', nama_paket, 'kategori', kategori_paket,
        'harga', COALESCE(NULLIF(harga_korporat, 0), harga_normal)) ORDER BY nama_paket)
        FROM public.packages
       WHERE COALESCE(is_active, true)
         AND (corporate_id IS NULL OR corporate_id = v_a.ref_id)), '[]'::jsonb),

    'pemeriksaan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'batch', booking_batch, 'tanggal', book_date,
        'nama', patient_name, 'departemen', department,
        'paket', package_name, 'status', exam_status) ORDER BY book_date DESC)
        FROM (SELECT * FROM public.corp_exam_requests
               WHERE corporate_id = v_a.ref_id ORDER BY book_date DESC LIMIT 200) x), '[]'::jsonb),

    'tagihan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'nomor', invoice_number, 'tanggal', invoice_date,
        'jatuh_tempo', due_date, 'nilai', total_amount, 'status', status) ORDER BY invoice_date DESC)
        FROM public.invoices
       WHERE corporate_id = v_a.ref_id), '[]'::jsonb),

    'berlaku_sampai', v_a.berlaku_sampai
  ) INTO v_hasil;

  RETURN v_hasil;
END $$;

GRANT EXECUTE ON FUNCTION public.portal_korporat(text) TO anon, authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════
-- 6. SISI STAF — menerbitkan tautan dengan izin kelola, dan mengubahnya
--
-- portal_akses_buat() bertambah satu parameter. CREATE OR REPLACE tidak
-- bisa menambah parameter pada fungsi yang sudah ada, jadi yang lama
-- dijatuhkan lebih dulu. Parameter barunya ber-DEFAULT false sehingga
-- seluruh pemanggilan 4-argumen yang sudah ada tetap resolve dan tetap
-- menghasilkan tautan hanya-baca.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.portal_akses_buat(text, bigint, text, integer);

CREATE OR REPLACE FUNCTION public.portal_akses_buat(
  p_jenis text, p_ref_id bigint, p_label text, p_hari integer DEFAULT 180,
  p_boleh_tulis boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_id bigint; v_tulis boolean;
BEGIN
  -- Izin menulis hanya masuk akal untuk portal korporat. Portal perujuk
  -- tidak punya roster untuk dikelola; menyalakannya di sana hanya akan
  -- menyisakan bendera aktif yang tidak menjaga apa pun.
  v_tulis := COALESCE(p_boleh_tulis, false) AND COALESCE(p_jenis, 'korporat') = 'korporat';

  -- gen_random_bytes() berasal dari pgcrypto, yang TIDAK ada di PGlite —
  -- lihat 0016_token_tanpa_pgcrypto.sql. Cara pembangkitan token di sini
  -- harus tetap sama dengan yang sudah diputuskan di sana; memakai yang lain
  -- akan mematikan pembuatan tautan portal di instalasi klinik.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.portal_akses (token, jenis, ref_id, label, berlaku_sampai, boleh_tulis)
  VALUES (v_token, COALESCE(p_jenis,'korporat'), p_ref_id, p_label,
          CURRENT_DATE + COALESCE(p_hari, 180), v_tulis)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token, 'boleh_tulis', v_tulis);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_akses_buat(text, bigint, text, integer, boolean)
  TO authenticated, service_role;


-- Menyalakan/mematikan izin kelola pada tautan yang sudah beredar, tanpa
-- perlu mencabut dan menerbitkan ulang. Mencabut izin menulis berlaku
-- seketika: permintaan tulis berikutnya ditolak penjaga.
CREATE OR REPLACE FUNCTION public.portal_akses_set_tulis(
  p_id bigint, p_boleh boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_j text;
BEGIN
  SELECT jenis INTO v_j FROM public.portal_akses WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tautan tidak ditemukan.');
  END IF;
  IF v_j <> 'korporat' THEN
    RETURN jsonb_build_object('error', 'Hanya portal korporat yang punya roster untuk dikelola.');
  END IF;

  UPDATE public.portal_akses SET boleh_tulis = COALESCE(p_boleh, false) WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'boleh_tulis', COALESCE(p_boleh, false));
END $$;

GRANT EXECUTE ON FUNCTION public.portal_akses_set_tulis(bigint, boolean)
  TO authenticated, service_role;
