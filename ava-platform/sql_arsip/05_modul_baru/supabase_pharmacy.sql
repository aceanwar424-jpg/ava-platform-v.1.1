-- ══════════════════════════════════════════════════════════════
-- OneLab — FARMASI / APOTEK
-- ──────────────────────────────────────────────────────────────
-- Cakupan:
--   1. pharmacy_drugs            — master obat (bentuk sediaan, golongan, formularium)
--   2. pharmacy_batches          — stok per batch + kedaluwarsa (FEFO)
--   3. pharmacy_interactions     — pasangan obat yang berinteraksi
--   4. prescriptions             — resep elektronik (header)
--   5. prescription_items        — detail obat pada resep
--   6. pharmacy_dispenses        — penyerahan obat (header)
--   7. pharmacy_dispense_items   — detail penyerahan + batch yang terpakai
--   8. narcotic_register         — buku register narkotika & psikotropika
--   9. pharmacy_stock_ledger     — kartu stok obat
--
-- PRASYARAT: supabase_fase1_rls_a.sql (current_app_role) dan
--            supabase_fase1_rpc.sql  (current_app_name, write_audit)
--            sudah dijalankan. Fungsi tersebut TIDAK dibuat ulang di sini.
--
-- CATATAN KARTU STOK: obat sengaja memakai pharmacy_stock_ledger sendiri,
-- bukan menumpang public.stock_ledger. Kolom stock_ledger.item_id merujuk
-- inventory_items; menuliskan id obat ke sana akan bertabrakan dengan id
-- barang umum dan mengacaukan laporan Inventory. Bentuk kolomnya sengaja
-- disamakan persis supaya laporan gabungan mudah dibuat bila kelak dibutuhkan.
--
-- Aman dijalankan berulang (idempoten). Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- BAGIAN 1 — SKEMA
-- ══════════════════════════════════════════════════════════════

