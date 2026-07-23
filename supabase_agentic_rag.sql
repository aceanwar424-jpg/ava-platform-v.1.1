-- ══════════════════════════════════════════════════════════════
-- OneLab Agentic — RAG Ringan (Fase 1): pgvector + chunk + retrieve
-- ──────────────────────────────────────────────────────────────
-- Mengadopsi STRUKTUR RAG (chunk → embed → simpan vektor → retrieve),
-- direimplementasi di Supabase sendiri agar dokumen mutu/klinis TETAP di dalam.
-- Chunk dibuat di peramban (reuse sectionizer). Embedding via edge function
-- "embed" (Gemini text-embedding-004, 768 dimensi). Lihat AGENTIC_RAG_DESIGN.md.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- PRASYARAT: ekstensi vector (di bawah) + deploy edge function "embed".
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Potongan (chunk) berikut embedding-nya ─────────────────────
CREATE TABLE IF NOT EXISTS agentic.document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES agentic.document_registry(id) ON DELETE CASCADE,
  section_key TEXT,                      -- mis. ISI_PROSEDUR (dari sectionizer)
  ord         INT NOT NULL DEFAULT 0,    -- urutan potongan dalam dokumen
  content     TEXT NOT NULL,
  embedding   vector(768),               -- Gemini text-embedding-004
  token_est   INT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON agentic.document_chunks(document_id, ord);

-- Indeks kemiripan. HNSW lebih cepat & akurat; ivfflat bila HNSW tak tersedia.
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chunks_vec ON agentic.document_chunks
             USING hnsw (embedding vector_cosine_ops)';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chunks_vec ON agentic.document_chunks
             USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
  END;
END $$;

-- Embedding tingkat-dokumen (centroid) — untuk overlap semantik (Fase 2).
CREATE TABLE IF NOT EXISTS agentic.document_embeddings (
  document_id UUID PRIMARY KEY REFERENCES agentic.document_registry(id) ON DELETE CASCADE,
  embedding   vector(768),
  chunk_count INT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indeks ulang satu dokumen ──────────────────────────────────
-- p_chunks: array [{ section_key, ord, content, embedding (teks "[..]"), token_est }].
-- Buang chunk lama dokumen itu, masukkan yang baru, hitung centroid.
CREATE OR REPLACE FUNCTION public.agentic_rag_index(p_doc UUID, p_chunks JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_n INT;
BEGIN
  DELETE FROM agentic.document_chunks WHERE document_id = p_doc;

  INSERT INTO agentic.document_chunks (document_id, section_key, ord, content, embedding, token_est)
  SELECT p_doc,
         NULLIF(e->>'section_key',''),
         COALESCE((e->>'ord')::int, 0),
         e->>'content',
         (e->>'embedding')::vector,
         (e->>'token_est')::int
  FROM jsonb_array_elements(COALESCE(p_chunks,'[]'::jsonb)) e
  WHERE COALESCE(e->>'content','') <> '' AND COALESCE(e->>'embedding','') <> '';

  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- centroid (rata-rata) dari chunk dokumen ini untuk overlap semantik (Fase 2).
  -- avg(vector) butuh pgvector >= 0.7; bila belum ada, JANGAN gagalkan indeks
  -- Fase 1 (chunk + pencarian tetap jalan). Centroid diisi saat versi mendukung.
  DELETE FROM agentic.document_embeddings WHERE document_id = p_doc;
  IF v_n > 0 THEN
    BEGIN
      INSERT INTO agentic.document_embeddings (document_id, embedding, chunk_count)
      SELECT p_doc, avg(embedding), count(*)
      FROM agentic.document_chunks WHERE document_id = p_doc AND embedding IS NOT NULL;
    EXCEPTION WHEN undefined_function OR datatype_mismatch THEN
      NULL;  -- pgvector belum punya avg(vector) — lewati, tak menggagalkan Fase 1
    END;
  END IF;

  RETURN jsonb_build_object('chunks', v_n);
END $$;

-- ── Pencarian kemiripan (retrieve) ─────────────────────────────
-- p_embedding: vektor pertanyaan sebagai teks "[..]".
CREATE OR REPLACE FUNCTION public.agentic_rag_search(
  p_embedding TEXT, p_k INT DEFAULT 8, p_status TEXT DEFAULT NULL, p_dept TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'dist')::float), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'document_id', c.document_id, 'section_key', c.section_key,
      'content', c.content,
      'doc_number', d.doc_number, 'title', d.title, 'department', d.department,
      'dist', (c.embedding <=> p_embedding::vector)
    ) AS x
    FROM agentic.document_chunks c
    JOIN agentic.document_registry d ON d.id = c.document_id
    WHERE c.embedding IS NOT NULL
      AND (p_status IS NULL OR d.status = p_status)
      AND (p_dept   IS NULL OR d.department = p_dept)
    ORDER BY c.embedding <=> p_embedding::vector
    LIMIT GREATEST(1, LEAST(COALESCE(p_k,8), 20))
  ) q;
$$;

-- ── Status indeks (berapa dokumen & chunk terindeks) ───────────
CREATE OR REPLACE FUNCTION public.agentic_rag_status()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'docs_indexed',  (SELECT count(DISTINCT document_id) FROM agentic.document_chunks),
    'chunks',        (SELECT count(*) FROM agentic.document_chunks),
    'docs_total',    (SELECT count(*) FROM agentic.document_registry WHERE status <> 'MISSING')
  );
$$;

GRANT EXECUTE ON FUNCTION public.agentic_rag_index(UUID,JSONB)                TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_rag_search(TEXT,INT,TEXT,TEXT)       TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_rag_status()                        TO anon, authenticated, service_role;

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT 'agentic RAG (Fase 1) siap' AS status,
       (SELECT count(*) FROM agentic.document_chunks) AS jumlah_chunk;
