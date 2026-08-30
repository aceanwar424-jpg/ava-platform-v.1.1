-- ══════════════════════════════════════════════════════════════════
-- AVA SANCTUARY — KATALOG TERAPI, TERAPIS, RUANGAN, RESERVASI, MEMBER
--
-- Menggantikan layar karangan di modules/business_units/sanctuary_booking.js
-- (705 baris, NOL panggilan data — jadwal, nama terapis, dan saldo sesi
-- member seluruhnya array yang ditulis tangan).
--
-- ── DUA HAL YANG TIDAK BOLEH SALAH DI SISTEM RESERVASI ────────────
-- 1. Satu terapis tidak boleh dipesan dua kali pada jam yang sama.
--    Ini bukan sekadar gangguan jadwal: pelanggan datang, membayar,
--    lalu tidak ada yang melayani.
-- 2. Saldo sesi member tidak boleh terpotong dua kali atau terpotong
--    untuk sesi yang batal. Saldo itu sudah dibayar di muka.
--
-- Keduanya diselesaikan di basis data, bukan di layar. Pemeriksaan di
-- JavaScript selalu kalah oleh dua petugas yang menekan simpan pada
-- detik yang sama, dan itu justru kejadian paling umum di meja depan.
--
-- ── KENAPA TERAPIS MENUNJUK KE public.employees ───────────────────
-- Repo sudah punya tabel karyawan lengkap dengan NIK, divisi, dan
-- status. Membuat tabel terapis sendiri berarti nama yang sama
-- ditulis dua kali dan berbeda begitu ada yang berhenti. Yang khas
-- terapis — sertifikasi dan jenis terapi yang boleh dikerjakan —
-- disimpan di tabel pendamping.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. KATALOG PAKET TERAPI ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spa_treatment (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode         text UNIQUE NOT NULL,
  nama         text NOT NULL,
  kategori     text,
  durasi_menit int DEFAULT 60,
  harga        numeric DEFAULT 0,
  harga_member numeric DEFAULT 0,
  -- Sesi yang dipotong dari saldo member. Ada terapi yang menghabiskan
  -- dua sesi sekaligus, jadi ini tidak selalu 1.
  sesi_terpakai int DEFAULT 1,
  butuh_ruangan text,
  deskripsi    text,
  kontraindikasi text,
  status       text DEFAULT 'Aktif',
  created_at   timestamp DEFAULT now()
);

-- ── 2. TERAPIS (pendamping public.employees) ──────────────────────
CREATE TABLE IF NOT EXISTS public.spa_terapis (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id  bigint REFERENCES public.employees(id) ON DELETE CASCADE,
  nama         text,
  spesialisasi text,
  sertifikasi  text,
  tgl_sertifikat_habis date,
  status       text DEFAULT 'Aktif',
  created_at   timestamp DEFAULT now(),
  UNIQUE (employee_id)
);

-- Terapi apa saja yang boleh dikerjakan terapis ini. Tanpa daftar ini,
-- sistem akan dengan senang hati menjadwalkan terapis untuk prosedur
-- yang belum pernah ia latih.
CREATE TABLE IF NOT EXISTS public.spa_terapis_kompetensi (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  terapis_id   bigint REFERENCES public.spa_terapis(id) ON DELETE CASCADE,
  treatment_id bigint REFERENCES public.spa_treatment(id) ON DELETE CASCADE,
  UNIQUE (terapis_id, treatment_id)
);

-- ── 3. RUANGAN ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spa_ruangan (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode      text UNIQUE NOT NULL,
  nama      text NOT NULL,
  tipe      text,
  kapasitas int DEFAULT 1,
  lantai    text,
  status    text DEFAULT 'Aktif',
  created_at timestamp DEFAULT now()
);

-- ── 4. MEMBER VIP ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spa_member (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_member    text UNIQUE,
  nama         text NOT NULL,
  hp           text,
  email        text,
  tgl_lahir    date,
  tier         text DEFAULT 'Reguler',
  tgl_gabung   date DEFAULT current_date,
  tgl_berakhir date,
  -- Saldo TIDAK disimpan sebagai kolom di sini. Lihat catatan di
  -- bagian 5 — ia turunan dari mutasi.
  catatan_medis text,
  status       text DEFAULT 'Aktif',
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now()
);

