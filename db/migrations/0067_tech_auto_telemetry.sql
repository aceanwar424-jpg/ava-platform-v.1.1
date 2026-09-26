-- AVA TECH AUTO TELEMETRY v1
-- Client failure -> operational event -> deduplicated alert -> optional incident.
-- Payload is technical metadata only; never send secrets or patient content.

CREATE OR REPLACE FUNCTION public.tech_ops_ingest_client_error(
  p_tenant uuid,
  p_installation_id text,
  p_event_type text,
  p_severity text,
  p_fingerprint text,
  p_title text,
  p_detail text,
  p_correlation_id text,
  p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event jsonb;
  v_alert public.tech_alerts;
  v_incident_id bigint;
  v_incident_no text;
  v_severity text := CASE upper(coalesce(p_severity, 'error'))
    WHEN 'CRITICAL' THEN 'P0' WHEN 'ERROR' THEN 'P1'
    WHEN 'WARNING' THEN 'P2' ELSE 'P3' END;
  v_fp text := left(coalesce(nullif(trim(p_fingerprint), ''), md5(coalesce(p_title, 'client-error'))), 200);
BEGIN
  IF p_tenant IS NOT NULL AND p_tenant IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'tenant context mismatch';
  END IF;
  v_event := public.tech_ops_record_event(
    p_tenant, coalesce(nullif(trim(p_event_type), ''), 'client.error'),
    lower(coalesce(p_severity, 'error')), coalesce(nullif(trim(p_correlation_id), ''), gen_random_uuid()::text),
    'client-telemetry', coalesce(p_payload, '{}'::jsonb), p_installation_id, NULL);

  SELECT * INTO v_alert FROM public.tech_alerts
  WHERE fingerprint = v_fp AND status = 'OPEN'
  ORDER BY id DESC LIMIT 1 FOR UPDATE;
  IF v_alert.id IS NULL THEN
    INSERT INTO public.tech_alerts
      (tenant_id, installation_id, fingerprint, rule_code, severity, title, detail, status, last_seen, correlation_id)
    VALUES
      (p_tenant, p_installation_id, v_fp, 'CLIENT_FAILURE', v_severity,
       left(coalesce(nullif(trim(p_title), ''), 'Client application failure'), 240),
       left(p_detail, 2000), 'OPEN', now(), coalesce(nullif(trim(p_correlation_id), ''), v_event->>'correlation_id'))
    RETURNING * INTO v_alert;
  ELSE
    UPDATE public.tech_alerts SET last_seen = now(), detail = left(p_detail, 2000),
      correlation_id = coalesce(nullif(trim(p_correlation_id), ''), correlation_id), severity = v_severity
    WHERE id = v_alert.id
    RETURNING * INTO v_alert;
  END IF;

  IF v_severity IN ('P0','P1') THEN
    SELECT id INTO v_incident_id FROM public.tech_incidents
    WHERE tenant_id IS NOT DISTINCT FROM p_tenant
      AND status IN ('OPEN','MITIGATING','MONITORING')
      AND correlation_id = v_alert.correlation_id
    ORDER BY detected_at DESC LIMIT 1;
    IF v_incident_id IS NULL THEN
      v_incident_no := 'INC-AUTO-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(md5(v_fp || clock_timestamp()::text), 1, 6));
      INSERT INTO public.tech_incidents
        (incident_no, tenant_id, installation_id, severity, title, impact, correlation_id, sla_ack_due_at, sla_restore_due_at)
      VALUES
        (v_incident_no, p_tenant, p_installation_id, v_severity,
         left(coalesce(p_title, 'Automatic client failure'), 240), left(p_detail, 2000), v_alert.correlation_id,
         now() + CASE WHEN v_severity = 'P0' THEN interval '15 minutes' ELSE interval '30 minutes' END,
         now() + CASE WHEN v_severity = 'P0' THEN interval '60 minutes' ELSE interval '4 hours' END)
      RETURNING id INTO v_incident_id;
      UPDATE public.tech_alerts SET detail = coalesce(detail, '') || ' [incident:' || v_incident_no || ']', last_seen = now() WHERE id = v_alert.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'event_id', v_event->>'event_id', 'alert_id', v_alert.id,
    'incident_id', v_incident_id, 'severity', v_severity, 'fingerprint', v_fp,
    'correlation_id', v_alert.correlation_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.tech_ops_ingest_client_error(uuid,text,text,text,text,text,text,text,jsonb) TO authenticated, service_role;

