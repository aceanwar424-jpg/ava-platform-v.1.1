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


-- ── 6. PERBAIKAN: pencarian template bertingkat ────────────────
-- MASALAH
--   agentic_template_get menuntut kecocokan PERSIS pada doc_level + doc_type +
--   department sekaligus. Akibatnya template yang sudah diunggah dianggap
--   "belum ada" hanya karena departemennya beda (mis. master diunggah untuk
--   MUTU, tetapi dokumennya milik LAB). Pengguna melihat "Belum ada master
--   .docx" terus-menerus padahal templatenya jelas sudah ada.
--
-- PERBAIKAN
--   Cari bertingkat, dari paling tepat ke paling umum:
--     1  level + jenis + departemen sama          (paling tepat)
--     2  level + jenis, departemen MUTU           (template umum organisasi)
--     3  level + jenis, departemen mana pun
--     4  jenis + departemen sama, level berbeda
--     5  jenis sama saja                          (paling longgar)
--   Template tanpa master .docx terunggah (storage_path NULL) dilewati karena
--   tidak bisa dipakai merakit apa pun.
--
--   Hasilnya membawa 'match_level' agar antarmuka dapat berterus terang bahwa
--   yang dipakai adalah template cadangan, bukan yang persis — supaya pengguna
--   tahu dan bisa memperbaiki pemetaannya bila perlu.
CREATE OR REPLACE FUNCTION public.agentic_template_get(
  p_level SMALLINT, p_type TEXT, p_dept TEXT DEFAULT 'MUTU'
) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT (to_jsonb(t) - 'prio') || jsonb_build_object('match_level', t.prio)
  FROM (
    SELECT d.*,
      CASE
        -- Template departemen sama = paling tepat
        WHEN d.doc_level = p_level AND d.doc_type = p_type
             AND d.department = COALESCE(p_dept,'MUTU')                 THEN 1
        -- Template "SEMUA" = berlaku untuk departemen apa pun (mode utama sekarang)
        WHEN d.doc_level = p_level AND d.doc_type = p_type
             AND d.department = 'SEMUA'                                 THEN 2
        -- Template umum lama (MUTU) sebagai cadangan
        WHEN d.doc_level = p_level AND d.doc_type = p_type
             AND d.department = 'MUTU'                                  THEN 3
        WHEN d.doc_level = p_level AND d.doc_type = p_type              THEN 4
        WHEN d.doc_type  = p_type
             AND d.department IN (COALESCE(p_dept,'MUTU'),'SEMUA')      THEN 5
        WHEN d.doc_type  = p_type                                       THEN 6
        ELSE 99
      END AS prio
    FROM agentic.doc_templates d
    WHERE d.active AND d.storage_path IS NOT NULL
  ) t
  WHERE t.prio < 99
  ORDER BY t.prio, t.updated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.agentic_template_get(SMALLINT,TEXT,TEXT) TO anon, authenticated, service_role;

-- Daftar template yang benar-benar siap pakai (untuk pesan bantuan di UI).
CREATE OR REPLACE FUNCTION public.agentic_template_list()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'doc_level', doc_level, 'doc_type', doc_type,
    'department', department, 'name', name,
    'has_master', (storage_path IS NOT NULL)
  ) ORDER BY doc_level, doc_type, department), '[]'::jsonb)
  FROM agentic.doc_templates WHERE active;
$$;

GRANT EXECUTE ON FUNCTION public.agentic_template_list() TO anon, authenticated, service_role;

