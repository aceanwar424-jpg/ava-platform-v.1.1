-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC — FASE 6C (KEPALA IT SELF-HEAL PROMPT)
-- Kepala IT menganalisis kegagalan runtime dan MEMPERBAIKI PROMPT sendiri
-- (prompt = instruksi kerja agent, ada di DB). Setiap perubahan di-backup
-- untuk rollback. Kepala IT TIDAK menyentuh kode program (repo) — itu
-- garis keamanan yang tidak dilewati.
-- PRASYARAT: fase6. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- Riwayat versi prompt (untuk rollback)
CREATE TABLE IF NOT EXISTS agentic.prompt_history (
  id           BIGSERIAL PRIMARY KEY,
  code         VARCHAR(60) NOT NULL,
  version      SMALLINT NOT NULL,
  system_prompt TEXT NOT NULL,
  changed_by   VARCHAR(30) NOT NULL DEFAULT 'IT_HEAD',
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prompt_hist ON agentic.prompt_history(code, created_at DESC);
ALTER TABLE agentic.prompt_history DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.prompt_history TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE agentic.prompt_history_id_seq TO anon, authenticated, service_role;

-- Perluas charter Kepala IT — kini juga engineer prompt
UPDATE agentic.agents SET charter =
 'Anda Kepala IT / SRE + Prompt Engineer organisasi agent OneLab. Tugas: (1) menjaga sistem hidup — tes semua jalur AI, bebaskan task macet, pantau error & token; (2) MENGANALISIS kegagalan berulang (error LLM, QA gagal, gambar diblokir filter) dan MEMPERBAIKI PROMPT agent yang bermasalah agar tidak terulang. Saat memperbaiki prompt: PERTAHANKAN semua aturan keamanan/guardrail yang sudah ada (anti-hyperbole, placeholder [[KONFIRMASI]], firewall isi-vs-format, larangan klaim medis), hanya tambahkan/pertegas — JANGAN menghapus batasan. Anda TIDAK boleh mengarang. Eskalasi ke CEO bila ada jalur mati atau kegagalan yang tidak bisa diperbaiki lewat prompt.'
WHERE code = 'IT_HEAD';

-- Data untuk analisis IT: error LLM tergroup + QA gagal + gambar diblokir +
-- template aktif (ringkas). Semua read-only, 24 jam terakhir.
CREATE OR REPLACE FUNCTION public.agentic_it_data()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'llm_errors', COALESCE((SELECT jsonb_agg(r) FROM (
        SELECT jsonb_build_object('model', model, 'n', count(*),
          'contoh', left(max(response_preview), 180)) AS r
        FROM agentic.llm_requests
        WHERE status='ERROR' AND created_at > now() - interval '24 hours'
        GROUP BY model ORDER BY count(*) DESC LIMIT 15) s), '[]'::jsonb),
    'image_blocked', (SELECT count(*) FROM agentic.llm_requests
        WHERE status='ERROR' AND response_preview ILIKE '%gambar hitam%'
          AND created_at > now() - interval '24 hours'),
    'qa_fails', COALESCE((SELECT jsonb_agg(r) FROM (
        SELECT jsonb_build_object('agent', agent_code, 'score', score,
          'findings', findings) AS r
        FROM agentic.qa_reviews
        WHERE verdict='FAIL' AND created_at > now() - interval '24 hours'
        ORDER BY created_at DESC LIMIT 15) s), '[]'::jsonb),
    'templates', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'code', code, 'system_prompt', system_prompt)) FROM agentic.prompt_templates
        WHERE active), '[]'::jsonb)
  );
$$;

-- Terapkan perbaikan prompt (dipakai IT worker & UI). Guard:
--   template harus ADA · prompt baru ≥60% panjang lama & ≥120 char
--   (mencegah LLM menggerus/mengosongkan instruksi). Backup dulu.
CREATE OR REPLACE FUNCTION public.agentic_prompt_apply(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_old agentic.prompt_templates; v_new TEXT; v_reason TEXT; v_by TEXT;
BEGIN
  SELECT * INTO v_old FROM agentic.prompt_templates WHERE code = p->>'code';
  IF v_old.code IS NULL THEN RAISE EXCEPTION 'Template % tidak ada — IT dilarang membuat template baru', p->>'code'; END IF;

  v_new := p->>'system_prompt';
  IF v_new IS NULL OR length(v_new) < 120 THEN
    RAISE EXCEPTION 'Prompt baru terlalu pendek (< 120 char) — ditolak demi keamanan';
  END IF;
  IF length(v_new) < (length(v_old.system_prompt) * 0.6)::int THEN
    RAISE EXCEPTION 'Prompt baru < 60%% panjang lama — kemungkinan menghapus guardrail, ditolak';
  END IF;
  IF v_new = v_old.system_prompt THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'tidak ada perubahan');
  END IF;

  v_reason := COALESCE(NULLIF(p->>'reason',''), 'perbaikan otomatis Kepala IT');
  v_by     := COALESCE(NULLIF(p->>'changed_by',''), 'IT_HEAD');

  -- backup versi lama
  INSERT INTO agentic.prompt_history(code, version, system_prompt, changed_by, reason)
  VALUES (v_old.code, v_old.version, v_old.system_prompt, v_by, v_reason);

  UPDATE agentic.prompt_templates
     SET system_prompt = v_new, version = version + 1, updated_at = now()
   WHERE code = v_old.code;

  RETURN jsonb_build_object('code', v_old.code, 'from_version', v_old.version,
    'to_version', v_old.version + 1, 'reason', v_reason);
END $$;

-- Rollback ke versi backup terakhir
CREATE OR REPLACE FUNCTION public.agentic_prompt_rollback(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v_hist agentic.prompt_history;
BEGIN
  SELECT * INTO v_hist FROM agentic.prompt_history
   WHERE code = p_code ORDER BY created_at DESC LIMIT 1;
  IF v_hist.id IS NULL THEN RAISE EXCEPTION 'Tidak ada riwayat untuk %', p_code; END IF;
  UPDATE agentic.prompt_templates
     SET system_prompt = v_hist.system_prompt, version = version + 1, updated_at = now()
   WHERE code = p_code;
  DELETE FROM agentic.prompt_history WHERE id = v_hist.id;
  RETURN jsonb_build_object('code', p_code, 'restored_from_version', v_hist.version);
END $$;

CREATE OR REPLACE VIEW public.agentic_prompt_hist_v AS SELECT * FROM agentic.prompt_history;
CREATE OR REPLACE VIEW public.agentic_prompts_full_v AS SELECT * FROM agentic.prompt_templates;
GRANT SELECT ON public.agentic_prompt_hist_v, public.agentic_prompts_full_v TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.agentic_it_data(),
  public.agentic_prompt_apply(JSONB),
  public.agentic_prompt_rollback(TEXT)
TO anon, authenticated, service_role;

SELECT 'Agentic Fase 6C siap — Kepala IT bisa memperbaiki prompt sendiri (dengan rollback)' AS status;
