-- OWNED_BY: generic. HIS orchestration; HR requests/evaluates, provider only submits results.
-- Forward migration. No production identities, grants or consent are fabricated.
BEGIN;

-- Restore strict tenant resolution (legacy UAT patches used an unsafe global fallback).
CREATE OR REPLACE FUNCTION public.wellness_actor_tenant() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT tenant_id FROM public.user_profiles WHERE id=auth.uid()
$$;

ALTER TABLE public.wellness_enrollments ADD COLUMN IF NOT EXISTS consent_notice_version text;
-- Navigation grant is scoped to existing internal roles, never external accounts.
DO $$ BEGIN
 IF to_regclass('public.role_pages') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL THEN
  INSERT INTO public.roles(kode,label,keterangan) VALUES('ihc','IHC · Pemasok hasil','APPS: pengiriman hasil untuk program yang diberikan admin HIS.') ON CONFLICT DO NOTHING;
  INSERT INTO public.role_pages(role_kode,page)
  SELECT kode,'his-wellness' FROM public.roles WHERE kode IN ('super_admin','admin','admin_faskes','head_operation','direktur','manager','spv','tech')
  ON CONFLICT DO NOTHING;
 END IF;
END $$;
ALTER TABLE public.wellness_treatment_requests ADD COLUMN IF NOT EXISTS request_key text;
ALTER TABLE public.wellness_treatment_requests ADD COLUMN IF NOT EXISTS closure_report text;
ALTER TABLE public.wellness_treatment_requests DROP CONSTRAINT IF EXISTS wellness_treatment_requests_risk_tier_check;
ALTER TABLE public.wellness_treatment_requests ADD CONSTRAINT wellness_treatment_requests_risk_tier_check CHECK(risk_tier BETWEEN 0 AND 4);
CREATE UNIQUE INDEX IF NOT EXISTS wellness_request_retry_uq ON public.wellness_treatment_requests(tenant_id,requested_by,request_key,enrollment_id) WHERE request_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.wellness_treatment_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 request_id uuid NOT NULL REFERENCES public.wellness_treatment_requests(id),
 session_no integer NOT NULL CHECK(session_no>0), scheduled_at timestamptz NOT NULL,
 assigned_to uuid NOT NULL, status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','reported','cancelled')),
 attendance text CHECK(attendance IN ('present','late','absent','excused')),
 adherence text CHECK(adherence IN ('followed','partial','not_followed','not_assessed')),
 report text, follow_up text, reported_by uuid, reported_at timestamptz,
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(request_id,session_no)
);
CREATE TABLE IF NOT EXISTS public.wellness_result_providers (
 program_id uuid NOT NULL REFERENCES public.wellness_programs(id), user_id uuid NOT NULL,
 tenant_id uuid NOT NULL, active boolean NOT NULL DEFAULT true,
 granted_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(program_id,user_id)
);
ALTER TABLE public.wellness_treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_treatment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_result_providers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wellness_treatment_sessions,public.wellness_result_providers FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wellness_treatment_sessions,public.wellness_result_providers TO service_role;

CREATE OR REPLACE FUNCTION public.wellness_processing_allowed(p_enrollment uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM wellness_enrollments e WHERE e.id=p_enrollment AND e.status='active'
 AND (e.consent_status='not_required' OR (e.consent_status='granted' AND e.consent_notice_version='wellness-privacy-v2')))
$$;

CREATE OR REPLACE FUNCTION public.wellness_accept_consent(p_program_id uuid,p_notice_version text,p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user(); e wellness_enrollments%ROWTYPE;
BEGIN
 IF p_accept IS DISTINCT FROM true THEN RAISE EXCEPTION 'Persetujuan harus diberikan secara eksplisit.'; END IF;
 IF p_notice_version IS DISTINCT FROM 'wellness-privacy-v2' THEN RAISE EXCEPTION 'Muat ulang pemberitahuan persetujuan terbaru.'; END IF;
 SELECT * INTO e FROM wellness_enrollments WHERE program_id=p_program_id AND auth_user_id=u
 AND tenant_id=wellness_actor_tenant() AND status IN ('invited','active','paused') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment tidak ditemukan.'; END IF;
 UPDATE wellness_enrollments SET consent_status='granted',consent_notice_version=p_notice_version,consented_at=now(),
 status=CASE WHEN status='invited' THEN 'active' ELSE status END,updated_at=now() WHERE id=e.id;
 INSERT INTO wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id,detail)
 VALUES(e.tenant_id,e.program_id,u,'GRANT_CONSENT','enrollment',e.id::text,jsonb_build_object('notice_version',p_notice_version));
 RETURN jsonb_build_object('ok',true,'consent_status','granted');
END $$;

CREATE OR REPLACE FUNCTION public.wellness_withdraw_consent(p_program_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user(); e wellness_enrollments%ROWTYPE;
BEGIN
 SELECT * INTO e FROM wellness_enrollments WHERE program_id=p_program_id AND auth_user_id=u AND tenant_id=wellness_actor_tenant() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment tidak ditemukan.'; END IF;
 UPDATE wellness_enrollments SET consent_status='withdrawn',status='withdrawn',updated_at=now() WHERE id=e.id;
 UPDATE wellness_treatment_sessions SET status='cancelled' WHERE status='scheduled' AND request_id IN
 (SELECT id FROM wellness_treatment_requests WHERE enrollment_id=e.id);
 UPDATE wellness_treatment_requests SET status='cancelled',closure_report='Persetujuan peserta ditarik.',updated_at=now()
 WHERE enrollment_id=e.id AND status NOT IN ('completed','cancelled');
 UPDATE wellness_tasks SET status='cancelled' WHERE enrollment_id=e.id AND status IN ('open','sent');
 INSERT INTO wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id)
 VALUES(e.tenant_id,e.program_id,u,'WITHDRAW_CONSENT','enrollment',e.id::text);
 RETURN jsonb_build_object('ok',true);
