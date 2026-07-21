-- ══════════════════════════════════════════════════════════════
-- OneLab Agentic — Deteksi Tumpang Tindih Antar Dokumen (FASE 1)
-- ──────────────────────────────────────────────────────────────
-- Menyimpan hasil pemindaian tumpang tindih. Perhitungannya (ciri dokumen +
-- kemiripan pasangan) dilakukan di peramban tanpa LLM — lihat modules/agentic/
-- overlap.js. Tabel ini hanya menyimpan pasangan mencurigakan yang lolos ambang,
-- dan status tinjauannya oleh manusia.
--
-- INVARIAN: sistem hanya MENANDAI. Keputusan menggabung/menghapus/membiarkan
-- ada di tangan manusia (kolom status + reviewed_by).
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agentic.document_overlaps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_a       UUID NOT NULL REFERENCES agentic.document_registry(id) ON DELETE CASCADE,
  doc_b       UUID NOT NULL REFERENCES agentic.document_registry(id) ON DELETE CASCADE,
  score       NUMERIC(4,3) NOT NULL,          -- 0..1 kemiripan Tahap A
  shared_terms   JSONB DEFAULT '[]'::jsonb,   -- istilah kunci yang beririsan (untuk tampilan)
  shared_clauses JSONB DEFAULT '[]'::jsonb,   -- klausul ISO yang sama
  overlap_type   TEXT,                        -- diisi Fase 2 (LLM): DUPLIKAT/SEBAGIAN/KONFLIK/PELENGKAP
  recommendation TEXT,                        -- diisi Fase 2
  status      TEXT NOT NULL DEFAULT 'DETECTED'
              CHECK (status IN ('DETECTED','REVIEWED','RESOLVED','DISMISSED')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Pasangan disimpan berurutan (doc_a < doc_b) supaya (A,B) dan (B,A) tidak ganda.
  CONSTRAINT chk_overlap_order CHECK (doc_a < doc_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_overlap_pair ON agentic.document_overlaps (doc_a, doc_b);
CREATE INDEX IF NOT EXISTS idx_overlap_status ON agentic.document_overlaps (status, score DESC);

CREATE OR REPLACE FUNCTION public.trg_overlap_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS overlap_touch ON agentic.document_overlaps;
CREATE TRIGGER overlap_touch BEFORE UPDATE ON agentic.document_overlaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_overlap_touch();

-- ── Simpan hasil pindai ────────────────────────────────────────
-- Menerima array pasangan {doc_a, doc_b, score, shared_terms, shared_clauses}.
-- Strategi: buang deteksi lama yang BELUM ditinjau (status DETECTED), lalu masukkan
-- pasangan baru. Pasangan yang sudah diputuskan manusia (RESOLVED/DISMISSED)
-- DIPERTAHANKAN — tidak dibangkitkan lagi walau masih mirip (ON CONFLICT DO NOTHING).
CREATE OR REPLACE FUNCTION public.agentic_overlap_save(p_pairs JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_ins INT := 0;
BEGIN
  DELETE FROM agentic.document_overlaps WHERE status = 'DETECTED';

  WITH src AS (
    SELECT
      LEAST((e->>'doc_a')::uuid, (e->>'doc_b')::uuid)    AS a,
      GREATEST((e->>'doc_a')::uuid, (e->>'doc_b')::uuid) AS b,
      (e->>'score')::numeric                             AS score,
      COALESCE(e->'shared_terms','[]'::jsonb)            AS terms,
      COALESCE(e->'shared_clauses','[]'::jsonb)          AS clauses
    FROM jsonb_array_elements(COALESCE(p_pairs,'[]'::jsonb)) e
    WHERE (e->>'doc_a')::uuid <> (e->>'doc_b')::uuid
  ),
  ins AS (
    INSERT INTO agentic.document_overlaps (doc_a, doc_b, score, shared_terms, shared_clauses)
    SELECT a, b, score, terms, clauses FROM src
    ON CONFLICT (doc_a, doc_b) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_ins FROM ins;

  RETURN jsonb_build_object('inserted', v_ins);
END $$;

-- ── Baca daftar pasangan (join judul dokumen) ──────────────────
CREATE OR REPLACE FUNCTION public.agentic_overlap_list()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'score', o.score, 'status', o.status,
    'overlap_type', o.overlap_type, 'recommendation', o.recommendation,
    'shared_terms', o.shared_terms, 'shared_clauses', o.shared_clauses,
    'reviewed_by', o.reviewed_by, 'reviewed_at', o.reviewed_at,
    'doc_a', o.doc_a, 'doc_b', o.doc_b,
    'a_title', da.title, 'a_number', da.doc_number, 'a_dept', da.department,
    'b_title', db.title, 'b_number', db.doc_number, 'b_dept', db.department
  ) ORDER BY (o.status='DETECTED') DESC, o.score DESC), '[]'::jsonb)
  FROM agentic.document_overlaps o
  JOIN agentic.document_registry da ON da.id = o.doc_a
  JOIN agentic.document_registry db ON db.id = o.doc_b;
$$;

-- ── Tandai status tinjauan ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agentic_overlap_status(p_id UUID, p_status TEXT, p_by TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_row agentic.document_overlaps;
BEGIN
  IF p_status NOT IN ('DETECTED','REVIEWED','RESOLVED','DISMISSED') THEN
    RAISE EXCEPTION 'Status tidak dikenal: %', p_status;
  END IF;
  UPDATE agentic.document_overlaps
     SET status = p_status,
         reviewed_by = COALESCE(p_by, reviewed_by),
         reviewed_at = CASE WHEN p_status IN ('RESOLVED','DISMISSED','REVIEWED') THEN now() ELSE reviewed_at END
   WHERE id = p_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pasangan tidak ditemukan'; END IF;
  RETURN to_jsonb(v_row);
END $$;

GRANT EXECUTE ON FUNCTION public.agentic_overlap_save(JSONB)          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_overlap_list()              TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_overlap_status(UUID,TEXT,TEXT) TO anon, authenticated, service_role;

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT 'agentic overlap (Fase 1) siap' AS status,
       (SELECT count(*) FROM agentic.document_overlaps) AS jumlah_pasangan;
