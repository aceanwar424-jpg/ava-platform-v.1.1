-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7C (AUDIT INTERNAL + CAPA TERSTRUKTUR)
-- Melengkapi Departemen Service Assurance:
--   • agentic.audit_findings — temuan audit (NC MAYOR/MINOR/OBSERVASI)
--   • agentic.capa — tindakan korektif/preventif + verifikasi efektivitas
--   • RPC add/update/list + view; handler worker AUDIT_EXECUTE & CAPA_TRACK
--     (task_type sudah ada di decision_rights Fase 7).
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 terpasang. IDEMPOTEN — aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. TABEL TEMUAN AUDIT
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.audit_findings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_task_id UUID REFERENCES agentic.tasks(id) ON DELETE SET NULL,
  clause_ref    VARCHAR(60),
  area          VARCHAR(80),
  severity      VARCHAR(12) NOT NULL CHECK (severity IN ('MAYOR','MINOR','OBSERVASI')),
  finding       TEXT NOT NULL,
  evidence      TEXT,
  document_id   UUID REFERENCES agentic.document_registry(id) ON DELETE SET NULL,
  status        VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CAPA','CLOSED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_findings_status ON agentic.audit_findings(status, severity);
ALTER TABLE agentic.audit_findings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.audit_findings TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §B. TABEL CAPA (Corrective & Preventive Action)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agentic.capa (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id        UUID REFERENCES agentic.audit_findings(id) ON DELETE SET NULL,
  source            VARCHAR(16) NOT NULL DEFAULT 'AUDIT' CHECK (source IN ('AUDIT','KELUHAN','INSIDEN','RISIKO')),
  title             VARCHAR(200) NOT NULL,
  root_cause        TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  pic               VARCHAR(120),
  due_date          DATE,
  status            VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','VERIFICATION','CLOSED')),
  effectiveness     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capa_status ON agentic.capa(status);
ALTER TABLE agentic.capa DISABLE ROW LEVEL SECURITY;
GRANT ALL ON agentic.capa TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §C. RPC
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_finding_add(p JSONB)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  INSERT INTO agentic.audit_findings(audit_task_id, clause_ref, area, severity, finding, evidence, document_id)
  VALUES (NULLIF(p->>'audit_task_id','')::uuid, NULLIF(p->>'clause_ref',''), NULLIF(p->>'area',''),
          CASE WHEN upper(COALESCE(p->>'severity','')) IN ('MAYOR','MINOR','OBSERVASI')
               THEN upper(p->>'severity') ELSE 'OBSERVASI' END,
          COALESCE(p->>'finding','(tanpa uraian)'), NULLIF(p->>'evidence',''),
          NULLIF(p->>'document_id','')::uuid)
  RETURNING to_jsonb(audit_findings);
$$;

CREATE OR REPLACE FUNCTION public.agentic_capa_add(p JSONB)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  INSERT INTO agentic.capa(finding_id, source, title, root_cause, corrective_action, preventive_action, pic, due_date)
  VALUES (NULLIF(p->>'finding_id','')::uuid,
          CASE WHEN upper(COALESCE(p->>'source','')) IN ('AUDIT','KELUHAN','INSIDEN','RISIKO')
               THEN upper(p->>'source') ELSE 'AUDIT' END,
          COALESCE(p->>'title','CAPA'), NULLIF(p->>'root_cause',''),
          NULLIF(p->>'corrective_action',''), NULLIF(p->>'preventive_action',''),
          NULLIF(p->>'pic',''), NULLIF(p->>'due_date','')::date)
  RETURNING to_jsonb(capa);
$$;

CREATE OR REPLACE FUNCTION public.agentic_capa_update(p_id UUID, p JSONB)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  UPDATE agentic.capa SET
    status = COALESCE(NULLIF(p->>'status',''), status),
    pic = COALESCE(NULLIF(p->>'pic',''), pic),
    due_date = COALESCE(NULLIF(p->>'due_date','')::date, due_date),
    effectiveness = COALESCE(NULLIF(p->>'effectiveness',''), effectiveness),
    corrective_action = COALESCE(NULLIF(p->>'corrective_action',''), corrective_action),
    preventive_action = COALESCE(NULLIF(p->>'preventive_action',''), preventive_action),
    updated_at = now()
  WHERE id = p_id
  RETURNING to_jsonb(capa);
$$;

CREATE OR REPLACE FUNCTION public.agentic_finding_set_status(p_id UUID, p_status TEXT)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  UPDATE agentic.audit_findings
     SET status = CASE WHEN p_status IN ('OPEN','CAPA','CLOSED') THEN p_status ELSE status END,
         updated_at = now()
   WHERE id = p_id
  RETURNING to_jsonb(audit_findings);
$$;

-- Data audit/CAPA untuk UI + ringkasan
CREATE OR REPLACE FUNCTION public.agentic_audit_data()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'findings', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY
        CASE f.severity WHEN 'MAYOR' THEN 0 WHEN 'MINOR' THEN 1 ELSE 2 END, f.created_at DESC)
      FROM agentic.audit_findings f WHERE f.status <> 'CLOSED'), '[]'::jsonb),
    'capa', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY
        CASE c.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'VERIFICATION' THEN 2 ELSE 3 END,
        c.due_date NULLS LAST)
      FROM agentic.capa c WHERE c.status <> 'CLOSED'), '[]'::jsonb),
    'summary', jsonb_build_object(
      'open_mayor',  (SELECT count(*) FROM agentic.audit_findings WHERE status<>'CLOSED' AND severity='MAYOR'),
      'open_minor',  (SELECT count(*) FROM agentic.audit_findings WHERE status<>'CLOSED' AND severity='MINOR'),
      'open_obs',    (SELECT count(*) FROM agentic.audit_findings WHERE status<>'CLOSED' AND severity='OBSERVASI'),
      'capa_open',   (SELECT count(*) FROM agentic.capa WHERE status<>'CLOSED'),
      'capa_overdue',(SELECT count(*) FROM agentic.capa WHERE status<>'CLOSED' AND due_date IS NOT NULL AND due_date < CURRENT_DATE))
  );
