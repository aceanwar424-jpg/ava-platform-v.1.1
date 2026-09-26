-- AVA TECH OPERATIONS TRANSITIONS v1
-- Server-side state transitions. Every mutation records actor/time/reason.

CREATE OR REPLACE FUNCTION public.tech_ops_open_incident(
  p_incident_no text, p_tenant uuid, p_severity text, p_title text,
  p_correlation_id text, p_impact text DEFAULT NULL, p_owner uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  IF p_tenant IS NOT NULL AND p_tenant IS DISTINCT FROM public.current_tenant_id() THEN RAISE EXCEPTION 'tenant context mismatch'; END IF;
  IF p_severity NOT IN ('P0','P1','P2','P3') THEN RAISE EXCEPTION 'severity tidak valid'; END IF;
  INSERT INTO public.tech_incidents(incident_no,tenant_id,severity,title,impact,owner_user_id,correlation_id,sla_ack_due_at,sla_restore_due_at)
  VALUES(trim(p_incident_no),p_tenant,p_severity,trim(p_title),p_impact,p_owner,trim(p_correlation_id),
    now()+CASE p_severity WHEN 'P0' THEN interval '15 minutes' WHEN 'P1' THEN interval '30 minutes' WHEN 'P2' THEN interval '4 hours' ELSE interval '1 day' END,
    now()+CASE p_severity WHEN 'P0' THEN interval '4 hours' WHEN 'P1' THEN interval '8 hours' WHEN 'P2' THEN interval '2 days' ELSE interval '5 days' END)
  RETURNING id INTO v_id;
  PERFORM public.tech_ops_record_event(p_tenant,'incident.opened',CASE WHEN p_severity IN ('P0','P1') THEN 'critical' ELSE 'warning' END,p_correlation_id,'tech-control-plane',jsonb_build_object('incident_id',v_id,'incident_no',p_incident_no));
  RETURN jsonb_build_object('ok',true,'incident_id',v_id,'incident_no',p_incident_no);
END $$;

CREATE OR REPLACE FUNCTION public.tech_ops_transition_incident(
  p_incident_id bigint, p_to_status text, p_reason text, p_actor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.tech_incidents; v_allowed boolean := false;
BEGIN
  SELECT * INTO v FROM public.tech_incidents WHERE id=p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'incident tidak ditemukan'; END IF;
  IF v.tenant_id IS NOT NULL AND v.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN RAISE EXCEPTION 'tenant context mismatch'; END IF;
  v_allowed := (v.status='OPEN' AND p_to_status IN ('MITIGATING','RESOLVED')) OR
               (v.status='MITIGATING' AND p_to_status IN ('MONITORING','RESOLVED')) OR
               (v.status='MONITORING' AND p_to_status IN ('RESOLVED','OPEN')) OR
               (v.status='RESOLVED' AND p_to_status='CLOSED');
  IF NOT v_allowed THEN RAISE EXCEPTION 'transisi incident tidak diizinkan: % ke %',v.status,p_to_status; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'alasan wajib diisi'; END IF;
  UPDATE public.tech_incidents SET status=p_to_status,
    acknowledged_at=CASE WHEN p_to_status IN ('MITIGATING','RESOLVED') AND acknowledged_at IS NULL THEN now() ELSE acknowledged_at END,
    mitigated_at=CASE WHEN p_to_status='MONITORING' THEN now() ELSE mitigated_at END,
    resolved_at=CASE WHEN p_to_status='RESOLVED' THEN now() ELSE resolved_at END,
    closed_at=CASE WHEN p_to_status='CLOSED' THEN now() ELSE closed_at END,
    workaround=CASE WHEN p_to_status IN ('MITIGATING','MONITORING') THEN p_reason ELSE workaround END,
    root_cause=CASE WHEN p_to_status IN ('RESOLVED','CLOSED') THEN p_reason ELSE root_cause END
  WHERE id=p_incident_id;
  PERFORM public.tech_ops_record_event(v.tenant_id,'incident.transitioned','info',v.correlation_id,'tech-control-plane',jsonb_build_object('incident_id',p_incident_id,'from',v.status,'to',p_to_status,'reason',p_reason));
  RETURN jsonb_build_object('ok',true,'incident_id',p_incident_id,'status',p_to_status);
END $$;

CREATE OR REPLACE FUNCTION public.tech_ops_transition_problem(
  p_problem_id bigint, p_to_status text, p_reason text, p_actor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.tech_problems; v_allowed boolean := false;
BEGIN
  SELECT * INTO v FROM public.tech_problems WHERE id=p_problem_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'problem tidak ditemukan'; END IF;
  IF v.tenant_id IS NOT NULL AND v.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN RAISE EXCEPTION 'tenant context mismatch'; END IF;
  v_allowed := (v.status='OPEN' AND p_to_status='ANALYSIS') OR (v.status='ANALYSIS' AND p_to_status='ACTIONED') OR (v.status='ACTIONED' AND p_to_status='VERIFYING') OR (v.status='VERIFYING' AND p_to_status='CLOSED');
  IF NOT v_allowed THEN RAISE EXCEPTION 'transisi problem tidak diizinkan: % ke %',v.status,p_to_status; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'evidence/alasan wajib diisi'; END IF;
  UPDATE public.tech_problems SET status=p_to_status,
    root_cause=CASE WHEN p_to_status='ANALYSIS' THEN p_reason ELSE root_cause END,
    preventive_action=CASE WHEN p_to_status='ACTIONED' THEN p_reason ELSE preventive_action END,
    verification_evidence=CASE WHEN p_to_status IN ('VERIFYING','CLOSED') THEN jsonb_build_object('reason',p_reason,'verified_at',now()) ELSE verification_evidence END,
    closed_at=CASE WHEN p_to_status='CLOSED' THEN now() ELSE closed_at END
  WHERE id=p_problem_id;
  PERFORM public.tech_ops_record_event(v.tenant_id,'problem.transitioned','info',concat('problem-',p_problem_id),'tech-control-plane',jsonb_build_object('problem_id',p_problem_id,'from',v.status,'to',p_to_status,'reason',p_reason));
  RETURN jsonb_build_object('ok',true,'problem_id',p_problem_id,'status',p_to_status);
END $$;

CREATE OR REPLACE FUNCTION public.tech_ops_approve_change(
  p_change_id bigint, p_actor uuid DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.tech_changes;
BEGIN
  SELECT * INTO v FROM public.tech_changes WHERE id=p_change_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change tidak ditemukan'; END IF;
  IF v.tenant_id IS NOT NULL AND v.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN RAISE EXCEPTION 'tenant context mismatch'; END IF;
  IF v.status <> 'REVIEW' THEN RAISE EXCEPTION 'change belum berada pada status review'; END IF;
  UPDATE public.tech_changes SET status='APPROVED',approved_by=COALESCE(p_actor,auth.uid()),preflight_evidence=preflight_evidence || jsonb_build_object('approved_at',now(),'reason',p_reason) WHERE id=p_change_id;
  PERFORM public.tech_ops_record_event(v.tenant_id,'change.approved','info',concat('change-',p_change_id),'tech-control-plane',jsonb_build_object('change_id',p_change_id));
  RETURN jsonb_build_object('ok',true,'change_id',p_change_id,'status','APPROVED');
END $$;

GRANT EXECUTE ON FUNCTION public.tech_ops_transition_incident(bigint,text,text,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tech_ops_transition_problem(bigint,text,text,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tech_ops_approve_change(bigint,uuid,text) TO authenticated,service_role;

-- Compatibility overload: callers naturally pass tenant first. Keep the
-- canonical implementation above, but accept the deployed UI/RPC contract
-- (tenant, incident_no, severity, title, correlation_id, impact, owner).
CREATE OR REPLACE FUNCTION public.tech_ops_open_incident(
  p_tenant uuid, p_incident_no text, p_severity text, p_title text,
  p_correlation_id text, p_impact text DEFAULT NULL, p_owner uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.tech_ops_open_incident(
    p_incident_no, p_tenant, p_severity, p_title,
    p_correlation_id, p_impact, p_owner
  );
END $$;
GRANT EXECUTE ON FUNCTION public.tech_ops_open_incident(uuid,text,text,text,text,text,uuid) TO authenticated,service_role;
