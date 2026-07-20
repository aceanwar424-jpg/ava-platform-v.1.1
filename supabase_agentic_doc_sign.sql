-- ══════════════════════════════════════════════════════════════
-- OneLab Agentic — Tanda tangan elektronik dokumen QMS,
--                  nomor dokumen manual, & daftar master SOP
-- ──────────────────────────────────────────────────────────────
-- YANG DITAMBAHKAN
--   1. agentic.document_signatures — tanda tangan elektronik berjenjang
--      (Disusun / Diperiksa / Disetujui) untuk satu dokumen.
--   2. agentic_doc_sign()          — membubuhkan tanda tangan.
--   3. agentic_doc_signatures()    — membaca tanda tangan sebuah dokumen.
--   4. agentic_doc_set_number()    — menetapkan/mengubah nomor dokumen manual
--      (agentic_doc_update sengaja TIDAK mengizinkan ini).
--
-- BENTUK TANDA TANGANNYA
--   Bukan gambar. Yang direkam: nama penanda tangan, jabatan, WAKTU SERVER,
--   dan SIDIK (SHA-256) dari isi dokumen saat ditandatangani. Bila isi dokumen
--   berubah setelah itu, sidik yang dihitung ulang tidak akan cocok — sehingga
--   perubahan diam-diam setelah pengesahan dapat terdeteksi. Inilah yang
--   membuatnya berguna untuk audit ISO, bukan sekadar hiasan.
--
--   Waktu diambil dari now() di basis data, BUKAN dari jam komputer klien,
--   supaya urutan pengesahan tidak dapat diputarbalikkan.
--
-- SIFAT HANYA-TAMBAH
--   Tidak disediakan RPC untuk mengubah atau menghapus tanda tangan. Koreksi
--   dilakukan dengan membubuhkan tanda tangan baru pada revisi berikutnya —
--   tanda tangan yang sudah terbubuh tetap menjadi catatan sejarah.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Tabel tanda tangan ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS agentic.document_signatures (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES agentic.document_registry(id) ON DELETE CASCADE,
  revision     SMALLINT,                      -- revisi dokumen saat ditandatangani
  signer_name  VARCHAR(160) NOT NULL,         -- nama seperti tampil di aplikasi
  signer_role  VARCHAR(80)  NOT NULL,         -- Disusun oleh / Diperiksa oleh / Disetujui oleh
  signer_uid   UUID,                          -- auth.uid() bila sesi login tersedia
  content_hash VARCHAR(64)  NOT NULL,         -- SHA-256 isi dokumen saat ditandatangani
  note         TEXT,
  signed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docsign_doc ON agentic.document_signatures(document_id, signed_at DESC);

-- Satu peran cukup sekali per revisi dokumen (mencegah tanda tangan ganda).
CREATE UNIQUE INDEX IF NOT EXISTS uq_docsign_doc_rev_role
  ON agentic.document_signatures(document_id, COALESCE(revision,0), signer_role);

-- ── 2. Bubuhkan tanda tangan ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.agentic_doc_sign(
  p_doc_id UUID, p_signer TEXT, p_role TEXT, p_hash TEXT, p_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_rev SMALLINT; v_row agentic.document_signatures;
BEGIN
  IF coalesce(trim(p_signer),'') = '' THEN RAISE EXCEPTION 'Nama penanda tangan wajib'; END IF;
  IF coalesce(trim(p_role),'')   = '' THEN RAISE EXCEPTION 'Jabatan/peran wajib'; END IF;
  IF coalesce(trim(p_hash),'')   = '' THEN RAISE EXCEPTION 'Sidik isi dokumen wajib'; END IF;

  SELECT current_revision INTO v_rev FROM agentic.document_registry WHERE id = p_doc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokumen tidak ditemukan'; END IF;

  INSERT INTO agentic.document_signatures
    (document_id, revision, signer_name, signer_role, signer_uid, content_hash, note)
  VALUES
    (p_doc_id, coalesce(v_rev,0), trim(p_signer), trim(p_role), auth.uid(), trim(p_hash), nullif(trim(coalesce(p_note,'')),''))
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Peran "%" sudah menandatangani revisi ini', p_role;
END $$;

-- ── 3. Baca tanda tangan sebuah dokumen ────────────────────────
CREATE OR REPLACE FUNCTION public.agentic_doc_signatures(p_doc_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'revision', revision, 'signer_name', signer_name, 'signer_role', signer_role,
    'content_hash', content_hash, 'note', note, 'signed_at', signed_at
  ) ORDER BY signed_at), '[]'::jsonb)
  FROM agentic.document_signatures WHERE document_id = p_doc_id;
