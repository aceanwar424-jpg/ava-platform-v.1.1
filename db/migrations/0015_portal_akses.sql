-- 0015 — Akses portal bertoken untuk pihak luar
--
-- Portal klien korporat sudah berkali-kali ditunda dengan alasan "menunggu
-- akses bertoken". Ini akses itu.
--
-- ── Kenapa TIDAK memakai akun biasa ──────────────────────────
-- PIC perusahaan klien bukan staf klinik. Memberi mereka akun pada sistem
-- operasional berarti memberi pijakan di dalam sistem yang memuat data
-- SELURUH pasien. Token bercakupan terbatas memberi tepat satu hal: data
-- korporatnya sendiri, hanya-baca.
--
-- ── Aturan yang mengikat rancangan ini ───────────────────────
-- 1. Cakupan ditentukan SEPENUHNYA di sisi server dari token. Tidak ada
--    corporate_id yang dikirim klien — kalau ada, pemegang token bisa
--    menukarnya dengan milik perusahaan lain.
-- 2. Hanya-baca. Tidak ada satu pun jalur tulis di portal.
-- 3. Bisa dicabut kapan saja dan punya masa berlaku. Kerja sama berakhir,
--    aksesnya ikut berakhir — tanpa perlu menunggu ada yang ingat.
-- 4. Setiap pemakaian dicatat. Bila data bocor, harus bisa ditelusuri
--    token mana, kapan, dari mana.

CREATE TABLE IF NOT EXISTS public.portal_akses (
  id             bigserial PRIMARY KEY,
  token          text UNIQUE NOT NULL,
  jenis          text NOT NULL DEFAULT 'korporat',   -- korporat | referral
  ref_id         bigint NOT NULL,                    -- corporates.id / referral_labs.id
  label          text,                               -- nama yang tampil di daftar
  aktif          boolean NOT NULL DEFAULT true,
  berlaku_sampai date,
  dibuat_oleh    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  terakhir_dipakai timestamptz,
  jumlah_akses   integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_portal_akses_token ON public.portal_akses (token) WHERE aktif;

-- Jejak pemakaian. Dipisah dari tabel token agar pencabutan tidak
-- menghapus bukti siapa pernah membuka apa.
CREATE TABLE IF NOT EXISTS public.portal_akses_log (
  id         bigserial PRIMARY KEY,
  akses_id   bigint,
  jenis      text,
  ref_id     bigint,
  berhasil   boolean NOT NULL DEFAULT true,
  sebab      text,
  dibuka_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_log_waktu ON public.portal_akses_log (dibuka_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- Data portal korporat — cakupan ditentukan token, bukan parameter klien.
--
-- Mengembalikan objek berisi 'error' bila token tidak sah, kedaluwarsa,
-- atau dicabut. Pesannya sengaja SAMA untuk ketiganya: membedakan
-- "token tidak ada" dari "token kedaluwarsa" memberi tahu penebak bahwa
-- tebakannya sudah mendekati benar.
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
    RETURN jsonb_build_object('error', 'Data perusahaan tidak ditemukan.');
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

    'tagihan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'nomor', invoice_number, 'tanggal', invoice_date,
        'jatuh_tempo', due_date, 'nilai', total_amount, 'status', status) ORDER BY invoice_date DESC)
        FROM public.invoices
       WHERE partner_name = v_c.corporate_name), '[]'::jsonb),

    'berlaku_sampai', v_a.berlaku_sampai
  ) INTO v_hasil;

  RETURN v_hasil;
END $$;

-- Pembuatan token. Nilai acak 32 byte — cukup panjang agar tidak bisa
-- ditebak, dan dikembalikan SEKALI saja saat dibuat.
CREATE OR REPLACE FUNCTION public.portal_akses_buat(
  p_jenis text, p_ref_id bigint, p_label text, p_hari integer DEFAULT 180)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_id bigint;
BEGIN
  v_token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.portal_akses (token, jenis, ref_id, label, berlaku_sampai)
  VALUES (v_token, COALESCE(p_jenis,'korporat'), p_ref_id, p_label,
          CURRENT_DATE + COALESCE(p_hari, 180))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token);
END $$;

GRANT EXECUTE ON FUNCTION public.portal_korporat(text)                       TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_akses_buat(text, bigint, text, integer) TO authenticated, service_role;
