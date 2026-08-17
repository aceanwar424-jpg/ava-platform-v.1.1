-- 0017 — Portal korporat: saring tagihan lewat kunci relasi, bukan nama
--
-- KEBOCORAN YANG DIPERBAIKI
-- portal_korporat() menyaring tagihan dengan
--     WHERE partner_name = v_c.corporate_name
-- yaitu mencocokkan TEKS BEBAS. Akibatnya portal satu perusahaan
-- menampilkan tagihan milik entitas lain yang kebetulan bernama sama.
--
-- Ini bukan kemungkinan teoretis. Saat diuji dengan data yang sudah ada,
-- token untuk akun korporat "Klinik Melati" menampilkan tiga tagihan milik
-- MITRA RUJUKAN bernama "Klinik Melati" — badan usaha yang sama sekali
-- berbeda. Data keuangan pihak ketiga terbuka kepada klien korporat, lewat
-- tautan yang justru dirancang untuk membatasi cakupan.
--
-- Nama perusahaan tidak unik dan bisa berubah. Penyaringan cakupan harus
-- memakai kunci yang memang dijamin unik.
--
-- invoices.corporate_id adalah konvensi asli aplikasi: modules/finance.js
-- mengisinya saat membuat invoice batch MCU korporat, dan
-- modules/config_package.js membacanya kembali dengan corporate_id=eq.
-- Fungsi portal ini yang menyimpang, bukan skemanya.
--
-- Konsekuensi yang disengaja: tagihan yang corporate_id-nya belum terisi
-- TIDAK akan muncul di portal. Menampilkan tagihan yang mungkin milik orang
-- lain jauh lebih berbahaya daripada menampilkan daftar yang kurang lengkap.

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
    -- Pesan sama persis dengan di atas. Perusahaan yang sudah dihapus tidak
    -- boleh bisa dibedakan dari token yang salah oleh pemegang tautan.
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

    'kontrak', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'nomor', contract_number, 'jenis', contract_type,
        'mulai', start_date, 'selesai', end_date,
        'kuota', max_peserta, 'terpakai', used_peserta,
        'nilai', nilai_kontrak, 'status', status) ORDER BY start_date DESC)
        FROM public.corporate_contracts WHERE corporate_id = v_a.ref_id), '[]'::jsonb),

    'karyawan_ringkas', jsonb_build_object(
      'total',  (SELECT count(*) FROM public.corporate_employees WHERE corporate_id = v_a.ref_id),
      'aktif',  (SELECT count(*) FROM public.corporate_employees
                  WHERE corporate_id = v_a.ref_id AND COALESCE(status,'') = 'Aktif')),

    -- Daftar pemeriksaan: nama karyawan dan statusnya. TIDAK menyertakan
    -- hasil klinis — perusahaan berhak tahu siapa sudah diperiksa, bukan
    -- membaca hasil medis karyawannya.
    'pemeriksaan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'batch', booking_batch, 'tanggal', book_date,
        'nama', patient_name, 'departemen', department,
        'paket', package_name, 'status', exam_status) ORDER BY book_date DESC)
        FROM (SELECT * FROM public.corp_exam_requests
               WHERE corporate_id = v_a.ref_id ORDER BY book_date DESC LIMIT 200) x), '[]'::jsonb),

    -- Kunci relasi, bukan nama. Lihat catatan di kepala berkas ini.
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