END $$;

-- One current snapshot is shared by lists, dashboard counts and request-time tier.
-- Preserve existing operational BP/fasting thresholds; other glucose contexts require review.
-- This is a program label, not a diagnosis. Rejected/superseded readings never drive it.
CREATE OR REPLACE VIEW public.wellness_current_participants AS
SELECT e.id AS enrollment_id,e.program_id,e.tenant_id,e.corporate_id,e.auth_user_id,e.status AS enrollment_status,
 e.consent_status,e.consent_notice_version,wellness_processing_allowed(e.id) AS processing_allowed,
 COALESCE(emp.full_name,emp.employee_id,'Peserta') AS participant_name,emp.employee_id AS employee_code,
 CASE WHEN s.sys IS NULL AND s.dia IS NULL AND (g.measurement_context IS DISTINCT FROM 'fasting' OR g.value IS NULL) THEN 0
 WHEN s.sys>=160 OR s.dia>=100 OR (g.measurement_context='fasting' AND g.value>=200) THEN 4
 WHEN s.sys>=140 OR s.dia>=90 OR (g.measurement_context='fasting' AND g.value>=126) THEN 3
 WHEN s.sys>=120 OR s.dia>=80 OR (g.measurement_context='fasting' AND g.value>=100) THEN 2 ELSE 1 END AS risk_tier,
 s.sys,s.dia,s.measured_at AS bp_at,s.source AS bp_source,s.verification_status AS bp_verification,
 g.value AS glu,g.measured_at AS glu_at,g.measurement_context AS glucose_context,g.source AS glucose_source,g.verification_status AS glucose_verification,
 'operational-v1'::text AS risk_rule_version,
 (g.value IS NOT NULL AND g.measurement_context IS DISTINCT FROM 'fasting') AS glucose_needs_review
FROM wellness_enrollments e LEFT JOIN corporate_employees emp ON emp.id=e.corporate_employee_id
LEFT JOIN LATERAL (
 SELECT a.value AS sys,b.value AS dia,a.measured_at,a.source,a.verification_status
 FROM wellness_observations a JOIN wellness_observations b ON b.enrollment_id=a.enrollment_id AND b.group_id=a.group_id AND b.code='blood_pressure_diastolic'
 WHERE a.enrollment_id=e.id AND a.code='blood_pressure_systolic' AND a.measured_at<=now()
 AND a.verification_status IN ('unverified','verified') AND b.verification_status IN ('unverified','verified')
 AND NOT EXISTS(SELECT 1 FROM wellness_observations n WHERE n.amended_from_id IN (a.id,b.id) AND n.verification_status<>'rejected')
 ORDER BY a.measured_at DESC,a.received_at DESC,a.id DESC LIMIT 1
) s ON true
LEFT JOIN LATERAL (
 SELECT o.* FROM wellness_observations o WHERE o.enrollment_id=e.id AND o.code='blood_glucose' AND o.measured_at<=now()
 AND o.verification_status IN ('unverified','verified')
 AND NOT EXISTS(SELECT 1 FROM wellness_observations n WHERE n.amended_from_id=o.id AND n.verification_status<>'rejected')
 ORDER BY o.measured_at DESC,o.received_at DESC,o.id DESC LIMIT 1
) g ON true;
REVOKE ALL ON public.wellness_current_participants FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.wellness_can_manage_program(p_program uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM wellness_programs p JOIN user_profiles u ON u.id=auth.uid()
 WHERE p.id=p_program AND p.tenant_id=u.tenant_id
 AND (wellness_actor_internal() OR (lower(u.role)='corporate' AND u.corporate_id=p.corporate_id)))
$$;

