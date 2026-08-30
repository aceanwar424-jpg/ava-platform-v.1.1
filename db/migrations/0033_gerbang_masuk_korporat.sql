-- ══════════════════════════════════════════════════════════════════
-- GERBANG MASUK KORPORAT — menutup kebocoran data antar-perusahaan
--
-- ── LUBANGNYA ──────────────────────────────────────────────────
-- Alur masuk korporat di apps/app.js memeriksa kode korporat begini:
--
--     sbGet('corporates', 'kode_corp=eq.' + kodeYangDiketik)
--     if (ada && status === 'Aktif') currentCorporateId = hasil.id
--
-- Yang diperiksa hanya "apakah kode ini ada dan aktif" — BUKAN "apakah
-- orang yang sedang masuk ini berhak atas perusahaan tersebut".
--
-- Lebih jauh, di apps/app.js baris 1410 nilai itu MENGALAHKAN tautan
-- perusahaan milik akunnya sendiri:
--
--     let corpId = currentCorporateId || currentUserProfile?.corporate_id
--
-- Akibatnya siapa pun yang punya akun sah bisa mengetik kode perusahaan
-- lain dan membaca seluruh roster karyawannya: nama, NIK, departemen,
-- riwayat pemeriksaan, dan tagihannya.
--
-- Kode korporat BUKAN rahasia. Ia tercetak di invoice, surat penawaran,
-- dan dokumen PKS — dokumen yang beredar ke banyak tangan.
--
-- ── PERBAIKANNYA ───────────────────────────────────────────────
-- Pemeriksaan dipindahkan ke basis data, dan yang menentukan bukan kode
-- yang diketik melainkan SIAPA yang sedang masuk. Fungsi di bawah membaca
-- auth.uid() sendiri; pemanggil tidak bisa menyebut identitas orang lain.
--
-- Pemeriksaan di sisi klien tidak pernah cukup untuk ini: siapa pun bisa
-- memanggil endpoint langsung tanpa melewati halaman login.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.korporat_verifikasi_akses(p_kode text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   uuid;
  v_prof  record;
  v_corp  record;
  v_peran text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Silakan masuk terlebih dahulu.');
  END IF;

  SELECT * INTO v_corp FROM public.corporates
   WHERE upper(btrim(kode_corp)) = upper(btrim(p_kode));

  -- Pesan SAMA untuk "kode tidak ada" dan "kode tidak aktif". Membedakan
  -- keduanya memberi tahu penebak bahwa kodenya sudah benar — dan kode
  -- korporat cukup pendek untuk ditebak.
  IF NOT FOUND OR COALESCE(v_corp.status, '') <> 'Aktif' THEN
    RETURN jsonb_build_object('error',
      'Kode korporat tidak dikenal atau sedang tidak aktif.');
  END IF;

  SELECT * INTO v_prof FROM public.user_profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profil pengguna tidak ditemukan.');
  END IF;

  v_peran := lower(COALESCE(v_prof.role, ''));

  -- Staf internal boleh membuka perusahaan mana pun — itu memang tugasnya
  -- (menyiapkan proyek MCU, menagih, menyelesaikan sengketa). Peran yang
  -- diizinkan disebutkan satu per satu; daftar tertutup lebih aman
  -- daripada "semua yang bukan korporat".
  IF v_peran IN ('super_admin', 'head_operation', 'direktur', 'manager', 'spv') THEN
    RETURN jsonb_build_object(
      'ok', true, 'id', v_corp.id, 'nama', v_corp.corporate_name,
      'kode', v_corp.kode_corp, 'corp_role', 'staf_internal',
      'sebagai', 'staf');
  END IF;

  -- Selain itu, akun HARUS tertaut ke perusahaan yang kodenya diketik.
  IF v_prof.corporate_id IS NULL OR v_prof.corporate_id <> v_corp.id THEN
    RETURN jsonb_build_object('error',
      'Akun Anda tidak terdaftar pada perusahaan dengan kode tersebut. '
      || 'Hubungi PIC perusahaan Anda atau AVA untuk pendaftaran akses.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'id', v_corp.id, 'nama', v_corp.corporate_name,
    'kode', v_corp.kode_corp,
    -- requestor = boleh mengajukan; approver = boleh menyetujui.
    -- Ditentukan di HIS, bukan dipilih sendiri saat masuk.
    'corp_role', COALESCE(v_prof.corp_role, 'requestor'),
    'sebagai', 'korporat');
END $$;

GRANT EXECUTE ON FUNCTION public.korporat_verifikasi_akses(text)
  TO authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════
-- PENAUTAN AKUN KE PERUSAHAAN — dikerjakan staf dari HIS
--
-- Tanpa cara menautkan, pemeriksaan di atas mengunci semua orang: tidak
-- ada satu pun akun korporat yang bisa masuk karena corporate_id-nya
-- masih kosong.
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.korporat_tautkan_akun(
  p_email text, p_kode text, p_corp_role text DEFAULT 'requestor')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_corp record; v_prof record;
BEGIN
  IF lower(COALESCE(p_corp_role, '')) NOT IN ('requestor', 'approver') THEN
    RETURN jsonb_build_object('error', 'Peran korporat harus requestor atau approver.');
  END IF;

  SELECT * INTO v_corp FROM public.corporates
   WHERE upper(btrim(kode_corp)) = upper(btrim(p_kode));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Kode korporat tidak ditemukan.');
  END IF;

  SELECT * INTO v_prof FROM public.user_profiles
   WHERE lower(btrim(email)) = lower(btrim(p_email));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error',
      'Akun dengan surel tersebut belum ada. Buat akunnya lebih dulu di User Management.');
  END IF;

  UPDATE public.user_profiles
     SET corporate_id = v_corp.id,
         corp_role    = lower(btrim(p_corp_role)),
         role         = CASE WHEN COALESCE(role, '') IN ('', 'patient')
                             THEN 'corporate' ELSE role END
   WHERE id = v_prof.id;

  RETURN jsonb_build_object('ok', true,
    'akun', v_prof.email, 'perusahaan', v_corp.corporate_name,
    'corp_role', lower(btrim(p_corp_role)));
END $$;

GRANT EXECUTE ON FUNCTION public.korporat_tautkan_akun(text, text, text)
  TO authenticated, service_role;
