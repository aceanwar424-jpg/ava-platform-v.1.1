-- ══════════════════════════════════════════════════════════════════
-- KLAIM PENJAMIN — BPJS, ASURANSI SWASTA, DAN TPA
--
-- Menu "Klaim BPJS & INA-CBG" berstatus "ada" padahal modulnya (481
-- baris) nol panggilan data dan tidak ada satu tabel pun di belakangnya.
--
-- ── YANG SENGAJA TIDAK DIBANGUN DI SINI ───────────────────────────
-- Tidak ada grouper INA-CBG. Tarif INA-CBG dihitung aplikasi E-Klaim
-- resmi Kemenkes berdasarkan tabel tarif ber-SK yang diperbarui berkala;
-- menghitungnya sendiri akan menghasilkan tarif yang berbeda dari yang
-- diakui verifikator. Klaim dengan tarif yang tidak sesuai bukan sekadar
-- ditolak — selisihnya bisa dibaca sebagai kelebihan tagih.
--
-- Karena itu kolom tarif di sini adalah tarif yang DIMASUKKAN dari
-- keluaran E-Klaim, bukan yang dihitung sistem ini. Kolomnya diberi nama
-- apa adanya (tarif_dari_eklaim) supaya tidak ada yang mengira angkanya
-- lahir di sini.
--
-- Hal yang sama berlaku untuk SEP: penerbitannya lewat VClaim BPJS.
-- Yang disimpan di sini nomor SEP yang sudah terbit, bukan penerbitnya.
--
-- Yang dikerjakan migrasi ini: melacak berkas kelengkapan, status
-- pengajuan, dan selisih antara tarif rumah sakit dengan yang dibayar.
-- Itu bagian yang selama ini dikerjakan di spreadsheet.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. PENJAMIN ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.penjamin (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode        text UNIQUE NOT NULL,
  nama        text NOT NULL,
  jenis       text,                    -- BPJS | Asuransi | TPA | Korporat
  pic_nama    text,
  pic_kontak  text,
  tempo_hari  int,                     -- janji waktu bayar
  status      text DEFAULT 'Aktif',
  catatan     text,
  created_at  timestamp DEFAULT now()
);

-- ── 2. BERKAS WAJIB PER PENJAMIN ──────────────────────────────────
-- Tiap penjamin menuntut berkas yang berbeda. Daftarnya dibuat KOSONG:
-- menebak persyaratan penjamin lalu memakainya untuk meloloskan
-- pengajuan berarti klaim dikirim tanpa berkas yang sebenarnya diminta,
-- dan baru ketahuan saat dikembalikan berminggu-minggu kemudian.
CREATE TABLE IF NOT EXISTS public.penjamin_berkas_wajib (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  penjamin_id  bigint REFERENCES public.penjamin(id) ON DELETE CASCADE,
  jenis_berkas text NOT NULL,
  wajib        boolean DEFAULT true,
  keterangan   text,
  UNIQUE (penjamin_id, jenis_berkas)
);