CREATE OR REPLACE FUNCTION public.wellness_hrd_participant_tier_list(p_program_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user();
BEGIN
 IF p_program_id IS NULL OR NOT wellness_can_manage_program(p_program_id) THEN RAISE EXCEPTION 'Akses program ditolak.'; END IF;
 RETURN jsonb_build_object('tiers',COALESCE((SELECT jsonb_agg(
 jsonb_build_object('enrollment_id',s.enrollment_id,'program_id',s.program_id,'participant_name',s.participant_name,
 'employee_code',s.employee_code,'enrollment_status',s.enrollment_status,'consent_status',s.consent_status,
 'processing_allowed',s.processing_allowed,'risk_tier',CASE WHEN s.processing_allowed THEN s.risk_tier END,
 'sys',CASE WHEN s.processing_allowed THEN s.sys END,'dia',CASE WHEN s.processing_allowed THEN s.dia END,
 'glu',CASE WHEN s.processing_allowed THEN s.glu END,'bp_at',CASE WHEN s.processing_allowed THEN s.bp_at END,
 'glu_at',CASE WHEN s.processing_allowed THEN s.glu_at END,'glucose_context',CASE WHEN s.processing_allowed THEN s.glucose_context END,
 'bp_verification',CASE WHEN s.processing_allowed THEN s.bp_verification END,'glucose_verification',CASE WHEN s.processing_allowed THEN s.glucose_verification END,
 'bp_source',CASE WHEN s.processing_allowed THEN s.bp_source END,'glucose_source',CASE WHEN s.processing_allowed THEN s.glucose_source END,
 'glucose_needs_review',CASE WHEN s.processing_allowed THEN s.glucose_needs_review END,'risk_rule_version',s.risk_rule_version)
 ORDER BY s.participant_name) FROM wellness_current_participants s WHERE s.program_id=p_program_id),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.wellness_participant_detail(p_enrollment_id uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user(); e wellness_enrollments%ROWTYPE; own boolean;
BEGIN
 SELECT * INTO e FROM wellness_enrollments WHERE id=p_enrollment_id AND tenant_id=wellness_actor_tenant();
 IF NOT FOUND THEN RAISE EXCEPTION 'Peserta tidak ditemukan.'; END IF;
 own:=e.auth_user_id=u;
 IF NOT COALESCE(own,false) AND (NOT wellness_can_manage_program(e.program_id) OR NOT wellness_processing_allowed(e.id)) THEN
 RAISE EXCEPTION 'Akses riwayat ditolak atau persetujuan terbaru diperlukan.'; END IF;
 RETURN jsonb_build_object('observations',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM
 (SELECT id,code,value,unit,measurement_context,measured_at,source,verification_status,note FROM wellness_observations
 WHERE enrollment_id=e.id ORDER BY measured_at DESC,received_at DESC,id DESC LIMIT 100 OFFSET greatest(0,p_offset)) x),'[]'::jsonb),
 'total', (SELECT count(*) FROM wellness_observations WHERE enrollment_id=e.id),
 'requests',COALESCE((SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('sessions',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY session_no)
 FROM wellness_treatment_sessions s WHERE s.request_id=t.id),'[]'::jsonb)) ORDER BY t.created_at DESC)
 FROM wellness_treatment_requests t WHERE t.enrollment_id=e.id),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.wellness_request_treatment(p_program_id uuid,p_enrollment_ids uuid[],p_treatment_type text,
 p_treatment_label text,p_notes text DEFAULT NULL,p_scheduled_at timestamptz DEFAULT NULL,p_request_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user(); eid uuid; e wellness_enrollments%ROWTYPE; tier integer; k text; inserted integer:=0; n integer;
BEGIN
 IF NOT wellness_can_manage_program(p_program_id) THEN RAISE EXCEPTION 'Akses request treatment ditolak.'; END IF;
 IF COALESCE(cardinality(p_enrollment_ids),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Pilih 1–500 peserta.'; END IF;
 IF length(btrim(COALESCE(p_treatment_label,''))) NOT BETWEEN 1 AND 200 OR length(COALESCE(p_notes,''))>4000 THEN RAISE EXCEPTION 'Label atau catatan tidak valid.'; END IF;
 IF p_treatment_type IS NULL OR p_treatment_type NOT IN ('konsultasi_dokter','followup_ihc','program_diet','program_olahraga','monitoring_ketat','psikologis','rehab_gaya_hidup','tindak_darurat') THEN RAISE EXCEPTION 'Jenis treatment tidak valid.'; END IF;
 k:=COALESCE(NULLIF(p_request_key,''),md5(jsonb_build_array(p_program_id,p_treatment_type,p_treatment_label,p_notes,p_scheduled_at)::text));
 IF length(k)>200 THEN RAISE EXCEPTION 'Request key terlalu panjang.'; END IF;
 FOR eid IN SELECT DISTINCT unnest(p_enrollment_ids) ORDER BY 1 LOOP
  SELECT * INTO e FROM wellness_enrollments WHERE id=eid AND program_id=p_program_id AND tenant_id=wellness_actor_tenant() FOR UPDATE;
  IF NOT FOUND OR NOT wellness_processing_allowed(eid) THEN RAISE EXCEPTION 'Peserta tidak aktif atau persetujuan terbaru belum tersedia.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM wellness_programs WHERE id=p_program_id AND status IN ('pilot','active')) THEN RAISE EXCEPTION 'Program belum aktif.'; END IF;
  SELECT risk_tier INTO tier FROM wellness_current_participants WHERE enrollment_id=eid;
  INSERT INTO wellness_treatment_requests(tenant_id,program_id,enrollment_id,corporate_id,requested_by,risk_tier,treatment_type,treatment_label,notes,scheduled_at,request_key)
  VALUES(e.tenant_id,e.program_id,e.id,e.corporate_id,u,COALESCE(tier,0),p_treatment_type,btrim(p_treatment_label),p_notes,p_scheduled_at,k)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; inserted:=inserted+n;
 END LOOP;
 IF inserted>0 THEN
 INSERT INTO wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,detail)
 VALUES(wellness_actor_tenant(),p_program_id,u,'REQUEST_TREATMENT','treatment_request',jsonb_build_object('request_key',k,'inserted',inserted)); END IF;
 RETURN jsonb_build_object('ok',true,'assigned_count',inserted,'duplicate',inserted=0);
END $$;

-- Keep the old API safe while old clients drain from caches.
CREATE OR REPLACE FUNCTION public.wellness_hrd_assign_treatment(p_program_id uuid,p_enrollment_ids uuid[],p_treatment_type text,
 p_treatment_label text,p_notes text DEFAULT NULL,p_scheduled_at timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT wellness_request_treatment(p_program_id,p_enrollment_ids,p_treatment_type,p_treatment_label,p_notes,p_scheduled_at,NULL)
$$;

CREATE OR REPLACE FUNCTION public.wellness_manage_treatment(p_request_id uuid,p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user(); t wellness_treatment_requests%ROWTYPE; s wellness_treatment_sessions%ROWTYPE;
 assigned uuid; when_at timestamptz; number integer; sid uuid; report_text text;
BEGIN
 IF NOT wellness_actor_internal() THEN RAISE EXCEPTION 'Pelaksanaan treatment hanya oleh admin HIS.'; END IF;
 SELECT * INTO t FROM wellness_treatment_requests WHERE id=p_request_id AND tenant_id=wellness_actor_tenant() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Treatment tidak ditemukan.'; END IF;
 IF t.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Treatment sudah ditutup.'; END IF;
 IF p_action<>'cancel' AND NOT wellness_processing_allowed(t.enrollment_id) THEN RAISE EXCEPTION 'Peserta tidak aktif atau persetujuan terbaru diperlukan.'; END IF;
 IF p_action='accept' THEN
  IF t.status<>'pending' THEN RAISE EXCEPTION 'Hanya request pending dapat diterima.'; END IF;
  UPDATE wellness_treatment_requests SET status='accepted',updated_at=now() WHERE id=t.id;
 ELSIF p_action='schedule' THEN
  IF t.status NOT IN ('accepted','in_progress') THEN RAISE EXCEPTION 'Terima request terlebih dahulu.'; END IF;
  assigned:=(p_payload->>'assigned_to')::uuid; when_at:=(p_payload->>'scheduled_at')::timestamptz;
  number:=(p_payload->>'session_no')::integer;
  IF when_at IS NULL OR number IS NULL OR number<1 THEN RAISE EXCEPTION 'Jadwal dan nomor sesi wajib diisi.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=assigned AND tenant_id=t.tenant_id AND lower(role) IN ('super_admin','admin','admin_faskes','head_operation','direktur','manager','spv','tech')) THEN RAISE EXCEPTION 'Pelaksana harus admin dalam tenant yang sama.'; END IF;
  SELECT * INTO s FROM wellness_treatment_sessions WHERE request_id=t.id AND session_no=number;
  IF FOUND THEN
   IF s.scheduled_at=when_at AND s.assigned_to=assigned THEN RETURN jsonb_build_object('ok',true,'duplicate',true); END IF;
   RAISE EXCEPTION 'Nomor sesi sudah digunakan; gunakan ubah jadwal.';
  END IF;
  INSERT INTO wellness_treatment_sessions(tenant_id,request_id,session_no,scheduled_at,assigned_to,created_by)
  VALUES(t.tenant_id,t.id,number,when_at,assigned,u) ON CONFLICT(request_id,session_no) DO NOTHING;
 ELSIF p_action IN ('reschedule','cancel_session') THEN
  sid:=(p_payload->>'session_id')::uuid;
  SELECT * INTO s FROM wellness_treatment_sessions WHERE id=sid AND request_id=t.id FOR UPDATE;
  IF NOT FOUND OR s.status<>'scheduled' THEN RAISE EXCEPTION 'Hanya sesi terjadwal dapat diubah.'; END IF;
  report_text:=btrim(COALESCE(p_payload->>'report',''));
  IF length(report_text) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Alasan perubahan wajib diisi.'; END IF;
  IF p_action='reschedule' THEN
   when_at:=(p_payload->>'scheduled_at')::timestamptz;
   IF when_at IS NULL THEN RAISE EXCEPTION 'Jadwal baru wajib diisi.'; END IF;
   UPDATE wellness_treatment_sessions SET scheduled_at=when_at WHERE id=sid;
  ELSE UPDATE wellness_treatment_sessions SET status='cancelled',report=report_text,reported_by=u,reported_at=now() WHERE id=sid; END IF;
 ELSIF p_action='report' THEN
  sid:=(p_payload->>'session_id')::uuid;
  SELECT * INTO s FROM wellness_treatment_sessions WHERE id=sid AND request_id=t.id FOR UPDATE;
  IF NOT FOUND OR s.status<>'scheduled' THEN RAISE EXCEPTION 'Sesi tidak tersedia atau sudah dilaporkan.'; END IF;
  IF s.scheduled_at>now() THEN RAISE EXCEPTION 'Sesi belum berlangsung.'; END IF;
  report_text:=btrim(COALESCE(p_payload->>'report',''));
  IF length(report_text) NOT BETWEEN 1 AND 4000 OR length(COALESCE(p_payload->>'follow_up',''))>4000 THEN RAISE EXCEPTION 'Laporan wajib diisi, maksimal 4000 karakter.'; END IF;
  IF p_payload->>'attendance' IS NULL OR p_payload->>'attendance' NOT IN ('present','late','absent','excused') OR p_payload->>'adherence' IS NULL OR p_payload->>'adherence' NOT IN ('followed','partial','not_followed','not_assessed') THEN RAISE EXCEPTION 'Kehadiran dan kedisiplinan wajib diisi.'; END IF;
  IF p_payload->>'attendance' IN ('absent','excused') AND p_payload->>'adherence'<>'not_assessed' THEN RAISE EXCEPTION 'Peserta tidak hadir: kedisiplinan treatment belum dapat dinilai.'; END IF;
  UPDATE wellness_treatment_sessions SET status='reported',attendance=p_payload->>'attendance',adherence=p_payload->>'adherence',report=report_text,
  follow_up=p_payload->>'follow_up',reported_by=u,reported_at=now() WHERE id=sid;
  UPDATE wellness_treatment_requests SET status='in_progress',updated_at=now() WHERE id=t.id;
 ELSIF p_action IN ('complete','cancel') THEN
  report_text:=btrim(COALESCE(p_payload->>'report',''));
  IF length(report_text) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Kesimpulan atau alasan penutupan wajib diisi.'; END IF;
  IF p_action='complete' AND (NOT EXISTS(SELECT 1 FROM wellness_treatment_sessions WHERE request_id=t.id AND status='reported')
   OR EXISTS(SELECT 1 FROM wellness_treatment_sessions WHERE request_id=t.id AND status='scheduled')) THEN RAISE EXCEPTION 'Laporkan seluruh sesi sebelum menyelesaikan treatment.'; END IF;
  IF p_action='cancel' THEN UPDATE wellness_treatment_sessions SET status='cancelled' WHERE request_id=t.id AND status='scheduled'; END IF;
  UPDATE wellness_treatment_requests SET status=CASE WHEN p_action='complete' THEN 'completed' ELSE 'cancelled' END,
  closure_report=report_text,completed_at=CASE WHEN p_action='complete' THEN now() END,updated_at=now() WHERE id=t.id;
 ELSE RAISE EXCEPTION 'Aksi tidak valid.'; END IF;
 INSERT INTO wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id,detail)
 VALUES(t.tenant_id,t.program_id,u,'TREATMENT_'||upper(p_action),'treatment_request',t.id::text,p_payload);
 RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.wellness_program_workspace(p_program_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user(); result jsonb;
BEGIN
 IF NOT wellness_can_manage_program(p_program_id) THEN RAISE EXCEPTION 'Akses program ditolak.'; END IF;
 result:=wellness_hrd_participant_tier_list(p_program_id);
 RETURN result||jsonb_build_object('can_execute',wellness_actor_internal(),
 'requests',COALESCE((SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('participant_name',s.participant_name,
 'sessions',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY session_no) FROM wellness_treatment_sessions x WHERE x.request_id=t.id),'[]'::jsonb)) ORDER BY t.created_at DESC)
 FROM wellness_treatment_requests t JOIN wellness_current_participants s ON s.enrollment_id=t.enrollment_id
 WHERE t.program_id=p_program_id AND (s.processing_allowed OR wellness_actor_internal())),'[]'::jsonb),
 'staff',CASE WHEN wellness_actor_internal() THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',COALESCE(to_jsonb(p)->>'full_name',id::text)))
 FROM user_profiles p WHERE tenant_id=wellness_actor_tenant() AND lower(role) IN ('super_admin','admin','admin_faskes','head_operation','direktur','manager','spv','tech')),'[]'::jsonb) ELSE '[]'::jsonb END,
 'providers',CASE WHEN wellness_actor_internal() THEN COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM wellness_result_providers p WHERE program_id=p_program_id),'[]'::jsonb) ELSE '[]'::jsonb END);
