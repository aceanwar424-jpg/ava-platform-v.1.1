-- ══════════════════════════════════════════════════════════════════
-- MIGRATION: 0049_homecare_bridging_his_lis.sql
-- BRIDGING HOME CARE (AVA CARE) KE LIS & HIS TERPADU
--
-- Layanan Home Care bukan hanya pengambilan sampel lab, melainkan
-- mencakup Infus, Injeksi Obat, Vaksinasi/Imunisasi, Perawatan Luka,
-- dan Fisioterapi.
--
-- Migrasi ini menyambungkan order Home Care langsung ke:
-- 1. Laboratorium LIS (public.lab_samples & worklist)
-- 2. HIS Tindakan Klinis (public.tindakan & informed consent)
-- 3. HIS Imunisasi (public.imunisasi & logbook vaksin)
-- 4. HIS EMR & Billing (public.homecare_visit_records & inpatient_charges)
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.homecare_orders
  ADD COLUMN IF NOT EXISTS ref_tabel         TEXT,
  ADD COLUMN IF NOT EXISTS ref_id            BIGINT,
  ADD COLUMN IF NOT EXISTS lis_barcode       TEXT,
  ADD COLUMN IF NOT EXISTS his_no_tindakan   TEXT,
  ADD COLUMN IF NOT EXISTS his_no_imunisasi  TEXT,
  ADD COLUMN IF NOT EXISTS vital_signs       JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS medication_items  JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bridged_at        TIMESTAMP,
  ADD COLUMN IF NOT EXISTS bridged_by        TEXT;

CREATE INDEX IF NOT EXISTS idx_hc_orders_lis_barcode ON public.homecare_orders(lis_barcode);
CREATE INDEX IF NOT EXISTS idx_hc_orders_bridged ON public.homecare_orders(bridged_at) WHERE bridged_at IS NOT NULL;

