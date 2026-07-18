-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7B (KONFIG AI DI WEB + SLOT VIDEO)
-- Menambah:
--   • agentic.ai_config — set MODEL/API/flag dari web (fallback ke Secrets)
--   • RPC: agentic_config_ui (masked), agentic_config_set, agentic_config_map
--     (map = full value, HANYA service_role → dipakai llm-gateway)
--   • Seed kunci konfigurasi termasuk NVIDIA_VIDEO_MODEL & VIDEO_ENABLED
-- Catatan: nilai kosong = pakai Secret/env lama (tidak menimpa).
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 terpasang. IDEMPOTEN — aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. TABEL KONFIG AI
--   is_secret=true → nilai TIDAK pernah dibalikkan ke UI (hanya status terisi).
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.ai_config (
  key         VARCHAR(60) PRIMARY KEY,
  value       TEXT,
  is_secret   BOOLEAN NOT NULL DEFAULT false,
  category    VARCHAR(30) NOT NULL DEFAULT 'UMUM',
  label       VARCHAR(120) NOT NULL,
  placeholder VARCHAR(160),
  notes       TEXT,
  sort        SMALLINT NOT NULL DEFAULT 100,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE agentic.ai_config DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.ai_config TO service_role;

-- Seed daftar setelan (value dibiarkan kosong = pakai Secret/env yang sudah ada)
INSERT INTO agentic.ai_config (key, value, is_secret, category, label, placeholder, notes, sort) VALUES
('NVIDIA_API_KEYS',   NULL, true,  'NVIDIA', 'Kunci API NVIDIA',        'nvapi-xxx, nvapi-yyy', 'Pisahkan banyak kunci dengan koma. Kosongkan untuk memakai Secret.', 10),
('NVIDIA_MODEL_MAIN', NULL, false, 'NVIDIA', 'Model Teks — Utama',      'meta/llama-3.3-70b-instruct', 'Model reasoning berat untuk task utama.', 11),
('NVIDIA_MODEL_LIGHT',NULL, false, 'NVIDIA', 'Model Teks — Ringan',     'meta/llama-3.1-8b-instruct', 'Model cepat & murah untuk QA/terjemah.', 12),
('NVIDIA_IMAGE_MODEL',NULL, false, 'GAMBAR', 'Model Gambar (prioritas)','black-forest-labs/flux.1-dev', 'Daftar koma; ditaruh di depan rantai default.', 20),
('NVIDIA_VIDEO_MODEL',NULL, false, 'VIDEO',  'Model Video NVIDIA',      'genmo/mochi-1, ...', 'Model text-to-video di build.nvidia.com. Kosong = video nonaktif.', 30),
('VIDEO_ENABLED',     NULL, false, 'VIDEO',  'Aktifkan Video',          'true / false', 'true untuk mengizinkan mode video (butuh model video terisi).', 31),
('GEMINI_API_KEYS',   NULL, true,  'GEMINI', 'Kunci API Gemini',        'AIza..., AIza...', 'Fallback teks & pembaca PDF. Pisah koma.', 40),
('GEMINI_MODEL',      NULL, false, 'GEMINI', 'Model Gemini',            'gemini-2.5-flash', 'Model fallback teks.', 41),
('IMAGE_FILTER_STRICT',NULL,false, 'LANJUT', 'Blokir Prompt Gambar Ketat','true / false', 'true = tolak prompt berisiko (bukan auto safe-rewrite).', 50),
('LLM_RATE_LIMIT_PER_KEY_PER_MIN', NULL, false, 'LANJUT', 'Batas Rate per Kunci/menit', '30', 'Batas request per kunci per menit.', 51)
ON CONFLICT (key) DO UPDATE SET
  is_secret=EXCLUDED.is_secret, category=EXCLUDED.category, label=EXCLUDED.label,
  placeholder=EXCLUDED.placeholder, notes=EXCLUDED.notes, sort=EXCLUDED.sort;

-- ══════════════════════════════════════════════════════════════════════
-- §B. RPC — UI (masked) · SET · MAP (service_role only)
-- ══════════════════════════════════════════════════════════════════════

-- Untuk UI: nilai rahasia disamarkan (hanya status "terisi" + panjang).
CREATE OR REPLACE FUNCTION public.agentic_config_ui()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', key, 'category', category, 'label', label, 'placeholder', placeholder,
    'notes', notes, 'is_secret', is_secret, 'sort', sort,
    'has_value', (value IS NOT NULL AND btrim(value) <> ''),
    'value', CASE WHEN is_secret THEN NULL
                  ELSE value END,
    'masked', CASE WHEN is_secret AND value IS NOT NULL AND btrim(value) <> ''
                   THEN '•••••• (tersimpan)' ELSE NULL END
  ) ORDER BY sort, category), '[]'::jsonb)
  FROM agentic.ai_config;
$$;

-- Simpan satu setelan. Nilai kosong → NULL (kembali ke Secret/env).
CREATE OR REPLACE FUNCTION public.agentic_config_set(p_key TEXT, p_value TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v agentic.ai_config;
BEGIN
  UPDATE agentic.ai_config
     SET value = NULLIF(btrim(COALESCE(p_value,'')),''), updated_at = now()
   WHERE key = p_key
  RETURNING * INTO v;
  IF v.key IS NULL THEN RAISE EXCEPTION 'Setelan % tidak dikenal', p_key; END IF;
  RETURN jsonb_build_object('key', v.key, 'has_value', (v.value IS NOT NULL));
END $$;

-- Peta lengkap (nilai asli) — HANYA untuk llm-gateway (service_role).
CREATE OR REPLACE FUNCTION public.agentic_config_map()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT COALESCE(jsonb_object_agg(key, value) FILTER (WHERE value IS NOT NULL AND btrim(value) <> ''), '{}'::jsonb)
  FROM agentic.ai_config;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- §C. GRANTS — kunci keamanan
--   ui/set boleh dipanggil frontend; map DICABUT dari PUBLIC, hanya service_role.
-- ══════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.agentic_config_ui()          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agentic_config_set(TEXT,TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.agentic_config_map() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agentic_config_map() TO service_role;

SELECT 'Agentic Fase 7B siap — konfig AI di web + slot video (gateway perlu re-deploy)' AS status;
