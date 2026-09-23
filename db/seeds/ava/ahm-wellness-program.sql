-- Initial, non-clinical project configuration requested by the owner on 2026-09-22.
-- OWNED_BY: ava
-- No participant data, examination results, pricing, PIC, or contract data.

INSERT INTO public.wellness_programs (
  tenant_id, corporate_id, code, name, description, focus, starts_on, status,
  measurement_plan, reporting_plan, medical_governance, created_by
)
SELECT
  administrator.tenant_id,
  corporate.id,
  'AHM-DM-HT-2026',
  'Program Wellness Diabetes & Hipertensi',
  'Program pemantauan kardiometabolik corporate: hasil pemeriksaan IHC, pencatatan mandiri peserta, tindak lanjut wellness, dan laporan HR berbentuk agregat.',
  ARRAY['diabetes','hypertension']::text[],
  current_date,
  'draft',
  jsonb_build_object(
    'blood_pressure','daily',
    'blood_glucose','according_to_care_plan',
    'ihc_intake','bulk_csv',
    'participant_self_entry',true
  ),
  jsonb_build_object(
    'weekly_operations',true,
    'monthly_corporate',true,
    'corporate_visibility','aggregate_only',
    'small_cell_threshold',5
  ),
  jsonb_build_object(
    'self_reported_status','unverified',
    'ihc_status','verified',
    'clinical_decision_owner','healthcare_professional',
    'emergency_channel','existing_corporate_or_ihc_protocol'
  ),
  administrator.id
FROM public.corporates corporate
CROSS JOIN LATERAL (
  SELECT id, tenant_id
  FROM public.user_profiles
  WHERE lower(COALESCE(role,''))='super_admin' AND tenant_id IS NOT NULL
  ORDER BY id
  LIMIT 1
) administrator
WHERE corporate.kode_corp='AHM-WELLNESS-2026'
ON CONFLICT (tenant_id, corporate_id, code) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  focus=EXCLUDED.focus,
  measurement_plan=EXCLUDED.measurement_plan,
  reporting_plan=EXCLUDED.reporting_plan,
  medical_governance=EXCLUDED.medical_governance,
  updated_by=EXCLUDED.created_by,
  updated_at=now();