END $$;

CREATE OR REPLACE FUNCTION public.wellness_set_result_provider(p_program_id uuid,p_user_id uuid,p_active boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user();
BEGIN
 IF NOT wellness_actor_internal() OR NOT wellness_can_manage_program(p_program_id) THEN RAISE EXCEPTION 'Akses admin HIS diperlukan.'; END IF;
 IF p_active IS NULL OR NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=p_user_id AND tenant_id=wellness_actor_tenant() AND lower(role)='ihc') THEN RAISE EXCEPTION 'Akun pemasok harus berperan ihc dalam tenant yang sama.'; END IF;
 INSERT INTO wellness_result_providers(program_id,user_id,tenant_id,active,granted_by) VALUES(p_program_id,p_user_id,wellness_actor_tenant(),p_active,u)
 ON CONFLICT(program_id,user_id) DO UPDATE SET active=EXCLUDED.active,granted_by=u,updated_at=now();
 INSERT INTO wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id,detail)
 VALUES(wellness_actor_tenant(),p_program_id,u,'SET_RESULT_PROVIDER','provider',p_user_id::text,jsonb_build_object('active',p_active));
 RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.wellness_can_import(p_program_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM wellness_programs p WHERE p.id=p_program_id AND p.tenant_id=wellness_actor_tenant()
 AND p.status IN ('active','pilot') AND (wellness_actor_internal() OR EXISTS(
 SELECT 1 FROM wellness_result_providers a JOIN user_profiles u ON u.id=a.user_id WHERE a.program_id=p.id AND a.user_id=auth.uid()
 AND a.tenant_id=p.tenant_id AND u.tenant_id=p.tenant_id AND lower(u.role)='ihc' AND a.active)))
