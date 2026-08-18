-- 0020 — Bekukan tarif komisi di baris pendaftaran, secara otomatis
--
-- MASALAHNYA
-- 0019 sudah menyediakan kolom perujuk_persen / perujuk_tetap supaya tarif
-- yang berlaku saat pasien dirujuk ikut tersimpan di barisnya. Tetapi
-- pengisiannya diserahkan ke pemanggil. Saat diuji: menaikkan tarif seorang
-- perujuk dari 10% ke 20% langsung mengubah nilai komisi SELURUH rujukan
-- lamanya yang belum sempat terisi tarifnya — termasuk yang sudah dicairkan.
--
-- Jaminan seperti ini tidak boleh bergantung pada setiap penulis data
-- mengingatnya. Formulir pendaftaran, impor massal, dan panggilan API mana
-- pun harus menghasilkan perilaku yang sama.
--
-- Karena itu pembekuan dipindahkan ke pemicu basis data: satu-satunya
-- tempat yang tidak bisa dilewati.

CREATE OR REPLACE FUNCTION public.bekukan_tarif_rujukan()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.perujuk_id IS NOT NULL
     AND (NEW.perujuk_persen IS NULL OR NEW.perujuk_tetap IS NULL) THEN
    SELECT COALESCE(NEW.perujuk_persen, p.komisi_persen, 0),
           COALESCE(NEW.perujuk_tetap,  p.komisi_tetap,  0)
      INTO NEW.perujuk_persen, NEW.perujuk_tetap
      FROM public.perujuk p WHERE p.id = NEW.perujuk_id;

    -- Perujuk tidak ditemukan: tetap dibekukan di nol, bukan dibiarkan NULL.
    -- NULL berarti "ikut tarif berjalan", dan itu justru yang dihindari.
    NEW.perujuk_persen := COALESCE(NEW.perujuk_persen, 0);
    NEW.perujuk_tetap  := COALESCE(NEW.perujuk_tetap, 0);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bekukan_tarif_rujukan ON public.admissions;
CREATE TRIGGER trg_bekukan_tarif_rujukan
  BEFORE INSERT OR UPDATE OF perujuk_id ON public.admissions
  FOR EACH ROW EXECUTE FUNCTION public.bekukan_tarif_rujukan();

-- Baris yang sudah terlanjur ada tanpa tarif tersimpan. Dibekukan pada
-- tarif perujuknya YANG BERLAKU SEKARANG — bukan tebakan tarif masa lalu,
-- karena tarif masa lalu memang tidak pernah tercatat. Setelah ini, tidak
-- ada lagi baris yang nilainya bisa berubah sendiri.
UPDATE public.admissions a
   SET perujuk_persen = COALESCE(a.perujuk_persen, p.komisi_persen, 0),
       perujuk_tetap  = COALESCE(a.perujuk_tetap,  p.komisi_tetap,  0)
  FROM public.perujuk p
 WHERE a.perujuk_id = p.id
   AND (a.perujuk_persen IS NULL OR a.perujuk_tetap IS NULL);