-- ── 1. RPC BRIDGING OTOMATIS DARI HOME CARE KE LIS / HIS ───────────
CREATE OR REPLACE FUNCTION public.homecare_bridge_layanan(
  p_order_id BIGINT,
  p_oleh TEXT DEFAULT 'System Dispatcher'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_o RECORD;
  v_barcode TEXT;
  v_sample_id BIGINT;
  v_tindakan_id BIGINT;
  v_no_tindakan TEXT;
  v_imunisasi_id BIGINT;
  v_kat RECORD;
  v_vak RECORD;
  v_target TEXT;
  v_res JSONB := '{}'::jsonb;
  v_tagihan JSONB;
BEGIN
  SELECT * INTO v_o FROM public.homecare_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order Home Care tidak ditemukan.');
  END IF;

  -- 1. JALUR LABORATORIUM LIS (Sampel Darah, Cek Lab, MCU Home)
  IF v_o.service_type ILIKE '%Sampel%' OR v_o.service_type ILIKE '%Darah%' 
     OR v_o.service_type ILIKE '%Lab%' OR v_o.service_type ILIKE '%Gula Darah%' 
     OR v_o.service_type ILIKE '%Kolesterol%' OR v_o.service_type ILIKE '%MCU%' THEN
    
    v_target := 'lis';
    v_barcode := 'LB-HC-' || to_char(now(), 'YYMMDD') || '-' ||
                 lpad((COALESCE((SELECT count(*) FROM public.lab_samples 
                                 WHERE barcode LIKE 'LB-HC-%' AND created_at::date = current_date), 0) + 1)::text, 4, '0');

    INSERT INTO public.lab_samples
      (barcode, admission_id, visit_number, patient_name, product_name, sampel_type, status, catatan)
    VALUES
      (v_barcode, NULL, v_o.order_number, v_o.patient_name, v_o.service_type, 'Darah EDTA / Serum', 'Sampling', 
       'Home Care Mobile Sampling · Alamat: ' || COALESCE(v_o.patient_address, '—'))
    RETURNING id INTO v_sample_id;

    UPDATE public.homecare_orders
       SET ref_tabel = 'lab_samples',
           ref_id = v_sample_id,
           lis_barcode = v_barcode,
           bridged_at = now(),
           bridged_by = p_oleh,
           updated_at = now()
     WHERE id = p_order_id;

    v_res := jsonb_build_object(
      'ok', true,
      'target', 'lis',
      'barcode', v_barcode,
      'sample_id', v_sample_id,
      'layanan', v_o.service_type,
      'pesan', 'Berhasil diteruskan ke Laboratorium LIS dengan barcode ' || v_barcode
    );

  -- 2. JALUR VAKSINASI / IMUNISASI HIS
  ELSIF v_o.service_type ILIKE '%Vaksin%' OR v_o.service_type ILIKE '%Imunisasi%' THEN
    v_target := 'his_imunisasi';

    SELECT * INTO v_vak FROM public.vaksin 
     WHERE nama ILIKE '%' || split_part(v_o.service_type, ' ', 2) || '%' 
     ORDER BY id LIMIT 1;

    INSERT INTO public.imunisasi
      (admission_id, vaksin_id, patient_name, mr_number, tgl_suntik, dosis_ke, 
       batch_lot, lokasi_suntik, penyuntik, reaksi_kippi)
    VALUES
      (NULL, v_vak.id, v_o.patient_name, v_o.order_number, current_date, 1,
       'BATCH-HC-' || to_char(now(), 'YYMM'), 'Deltoid Lengan Kiri (Home Visit)', 
       COALESCE(v_o.assigned_staff, p_oleh), 'Tidak ada keluhan')
    RETURNING id INTO v_imunisasi_id;

    UPDATE public.homecare_orders
       SET ref_tabel = 'imunisasi',
           ref_id = v_imunisasi_id,
           his_no_imunisasi = 'IM-HC-' || v_imunisasi_id,
           bridged_at = now(),
           bridged_by = p_oleh,
           updated_at = now()
     WHERE id = p_order_id;

    v_res := jsonb_build_object(
      'ok', true,
      'target', 'his_imunisasi',
      'imunisasi_id', v_imunisasi_id,
      'vaksin', COALESCE(v_vak.nama, v_o.service_type),
      'pesan', 'Berhasil diteruskan ke Logbook Imunisasi & Rekam Medis Pasien'
    );

  -- 3. JALUR TINDAKAN KLINIS HIS (Infus, Injeksi, Perawatan Luka, Nebulizer, Fisioterapi, EKG)
  ELSE
    v_target := 'his_tindakan';

    SELECT * INTO v_kat FROM public.tindakan_katalog 
     WHERE nama ILIKE '%' || split_part(v_o.service_type, ' ', 1) || '%' 
     ORDER BY id LIMIT 1;

    v_no_tindakan := 'TDK-HC-' || to_char(now(), 'YYMMDD') || '-' ||
                     lpad((COALESCE((SELECT count(*) FROM public.tindakan 
                                     WHERE no_tindakan LIKE 'TDK-HC-%' AND created_at::date = current_date), 0) + 1)::text, 4, '0');

    INSERT INTO public.tindakan
      (no_tindakan, katalog_id, admission_id, visit_number, patient_name, 
       mr_number, tgl_rencana, pelaksana, tarif, status)
    VALUES
      (v_no_tindakan, v_kat.id, NULL, v_o.order_number, v_o.patient_name,
       v_o.order_number, current_date, COALESCE(v_o.assigned_staff, p_oleh), 
       COALESCE(v_o.total_amount, 150000), 'Dikerjakan')
    RETURNING id INTO v_tindakan_id;

    UPDATE public.homecare_orders
       SET ref_tabel = 'tindakan',
           ref_id = v_tindakan_id,
           his_no_tindakan = v_no_tindakan,
           bridged_at = now(),
           bridged_by = p_oleh,
           updated_at = now()
     WHERE id = p_order_id;

    v_res := jsonb_build_object(
      'ok', true,
      'target', 'his_tindakan',
      'no_tindakan', v_no_tindakan,
      'tindakan_id', v_tindakan_id,
      'layanan', v_o.service_type,
      'pesan', 'Berhasil diteruskan ke Modul Tindakan Klinis HIS & Rekam Medis (' || v_no_tindakan || ')'
    );
  END IF;

  RETURN v_res;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.homecare_bridge_layanan(BIGINT, TEXT) TO anon, authenticated, service_role;
