-- ══════════════════════════════════════════════════════════════════
-- MEREK: "OneLab" → "AVA" pada pesan yang dibaca pihak luar
--
-- Beberapa fungsi portal mengembalikan kalimat yang ditampilkan langsung
-- kepada klien korporat dan dokter perujuk, dan kalimat itu masih menyebut
-- "OneLab". Nama itu sudah tidak dipakai.
--
-- ── MENGAPA MIGRASI BARU, BUKAN MENYUNTING YANG LAMA ──────────────
-- Kalimat ini tertanam di dalam badan fungsi yang dibuat 0015, 0017, 0019,
-- dan 0028 — dan keempatnya SUDAH TERPASANG. Runner migrasi menyimpan
-- checksum tiap berkas; menyuntingnya membuat basis data yang sudah ada dan
-- yang baru diam-diam berbeda, dan runner akan memperingatkan setiap boot.
-- Karena itu fungsinya didefinisikan ulang di sini.
--
-- ── SATU KALIMAT, DUA TEMPAT ──────────────────────────────────────
-- Pesan penolakan token HARUS sama persis dengan PORTAL_PESAN_TOLAK di
-- desktop-app/electron/local-engine.js. Kalau berbeda, penebak token bisa
-- memisahkan "format salah" (dijawab mesin) dari "format benar tapi tidak
-- ada" (dijawab basis data) — dan perbedaan itu memberitahunya bahwa
-- tebakannya sudah di jalur yang benar. Keduanya diubah bersamaan.
-- ══════════════════════════════════════════════════════════════════

-- Kalimat baku, ditulis sekali supaya tidak ada salinan yang tertinggal.
--   'Tautan tidak berlaku atau sudah berakhir. Hubungi AVA untuk tautan baru.'

-- ── 1. Penjaga tulis portal korporat (dari 0028) ──────────────────
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
      'Tautan tidak berlaku atau sudah berakhir. Hubungi AVA untuk tautan baru.');
  END IF;

  IF NOT v_a.boleh_tulis THEN
    INSERT INTO public.portal_akses_log (akses_id, jenis, ref_id, berhasil, sebab)
    VALUES (v_a.id, 'korporat', v_a.ref_id, false, 'tautan hanya-baca');
    RETURN jsonb_build_object('error',
      'Tautan ini hanya dapat melihat data. Hubungi AVA untuk mengaktifkan pengelolaan roster.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_a.id, 'ref_id', v_a.ref_id);
END $$;

REVOKE ALL ON FUNCTION public.portal_korporat_penjaga(text) FROM PUBLIC, anon, authenticated;


-- ── 2. Pembaca portal korporat (dari 0028) ────────────────────────
--
-- Hanya dua kalimat penolakan yang berubah. Seluruh bentuk muatan —
-- termasuk 'karyawan' dan 'paket_tersedia' yang ditambahkan 0028 —
-- dipertahankan apa adanya.
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
    RETURN jsonb_build_object('error',
      'Tautan tidak berlaku atau sudah berakhir. Hubungi AVA untuk tautan baru.');
  END IF;

  SELECT * INTO v_c FROM public.corporates WHERE id = v_a.ref_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error',
      'Tautan tidak berlaku atau sudah berakhir. Hubungi AVA untuk tautan baru.');
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

    'karyawan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'nama', full_name, 'nik', employee_id,
        'departemen', department, 'gender', gender, 'telepon', phone,
        'surel', email, 'paket_id', package_id, 'paket', package_name,
        'status', status) ORDER BY full_name)
        FROM public.corporate_employees
       WHERE corporate_id = v_a.ref_id AND COALESCE(status,'') <> 'Keluar'), '[]'::jsonb),

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


-- ── 3. Dispatcher portal (dari 0019) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_jenis text;
BEGIN
  SELECT jenis INTO v_jenis FROM public.portal_akses WHERE token = p_token;

  IF v_jenis IS NULL THEN
    INSERT INTO public.portal_akses_log (jenis, berhasil, sebab)
    VALUES (NULL, false, 'token tidak dikenal');
    RETURN jsonb_build_object('error',
      'Tautan tidak berlaku atau sudah berakhir. Hubungi AVA untuk tautan baru.');
  END IF;

  IF v_jenis = 'perujuk' THEN RETURN public.portal_perujuk(p_token); END IF;
  RETURN public.portal_korporat(p_token);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_data(text) TO anon, authenticated, service_role;


-- ── 4. Portal perujuk (dari 0019) ─────────────────────────────────
--
-- Disalin apa adanya dari 0019; HANYA kalimat penolakannya yang berubah.
-- Menyalin ulang dengan tangan berisiko menggeser logika penyaringan data
-- perujuk, jadi badan fungsinya diambil langsung dari berkas aslinya.
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
    RETURN jsonb_build_object('error', 'Tautan tidak berlaku atau sudah berakhir. Hubungi AVA untuk tautan baru.');
  END IF;

  SELECT * INTO v_p FROM public.perujuk WHERE id = v_a.ref_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tautan tidak berlaku atau sudah berakhir. Hubungi AVA untuk tautan baru.');
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