$$;
CREATE OR REPLACE FUNCTION public.wellness_import_dashboard() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user();
BEGIN
 RETURN jsonb_build_object('programs',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code)) FROM wellness_programs WHERE wellness_can_import(id)),'[]'::jsonb),
 'imports',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,source_file,status,total_rows,accepted_rows,rejected_rows,created_at
 FROM wellness_import_batches WHERE wellness_can_import(program_id) AND (created_by=u OR wellness_actor_internal()) ORDER BY created_at DESC LIMIT 50) x),'[]'::jsonb));
END $$;

-- Fix auto-link: identity comes from verified auth email, never client-editable profile email.
CREATE OR REPLACE FUNCTION public.wellness_auto_link_user_enrollments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE wellness_enrollments e SET auth_user_id=NEW.id,updated_at=now()
 FROM corporate_employees emp,auth.users a WHERE a.id=NEW.id AND a.email_confirmed_at IS NOT NULL
 AND emp.id=e.corporate_employee_id AND lower(btrim(emp.email))=lower(btrim(a.email))
 AND e.tenant_id=NEW.tenant_id AND e.auth_user_id IS NULL;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wellness_auto_link_user ON public.user_profiles;
CREATE TRIGGER trg_wellness_auto_link_user AFTER INSERT OR UPDATE OF tenant_id ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION wellness_auto_link_user_enrollments();