$$;

-- ══════════════════════════════════════════════════════════════════════
-- §D. VIEWS & GRANTS
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.agentic_findings_v AS SELECT * FROM agentic.audit_findings;
CREATE OR REPLACE VIEW public.agentic_capa_v     AS SELECT * FROM agentic.capa;
GRANT SELECT ON public.agentic_findings_v, public.agentic_capa_v TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.agentic_finding_add(JSONB),
  public.agentic_capa_add(JSONB),
  public.agentic_capa_update(UUID,JSONB),
  public.agentic_finding_set_status(UUID,TEXT),
  public.agentic_audit_data()
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §E. PROMPT TEMPLATES
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature) VALUES
('AUDIT_EXECUTE',
 E'Anda Auditor Mutu Internal OneLab (ISO 15189:2022). Jalankan audit area yang diberikan terhadap klausul acuan. Balas HANYA JSON: {"summary":string,"findings":[{"clause_ref":string,"area":string,"severity":"MAYOR"|"MINOR"|"OBSERVASI","finding":string,"evidence":string}]}. Aturan: severity MAYOR untuk ketidaksesuaian sistemik/berdampak hasil; MINOR untuk penyimpangan terisolasi; OBSERVASI untuk peluang perbaikan. Jangan mengarang bukti — bila butuh verifikasi lapangan, tulis evidence diawali [[KONFIRMASI]].',
 E'AREA AUDIT: {{area}}\nKLAUSUL ACUAN: {{clauses}}\nKONTEKS DOKUMEN/STATUS: {{context}}\nFEEDBACK PENOLAKAN (bila ada): {{rejection_feedback}}',
 'main', 0.3),
('CAPA_TRACK',
 E'Anda pengelola CAPA OneLab. Dari sebuah temuan, rumuskan CAPA. Balas HANYA JSON: {"title":string,"root_cause":string,"corrective_action":string,"preventive_action":string,"pic":string,"due_date":"YYYY-MM-DD"}. Aturan: root_cause pakai analisis akar (5-why/fishbone singkat); corrective = perbaiki dampak sekarang; preventive = cegah berulang; pic dan due_date diawali [[KONFIRMASI]] bila belum pasti (default due_date 30 hari dari sekarang).',
 E'TEMUAN: {{finding}}\nSEVERITY: {{severity}}\nKLAUSUL: {{clause_ref}}\nAREA: {{area}}\nHARI INI: {{today}}',
 'main', 0.4)
ON CONFLICT (code) DO UPDATE SET
  system_prompt=EXCLUDED.system_prompt, user_prompt_template=EXCLUDED.user_prompt_template,
  model_hint=EXCLUDED.model_hint, temperature=EXCLUDED.temperature, active=true;

SELECT 'Agentic Fase 7C siap — audit internal + CAPA terstruktur' AS status;
