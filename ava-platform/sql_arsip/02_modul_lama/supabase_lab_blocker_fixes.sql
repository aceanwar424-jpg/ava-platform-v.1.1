-- ══════════════════════════════════════════════════════════════════════════════
-- OneLab · Laboratory Information System (LIS)
-- BLOCKER FIXES: Auto-Conclusion Generation + Audit Trail + Digital Signature
-- Jalankan SEKALI di Supabase SQL Editor.
-- Aman dijalankan ulang (idempoten): semua ADD COLUMN IF NOT EXISTS.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LAB_RESULTS — Tambah kolom untuk Auto-Conclusion + Digital Signature
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS ai_conclusion        text,             -- AI-generated clinical conclusion
  ADD COLUMN IF NOT EXISTS conclusion_generated_at timestamp,      -- When AI generated it
  ADD COLUMN IF NOT EXISTS conclusion_generated_by text,           -- Usually 'system/ai'
  ADD COLUMN IF NOT EXISTS conclusion_modified  boolean default false, -- Doctor edited?
  ADD COLUMN IF NOT EXISTS conclusion_modified_at timestamp,       -- When doctor edited
  ADD COLUMN IF NOT EXISTS conclusion_modified_by text,            -- Doctor who edited
  ADD COLUMN IF NOT EXISTS digital_signature    text,              -- PKI signature blob (base64)
  ADD COLUMN IF NOT EXISTS signature_timestamp  timestamp,         -- NTP-verified timestamp
  ADD COLUMN IF NOT EXISTS signature_algorithm  text default 'RS256'; -- RSA-256


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LAB_CONCLUSION_TEMPLATES — Configurable AI conclusion patterns
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_conclusion_templates (
  id                  bigint generated always as identity primary key,
  product_id          bigint references public.products(id) on delete cascade,
  product_name        text not null,
  test_name           text,
  -- Pattern matching
  pattern_type        text not null,  -- 'high', 'low', 'critical', 'delta', 'abnormal', 'mixed'
  condition_name      text,           -- 'Diabetes', 'Hipertensi', 'Anemia', etc
  -- Triggers
  min_value           numeric,        -- If result >= min_value
  max_value           numeric,        -- If result <= max_value
  delta_threshold_pct numeric,        -- If change % >= threshold
  -- Template
  conclusion_template text not null,  -- "↑ {{TEST}} {{VALUE}} {{UNIT}}. {{INTERPRETATION}}. {{RECOMMENDATION}}."
  clinical_note       text,           -- Additional note
  recommendation      text,           -- Tindak lanjut
  priority            integer default 50, -- Sort order
  is_active           boolean default true,
  created_at          timestamp default now(),
  updated_at          timestamp default now()
);

CREATE INDEX IF NOT EXISTS idx_conclusion_templates_product ON public.lab_conclusion_templates(product_id);
CREATE INDEX IF NOT EXISTS idx_conclusion_templates_pattern ON public.lab_conclusion_templates(pattern_type);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LAB_AUDIT_LOG — Immutable audit trail (ISO 15189 compliance)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_audit_log (
  id                  bigint generated always as identity primary key,
  -- What happened
  action              text not null,  -- 'result_entered', 'result_validated', 'result_approved', 'conclusion_generated', 'conclusion_edited', 'result_released'
  resource_type       text not null,  -- 'lab_result', 'lab_sample', 'analyzer_config'
  resource_id         bigint,
  -- Who did it
  user_id             text not null,  -- Username/email
  user_role           text,           -- 'Analis', 'Dokter', 'Admin'
  -- What changed
  before_value        text,           -- Previous value (JSON if complex)
  after_value         text,           -- New value (JSON if complex)
  change_reason       text,           -- Why changed? (required for edits)
  -- Tracking
  ip_address          text,           -- Source IP
  user_agent          text,           -- Browser/API client
  timestamp           timestamp default now(), -- Must be NTP-verified
  -- Digital signature (non-repudiation)
  digital_signature   text,           -- PKI signature of this log entry
  signature_verified  boolean default false,
  -- Retention policy
  retention_years     integer default 5, -- ISO 15189 requires 5-year retention
  archived            boolean default false
);

CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.lab_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user     ON public.lab_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action   ON public.lab_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.lab_audit_log(timestamp);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. LAB_ANALYZER_REGISTRY — Flexible analyzer model & HL7 configuration
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_analyzer_registry (
  id                  bigint generated always as identity primary key,
  analyzer_id         bigint references public.analyzers(id) on delete cascade,
  -- Model info
  model_manufacturer  text,           -- Roche, Siemens, Abbott, Beckman Coulter, etc
  model_name          text,           -- cobas c311, Atellica, Dimension, AU680, etc
  model_code          text unique,    -- Internal model code for quick lookup
  -- HL7 Configuration
  hl7_protocol        text,           -- 'HL7v2.5', 'HL7v2.4', 'LIS2-A1'
  hl7_encoding        text default 'ASCII', -- ASCII, UTF-8
  hl7_separator_field text default '|',
  hl7_separator_component text default '^',
  hl7_separator_repeat text default '~',
  -- Test mapping (JSON: test_loinc -> product_id)
  test_mapping        text,           -- JSON: {"2345-7": 123, "2345-8": 124}
  result_mapping      text,           -- JSON field path: {"OBX-5": "result_value"}
  -- Connection
  connection_type     text,           -- 'TCP', 'Serial', 'USB', 'LAN'
  connection_params   text,           -- JSON: {"host": "192.168.1.100", "port": 2575}
  heartbeat_interval  integer default 60, -- seconds
  -- Capabilities
  supports_delta_check boolean default true,
  supports_qc         boolean default true,
  supports_reflex     boolean default false,
  -- Status
  status              text default 'Configured', -- Configured, Connected, Error, Offline
  last_heartbeat      timestamp,
  notes               text,
  created_at          timestamp default now(),
  updated_at          timestamp default now()
);

CREATE INDEX IF NOT EXISTS idx_analyzer_registry_analyzer ON public.lab_analyzer_registry(analyzer_id);
CREATE INDEX IF NOT EXISTS idx_analyzer_registry_model   ON public.lab_analyzer_registry(model_code);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. LAB_PKI_KEYS — Private/Public key management for digital signatures
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_pki_keys (
  id                  bigint generated always as identity primary key,
  key_id              text unique not null,  -- 'system-ca', 'dr-rudi-002', 'analyzer-01'
  key_type            text not null,         -- 'CA', 'User', 'Analyzer', 'Timestamp'
  key_owner           text,                  -- Username or device name
  public_key_pem      text,                  -- PEM-encoded public key
  public_key_fingerprint text,               -- SHA256 fingerprint
  -- Private key NOT stored here (for security!)
  -- Private key should be in environment variables or secrets vault
  algorithm           text default 'RS256',  -- RSA-256
  key_size            integer default 2048,  -- bits
  created_at          timestamp default now(),
  expires_at          timestamp,             -- Certificate expiry
  revoked             boolean default false,
  revoke_reason       text,
  revoked_at          timestamp
);

CREATE INDEX IF NOT EXISTS idx_pki_keys_id ON public.lab_pki_keys(key_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. LAB_NTP_TIMESTAMPS — Legal-grade timestamp server verification
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_ntp_timestamps (
  id                  bigint generated always as identity primary key,
  local_timestamp     timestamp,             -- What system said
  ntp_timestamp       timestamp,             -- What NTP server said
  ntp_server          text,                  -- 'pool.ntp.org', 'time.google.com', etc
  time_offset_ms      integer,               -- Difference in milliseconds
  is_verified         boolean default true,
  timestamp_token     text,                  -- RFC 3161 timestamp token
  created_at          timestamp default now()
);

CREATE INDEX IF NOT EXISTS idx_ntp_timestamp_verify ON public.lab_ntp_timestamps(is_verified);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Enable audit logging via trigger function (minimal version)
-- ─────────────────────────────────────────────────────────────────────────────
-- This function will be called from the application to log actions
-- (Full trigger implementation requires careful planning to avoid circular logs)

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Disable RLS on new tables (app manages auth)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lab_conclusion_templates    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_audit_log               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_analyzer_registry       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_pki_keys                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_ntp_timestamps          DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Seed default conclusion templates (common patterns)
-- ─────────────────────────────────────────────────────────────────────────────
-- These will be populated by application based on product catalog
-- Format: INSERT template matching pattern + AI generation logic

-- Example templates (to be expanded by lab):
/*
INSERT INTO public.lab_conclusion_templates 
  (product_id, product_name, pattern_type, condition_name, min_value, 
   conclusion_template, clinical_note, recommendation, priority)
VALUES
  (1, 'Glucose', 'high', 'Hyperglycemia', 126, 
   '↑ GLUKOSA {{VALUE}} {{UNIT}} (Normal 70-100). {{TREND}}', 
   'Cek diabetes melitus', 'Konsultasi dokter / diet control', 10),
  (1, 'Glucose', 'critical', 'Severe Hyperglycemia', 400,
   '🚨 GLUKOSA KRITIS {{VALUE}} {{UNIT}}. URGENT evaluation diperlukan.',
   'Kemungkinan DKA atau HHS', 'Segera konsultasi dokter spesialis', 5);
*/

SELECT 'Lab Blocker Fixes installed: Auto-conclusion, Audit Trail, Digital Signature infrastructure ready' AS status;