-- Public helpers are not APIs; all client access goes through scoped RPCs.
REVOKE ALL ON FUNCTION wellness_processing_allowed(uuid),wellness_can_manage_program(uuid),wellness_can_import(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION wellness_withdraw_consent(uuid),wellness_participant_detail(uuid,integer),wellness_request_treatment(uuid,uuid[],text,text,text,timestamptz,text),
 wellness_manage_treatment(uuid,text,jsonb),wellness_program_workspace(uuid),wellness_set_result_provider(uuid,uuid,boolean),wellness_import_dashboard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION wellness_withdraw_consent(uuid),wellness_participant_detail(uuid,integer),wellness_request_treatment(uuid,uuid[],text,text,text,timestamptz,text),
 wellness_manage_treatment(uuid,text,jsonb),wellness_program_workspace(uuid),wellness_set_result_provider(uuid,uuid,boolean),wellness_import_dashboard() TO authenticated;
CREATE OR REPLACE FUNCTION public.wellness_import_ihc(
  p_program_id uuid, p_source_file text, p_checksum text, p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid; v_tenant uuid; v_program record; v_batch uuid; v_existing record;
  v_row jsonb; v_idx integer:=0; v_employee record; v_enroll record; v_client text; v_group uuid;
  v_sys numeric; v_dia numeric; v_pulse numeric; v_glucose numeric; v_hba1c numeric; v_time timestamptz; v_context text;
  v_accepted integer:=0; v_rejected integer:=0; v_errors jsonb:='[]'::jsonb;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_can_import(p_program_id) THEN RAISE EXCEPTION 'Akses impor IHC diperlukan.'; END IF;
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)=0 OR jsonb_array_length(p_rows)>5000 THEN
    RAISE EXCEPTION 'Batch harus berisi 1–5000 baris.';
  END IF;
  SELECT * INTO v_program FROM public.wellness_programs WHERE id=p_program_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program tidak ditemukan.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_program_id::text || COALESCE(p_checksum,''),0));
  SELECT * INTO v_existing FROM public.wellness_import_batches
    WHERE tenant_id=v_tenant AND program_id=p_program_id AND checksum=p_checksum;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'batch_id',v_existing.id,
    'accepted_rows',v_existing.accepted_rows,'rejected_rows',v_existing.rejected_rows,'errors',v_existing.error_details); END IF;
  INSERT INTO public.wellness_import_batches
    (tenant_id,program_id,corporate_id,source_file,checksum,total_rows,created_by)
  VALUES(v_tenant,p_program_id,v_program.corporate_id,NULLIF(btrim(p_source_file),''),btrim(p_checksum),jsonb_array_length(p_rows),v_uid)
  RETURNING id INTO v_batch;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_idx:=v_idx+1;
    BEGIN
      SELECT * INTO STRICT v_employee FROM public.corporate_employees
       WHERE corporate_id=v_program.corporate_id AND employee_id=btrim(v_row->>'employee_id') LIMIT 1;
      SELECT * INTO STRICT v_enroll FROM public.wellness_enrollments
       WHERE program_id=p_program_id AND corporate_employee_id=v_employee.id AND status='active' LIMIT 1;
      v_time:=NULLIF(v_row->>'measured_at','')::timestamptz;
      IF v_time IS NULL OR v_time>now()+interval '5 minutes' OR v_time<now()-interval '2 years' THEN RAISE EXCEPTION 'measured_at tidak valid'; END IF;
      v_client:=COALESCE(NULLIF(btrim(v_row->>'external_id'),''),p_checksum||':'||v_idx::text); v_group:=gen_random_uuid();
      v_sys:=NULLIF(v_row->>'systolic','')::numeric; v_dia:=NULLIF(v_row->>'diastolic','')::numeric;
      v_pulse:=NULLIF(v_row->>'pulse','')::numeric; v_glucose:=NULLIF(v_row->>'glucose','')::numeric;
      v_hba1c:=NULLIF(v_row->>'hba1c','')::numeric;
      v_context:=COALESCE(NULLIF(v_row->>'glucose_context',''),'random');
      IF v_sys IS NULL AND v_dia IS NULL AND v_glucose IS NULL AND v_hba1c IS NULL THEN RAISE EXCEPTION 'tidak ada nilai pemeriksaan'; END IF;
      IF (v_sys IS NULL)<>(v_dia IS NULL) THEN RAISE EXCEPTION 'sistolik dan diastolik harus berpasangan'; END IF;
      IF v_sys IS NOT NULL THEN
        IF v_sys NOT BETWEEN 40 AND 300 OR v_dia NOT BETWEEN 30 AND 200 OR v_dia>=v_sys THEN RAISE EXCEPTION 'tekanan darah tidak valid'; END IF;
        INSERT INTO public.wellness_observations
          (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,code,value,unit,
           measurement_context,measured_at,source,verification_status,device_method,import_batch_id,client_record_id,created_by)
        VALUES
          (v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'blood_pressure_systolic',v_sys,'mmHg','ihc',v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid),
          (v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'blood_pressure_diastolic',v_dia,'mmHg','ihc',v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid)
        ON CONFLICT DO NOTHING;
        IF v_pulse IS NOT NULL THEN
          IF v_pulse NOT BETWEEN 20 AND 250 THEN RAISE EXCEPTION 'denyut tidak valid'; END IF;
          INSERT INTO public.wellness_observations
            (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,code,value,unit,
             measurement_context,measured_at,source,verification_status,device_method,import_batch_id,client_record_id,created_by)
          VALUES(v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'pulse_rate',v_pulse,'bpm','ihc',v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
      IF v_glucose IS NOT NULL THEN
        IF v_glucose NOT BETWEEN 20 AND 600 THEN RAISE EXCEPTION 'gula darah tidak valid'; END IF;
        IF v_context NOT IN ('fasting','random','postprandial','before_meal','before_sleep') THEN RAISE EXCEPTION 'konteks gula darah tidak valid'; END IF;
        INSERT INTO public.wellness_observations
          (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,code,value,unit,
           measurement_context,measured_at,source,verification_status,device_method,import_batch_id,client_record_id,created_by)
        VALUES(v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'blood_glucose',v_glucose,'mg/dL',
          v_context,v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid)
        ON CONFLICT DO NOTHING;
      END IF;
      IF v_hba1c IS NOT NULL THEN
        IF v_hba1c NOT BETWEEN 2 AND 25 THEN RAISE EXCEPTION 'HbA1c tidak valid'; END IF;
        INSERT INTO public.wellness_observations
          (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,code,value,unit,
           measurement_context,measured_at,source,verification_status,device_method,import_batch_id,client_record_id,created_by)
        VALUES(v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'hba1c',v_hba1c,'%',
          'ihc',v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid)
        ON CONFLICT DO NOTHING;
      END IF;
      v_accepted:=v_accepted+1;
    EXCEPTION WHEN OTHERS THEN
      v_rejected:=v_rejected+1;
      v_errors:=v_errors||jsonb_build_array(jsonb_build_object('row',v_idx,'employee_id',v_row->>'employee_id','error',SQLERRM));
    END;
  END LOOP;
  UPDATE public.wellness_import_batches SET accepted_rows=v_accepted,rejected_rows=v_rejected,error_details=v_errors,
    status=CASE WHEN v_rejected=0 THEN 'completed' WHEN v_accepted=0 THEN 'failed' ELSE 'completed_with_errors' END,completed_at=now()
  WHERE id=v_batch;
  INSERT INTO public.wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id,detail)
  VALUES(v_tenant,p_program_id,v_uid,'IMPORT_IHC','import_batch',v_batch::text,jsonb_build_object('accepted',v_accepted,'rejected',v_rejected));
  RETURN jsonb_build_object('ok',true,'batch_id',v_batch,'accepted_rows',v_accepted,'rejected_rows',v_rejected,'errors',v_errors);
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_personal_dashboard()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid;
BEGIN
  v_uid := public.wellness_require_user();
  v_tenant := public.wellness_actor_tenant();
  RETURN jsonb_build_object(
    'programs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'code',p.code,'name',p.name,'description',p.description,
        'focus',p.focus,'starts_on',p.starts_on,'ends_on',p.ends_on,'status',p.status,
        'measurement_plan',p.measurement_plan,'reporting_plan',p.reporting_plan,
        'enrollment_id',e.id,'enrollment_status',e.status,'consent_status',e.consent_status,'consent_notice_version',e.consent_notice_version,'processing_allowed',public.wellness_processing_allowed(e.id)
      ) ORDER BY p.starts_on DESC)
      FROM public.wellness_enrollments e
      JOIN public.wellness_programs p ON p.id=e.program_id
      WHERE e.tenant_id=v_tenant AND e.auth_user_id=v_uid AND e.status IN ('invited','active','paused','completed','withdrawn')
    ), '[]'::jsonb),
    'observations', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.measured_at DESC)
      FROM (
        SELECT o.id,o.program_id,o.group_id,o.code,o.value,o.unit,o.measurement_context,
               o.measured_at,o.received_at,o.source,o.verification_status,o.device_method,o.note
          FROM public.wellness_observations o
         WHERE o.tenant_id=v_tenant AND o.subject_user_id=v_uid
         ORDER BY o.measured_at DESC LIMIT 250
      ) x
    ), '[]'::jsonb),
    'open_tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',t.id,'program_id',t.program_id,'task_type',t.task_type,'due_at',t.due_at,
        'status',t.status,'audience',t.audience,'payload',t.payload
      ) ORDER BY t.due_at)
      FROM public.wellness_tasks t
      JOIN public.wellness_enrollments e ON e.id=t.enrollment_id
      WHERE t.tenant_id=v_tenant AND e.auth_user_id=v_uid AND t.audience='participant' AND t.status IN ('open','sent')
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_enforce_observation_consent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_consent text;
BEGIN
  SELECT e.consent_status INTO v_consent
    FROM public.wellness_enrollments e
   WHERE e.id = NEW.enrollment_id
     AND e.tenant_id = NEW.tenant_id
     AND e.program_id = NEW.program_id
     AND e.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment aktif tidak ditemukan untuk pencatatan wellness.';
  END IF;
  IF NOT public.wellness_processing_allowed(NEW.enrollment_id) THEN
    RAISE EXCEPTION 'Persetujuan peserta belum diberikan untuk program ini.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.wellness_corporate_dashboard(p_program_id uuid DEFAULT NULL,p_corporate_id bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=wellness_require_user();