-- ── 1. PHARMACY_DRUGS — master obat ────────────────────────────
-- Obat dipisahkan dari inventory_items karena butuh atribut yang tidak
-- dimiliki barang umum: bentuk sediaan, kekuatan, golongan, formularium.
CREATE TABLE IF NOT EXISTS public.pharmacy_drugs (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.pharmacy_drugs
  ADD COLUMN IF NOT EXISTS drug_code     text,
  ADD COLUMN IF NOT EXISTS generic_name  text,   -- nama generik (dipakai cek interaksi & alergi)
  ADD COLUMN IF NOT EXISTS brand_name    text,   -- nama dagang
  ADD COLUMN IF NOT EXISTS dosage_form   text,   -- Tablet | Kapsul | Sirup | Injeksi | Salep | Tetes | Suppositoria
  ADD COLUMN IF NOT EXISTS strength      text,   -- contoh: 500 mg, 125 mg/5 mL
  ADD COLUMN IF NOT EXISTS unit          text,   -- satuan terkecil: Tablet, Botol, Ampul
  ADD COLUMN IF NOT EXISTS drug_class    text default 'Bebas',
                                                 -- Bebas | Bebas Terbatas | Keras | Narkotika | Psikotropika
  ADD COLUMN IF NOT EXISTS is_formulary  boolean default true,
  ADD COLUMN IF NOT EXISTS unit_price    numeric default 0,
  ADD COLUMN IF NOT EXISTS min_stock     numeric default 0,
  ADD COLUMN IF NOT EXISTS stock_qty     numeric default 0,   -- ringkasan; sumber kebenaran = pharmacy_batches
  ADD COLUMN IF NOT EXISTS storage_note  text,   -- contoh: simpan 2-8 °C, lemari narkotika
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS is_active     boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_drug_code   ON public.pharmacy_drugs(drug_code) WHERE drug_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drug_generic      ON public.pharmacy_drugs(lower(generic_name));
CREATE INDEX IF NOT EXISTS idx_drug_class        ON public.pharmacy_drugs(drug_class);
CREATE INDEX IF NOT EXISTS idx_drug_active       ON public.pharmacy_drugs(is_active);

-- ── 2. PHARMACY_BATCHES — batch/lot & kedaluwarsa ──────────────
-- Pola kolomnya meniru inventory_batches agar konsisten dengan Inventory.
CREATE TABLE IF NOT EXISTS public.pharmacy_batches (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.pharmacy_batches
  ADD COLUMN IF NOT EXISTS drug_id       bigint,
  ADD COLUMN IF NOT EXISTS drug_code     text,
  ADD COLUMN IF NOT EXISTS batch_no      text,
  ADD COLUMN IF NOT EXISTS expiry_date   date,
  ADD COLUMN IF NOT EXISTS qty_received  numeric default 0,
  ADD COLUMN IF NOT EXISTS qty_remaining numeric default 0,
  ADD COLUMN IF NOT EXISTS received_date date,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS unit_price    numeric default 0,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.pharmacy_batches ADD CONSTRAINT fk_rxbatch_drug
    FOREIGN KEY (drug_id) REFERENCES public.pharmacy_drugs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_rxbatch_drug   ON public.pharmacy_batches(drug_id);
CREATE INDEX IF NOT EXISTS idx_rxbatch_expiry ON public.pharmacy_batches(expiry_date);

-- ── 3. PHARMACY_INTERACTIONS — pasangan obat berinteraksi ──────
-- Pencocokan dilakukan pada NAMA GENERIK secara "mengandung" (contains),
-- sehingga "Amoksisilin Trihidrat" tetap cocok dengan kata kunci "amoksisilin".
--
-- PENTING: daftar ini SENGAJA hanya berisi beberapa contoh yang lazim sebagai
-- titik awal. Daftar ini BUKAN acuan klinis yang lengkap. Apoteker penanggung
-- jawab WAJIB melengkapi dan meninjaunya secara berkala mengikuti formularium
-- dan acuan resmi yang dipakai fasilitas.
CREATE TABLE IF NOT EXISTS public.pharmacy_interactions (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.pharmacy_interactions
  ADD COLUMN IF NOT EXISTS drug_a      text,   -- kata kunci nama generik obat pertama
  ADD COLUMN IF NOT EXISTS drug_b      text,   -- kata kunci nama generik obat kedua
  ADD COLUMN IF NOT EXISTS severity    text default 'Sedang',
                                               -- Ringan | Sedang | Berat | Kontraindikasi
  ADD COLUMN IF NOT EXISTS effect      text,   -- dampak klinis yang mungkin terjadi
  ADD COLUMN IF NOT EXISTS management  text,   -- saran penanganan
  ADD COLUMN IF NOT EXISTS source      text,   -- rujukan
  ADD COLUMN IF NOT EXISTS is_active   boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at  timestamp default now();

CREATE INDEX IF NOT EXISTS idx_rxint_a ON public.pharmacy_interactions(lower(drug_a));
CREATE INDEX IF NOT EXISTS idx_rxint_b ON public.pharmacy_interactions(lower(drug_b));

-- ── 4. PRESCRIPTIONS — resep elektronik (header) ───────────────
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS rx_number       text,
  ADD COLUMN IF NOT EXISTS rx_date         date,
  ADD COLUMN IF NOT EXISTS admission_id    bigint,
  ADD COLUMN IF NOT EXISTS mr_number       text,
  ADD COLUMN IF NOT EXISTS patient_name    text,
  ADD COLUMN IF NOT EXISTS patient_gender  text,
  ADD COLUMN IF NOT EXISTS patient_age     text,
  ADD COLUMN IF NOT EXISTS doctor_name     text,
  ADD COLUMN IF NOT EXISTS diagnosis       text,
  ADD COLUMN IF NOT EXISTS status          text default 'Baru',
                                                  -- Baru | Diserahkan | Dibatalkan
  ADD COLUMN IF NOT EXISTS total_amount    numeric default 0,
  -- Jejak peringatan keselamatan: bila dokter tetap meneruskan resep meski
  -- ada peringatan, alasannya WAJIB tersimpan di sini (ditegakkan di RPC).
  ADD COLUMN IF NOT EXISTS allergy_warning     jsonb,
  ADD COLUMN IF NOT EXISTS allergy_override    text,
  ADD COLUMN IF NOT EXISTS interaction_warning jsonb,
  ADD COLUMN IF NOT EXISTS interaction_override text,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS cancel_reason   text,
  ADD COLUMN IF NOT EXISTS created_by      text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_rx_number ON public.prescriptions(rx_number) WHERE rx_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rx_mr     ON public.prescriptions(mr_number);
CREATE INDEX IF NOT EXISTS idx_rx_status ON public.prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_rx_date   ON public.prescriptions(rx_date);

-- ── 5. PRESCRIPTION_ITEMS — detail obat pada resep ─────────────
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.prescription_items
  ADD COLUMN IF NOT EXISTS rx_id         bigint,
  ADD COLUMN IF NOT EXISTS drug_id       bigint,
  ADD COLUMN IF NOT EXISTS drug_code     text,
  ADD COLUMN IF NOT EXISTS drug_name     text,   -- nama yang tercetak di etiket
  ADD COLUMN IF NOT EXISTS dosage_form   text,
  ADD COLUMN IF NOT EXISTS strength      text,
  ADD COLUMN IF NOT EXISTS drug_class    text,
  ADD COLUMN IF NOT EXISTS qty           numeric default 0,
  ADD COLUMN IF NOT EXISTS unit          text,
  ADD COLUMN IF NOT EXISTS dose          text,   -- contoh: 1 tablet
  ADD COLUMN IF NOT EXISTS frequency     text,   -- contoh: 3x sehari
  ADD COLUMN IF NOT EXISTS duration_days integer default 0,
  ADD COLUMN IF NOT EXISTS instruction   text,   -- aturan pakai: sesudah makan, dll
  ADD COLUMN IF NOT EXISTS unit_price    numeric default 0,
  ADD COLUMN IF NOT EXISTS subtotal      numeric default 0,
  ADD COLUMN IF NOT EXISTS qty_dispensed numeric default 0;

DO $$ BEGIN
  ALTER TABLE public.prescription_items ADD CONSTRAINT fk_rxitem_rx
    FOREIGN KEY (rx_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_rxitem_rx   ON public.prescription_items(rx_id);
CREATE INDEX IF NOT EXISTS idx_rxitem_drug ON public.prescription_items(drug_id);

-- ── 6. PHARMACY_DISPENSES — penyerahan obat (header) ───────────
CREATE TABLE IF NOT EXISTS public.pharmacy_dispenses (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.pharmacy_dispenses
  ADD COLUMN IF NOT EXISTS dispense_number  text,
  ADD COLUMN IF NOT EXISTS rx_id            bigint,
  ADD COLUMN IF NOT EXISTS rx_number        text,
  ADD COLUMN IF NOT EXISTS mr_number        text,
  ADD COLUMN IF NOT EXISTS patient_name     text,
  ADD COLUMN IF NOT EXISTS dispensed_at     timestamp default now(),
  ADD COLUMN IF NOT EXISTS dispensed_by     text,   -- apoteker yang menyerahkan
  -- Identitas penerima. Wajib diisi bila resep memuat narkotika/psikotropika.
  ADD COLUMN IF NOT EXISTS recipient_name     text,
  ADD COLUMN IF NOT EXISTS recipient_id_no    text,   -- NIK / nomor identitas
  ADD COLUMN IF NOT EXISTS recipient_relation text,   -- Pasien Sendiri | Keluarga | Pengantar
  ADD COLUMN IF NOT EXISTS recipient_phone    text,
  ADD COLUMN IF NOT EXISTS has_controlled     boolean default false,
  ADD COLUMN IF NOT EXISTS total_value      numeric default 0,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.pharmacy_dispenses ADD CONSTRAINT fk_disp_rx
    FOREIGN KEY (rx_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_disp_number ON public.pharmacy_dispenses(dispense_number) WHERE dispense_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disp_rx   ON public.pharmacy_dispenses(rx_id);
CREATE INDEX IF NOT EXISTS idx_disp_date ON public.pharmacy_dispenses(dispensed_at);

-- ── 7. PHARMACY_DISPENSE_ITEMS — detail + batch yang terpakai ──
-- Satu baris per (item resep × batch), karena satu permintaan bisa
-- terpenuhi dari lebih dari satu batch mengikuti urutan FEFO.
CREATE TABLE IF NOT EXISTS public.pharmacy_dispense_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.pharmacy_dispense_items
  ADD COLUMN IF NOT EXISTS dispense_id text,
  ADD COLUMN IF NOT EXISTS rx_item_id  bigint,
  ADD COLUMN IF NOT EXISTS drug_id     bigint,
  ADD COLUMN IF NOT EXISTS drug_code   text,
  ADD COLUMN IF NOT EXISTS drug_name   text,
  ADD COLUMN IF NOT EXISTS drug_class  text,
  ADD COLUMN IF NOT EXISTS qty         numeric default 0,
  ADD COLUMN IF NOT EXISTS unit        text,
  ADD COLUMN IF NOT EXISTS batch_id    bigint,
  ADD COLUMN IF NOT EXISTS batch_no    text,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS unit_price  numeric default 0,
  ADD COLUMN IF NOT EXISTS subtotal    numeric default 0;

-- dispense_id sempat dibuat bertipe text pada rancangan awal; paksa ke bigint
-- agar cocok dengan pharmacy_dispenses.id. Dilewati bila tabel sudah berisi data
-- yang tidak bisa dikonversi.
DO $$ BEGIN
  ALTER TABLE public.pharmacy_dispense_items
    ALTER COLUMN dispense_id TYPE bigint USING nullif(dispense_id::text,'')::bigint;
EXCEPTION WHEN others THEN RAISE NOTICE 'dispense_id dibiarkan apa adanya'; END $$;

DO $$ BEGIN
  ALTER TABLE public.pharmacy_dispense_items ADD CONSTRAINT fk_dispitem_disp
    FOREIGN KEY (dispense_id) REFERENCES public.pharmacy_dispenses(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_dispitem_disp ON public.pharmacy_dispense_items(dispense_id);
CREATE INDEX IF NOT EXISTS idx_dispitem_drug ON public.pharmacy_dispense_items(drug_id);

-- ── 8. NARCOTIC_REGISTER — buku register narkotika/psikotropika ─
-- Dicatat terpisah dari kartu stok biasa karena pelaporannya berdiri sendiri
-- dan wajib memuat identitas penerima.
CREATE TABLE IF NOT EXISTS public.narcotic_register (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.narcotic_register
  ADD COLUMN IF NOT EXISTS register_date   date default current_date,
  ADD COLUMN IF NOT EXISTS drug_id         bigint,
  ADD COLUMN IF NOT EXISTS drug_code       text,
  ADD COLUMN IF NOT EXISTS drug_name       text,
  ADD COLUMN IF NOT EXISTS drug_class      text,   -- Narkotika | Psikotropika
  ADD COLUMN IF NOT EXISTS movement_type   text,   -- IN | OUT
  ADD COLUMN IF NOT EXISTS qty             numeric default 0,
  ADD COLUMN IF NOT EXISTS balance_after   numeric default 0,
  ADD COLUMN IF NOT EXISTS batch_no        text,
  ADD COLUMN IF NOT EXISTS rx_number       text,
  ADD COLUMN IF NOT EXISTS mr_number       text,
  ADD COLUMN IF NOT EXISTS patient_name    text,
  ADD COLUMN IF NOT EXISTS doctor_name     text,
  ADD COLUMN IF NOT EXISTS recipient_name  text,
  ADD COLUMN IF NOT EXISTS recipient_id_no text,
  ADD COLUMN IF NOT EXISTS supplier_name   text,
  ADD COLUMN IF NOT EXISTS ref_type        text,   -- dispense | receive | adjust
  ADD COLUMN IF NOT EXISTS ref_id          bigint,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS created_by      text;

CREATE INDEX IF NOT EXISTS idx_narc_date  ON public.narcotic_register(register_date);
CREATE INDEX IF NOT EXISTS idx_narc_drug  ON public.narcotic_register(drug_id);
CREATE INDEX IF NOT EXISTS idx_narc_class ON public.narcotic_register(drug_class);

-- ── 9. PHARMACY_STOCK_LEDGER — kartu stok obat ─────────────────
-- Bentuk kolom sengaja disamakan dengan public.stock_ledger.
CREATE TABLE IF NOT EXISTS public.pharmacy_stock_ledger (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.pharmacy_stock_ledger
  ADD COLUMN IF NOT EXISTS drug_id       bigint,
  ADD COLUMN IF NOT EXISTS drug_code     text,
  ADD COLUMN IF NOT EXISTS drug_name     text,
  ADD COLUMN IF NOT EXISTS movement_type text,   -- IN | OUT | ADJUST
  ADD COLUMN IF NOT EXISTS qty           numeric default 0,
  ADD COLUMN IF NOT EXISTS balance_after numeric default 0,
  ADD COLUMN IF NOT EXISTS unit_price    numeric default 0,
  ADD COLUMN IF NOT EXISTS batch_no      text,
  ADD COLUMN IF NOT EXISTS ref_type      text,   -- receive | dispense | adjust
  ADD COLUMN IF NOT EXISTS ref_id        bigint,
  ADD COLUMN IF NOT EXISTS ref_number    text,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS created_by    text;

CREATE INDEX IF NOT EXISTS idx_rxledger_drug    ON public.pharmacy_stock_ledger(drug_id);
CREATE INDEX IF NOT EXISTS idx_rxledger_created ON public.pharmacy_stock_ledger(created_at);

-- ── 10. Penomoran dokumen ──────────────────────────────────────
-- Memakai sequence, bukan angka acak, supaya nomor tidak pernah bentrok.
CREATE SEQUENCE IF NOT EXISTS public.seq_prescription_no;
CREATE SEQUENCE IF NOT EXISTS public.seq_dispense_no;

-- ══════════════════════════════════════════════════════════════
-- BAGIAN 2 — KEAMANAN BARIS (RLS)
-- ══════════════════════════════════════════════════════════════

-- Master obat & tabel interaksi: bukan data pasien, konsisten dengan
-- master Inventory yang sudah ada.
ALTER TABLE public.pharmacy_drugs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_batches      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_stock_ledger DISABLE ROW LEVEL SECURITY;

-- Tabel yang memuat data pasien: RLS wajib aktif.
-- SELURUH kebijakan lama dihapus dulu, apa pun namanya — satu kebijakan
-- longgar yang tertinggal sudah cukup membatalkan seluruh pengetatan
-- (pelajaran dari supabase_fase1_rls_a_fix.sql).
DO $$
DECLARE
  t   text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'prescriptions','prescription_items','pharmacy_dispenses',
    'pharmacy_dispense_items','narcotic_register'
  ] LOOP
    FOR pol IN SELECT p.polname FROM pg_policy p
               JOIN pg_class c     ON c.oid = p.polrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = t
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, t); END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                    USING (true) WITH CHECK (true)', t || '_authenticated', t);
    RAISE NOTICE 'RLS aktif: %', t;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- BAGIAN 3 — PEMERIKSAAN KESELAMATAN (alergi & interaksi)
-- ══════════════════════════════════════════════════════════════

-- ── Cek alergi ─────────────────────────────────────────────────
-- Mencocokkan alergen pasien dengan nama generik ATAU nama dagang obat.
-- Pencocokan dua arah "mengandung" supaya "Penisilin" cocok dengan
-- "Amoksisilin" hanya bila memang tertulis, dan "Amoksisilin Trihidrat"
-- tetap tertangkap oleh alergen "amoksisilin".
CREATE OR REPLACE FUNCTION public.rx_check_allergies(
  p_mr_number text, p_drug_ids bigint[]
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'drug_id',    d.id,
           'drug_name',  coalesce(d.brand_name, d.generic_name),
           'allergen',   a.allergen,
           'reaction',   a.reaction,
           'severity',   coalesce(a.severity,'Sedang')
         )), '[]'::jsonb)
  FROM public.pharmacy_drugs d
  JOIN public.patient_allergies a
    ON coalesce(a.is_active, true)
   AND a.mr_number = p_mr_number
   AND length(trim(coalesce(a.allergen,''))) >= 3
   AND (
        lower(coalesce(d.generic_name,'')) LIKE '%' || lower(trim(a.allergen)) || '%'
     OR lower(coalesce(d.brand_name,''))   LIKE '%' || lower(trim(a.allergen)) || '%'
   )
  WHERE d.id = ANY(p_drug_ids)
    AND coalesce(p_mr_number,'') <> '';
$$;

COMMENT ON FUNCTION public.rx_check_allergies(text,bigint[]) IS
  'Peringatan alergi untuk sekumpulan obat pada satu pasien. Dipakai UI sebelum menyimpan resep dan ditegakkan ulang di rx_save_prescription.';

-- ── Cek interaksi antar obat ───────────────────────────────────
-- Memeriksa setiap pasangan obat pada resep terhadap tabel
-- pharmacy_interactions. Pasangan diperiksa dua arah (A-B dan B-A).
CREATE OR REPLACE FUNCTION public.rx_check_interactions(
  p_drug_ids bigint[]
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH obat AS (
    SELECT id, coalesce(brand_name, generic_name) AS nama, lower(coalesce(generic_name,'')) AS generik
    FROM public.pharmacy_drugs WHERE id = ANY(p_drug_ids)
  ),
  pasangan AS (
    SELECT o1.id AS id1, o1.nama AS nama1, o1.generik AS g1,
           o2.id AS id2, o2.nama AS nama2, o2.generik AS g2
    FROM obat o1 JOIN obat o2 ON o1.id < o2.id
  )
  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
           'drug_id_a',   p.id1,
           'drug_name_a', p.nama1,
           'drug_id_b',   p.id2,
           'drug_name_b', p.nama2,
           'severity',    coalesce(i.severity,'Sedang'),
           'effect',      i.effect,
           'management',  i.management
         )), '[]'::jsonb)
  FROM pasangan p
  JOIN public.pharmacy_interactions i
    ON coalesce(i.is_active, true)
   AND length(trim(coalesce(i.drug_a,''))) >= 3
   AND length(trim(coalesce(i.drug_b,''))) >= 3
   AND (
        (p.g1 LIKE '%' || lower(trim(i.drug_a)) || '%' AND p.g2 LIKE '%' || lower(trim(i.drug_b)) || '%')
     OR (p.g1 LIKE '%' || lower(trim(i.drug_b)) || '%' AND p.g2 LIKE '%' || lower(trim(i.drug_a)) || '%')
   );
$$;

COMMENT ON FUNCTION public.rx_check_interactions(bigint[]) IS
  'Peringatan interaksi antar obat pada satu resep. Daftar pasangan di pharmacy_interactions masih contoh dan wajib dilengkapi apoteker.';

-- ══════════════════════════════════════════════════════════════
-- BAGIAN 4 — RPC: RESEP
-- ══════════════════════════════════════════════════════════════

-- ── Simpan resep elektronik dalam satu transaksi ───────────────
-- Peringatan alergi & interaksi diperiksa ULANG di server. Bila ada
-- peringatan tetapi alasan meneruskan tidak diisi, resep DITOLAK.
-- Dengan begitu peringatan tidak mungkin dilewati diam-diam dari browser.
CREATE OR REPLACE FUNCTION public.rx_save_prescription(
  p_header jsonb, p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role     text := public.current_app_role();
  v_name     text := public.current_app_name();
  v_rx_id    bigint;
  v_rx_no    text;
  v_line     jsonb;
  v_drug     record;
  v_qty      numeric;
  v_ids      bigint[] := ARRAY[]::bigint[];
  v_alergi   jsonb;
  v_interaksi jsonb;
  v_total    numeric := 0;
  v_count    int := 0;
  v_mr       text := nullif(trim(coalesce(p_header->>'mr_number','')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('dokter','apoteker','farmasi','perawat','manager','direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang membuat resep', v_role;
  END IF;
  IF v_mr IS NULL THEN RAISE EXCEPTION 'Pasien belum dipilih (nomor rekam medis kosong)'; END IF;
  IF jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Resep tidak berisi obat';
  END IF;

  -- Kumpulkan id obat lebih dulu untuk pemeriksaan keselamatan
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_line->>'drug_id') IS NOT NULL THEN
      v_ids := v_ids || (v_line->>'drug_id')::bigint;
    END IF;
  END LOOP;

  v_alergi    := public.rx_check_allergies(v_mr, v_ids);
  v_interaksi := public.rx_check_interactions(v_ids);

  -- Peringatan tidak boleh dilewati diam-diam: alasan wajib dicatat.
  IF jsonb_array_length(v_alergi) > 0
     AND length(trim(coalesce(p_header->>'allergy_override',''))) < 5 THEN
    RAISE EXCEPTION 'Ada peringatan alergi. Isi alasan meneruskan resep (minimal 5 karakter) atau ganti obat.';
  END IF;
  IF jsonb_array_length(v_interaksi) > 0
     AND length(trim(coalesce(p_header->>'interaction_override',''))) < 5 THEN
    RAISE EXCEPTION 'Ada peringatan interaksi obat. Isi alasan meneruskan resep (minimal 5 karakter) atau ganti obat.';
  END IF;

  v_rx_no := 'RX/' || to_char(now(),'YYYYMM') || '/' ||
             lpad(nextval('public.seq_prescription_no')::text, 5, '0');

  INSERT INTO prescriptions(
    rx_number, rx_date, admission_id, mr_number, patient_name, patient_gender,
    patient_age, doctor_name, diagnosis, status, total_amount,
    allergy_warning, allergy_override, interaction_warning, interaction_override,
    notes, created_by, updated_at)
  VALUES (
    v_rx_no, coalesce(nullif(p_header->>'rx_date','')::date, current_date),
    nullif(p_header->>'admission_id','')::bigint, v_mr,
    p_header->>'patient_name', p_header->>'patient_gender', p_header->>'patient_age',
    coalesce(nullif(trim(coalesce(p_header->>'doctor_name','')),''), v_name),
    p_header->>'diagnosis', 'Baru', 0,
    CASE WHEN jsonb_array_length(v_alergi) > 0 THEN v_alergi END,
    nullif(trim(coalesce(p_header->>'allergy_override','')),''),
    CASE WHEN jsonb_array_length(v_interaksi) > 0 THEN v_interaksi END,
    nullif(trim(coalesce(p_header->>'interaction_override','')),''),
    p_header->>'notes', v_name, now())
  RETURNING id INTO v_rx_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_line->>'qty')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Jumlah obat harus lebih dari nol';
    END IF;

    SELECT * INTO v_drug FROM pharmacy_drugs WHERE id = (v_line->>'drug_id')::bigint;
    IF NOT FOUND THEN RAISE EXCEPTION 'Obat id % tidak ditemukan', v_line->>'drug_id'; END IF;

    INSERT INTO prescription_items(
      rx_id, drug_id, drug_code, drug_name, dosage_form, strength, drug_class,
      qty, unit, dose, frequency, duration_days, instruction, unit_price, subtotal, qty_dispensed)
    VALUES (
      v_rx_id, v_drug.id, v_drug.drug_code,
      coalesce(v_drug.brand_name, v_drug.generic_name),
      v_drug.dosage_form, v_drug.strength, v_drug.drug_class,
      v_qty, v_drug.unit,
      v_line->>'dose', v_line->>'frequency',
      coalesce(nullif(v_line->>'duration_days','')::int, 0),
      v_line->>'instruction',
      coalesce(v_drug.unit_price,0), coalesce(v_drug.unit_price,0) * v_qty, 0);

    v_total := v_total + coalesce(v_drug.unit_price,0) * v_qty;
    v_count := v_count + 1;
  END LOOP;

  UPDATE prescriptions SET total_amount = v_total WHERE id = v_rx_id;

  PERFORM public.write_audit('create','prescriptions', v_rx_id::text,
    format('Resep baru %s item untuk %s', v_count, coalesce(p_header->>'patient_name', v_mr)),
    v_rx_no, NULL,
    jsonb_build_object('rx_number', v_rx_no, 'total', v_total,
                       'peringatan_alergi', v_alergi, 'peringatan_interaksi', v_interaksi,
                       'alasan_alergi', p_header->>'allergy_override',
                       'alasan_interaksi', p_header->>'interaction_override'));

  RETURN jsonb_build_object('ok',true,'rx_id',v_rx_id,'rx_number',v_rx_no,
                            'total',v_total,'items',v_count,
                            'alergi',v_alergi,'interaksi',v_interaksi);
END $$;

-- ── Batalkan resep ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rx_cancel_prescription(
  p_rx_id bigint, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := public.current_app_role();
  v_name text := public.current_app_name();
  v_rx   record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('dokter','apoteker','farmasi','manager','direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang membatalkan resep', v_role;
  END IF;
  IF length(trim(coalesce(p_reason,''))) < 5 THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi';
  END IF;

  SELECT * INTO v_rx FROM prescriptions WHERE id = p_rx_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resep tidak ditemukan'; END IF;
  IF v_rx.status = 'Diserahkan' THEN
    RAISE EXCEPTION 'Resep sudah diserahkan, tidak bisa dibatalkan';
  END IF;
  IF v_rx.status = 'Dibatalkan' THEN
    RAISE EXCEPTION 'Resep sudah dibatalkan sebelumnya';
  END IF;

  UPDATE prescriptions SET status='Dibatalkan', cancel_reason=p_reason, updated_at=now()
   WHERE id = p_rx_id;

  PERFORM public.write_audit('cancel','prescriptions', p_rx_id::text,
    format('Resep dibatalkan: %s', p_reason), v_rx.rx_number,
    to_jsonb(v_rx), jsonb_build_object('status','Dibatalkan','oleh',v_name));

  RETURN jsonb_build_object('ok',true);
END $$;

-- ══════════════════════════════════════════════════════════════
-- BAGIAN 5 — RPC: STOK OBAT
-- ══════════════════════════════════════════════════════════════

-- ── Penerimaan stok obat (selalu per batch) ────────────────────
-- Obat WAJIB punya batch & tanggal kedaluwarsa, sehingga seluruh
-- pemasukan stok melewati fungsi ini dan membentuk satu batch baru.
CREATE OR REPLACE FUNCTION public.rx_receive_stock(
  p_drug_id bigint, p_qty numeric, p_batch_no text, p_expiry_date date,
  p_unit_price numeric DEFAULT NULL, p_supplier text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  text := public.current_app_role();
  v_name  text := public.current_app_name();
  v_drug  record;
  v_new   numeric;
  v_batch bigint;
  v_price numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('apoteker','farmasi','spv','manager','direktur','super_admin','operasional') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menerima stok obat', v_role;
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Jumlah penerimaan harus lebih dari nol'; END IF;
  IF length(trim(coalesce(p_batch_no,''))) = 0 THEN RAISE EXCEPTION 'Nomor batch wajib diisi'; END IF;
  IF p_expiry_date IS NULL THEN RAISE EXCEPTION 'Tanggal kedaluwarsa wajib diisi'; END IF;
  IF p_expiry_date <= current_date THEN
    RAISE EXCEPTION 'Tanggal kedaluwarsa sudah lewat — obat tidak boleh diterima';
  END IF;

  -- FOR UPDATE mengunci baris obat: dua penerimaan bersamaan tidak saling menimpa
  SELECT * INTO v_drug FROM pharmacy_drugs WHERE id = p_drug_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obat tidak ditemukan'; END IF;

  v_price := coalesce(p_unit_price, v_drug.unit_price, 0);
  v_new   := coalesce(v_drug.stock_qty,0) + p_qty;

  INSERT INTO pharmacy_batches(drug_id, drug_code, batch_no, expiry_date, qty_received,
                               qty_remaining, received_date, supplier_name, unit_price, notes, updated_at)
  VALUES (v_drug.id, v_drug.drug_code, trim(p_batch_no), p_expiry_date, p_qty,
          p_qty, current_date, p_supplier, v_price, p_notes, now())
  RETURNING id INTO v_batch;

  UPDATE pharmacy_drugs SET stock_qty = v_new, updated_at = now() WHERE id = v_drug.id;

  INSERT INTO pharmacy_stock_ledger(drug_id, drug_code, drug_name, movement_type, qty,
                                    balance_after, unit_price, batch_no, ref_type, ref_id,
                                    ref_number, notes, created_by, created_at)
  VALUES (v_drug.id, v_drug.drug_code, coalesce(v_drug.brand_name, v_drug.generic_name),
          'IN', p_qty, v_new, v_price, trim(p_batch_no), 'receive', v_batch,
          trim(p_batch_no), coalesce(p_notes,'Penerimaan stok obat'), v_name, now());

  -- Narkotika & psikotropika juga masuk buku register tersendiri
  IF v_drug.drug_class IN ('Narkotika','Psikotropika') THEN
    INSERT INTO narcotic_register(register_date, drug_id, drug_code, drug_name, drug_class,
                                  movement_type, qty, balance_after, batch_no, supplier_name,
                                  ref_type, ref_id, notes, created_by)
    VALUES (current_date, v_drug.id, v_drug.drug_code,
            coalesce(v_drug.brand_name, v_drug.generic_name), v_drug.drug_class,
            'IN', p_qty, v_new, trim(p_batch_no), p_supplier, 'receive', v_batch,
            p_notes, v_name);
  END IF;

  PERFORM public.write_audit('receive','pharmacy_batches', v_batch::text,
    format('Terima %s %s batch %s', p_qty, coalesce(v_drug.unit,'unit'), p_batch_no),
    coalesce(v_drug.brand_name, v_drug.generic_name), NULL,
    jsonb_build_object('qty',p_qty,'batch',p_batch_no,'ed',p_expiry_date,'stok_baru',v_new));

  RETURN jsonb_build_object('ok',true,'batch_id',v_batch,'stock_qty',v_new);
END $$;

-- ── Penyesuaian stok (opname, rusak, kedaluwarsa) ──────────────
-- Stok obat TIDAK BOLEH minus; penyesuaian yang membuat batch atau total
-- stok menjadi negatif ditolak.
CREATE OR REPLACE FUNCTION public.rx_adjust_stock(
  p_batch_id bigint, p_qty numeric, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  text := public.current_app_role();
  v_name  text := public.current_app_name();
  v_batch record;
  v_drug  record;
  v_sisa  numeric;
  v_new   numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('apoteker','farmasi','manager','direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menyesuaikan stok obat', v_role;
  END IF;
  IF p_qty IS NULL OR p_qty = 0 THEN RAISE EXCEPTION 'Jumlah penyesuaian tidak boleh nol'; END IF;
  IF length(trim(coalesce(p_reason,''))) < 5 THEN
    RAISE EXCEPTION 'Alasan penyesuaian wajib diisi';
  END IF;

  SELECT * INTO v_batch FROM pharmacy_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch tidak ditemukan'; END IF;

  SELECT * INTO v_drug FROM pharmacy_drugs WHERE id = v_batch.drug_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obat tidak ditemukan'; END IF;

  v_sisa := coalesce(v_batch.qty_remaining,0) + p_qty;
  IF v_sisa < 0 THEN
    RAISE EXCEPTION 'Penyesuaian membuat batch % menjadi minus (sisa %, diminta %)',
      v_batch.batch_no, coalesce(v_batch.qty_remaining,0), p_qty;
  END IF;

  v_new := coalesce(v_drug.stock_qty,0) + p_qty;
  IF v_new < 0 THEN RAISE EXCEPTION 'Penyesuaian membuat stok obat menjadi minus'; END IF;

  UPDATE pharmacy_batches SET qty_remaining = v_sisa, updated_at = now() WHERE id = v_batch.id;
  UPDATE pharmacy_drugs   SET stock_qty = v_new, updated_at = now() WHERE id = v_drug.id;

  INSERT INTO pharmacy_stock_ledger(drug_id, drug_code, drug_name, movement_type, qty,
                                    balance_after, unit_price, batch_no, ref_type, ref_id,
                                    ref_number, notes, created_by, created_at)
  VALUES (v_drug.id, v_drug.drug_code, coalesce(v_drug.brand_name, v_drug.generic_name),
          'ADJUST', p_qty, v_new, coalesce(v_batch.unit_price,0), v_batch.batch_no,
          'adjust', v_batch.id, v_batch.batch_no, p_reason, v_name, now());

  IF v_drug.drug_class IN ('Narkotika','Psikotropika') THEN
    INSERT INTO narcotic_register(register_date, drug_id, drug_code, drug_name, drug_class,
                                  movement_type, qty, balance_after, batch_no,
                                  ref_type, ref_id, notes, created_by)
    VALUES (current_date, v_drug.id, v_drug.drug_code,
            coalesce(v_drug.brand_name, v_drug.generic_name), v_drug.drug_class,
            CASE WHEN p_qty > 0 THEN 'IN' ELSE 'OUT' END, abs(p_qty), v_new,
            v_batch.batch_no, 'adjust', v_batch.id, p_reason, v_name);
  END IF;

  PERFORM public.write_audit('adjust','pharmacy_batches', v_batch.id::text,
    format('Penyesuaian stok %s: %s', v_batch.batch_no, p_reason),
    coalesce(v_drug.brand_name, v_drug.generic_name),
    jsonb_build_object('qty_remaining', v_batch.qty_remaining),
    jsonb_build_object('qty_remaining', v_sisa, 'alasan', p_reason));

  RETURN jsonb_build_object('ok',true,'qty_remaining',v_sisa,'stock_qty',v_new);
END $$;

-- ══════════════════════════════════════════════════════════════
-- BAGIAN 6 — RPC: PENYERAHAN OBAT (DISPENSING)
-- ══════════════════════════════════════════════════════════════
-- Satu transaksi utuh: verifikasi resep → potong stok FEFO → catat kartu
-- stok → catat register narkotika → tandai resep selesai.
--
-- Perbedaan penting dengan reagen lab: stok obat TIDAK BOLEH minus. Bila
-- salah satu item tidak mencukupi, SELURUH penyerahan dibatalkan.
-- Batch yang sudah kedaluwarsa tidak pernah ikut dipotong.
CREATE OR REPLACE FUNCTION public.rx_dispense_prescription(
  p_rx_id bigint, p_recipient jsonb, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role     text := public.current_app_role();
  v_name     text := public.current_app_name();
  v_rx       record;
  v_item     record;
  v_drug     record;
  v_batch    record;
  v_disp_id  bigint;
  v_disp_no  text;
  v_sisa     numeric;
  v_ambil    numeric;
  v_tersedia numeric;
  v_new      numeric;
  v_total    numeric := 0;
  v_count    int := 0;
  v_narko    boolean := false;
  v_rname    text := nullif(trim(coalesce(p_recipient->>'recipient_name','')), '');
  v_rid      text := nullif(trim(coalesce(p_recipient->>'recipient_id_no','')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('apoteker','farmasi','manager','direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menyerahkan obat', v_role;
  END IF;

  SELECT * INTO v_rx FROM prescriptions WHERE id = p_rx_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resep tidak ditemukan'; END IF;
  IF v_rx.status = 'Diserahkan' THEN RAISE EXCEPTION 'Resep sudah pernah diserahkan'; END IF;
  IF v_rx.status = 'Dibatalkan' THEN RAISE EXCEPTION 'Resep sudah dibatalkan'; END IF;
  IF v_rname IS NULL THEN RAISE EXCEPTION 'Nama penerima obat wajib diisi'; END IF;

  -- Resep memuat narkotika/psikotropika? Identitas penerima jadi wajib.
  SELECT EXISTS (
    SELECT 1 FROM prescription_items i
     WHERE i.rx_id = p_rx_id AND i.drug_class IN ('Narkotika','Psikotropika')
  ) INTO v_narko;

  IF v_narko AND (v_rid IS NULL OR length(v_rid) < 6) THEN
    RAISE EXCEPTION 'Resep memuat narkotika/psikotropika — nomor identitas penerima (NIK) wajib diisi';
  END IF;

  v_disp_no := 'SRH/' || to_char(now(),'YYYYMM') || '/' ||
               lpad(nextval('public.seq_dispense_no')::text, 5, '0');

  INSERT INTO pharmacy_dispenses(dispense_number, rx_id, rx_number, mr_number, patient_name,
                                 dispensed_at, dispensed_by, recipient_name, recipient_id_no,
                                 recipient_relation, recipient_phone, has_controlled,
                                 total_value, notes, updated_at)
  VALUES (v_disp_no, p_rx_id, v_rx.rx_number, v_rx.mr_number, v_rx.patient_name,
          now(), v_name, v_rname, v_rid,
          p_recipient->>'recipient_relation', p_recipient->>'recipient_phone', v_narko,
          0, p_notes, now())
  RETURNING id INTO v_disp_id;

  FOR v_item IN SELECT * FROM prescription_items WHERE rx_id = p_rx_id ORDER BY id LOOP
    IF coalesce(v_item.qty,0) <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_drug FROM pharmacy_drugs WHERE id = v_item.drug_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Obat % tidak ada di master', v_item.drug_name; END IF;

    -- Hanya batch yang BELUM kedaluwarsa yang boleh diserahkan
    SELECT coalesce(sum(qty_remaining),0) INTO v_tersedia
      FROM pharmacy_batches
     WHERE drug_id = v_drug.id
       AND coalesce(qty_remaining,0) > 0
       AND (expiry_date IS NULL OR expiry_date > current_date);

    IF v_tersedia < v_item.qty THEN
      RAISE EXCEPTION 'Stok % tidak mencukupi: tersedia % %, diminta %. Penyerahan dibatalkan.',
        v_item.drug_name, v_tersedia, coalesce(v_drug.unit,''), v_item.qty;
    END IF;

    -- FEFO: batch dengan kedaluwarsa terdekat dihabiskan lebih dulu
    v_sisa := v_item.qty;
    FOR v_batch IN
      SELECT * FROM pharmacy_batches
       WHERE drug_id = v_drug.id
         AND coalesce(qty_remaining,0) > 0
         AND (expiry_date IS NULL OR expiry_date > current_date)
       ORDER BY expiry_date NULLS LAST, id
       FOR UPDATE
    LOOP
      EXIT WHEN v_sisa <= 0;
      v_ambil := least(v_sisa, v_batch.qty_remaining);

      UPDATE pharmacy_batches SET qty_remaining = qty_remaining - v_ambil, updated_at = now()
       WHERE id = v_batch.id;

      INSERT INTO pharmacy_dispense_items(dispense_id, rx_item_id, drug_id, drug_code, drug_name,
                                          drug_class, qty, unit, batch_id, batch_no, expiry_date,
                                          unit_price, subtotal)
      VALUES (v_disp_id, v_item.id, v_drug.id, v_drug.drug_code, v_item.drug_name,
              v_drug.drug_class, v_ambil, v_drug.unit, v_batch.id, v_batch.batch_no,
              v_batch.expiry_date, coalesce(v_item.unit_price,0),
              coalesce(v_item.unit_price,0) * v_ambil);

      v_sisa := v_sisa - v_ambil;
    END LOOP;

    IF v_sisa > 0 THEN
      -- Tidak seharusnya terjadi karena sudah diperiksa di atas; jaring pengaman
      -- supaya stok tidak pernah menjadi minus.
      RAISE EXCEPTION 'Stok % berubah saat proses berjalan, penyerahan dibatalkan', v_item.drug_name;
    END IF;

    v_new := coalesce(v_drug.stock_qty,0) - v_item.qty;
    IF v_new < 0 THEN RAISE EXCEPTION 'Stok % tidak boleh minus', v_item.drug_name; END IF;
    UPDATE pharmacy_drugs SET stock_qty = v_new, updated_at = now() WHERE id = v_drug.id;

    UPDATE prescription_items SET qty_dispensed = v_item.qty WHERE id = v_item.id;

    INSERT INTO pharmacy_stock_ledger(drug_id, drug_code, drug_name, movement_type, qty,
                                      balance_after, unit_price, ref_type, ref_id, ref_number,
                                      notes, created_by, created_at)
    VALUES (v_drug.id, v_drug.drug_code, v_item.drug_name, 'OUT', -v_item.qty, v_new,
            coalesce(v_item.unit_price,0), 'dispense', v_disp_id, v_disp_no,
            concat_ws(' · ', v_rx.rx_number, v_rx.patient_name), v_name, now());

    -- Register narkotika/psikotropika — satu baris per batch yang terpakai
    IF v_drug.drug_class IN ('Narkotika','Psikotropika') THEN
      INSERT INTO narcotic_register(register_date, drug_id, drug_code, drug_name, drug_class,
                                    movement_type, qty, balance_after, batch_no, rx_number,
                                    mr_number, patient_name, doctor_name, recipient_name,
                                    recipient_id_no, ref_type, ref_id, notes, created_by)
      SELECT current_date, v_drug.id, v_drug.drug_code, v_item.drug_name, v_drug.drug_class,
             'OUT', di.qty, v_new, di.batch_no, v_rx.rx_number, v_rx.mr_number,
             v_rx.patient_name, v_rx.doctor_name, v_rname, v_rid, 'dispense', v_disp_id,
             p_notes, v_name
        FROM pharmacy_dispense_items di
       WHERE di.dispense_id = v_disp_id AND di.rx_item_id = v_item.id;
    END IF;

    v_total := v_total + coalesce(v_item.unit_price,0) * v_item.qty;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN RAISE EXCEPTION 'Resep tidak berisi obat yang bisa diserahkan'; END IF;

  UPDATE pharmacy_dispenses SET total_value = v_total WHERE id = v_disp_id;
  UPDATE prescriptions SET status='Diserahkan', updated_at=now() WHERE id = p_rx_id;

  PERFORM public.write_audit('dispense','pharmacy_dispenses', v_disp_id::text,
    format('Penyerahan %s item resep %s kepada %s', v_count, v_rx.rx_number, v_rname),
    v_disp_no, NULL,
    jsonb_build_object('dispense_number', v_disp_no, 'rx_number', v_rx.rx_number,
                       'total', v_total, 'penerima', v_rname, 'identitas', v_rid,
                       'ada_narkotika', v_narko));

  RETURN jsonb_build_object('ok',true,'dispense_id',v_disp_id,'dispense_number',v_disp_no,
                            'total',v_total,'items',v_count,'narkotika',v_narko);
END $$;

-- ══════════════════════════════════════════════════════════════
-- BAGIAN 7 — HAK AKSES FUNGSI
-- ══════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.rx_check_allergies(text,bigint[])                       FROM public, anon;
REVOKE ALL ON FUNCTION public.rx_check_interactions(bigint[])                         FROM public, anon;
REVOKE ALL ON FUNCTION public.rx_save_prescription(jsonb,jsonb)                       FROM public, anon;
REVOKE ALL ON FUNCTION public.rx_cancel_prescription(bigint,text)                     FROM public, anon;
REVOKE ALL ON FUNCTION public.rx_receive_stock(bigint,numeric,text,date,numeric,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.rx_adjust_stock(bigint,numeric,text)                    FROM public, anon;
REVOKE ALL ON FUNCTION public.rx_dispense_prescription(bigint,jsonb,text)             FROM public, anon;

GRANT EXECUTE ON FUNCTION public.rx_check_allergies(text,bigint[])                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.rx_check_interactions(bigint[])                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.rx_save_prescription(jsonb,jsonb)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.rx_cancel_prescription(bigint,text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.rx_receive_stock(bigint,numeric,text,date,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rx_adjust_stock(bigint,numeric,text)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.rx_dispense_prescription(bigint,jsonb,text)             TO authenticated;

-- Sequence penomoran hanya dipakai dari dalam fungsi SECURITY DEFINER
REVOKE ALL ON SEQUENCE public.seq_prescription_no FROM public, anon;
REVOKE ALL ON SEQUENCE public.seq_dispense_no     FROM public, anon;

-- ══════════════════════════════════════════════════════════════
-- BAGIAN 8 — DATA AWAL PASANGAN INTERAKSI OBAT
-- ══════════════════════════════════════════════════════════════
-- PERINGATAN: daftar di bawah hanyalah CONTOH pasangan yang lazim ditemui,
-- dipakai agar fitur peringatan bisa langsung diuji. Daftar ini JAUH DARI
-- LENGKAP dan bukan pengganti penilaian klinis. Apoteker penanggung jawab
-- wajib melengkapi, meninjau, dan menyesuaikannya dengan acuan resmi
-- (misalnya formularium nasional dan pustaka interaksi yang dipakai fasilitas)
-- sebelum modul ini dipakai untuk pelayanan sungguhan.
INSERT INTO public.pharmacy_interactions (drug_a, drug_b, severity, effect, management, source)
SELECT * FROM (VALUES
  ('warfarin','aspirin','Berat',
   'Risiko perdarahan meningkat karena efek antikoagulan dan antiplatelet saling menguatkan.',
   'Hindari bila memungkinkan. Bila terpaksa, pantau INR dan tanda perdarahan lebih ketat.','Contoh awal'),
  ('warfarin','ibuprofen','Berat',
   'AINS menambah risiko perdarahan saluran cerna dan menggeser ikatan protein warfarin.',
   'Pilih parasetamol sebagai pereda nyeri. Bila tetap dipakai, pantau INR.','Contoh awal'),
  ('warfarin','flukonazol','Berat',
   'Flukonazol menghambat metabolisme warfarin sehingga INR melonjak.',
   'Turunkan dosis warfarin dan periksa INR dalam 3-5 hari.','Contoh awal'),
  ('simvastatin','klaritromisin','Kontraindikasi',
   'Kadar simvastatin melonjak tajam, berisiko rabdomiolisis.',
   'Hentikan sementara simvastatin selama terapi klaritromisin, atau ganti antibiotik.','Contoh awal'),
  ('simvastatin','gemfibrozil','Berat',
   'Risiko miopati dan rabdomiolisis meningkat.',
   'Kombinasi sebaiknya dihindari; pertimbangkan fenofibrat.','Contoh awal'),
  ('metformin','kontras iodin','Berat',
   'Risiko asidosis laktat pada gangguan fungsi ginjal setelah pemberian kontras.',
   'Hentikan metformin sebelum pemeriksaan berkontras, lanjutkan setelah fungsi ginjal dinilai.','Contoh awal'),
  ('kaptopril','spironolakton','Sedang',
   'Keduanya menahan kalium sehingga berisiko hiperkalemia.',
   'Periksa kalium dan fungsi ginjal secara berkala.','Contoh awal'),
  ('kaptopril','ibuprofen','Sedang',
   'AINS menurunkan efek antihipertensi dan dapat memperburuk fungsi ginjal.',
   'Pantau tekanan darah dan fungsi ginjal; batasi durasi AINS.','Contoh awal'),
  ('siprofloksasin','antasida','Sedang',
   'Kation pada antasida mengikat siprofloksasin sehingga penyerapannya turun drastis.',
   'Beri jarak minimal 2 jam sebelum atau 6 jam sesudah antasida.','Contoh awal'),
  ('levotiroksin','kalsium karbonat','Sedang',
   'Penyerapan levotiroksin berkurang.',
   'Beri jarak minimal 4 jam.','Contoh awal'),
  ('digoksin','furosemid','Sedang',
   'Hipokalemia akibat furosemid meningkatkan toksisitas digoksin.',
   'Pantau kalium dan tanda toksisitas digoksin.','Contoh awal'),
  ('tramadol','fluoksetin','Berat',
   'Risiko sindrom serotonin dan penurunan ambang kejang.',
   'Hindari kombinasi; pilih analgesik lain.','Contoh awal'),
  ('alprazolam','kodein','Berat',
   'Depresi napas dan sedasi berlebihan karena efek depresan susunan saraf pusat bertumpuk.',
   'Hindari. Bila terpaksa, pakai dosis terendah dan awasi pernapasan.','Contoh awal'),
  ('diazepam','morfin','Berat',
   'Depresi napas, sedasi dalam, sampai risiko kematian.',
   'Hindari kombinasi rutin; hanya dengan pengawasan ketat.','Contoh awal'),
  ('allopurinol','azatioprin','Kontraindikasi',
   'Allopurinol menghambat pemecahan azatioprin sehingga terjadi supresi sumsum tulang berat.',
   'Kombinasi dihindari. Bila terpaksa, dosis azatioprin diturunkan sampai 75%.','Contoh awal'),
  ('amoksisilin','metotreksat','Sedang',
   'Ekskresi metotreksat menurun sehingga kadarnya meningkat.',
   'Pantau tanda toksisitas metotreksat.','Contoh awal')
) AS v(drug_a, drug_b, severity, effect, management, source)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pharmacy_interactions i
   WHERE lower(i.drug_a) = lower(v.drug_a) AND lower(i.drug_b) = lower(v.drug_b)
);

COMMENT ON TABLE public.pharmacy_interactions IS
  'Pasangan obat yang berinteraksi. Isi awal hanya CONTOH dan wajib dilengkapi serta ditinjau apoteker penanggung jawab sebelum dipakai untuk pelayanan.';

-- ══════════════════════════════════════════════════════════════
-- VERIFIKASI
-- ══════════════════════════════════════════════════════════════

-- 1. Tabel yang terpasang
SELECT 'tabel' AS jenis, table_name AS nama
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pharmacy_drugs','pharmacy_batches','pharmacy_interactions',
                     'prescriptions','prescription_items','pharmacy_dispenses',
                     'pharmacy_dispense_items','narcotic_register','pharmacy_stock_ledger')
ORDER BY table_name;

-- 2. Fungsi yang terpasang (harus 7 baris)
SELECT 'fungsi' AS jenis, p.proname AS nama
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('rx_check_allergies','rx_check_interactions','rx_save_prescription',
                    'rx_cancel_prescription','rx_receive_stock','rx_adjust_stock',
                    'rx_dispense_prescription')
ORDER BY p.proname;

-- 3. RLS tabel data pasien — semua harus rls_aktif = true dengan 1 kebijakan
SELECT c.relname AS tabel, c.relrowsecurity AS rls_aktif, count(p.polname) AS jumlah_kebijakan
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('prescriptions','prescription_items','pharmacy_dispenses',
                    'pharmacy_dispense_items','narcotic_register')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- 4. Jumlah pasangan interaksi awal
SELECT 'pasangan interaksi' AS jenis, count(*)::text AS jumlah FROM public.pharmacy_interactions;