$$;

-- ── 4. Tetapkan nomor dokumen secara manual ────────────────────
-- agentic_doc_update sengaja tidak menyentuh doc_number agar nomor resmi tidak
-- berubah tanpa sengaja. Fungsi khusus ini yang mengizinkannya, dengan penjagaan
-- keunikan dan penolakan bila dokumen sudah ditandatangani.
CREATE OR REPLACE FUNCTION public.agentic_doc_set_number(p_doc_id UUID, p_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_row agentic.document_registry; v_signed INT;
BEGIN
  IF coalesce(trim(p_number),'') = '' THEN RAISE EXCEPTION 'Nomor dokumen tidak boleh kosong'; END IF;

  SELECT count(*) INTO v_signed FROM agentic.document_signatures WHERE document_id = p_doc_id;
  IF v_signed > 0 THEN
    RAISE EXCEPTION 'Dokumen sudah ditandatangani — nomor tidak boleh diubah. Terbitkan revisi baru bila perlu.';
  END IF;

  UPDATE agentic.document_registry
     SET doc_number = trim(p_number), updated_at = now()
   WHERE id = p_doc_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Dokumen tidak ditemukan'; END IF;
  RETURN to_jsonb(v_row);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Nomor dokumen "%" sudah dipakai dokumen lain', p_number;
END $$;

-- ── Izin (mengikuti pola modul agentic) ────────────────────────
GRANT EXECUTE ON FUNCTION public.agentic_doc_sign(UUID,TEXT,TEXT,TEXT,TEXT)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_doc_signatures(UUID)                TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_doc_set_number(UUID,TEXT)           TO anon, authenticated, service_role;


-- ── 5. Data untuk tab Review ───────────────────────────────────
-- Satu panggilan mengembalikan semua yang dibutuhkan layar Review, supaya tidak
-- perlu N kueri terpisah per dokumen (Supabase di Sydney; tiap kueri ~100 ms).
CREATE OR REPLACE FUNCTION public.agentic_doc_review_data(p_horizon_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    -- Dokumen yang jatuh tempo review (atau sudah lewat)
    'due', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'doc_number', d.doc_number, 'title', d.title,
        'department', d.department, 'status', d.status,
        'revision', d.current_revision, 'next_review_date', d.next_review_date,
        'days_left', (d.next_review_date - CURRENT_DATE))
      ORDER BY d.next_review_date)
      FROM agentic.document_registry d
      WHERE d.next_review_date IS NOT NULL
        AND d.next_review_date <= CURRENT_DATE + COALESCE(p_horizon_days,30)
        AND d.status <> 'OBSOLETE'), '[]'::jsonb),

    -- Dokumen terbit yang belum lengkap pengesahannya
    'unsigned', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'doc_number', d.doc_number, 'title', d.title,
        'department', d.department, 'revision', d.current_revision,
        'sign_count', (SELECT count(*) FROM agentic.document_signatures g
                        WHERE g.document_id = d.id AND COALESCE(g.revision,0) = COALESCE(d.current_revision,0)),
        'roles', COALESCE((SELECT jsonb_agg(g.signer_role ORDER BY g.signed_at)
                            FROM agentic.document_signatures g
                            WHERE g.document_id = d.id AND COALESCE(g.revision,0) = COALESCE(d.current_revision,0)), '[]'::jsonb))
      ORDER BY d.department, d.doc_number)
      FROM agentic.document_registry d
      WHERE d.status IN ('PUBLISHED','DRAFT','DUE_FOR_REVIEW')), '[]'::jsonb),

    -- Pengesahan terakhir (jejak siapa mengesahkan apa)
    'recent_signatures', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'document_id', g.document_id, 'doc_number', d.doc_number, 'title', d.title,
        'signer_name', g.signer_name, 'signer_role', g.signer_role,
        'revision', g.revision, 'signed_at', g.signed_at)
      ORDER BY g.signed_at DESC)
      FROM agentic.document_signatures g
      JOIN agentic.document_registry d ON d.id = g.document_id
      WHERE g.signed_at >= now() - interval '90 days'), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.agentic_doc_review_data(INT) TO anon, authenticated, service_role;

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT 'agentic doc-sign siap' AS status,
       (SELECT count(*) FROM agentic.document_signatures) AS jumlah_tanda_tangan;