-- ── 5. MUTASI SALDO SESI ──────────────────────────────────────────
-- Saldo sesi adalah uang yang sudah dibayar pelanggan. Menyimpannya
-- sebagai satu angka yang ditambah-kurang berarti: begitu ada satu
-- update yang gagal di tengah, angkanya salah selamanya dan tidak ada
-- cara membuktikan berapa yang seharusnya. Disimpan sebagai mutasi,
-- saldo selalu bisa dihitung ulang dan tiap perubahan punya sebabnya.
CREATE TABLE IF NOT EXISTS public.spa_saldo_mutasi (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id  bigint REFERENCES public.spa_member(id) ON DELETE CASCADE,
  jenis      text NOT NULL,   -- beli | pakai | kembali | hangus | bonus
  sesi       int NOT NULL,    -- positif menambah, negatif mengurangi
  treatment_id bigint REFERENCES public.spa_treatment(id),
  reservasi_id bigint,
  nilai_rupiah numeric DEFAULT 0,
  tgl_kedaluwarsa date,
  catatan    text,
  oleh       text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spasaldo_member ON public.spa_saldo_mutasi(member_id, created_at DESC);

CREATE OR REPLACE VIEW public.spa_saldo AS
SELECT m.id AS member_id, m.no_member, m.nama, m.tier, m.status,
       COALESCE(SUM(s.sesi), 0)                                   AS sesi_tersisa,
       COALESCE(SUM(s.sesi) FILTER (WHERE s.jenis = 'beli'), 0)    AS sesi_dibeli,
       COALESCE(SUM(-s.sesi) FILTER (WHERE s.jenis = 'pakai'), 0)  AS sesi_terpakai,
       COALESCE(SUM(s.nilai_rupiah) FILTER (WHERE s.jenis = 'beli'), 0) AS total_belanja,
       MAX(s.created_at)                                          AS mutasi_terakhir
  FROM public.spa_member m
  LEFT JOIN public.spa_saldo_mutasi s ON s.member_id = m.id
 GROUP BY m.id, m.no_member, m.nama, m.tier, m.status;

-- ── 6. RESERVASI ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spa_reservasi (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_reservasi text UNIQUE,
  member_id    bigint REFERENCES public.spa_member(id),
  tamu_nama    text,
  tamu_hp      text,
  treatment_id bigint REFERENCES public.spa_treatment(id),
  terapis_id   bigint REFERENCES public.spa_terapis(id),
  ruangan_id   bigint REFERENCES public.spa_ruangan(id),
  mulai        timestamp NOT NULL,
  selesai      timestamp NOT NULL,
  -- Dijadwalkan | Hadir | Berlangsung | Selesai | Batal | Tidak Hadir
  status       text DEFAULT 'Dijadwalkan',
  bayar_dengan text DEFAULT 'tunai',   -- tunai | sesi | transfer | qris
  nilai        numeric DEFAULT 0,
  sesi_dipotong int DEFAULT 0,
  catatan      text,
  alasan_batal text,
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spares_jadwal  ON public.spa_reservasi(mulai, status);
CREATE INDEX IF NOT EXISTS idx_spares_terapis ON public.spa_reservasi(terapis_id, mulai);
CREATE INDEX IF NOT EXISTS idx_spares_ruangan ON public.spa_reservasi(ruangan_id, mulai);

-- ── 7. BUAT RESERVASI ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.spa_buat_reservasi(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_tr record; v_mulai timestamp; v_selesai timestamp;
  v_terapis bigint; v_ruangan bigint; v_member bigint;
  v_bayar text; v_saldo int; v_id bigint; v_no text; v_bentrok text;
BEGIN
  SELECT * INTO v_tr FROM public.spa_treatment
   WHERE id = NULLIF(p_data->>'treatment_id','')::bigint;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Paket terapi tidak ditemukan.'); END IF;

  v_mulai   := (p_data->>'mulai')::timestamp;
  IF v_mulai IS NULL THEN RETURN jsonb_build_object('error','Waktu mulai wajib diisi.'); END IF;
  v_selesai := v_mulai + (v_tr.durasi_menit || ' minutes')::interval;

  v_terapis := NULLIF(p_data->>'terapis_id','')::bigint;
  v_ruangan := NULLIF(p_data->>'ruangan_id','')::bigint;
  v_member  := NULLIF(p_data->>'member_id','')::bigint;
  v_bayar   := lower(COALESCE(NULLIF(p_data->>'bayar_dengan',''), 'tunai'));

  IF v_terapis IS NULL THEN RETURN jsonb_build_object('error','Terapis wajib dipilih.'); END IF;

  -- Kompetensi diperiksa sebelum jadwal: menolak karena terapis belum
  -- tersertifikasi lebih berguna disampaikan lebih dulu daripada
  -- setelah petugas mencari-cari slot kosong.
  IF NOT EXISTS (SELECT 1 FROM public.spa_terapis_kompetensi
                  WHERE terapis_id = v_terapis AND treatment_id = v_tr.id) THEN
    RETURN jsonb_build_object('error',
      'Terapis ini belum terdaftar berkompeten untuk ' || v_tr.nama || '.');
  END IF;

  -- ── Bentrok jadwal ──
  -- Dua rentang waktu bertabrakan bila A.mulai < B.selesai DAN
  -- B.mulai < A.selesai. Sengaja memakai < dan bukan <= supaya sesi
  -- yang berakhir tepat saat sesi berikutnya mulai tidak dianggap
  -- bentrok.
  SELECT 'terapis' INTO v_bentrok FROM public.spa_reservasi
   WHERE terapis_id = v_terapis
     AND status IN ('Dijadwalkan','Hadir','Berlangsung')
     AND mulai < v_selesai AND v_mulai < selesai
   LIMIT 1;
  IF v_bentrok IS NOT NULL THEN
    RETURN jsonb_build_object('error',
      'Terapis sudah punya jadwal lain pada jam tersebut.');
  END IF;

  IF v_ruangan IS NOT NULL THEN
    SELECT 'ruangan' INTO v_bentrok FROM public.spa_reservasi
     WHERE ruangan_id = v_ruangan
       AND status IN ('Dijadwalkan','Hadir','Berlangsung')
       AND mulai < v_selesai AND v_mulai < selesai
     LIMIT 1;
    IF v_bentrok IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'Ruangan sudah terpakai pada jam tersebut.');
    END IF;
  END IF;

  -- ── Saldo sesi bila dibayar dengan sesi ──
  IF v_bayar = 'sesi' THEN
    IF v_member IS NULL THEN
      RETURN jsonb_build_object('error','Pembayaran dengan sesi memerlukan data member.');
    END IF;
    SELECT sesi_tersisa INTO v_saldo FROM public.spa_saldo WHERE member_id = v_member;
    IF COALESCE(v_saldo, 0) < v_tr.sesi_terpakai THEN
      RETURN jsonb_build_object('error',
        format('Saldo sesi tidak cukup: tersisa %s, dibutuhkan %s.',
               COALESCE(v_saldo,0), v_tr.sesi_terpakai));
    END IF;
  END IF;

  v_no := 'SPA-' || to_char(v_mulai, 'YYMMDD') || '-' ||
          lpad((COALESCE((SELECT count(*) FROM public.spa_reservasi
                          WHERE mulai::date = v_mulai::date), 0) + 1)::text, 3, '0');

  INSERT INTO public.spa_reservasi
    (no_reservasi, member_id, tamu_nama, tamu_hp, treatment_id, terapis_id,
     ruangan_id, mulai, selesai, bayar_dengan, nilai, catatan)
  VALUES (v_no, v_member, p_data->>'tamu_nama', p_data->>'tamu_hp', v_tr.id,
          v_terapis, v_ruangan, v_mulai, v_selesai, v_bayar,
          CASE WHEN v_bayar = 'sesi' THEN 0
               WHEN v_member IS NOT NULL THEN v_tr.harga_member
               ELSE v_tr.harga END,
          p_data->>'catatan')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_reservasi', v_no,
    'mulai', v_mulai, 'selesai', v_selesai, 'treatment', v_tr.nama);
END $fn$;

-- ── 8. SELESAIKAN SESI (di sinilah saldo dipotong) ────────────────
-- Saldo dipotong saat sesi SELESAI, bukan saat dipesan. Reservasi yang
-- dibatalkan atau pelanggan yang tidak datang tidak boleh memakan sesi
-- yang sudah dibayar.
CREATE OR REPLACE FUNCTION public.spa_selesaikan_sesi(
  p_reservasi_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_r record; v_tr record; v_saldo int;
BEGIN
  SELECT * INTO v_r FROM public.spa_reservasi WHERE id = p_reservasi_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Reservasi tidak ditemukan.'); END IF;

  IF v_r.status = 'Selesai' THEN
    RETURN jsonb_build_object('error','Sesi ini sudah ditutup sebelumnya.');
  END IF;
  IF v_r.status IN ('Batal','Tidak Hadir') THEN
    RETURN jsonb_build_object('error',
      'Reservasi berstatus ' || v_r.status || ' tidak bisa diselesaikan.');
  END IF;

  SELECT * INTO v_tr FROM public.spa_treatment WHERE id = v_r.treatment_id;

  IF v_r.bayar_dengan = 'sesi' AND v_r.member_id IS NOT NULL THEN
    SELECT sesi_tersisa INTO v_saldo FROM public.spa_saldo WHERE member_id = v_r.member_id;
    IF COALESCE(v_saldo,0) < v_tr.sesi_terpakai THEN
      RETURN jsonb_build_object('error',
        format('Saldo sesi tidak lagi mencukupi (tersisa %s).', COALESCE(v_saldo,0)));
    END IF;

    INSERT INTO public.spa_saldo_mutasi
      (member_id, jenis, sesi, treatment_id, reservasi_id, oleh, catatan)
    VALUES (v_r.member_id, 'pakai', -v_tr.sesi_terpakai, v_tr.id, p_reservasi_id,
            p_oleh, 'Sesi ' || v_tr.nama || ' (' || v_r.no_reservasi || ')');
  END IF;

  UPDATE public.spa_reservasi
     SET status = 'Selesai',
         sesi_dipotong = CASE WHEN v_r.bayar_dengan = 'sesi'
                              THEN v_tr.sesi_terpakai ELSE 0 END,
         updated_at = now()
   WHERE id = p_reservasi_id;

  RETURN jsonb_build_object('ok', true, 'no_reservasi', v_r.no_reservasi,
    'sesi_dipotong', CASE WHEN v_r.bayar_dengan = 'sesi' THEN v_tr.sesi_terpakai ELSE 0 END);
END $fn$;

-- ── 9. BATALKAN RESERVASI ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.spa_batal_reservasi(
  p_reservasi_id bigint, p_alasan text, p_tidak_hadir boolean DEFAULT false,
  p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_r record;
BEGIN
  SELECT * INTO v_r FROM public.spa_reservasi WHERE id = p_reservasi_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Reservasi tidak ditemukan.'); END IF;
  -- Sesi yang sudah ditutup TIDAK dibatalkan lewat jalur ini. Menutup
  -- lalu membatalkan diam-diam menghapus jejak bahwa layanan sempat
  -- tercatat diberikan. Koreksi punya pintunya sendiri di bawah, yang
  -- mewajibkan alasan dan meninggalkan catatan.
  IF v_r.status = 'Selesai' THEN
    RETURN jsonb_build_object('error',
      'Sesi sudah ditutup. Gunakan spa_koreksi_sesi_selesai() bila penutupan itu keliru.');
  END IF;

  UPDATE public.spa_reservasi
     SET status = CASE WHEN p_tidak_hadir THEN 'Tidak Hadir' ELSE 'Batal' END,
         alasan_batal = p_alasan, updated_at = now()
   WHERE id = p_reservasi_id;

  RETURN jsonb_build_object('ok', true,
    'status', CASE WHEN p_tidak_hadir THEN 'Tidak Hadir' ELSE 'Batal' END);
END $fn$;

-- ── 9b. KOREKSI SESI YANG TERLANJUR DITUTUP ──────────────
-- Petugas salah menekan "Selesai" pada reservasi orang lain, atau
-- menutup sesi yang ternyata tidak jadi berjalan. Tanpa jalur ini,
-- pelanggan kehilangan sesi yang sudah dibayar dan satu-satunya cara
-- memperbaikinya adalah menyunting basis data langsung.
--
-- Dipisahkan dari pembatalan biasa dengan sengaja: yang ini membalik
-- layanan yang sudah tercatat diberikan, jadi alasannya wajib dan
-- pengembaliannya muncul sebagai mutasi tersendiri — bukan penghapusan
-- diam-diam.
CREATE OR REPLACE FUNCTION public.spa_koreksi_sesi_selesai(
  p_reservasi_id bigint, p_alasan text, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_r record;
BEGIN
  IF COALESCE(btrim(p_alasan), '') = '' THEN
    RETURN jsonb_build_object('error', 'Alasan koreksi wajib diisi.');
  END IF;

  SELECT * INTO v_r FROM public.spa_reservasi WHERE id = p_reservasi_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Reservasi tidak ditemukan.'); END IF;
  IF v_r.status <> 'Selesai' THEN
    RETURN jsonb_build_object('error',
      'Hanya sesi berstatus Selesai yang perlu dikoreksi (status sekarang: ' || v_r.status || ').');
  END IF;

  IF v_r.sesi_dipotong > 0 AND v_r.member_id IS NOT NULL THEN
    INSERT INTO public.spa_saldo_mutasi
      (member_id, jenis, sesi, treatment_id, reservasi_id, oleh, catatan)
    VALUES (v_r.member_id, 'kembali', v_r.sesi_dipotong, v_r.treatment_id,
            p_reservasi_id, p_oleh,
            'Koreksi penutupan ' || v_r.no_reservasi || ': ' || btrim(p_alasan));
  END IF;

  UPDATE public.spa_reservasi
     SET status = 'Batal', sesi_dipotong = 0,
         alasan_batal = 'Koreksi: ' || btrim(p_alasan), updated_at = now()
   WHERE id = p_reservasi_id;

  RETURN jsonb_build_object('ok', true, 'sesi_dikembalikan', v_r.sesi_dipotong);
END $fn$;

-- ── 10. TAMBAH SALDO (pembelian paket sesi) ───────────────────────
CREATE OR REPLACE FUNCTION public.spa_beli_paket_sesi(
  p_member_id bigint, p_sesi int, p_nilai numeric,
  p_berlaku_bulan int DEFAULT 12, p_oleh text DEFAULT NULL, p_catatan text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_saldo int;
BEGIN
  IF p_sesi IS NULL OR p_sesi <= 0 THEN
    RETURN jsonb_build_object('error','Jumlah sesi harus lebih dari nol.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.spa_member WHERE id = p_member_id) THEN
    RETURN jsonb_build_object('error','Member tidak ditemukan.');
  END IF;

  INSERT INTO public.spa_saldo_mutasi
    (member_id, jenis, sesi, nilai_rupiah, tgl_kedaluwarsa, oleh, catatan)
  VALUES (p_member_id, 'beli', p_sesi, COALESCE(p_nilai,0),
          (current_date + (COALESCE(p_berlaku_bulan,12) || ' months')::interval)::date,
          p_oleh, p_catatan);

  SELECT sesi_tersisa INTO v_saldo FROM public.spa_saldo WHERE member_id = p_member_id;
  RETURN jsonb_build_object('ok', true, 'sesi_tersisa', v_saldo);
END $fn$;

-- ── 11. OKUPANSI RUANGAN ──────────────────────────────────────────
CREATE OR REPLACE VIEW public.spa_okupansi_ruangan AS
SELECT r.id, r.kode, r.nama, r.tipe, r.status,
       count(v.id) FILTER (WHERE v.mulai::date = current_date
                             AND v.status IN ('Dijadwalkan','Hadir','Berlangsung')) AS sesi_hari_ini,
       COALESCE(SUM(EXTRACT(EPOCH FROM (v.selesai - v.mulai)) / 3600)
                FILTER (WHERE v.mulai::date = current_date
                          AND v.status IN ('Dijadwalkan','Hadir','Berlangsung','Selesai')), 0) AS jam_terpakai_hari_ini,
       (SELECT min(x.mulai) FROM public.spa_reservasi x
         WHERE x.ruangan_id = r.id AND x.mulai > now()
           AND x.status IN ('Dijadwalkan','Hadir')) AS jadwal_berikutnya
  FROM public.spa_ruangan r
  LEFT JOIN public.spa_reservasi v ON v.ruangan_id = r.id
 GROUP BY r.id, r.kode, r.nama, r.tipe, r.status;

GRANT SELECT ON public.spa_saldo, public.spa_okupansi_ruangan
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spa_buat_reservasi(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spa_selesaikan_sesi(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spa_batal_reservasi(bigint,text,boolean,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spa_koreksi_sesi_selesai(bigint,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spa_beli_paket_sesi(bigint,int,numeric,int,text,text) TO authenticated, service_role;
