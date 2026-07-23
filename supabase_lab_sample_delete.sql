-- ══════════════════════════════════════════════════════════════════════
-- OneLab · LIS — HAPUS SAMPEL DUPLIKAT/SALAH (aman)
-- Menghapus sebuah lab_sample + draft hasilnya, TAPI hanya bila sampel itu
-- belum punya nilai hasil dan belum tervalidasi/disetujui. Melindungi data
-- klinis nyata dari terhapus. Dipakai untuk membersihkan sampel dobel akibat
-- check-in ganda.
-- IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.lab_sample_delete(p_sample_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_has_value INT; v_final INT; v_bc TEXT;
BEGIN
  SELECT barcode INTO v_bc FROM public.lab_samples WHERE id = p_sample_id;
  IF v_bc IS NULL AND NOT EXISTS (SELECT 1 FROM public.lab_samples WHERE id = p_sample_id) THEN
    RAISE EXCEPTION 'Sampel tidak ditemukan';
  END IF;

  SELECT count(*) INTO v_has_value FROM public.lab_results
   WHERE sample_id = p_sample_id AND result_value IS NOT NULL AND btrim(result_value) <> '';
  SELECT count(*) INTO v_final FROM public.lab_results
   WHERE sample_id = p_sample_id AND status IN ('Validated','Approved','Released');

  IF v_has_value > 0 OR v_final > 0 THEN
    RAISE EXCEPTION 'Sampel % sudah punya hasil/tervalidasi — tidak boleh dihapus', COALESCE(v_bc, p_sample_id::text);
  END IF;

  DELETE FROM public.lab_results WHERE sample_id = p_sample_id;
  DELETE FROM public.lab_samples WHERE id = p_sample_id;
  RETURN jsonb_build_object('ok', true, 'barcode', v_bc);
END $$;

GRANT EXECUTE ON FUNCTION public.lab_sample_delete(BIGINT) TO anon, authenticated, service_role;

SELECT 'RPC lab_sample_delete siap — hapus sampel kosong/duplikat dgn aman' AS status;