BEGIN
 IF NOT wellness_actor_internal() AND NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=u AND lower(role)='corporate') THEN RAISE EXCEPTION 'Akses monitoring corporate diperlukan.'; END IF;
 RETURN jsonb_build_object('privacy_mode','authorized_employee_detail','programs',COALESCE((
 SELECT jsonb_agg(to_jsonb(x)) FROM (
 SELECT p.id,p.name,p.code,p.status,p.starts_on,p.ends_on,
 count(s.enrollment_id)::integer AS enrolled,
 count(s.auth_user_id)::integer AS linked_accounts,
 count(*) FILTER(WHERE s.processing_allowed AND s.risk_tier>0)::integer AS screened_count,
 count(*) FILTER(WHERE s.processing_allowed AND s.risk_tier=1)::integer AS risk_l1_count,
 count(*) FILTER(WHERE s.processing_allowed AND s.risk_tier=2)::integer AS risk_l2_count,
 count(*) FILTER(WHERE s.processing_allowed AND s.risk_tier=3)::integer AS risk_l3_count,
 count(*) FILTER(WHERE s.processing_allowed AND s.risk_tier=4)::integer AS risk_l4_count,
 count(*) FILTER(WHERE s.processing_allowed AND s.risk_tier=0)::integer AS unscreened_count,
 count(*) FILTER(WHERE NOT s.processing_allowed)::integer AS consent_pending_count
 FROM wellness_programs p LEFT JOIN wellness_current_participants s ON s.program_id=p.id
 WHERE wellness_can_manage_program(p.id) AND (p_program_id IS NULL OR p.id=p_program_id)
 AND (p_corporate_id IS NULL OR p.corporate_id=p_corporate_id)
 GROUP BY p.id ORDER BY p.starts_on DESC) x),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION public.wellness_admin_enroll_roster(p_program_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid; v_program record; v_added integer:=0; v_linked integer:=0;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN RAISE EXCEPTION 'Akses admin wellness diperlukan.'; END IF;
  SELECT * INTO v_program FROM public.wellness_programs WHERE id=p_program_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program tidak ditemukan.'; END IF;
  INSERT INTO public.wellness_enrollments
    (tenant_id,program_id,corporate_id,corporate_employee_id,auth_user_id,status,consent_status,activated_at,created_by)
  SELECT v_tenant,v_program.id,v_program.corporate_id,e.id,
         (SELECT u.id FROM auth.users u JOIN user_profiles up ON up.id=u.id WHERE lower(btrim(u.email))=lower(btrim(e.email)) AND u.email_confirmed_at IS NOT NULL AND up.tenant_id=v_tenant LIMIT 1),
         'active','pending',now(),v_uid
    FROM public.corporate_employees e
   WHERE e.corporate_id=v_program.corporate_id AND COALESCE(e.status,'')<>'Keluar'
  ON CONFLICT (program_id,corporate_employee_id) WHERE corporate_employee_id IS NOT NULL
  DO UPDATE SET auth_user_id=COALESCE(public.wellness_enrollments.auth_user_id,EXCLUDED.auth_user_id),updated_at=now();
  GET DIAGNOSTICS v_added=ROW_COUNT;
  SELECT count(*) INTO v_linked FROM public.wellness_enrollments WHERE program_id=p_program_id AND auth_user_id IS NOT NULL;
  INSERT INTO public.wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id,detail)
  VALUES(v_tenant,p_program_id,v_uid,'ENROLL_ROSTER','program',p_program_id::text,jsonb_build_object('affected',v_added,'linked_accounts',v_linked));
  RETURN jsonb_build_object('ok',true,'affected',v_added,'linked_accounts',v_linked);
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_generate_reminders(p_program_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid; v_count integer:=0;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN RAISE EXCEPTION 'Akses admin wellness diperlukan.'; END IF;
  INSERT INTO public.wellness_tasks
    (tenant_id,program_id,enrollment_id,reminder_rule_id,due_at,status,audience,payload,created_by)
  SELECT v_tenant,r.program_id,e.id,r.id,
         (current_date + r.send_time) AT TIME ZONE 'Asia/Jakarta','open','participant',
         jsonb_build_object('channel',r.channel,'message',r.message_template,'measurement_type',r.measurement_type),v_uid
    FROM public.wellness_reminder_rules r
    JOIN public.wellness_enrollments e
      ON e.program_id=r.program_id
     AND e.status='active'
     AND public.wellness_processing_allowed(e.id)
   WHERE r.tenant_id=v_tenant AND r.program_id=p_program_id AND r.is_active
     AND NOT EXISTS (
       SELECT 1 FROM public.wellness_observations o
        WHERE o.enrollment_id=e.id AND o.measured_at >= now()-(r.inactivity_days||' days')::interval
          AND (r.measurement_type='any'
            OR (r.measurement_type='blood_pressure' AND o.code='blood_pressure_systolic')
            OR (r.measurement_type='blood_glucose' AND o.code='blood_glucose'))
     )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'tasks_created',v_count);
END;
$$;
CREATE OR REPLACE FUNCTION public.wellness_admin_import_roster(p_program_id uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tenant uuid;
  v_program record;
  rec record;
  v_count integer := 0;
  v_full text;
  v_inserted integer;
  v_skipped integer := 0;
  v_emp_code text;
BEGIN
  v_uid := public.wellness_require_user();
  v_tenant := public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN
    RAISE EXCEPTION 'Akses admin wellness diperlukan.';
  END IF;

  SELECT * INTO v_program FROM public.wellness_programs WHERE id = p_program_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program tidak ditemukan.';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Roster harus berisi 1–5000 baris.'; END IF;

  FOR rec IN SELECT * FROM jsonb_to_recordset(p_rows) AS x(
    employee_id text, nik text, first_name text, last_name text, email text, department text, job_position text
  )
  LOOP
    IF rec.email IS NOT NULL AND btrim(rec.email) <> '' THEN
      v_full := btrim(COALESCE(rec.first_name,'') || ' ' || COALESCE(rec.last_name,''));
      IF v_full = '' THEN v_full := rec.email; END IF;
      v_emp_code := COALESCE(NULLIF(btrim(rec.employee_id),''), NULLIF(btrim(rec.nik),''));

      IF v_emp_code IS NULL THEN RAISE EXCEPTION 'Employee ID wajib diisi.'; END IF;
      INSERT INTO public.corporate_employees (corporate_id, employee_id, nik, full_name, email, department, job_position, status)
      VALUES (
        v_program.corporate_id,
        v_emp_code,
        COALESCE(NULLIF(btrim(rec.nik),''), v_emp_code),
        v_full,
        lower(btrim(rec.email)),
        rec.department,
        rec.job_position,
        'Aktif'
      )
      ON CONFLICT DO NOTHING;

      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_count := v_count + v_inserted;
      v_skipped := v_skipped + (1-v_inserted);
    ELSE RAISE EXCEPTION 'Email peserta wajib diisi.';
    END IF;
  END LOOP;

  PERFORM public.wellness_admin_enroll_roster(p_program_id);

  INSERT INTO wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,detail) VALUES(v_tenant,p_program_id,v_uid,'IMPORT_ROSTER','program',jsonb_build_object('inserted',v_count,'skipped',v_skipped));
  RETURN jsonb_build_object('ok', true, 'imported_rows', v_count, 'skipped_rows', v_skipped);
END;
$$;
COMMIT;