-- ── 3. KLAIM ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.klaim (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  no_klaim      text UNIQUE,
  penjamin_id   bigint REFERENCES public.penjamin(id),
  admission_id  bigint,
  visit_number  text,
  patient_name  text,
  no_kartu      text,
  no_sep        text,                  -- diterbitkan VClaim, disalin ke sini
  tgl_masuk     date,
  tgl_pulang    date,
  jenis_rawat   text,                  -- Rawat Jalan | Rawat Inap
  diagnosa_utama text,                 -- ICD-10
  diagnosa_sekunder text,
  prosedur      text,                  -- ICD-9-CM
  kode_cbg      text,                  -- hasil grouper E-Klaim, disalin
  -- Tarif yang dibebankan rumah sakit (dari billing sendiri).
  tarif_rs      numeric DEFAULT 0,
  -- Tarif hasil E-Klaim. TIDAK dihitung sistem ini — lihat catatan atas.
  tarif_dari_eklaim numeric,
  -- Yang benar-benar dibayar penjamin sesudah verifikasi.
  dibayar       numeric,
  tgl_bayar     date,
  -- Draf | Berkas Lengkap | Diajukan | Verifikasi | Disetujui |
  -- Dikembalikan | Ditolak | Dibayar
  status        text DEFAULT 'Draf',
  alasan_kembali text,
  diajukan_at   timestamp,
  diajukan_oleh text,
  catatan       text,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_klaim_status ON public.klaim(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_klaim_penjamin ON public.klaim(penjamin_id);

-- ── 4. KELENGKAPAN BERKAS PER KLAIM ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.klaim_berkas (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  klaim_id     bigint REFERENCES public.klaim(id) ON DELETE CASCADE,
  jenis_berkas text NOT NULL,
  ada          boolean DEFAULT false,
  berkas_url   text,
  dicek_oleh   text,
  dicek_at     timestamp,
  catatan      text,
  UNIQUE (klaim_id, jenis_berkas)
);

-- ── 5. JEJAK PERUBAHAN STATUS ─────────────────────────────────────
-- Klaim yang dikembalikan lalu diajukan ulang adalah kejadian yang
-- paling sering ditanyakan saat rekonsiliasi. Tanpa jejak, tidak ada
-- yang bisa menjawab berapa kali dan kenapa.
CREATE TABLE IF NOT EXISTS public.klaim_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  klaim_id   bigint REFERENCES public.klaim(id) ON DELETE CASCADE,
  dari       text,
  ke         text,
  alasan     text,
  oleh       text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_klaimlog ON public.klaim_log(klaim_id, created_at);

-- ── 6. SIAPKAN DAFTAR BERKAS SAAT KLAIM DIBUAT ────────────────────
CREATE OR REPLACE FUNCTION public.klaim_buat(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_id bigint; v_no text; v_pj bigint; v_b record; v_n int := 0;
BEGIN
  v_pj := NULLIF(p_data->>'penjamin_id','')::bigint;
  IF v_pj IS NULL THEN
    RETURN jsonb_build_object('error','Penjamin wajib dipilih.');
  END IF;
  IF COALESCE(btrim(p_data->>'patient_name'),'') = '' THEN
    RETURN jsonb_build_object('error','Nama pasien wajib diisi.');
  END IF;

  v_no := 'KLM-' || to_char(now(),'YYMM') || '-' ||
          lpad((COALESCE((SELECT count(*) FROM public.klaim
                          WHERE to_char(created_at,'YYMM') = to_char(now(),'YYMM')),0) + 1)
               ::text, 4, '0');

  INSERT INTO public.klaim
    (no_klaim, penjamin_id, admission_id, visit_number, patient_name,
     no_kartu, no_sep, tgl_masuk, tgl_pulang, jenis_rawat,
     diagnosa_utama, diagnosa_sekunder, prosedur, tarif_rs, catatan)
  VALUES (v_no, v_pj, NULLIF(p_data->>'admission_id','')::bigint,
          p_data->>'visit_number', btrim(p_data->>'patient_name'),
          p_data->>'no_kartu', p_data->>'no_sep',
          NULLIF(p_data->>'tgl_masuk','')::date,
          NULLIF(p_data->>'tgl_pulang','')::date,
          p_data->>'jenis_rawat', p_data->>'diagnosa_utama',
          p_data->>'diagnosa_sekunder', p_data->>'prosedur',
          COALESCE((p_data->>'tarif_rs')::numeric, 0), p_data->>'catatan')
  RETURNING id INTO v_id;

  -- Daftar berkas disalin dari persyaratan penjamin supaya petugas tahu
  -- apa yang harus dikumpulkan sejak awal, bukan saat mau mengajukan.
  FOR v_b IN SELECT * FROM public.penjamin_berkas_wajib WHERE penjamin_id = v_pj LOOP
    INSERT INTO public.klaim_berkas (klaim_id, jenis_berkas)
    VALUES (v_id, v_b.jenis_berkas) ON CONFLICT DO NOTHING;
    v_n := v_n + 1;
  END LOOP;

  INSERT INTO public.klaim_log (klaim_id, dari, ke, oleh)
  VALUES (v_id, NULL, 'Draf', p_data->>'oleh');

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'no_klaim', v_no,
    'berkas_disiapkan', v_n,
    'catatan', CASE WHEN v_n = 0
      THEN 'Penjamin ini belum punya daftar berkas wajib — tetapkan dulu '
        || 'agar kelengkapan bisa diperiksa.' ELSE NULL END);
END $fn$;

-- ── 7. AJUKAN KLAIM ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.klaim_ajukan(
  p_klaim_id bigint, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_k record; v_kurang text[]; v_belum int;
BEGIN
  SELECT * INTO v_k FROM public.klaim WHERE id = p_klaim_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Klaim tidak ditemukan.'); END IF;

  IF v_k.status NOT IN ('Draf','Berkas Lengkap','Dikembalikan') THEN
    RETURN jsonb_build_object('error',
      format('Klaim berstatus "%s" — hanya Draf, Berkas Lengkap, atau Dikembalikan yang bisa diajukan.',
             v_k.status));
  END IF;

  -- Berkas wajib yang belum ada menahan pengajuan. Mengajukan klaim
  -- dengan berkas kurang hampir pasti kembali, dan tiap putaran
  -- bolak-balik menambah minggu ke waktu pembayaran.
  SELECT array_agg(b.jenis_berkas), count(*) INTO v_kurang, v_belum
    FROM public.klaim_berkas b
    JOIN public.penjamin_berkas_wajib w
      ON w.penjamin_id = v_k.penjamin_id AND w.jenis_berkas = b.jenis_berkas
   WHERE b.klaim_id = p_klaim_id AND w.wajib AND NOT b.ada;

  IF COALESCE(v_belum, 0) > 0 THEN
    RETURN jsonb_build_object('error',
      format('%s berkas wajib belum lengkap.', v_belum),
      'kurang', to_jsonb(v_kurang));
  END IF;

  UPDATE public.klaim
     SET status = 'Diajukan', diajukan_at = now(), diajukan_oleh = p_oleh,
         updated_at = now()
   WHERE id = p_klaim_id;

  INSERT INTO public.klaim_log (klaim_id, dari, ke, oleh)
  VALUES (p_klaim_id, v_k.status, 'Diajukan', p_oleh);

  RETURN jsonb_build_object('ok', true, 'no_klaim', v_k.no_klaim);
END $fn$;

-- ── 8. UBAH STATUS ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.klaim_ubah_status(
  p_klaim_id bigint, p_status text, p_alasan text DEFAULT NULL,
  p_dibayar numeric DEFAULT NULL, p_oleh text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_k record;
BEGIN
  IF p_status NOT IN ('Verifikasi','Disetujui','Dikembalikan','Ditolak','Dibayar') THEN
    RETURN jsonb_build_object('error','Status tidak dikenal.');
  END IF;

  SELECT * INTO v_k FROM public.klaim WHERE id = p_klaim_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Klaim tidak ditemukan.'); END IF;

  -- Dikembalikan dan Ditolak WAJIB beralasan. Tanpa alasan tertulis,
  -- tidak ada yang bisa memperbaiki apa pun pada pengajuan berikutnya.
  IF p_status IN ('Dikembalikan','Ditolak')
     AND COALESCE(btrim(p_alasan),'') = '' THEN
    RETURN jsonb_build_object('error',
      'Alasan wajib diisi untuk klaim yang dikembalikan atau ditolak.');
  END IF;

  IF p_status = 'Dibayar' AND p_dibayar IS NULL THEN
    RETURN jsonb_build_object('error','Jumlah yang dibayar wajib diisi.');
  END IF;

  UPDATE public.klaim
     SET status = p_status,
         alasan_kembali = CASE WHEN p_status IN ('Dikembalikan','Ditolak')
                               THEN p_alasan ELSE alasan_kembali END,
         dibayar = COALESCE(p_dibayar, dibayar),
         tgl_bayar = CASE WHEN p_status = 'Dibayar' THEN current_date ELSE tgl_bayar END,
         updated_at = now()
   WHERE id = p_klaim_id;

  INSERT INTO public.klaim_log (klaim_id, dari, ke, alasan, oleh)
  VALUES (p_klaim_id, v_k.status, p_status, p_alasan, p_oleh);

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END $fn$;

-- ── 9. PAPAN KLAIM ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.klaim_papan AS
SELECT k.*, p.nama AS penjamin_nama, p.jenis AS penjamin_jenis, p.tempo_hari,
       (SELECT count(*) FROM public.klaim_berkas b WHERE b.klaim_id = k.id) AS berkas_total,
       (SELECT count(*) FROM public.klaim_berkas b
         WHERE b.klaim_id = k.id AND b.ada)                                 AS berkas_ada,
       -- Selisih antara yang ditagih dan yang dibayar. Inilah angka yang
       -- benar-benar dicari saat rekonsiliasi.
       CASE WHEN k.dibayar IS NOT NULL THEN k.tarif_rs - k.dibayar END      AS selisih,
       CASE WHEN k.diajukan_at IS NOT NULL AND k.tgl_bayar IS NULL
            THEN (current_date - k.diajukan_at::date) END                   AS umur_hari
  FROM public.klaim k
  LEFT JOIN public.penjamin p ON p.id = k.penjamin_id;

GRANT SELECT ON public.klaim_papan TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.klaim_buat(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.klaim_ajukan(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.klaim_ubah_status(bigint,text,text,numeric,text) TO authenticated, service_role;