-- ── 7. Departemen batch saat ingest ───────────────────────────
-- Worker menebak departemen lewat AI (meta.department). Bila pengguna memilih
-- departemen untuk satu batch unggahan, fungsi ini MEMAKSAKANNYA pada dokumen
-- yang baru diingest — dicocokkan lewat source_file_path (jalur berkas yang
-- disimpan worker), tanpa perlu mengubah worker.
CREATE OR REPLACE FUNCTION public.agentic_doc_set_dept_by_paths(p_paths JSONB, p_dept TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_n INT;
BEGIN
  IF coalesce(trim(p_dept),'') = '' THEN RAISE EXCEPTION 'Departemen tidak boleh kosong'; END IF;
  UPDATE agentic.document_registry
     SET department = trim(p_dept), updated_at = now()
   WHERE source_file_path IN (
     SELECT jsonb_array_elements_text(COALESCE(p_paths,'[]'::jsonb))
   );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('updated', v_n);
END $$;

-- Set departemen satu dokumen (untuk koreksi manual dari tabel registry).
CREATE OR REPLACE FUNCTION public.agentic_doc_set_dept(p_doc_id UUID, p_dept TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_row agentic.document_registry;
BEGIN
  IF coalesce(trim(p_dept),'') = '' THEN RAISE EXCEPTION 'Departemen tidak boleh kosong'; END IF;
  UPDATE agentic.document_registry SET department = trim(p_dept), updated_at = now()
   WHERE id = p_doc_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokumen tidak ditemukan'; END IF;
  RETURN to_jsonb(v_row);
END $$;

GRANT EXECUTE ON FUNCTION public.agentic_doc_set_dept_by_paths(JSONB,TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_doc_set_dept(UUID,TEXT)           TO anon, authenticated, service_role;

-- ── 8. Hapus template dokumen ──────────────────────────────────
-- Menghapus baris template. Dokumen yang sudah pernah dirakit tidak terpengaruh
-- (mereka .docx tersendiri). Berkas master di Storage menjadi yatim tak terpakai
-- — tidak menggagalkan apa pun.
CREATE OR REPLACE FUNCTION public.agentic_template_delete(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v INT;
BEGIN
  DELETE FROM agentic.doc_templates WHERE id = p_id;
  GET DIAGNOSTICS v = ROW_COUNT;
  IF v = 0 THEN RAISE EXCEPTION 'Template tidak ditemukan'; END IF;
  RETURN jsonb_build_object('deleted', v);
END $$;

GRANT EXECUTE ON FUNCTION public.agentic_template_delete(UUID) TO anon, authenticated, service_role;

-- ── 9. Riwayat percakapan Editor Dokumen AI (per dokumen) ──────
-- Menyimpan riwayat instruksi & tanggapan editor AI agar progres perbaikan
-- tercatat per dokumen — tidak hilang saat layar ditutup, dan bisa dilihat lagi
-- saat dokumen dibuka kembali. Isi dokumen sendiri tetap di
-- document_registry.extracted_meta.full_text.
CREATE TABLE IF NOT EXISTS agentic.document_ai_chat (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES agentic.document_registry(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','ai','system')),
  content     TEXT,
  kind        TEXT,          -- instruct / autofill / pdftext / save
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docchat ON agentic.document_ai_chat (document_id, created_at);

CREATE OR REPLACE FUNCTION public.agentic_doc_chat_add(p_doc UUID, p_role TEXT, p_content TEXT, p_kind TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v agentic.document_ai_chat;
BEGIN
  IF p_role NOT IN ('user','ai','system') THEN RAISE EXCEPTION 'role tidak dikenal'; END IF;
  INSERT INTO agentic.document_ai_chat (document_id, role, content, kind)
  VALUES (p_doc, p_role, p_content, p_kind) RETURNING * INTO v;
  RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.agentic_doc_chat_list(p_doc UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'role', role, 'content', content, 'kind', kind, 'created_at', created_at
  ) ORDER BY created_at), '[]'::jsonb)
  FROM agentic.document_ai_chat WHERE document_id = p_doc;
$$;

GRANT EXECUTE ON FUNCTION public.agentic_doc_chat_add(UUID,TEXT,TEXT,TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_doc_chat_list(UUID)              TO anon, authenticated, service_role;

-- ── 10. Terbitkan dokumen langsung dari registry ───────────────
-- MASALAH: agentic_publish bekerja pada TASK (p_task_id). Dokumen yang masuk
-- lewat ingest tidak punya task, sehingga TIDAK PERNAH bisa berstatus PUBLISHED
-- — padahal Wiki hanya menampilkan yang PUBLISHED. Akibatnya dokumen final yang
-- diunggah tak pernah muncul di perpustakaan Wiki.
-- Fungsi ini menerbitkan dokumen langsung dari registry, memakai pola penomoran
-- yang sama: OL/<jenis>/<departemen>/<urut 3 digit>.
CREATE OR REPLACE FUNCTION public.agentic_doc_publish(p_doc_id UUID, p_number TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_doc agentic.document_registry; v_num TEXT; v_seq INT;
BEGIN
  SELECT * INTO v_doc FROM agentic.document_registry WHERE id = p_doc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokumen tidak ditemukan'; END IF;

  v_num := NULLIF(trim(COALESCE(p_number,'')),'');
  IF v_num IS NULL THEN v_num := v_doc.doc_number; END IF;

  IF v_num IS NULL THEN
    SELECT count(*)+1 INTO v_seq FROM agentic.document_registry
     WHERE doc_type = v_doc.doc_type AND department = v_doc.department AND doc_number IS NOT NULL;
    LOOP
      v_num := 'OL/'||v_doc.doc_type||'/'||v_doc.department||'/'||lpad(v_seq::text,3,'0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM agentic.document_registry WHERE doc_number = v_num);
      v_seq := v_seq + 1;
    END LOOP;
  END IF;

  UPDATE agentic.document_registry
     SET doc_number       = v_num,
         status           = 'PUBLISHED',
         current_revision = GREATEST(COALESCE(current_revision,0), 1),
         effective_date   = COALESCE(effective_date, CURRENT_DATE),
         next_review_date = COALESCE(next_review_date, CURRENT_DATE + INTERVAL '2 years'),
         updated_at       = now()
   WHERE id = p_doc_id
  RETURNING * INTO v_doc;

  RETURN to_jsonb(v_doc);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Nomor dokumen "%" sudah dipakai dokumen lain', v_num;
END $$;

GRANT EXECUTE ON FUNCTION public.agentic_doc_publish(UUID,TEXT) TO anon, authenticated, service_role;

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT 'agentic doc-sign siap' AS status,
       (SELECT count(*) FROM agentic.document_signatures) AS jumlah_tanda_tangan;
