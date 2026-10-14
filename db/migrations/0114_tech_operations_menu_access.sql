-- OWNED_BY: generic. Operational evidence access only; no vendor execution.
BEGIN;
INSERT INTO roles(kode,label,warna) VALUES('tech','Tim Teknis','#455A64') ON CONFLICT(kode) DO NOTHING;
INSERT INTO role_pages(role_kode,page)
SELECT r.kode,p.page FROM roles r CROSS JOIN (VALUES('tech-roadmap'),('tech-modul'),('tech-isu'),('tech-delivery')) p(page)
WHERE r.kode IN('tech','super_admin','head_operation','direktur','admin_faskes') ON CONFLICT DO NOTHING;
INSERT INTO role_pages(role_kode,page) VALUES('tech','dashboard') ON CONFLICT DO NOTHING;
CREATE FUNCTION tech_ops_audit(p_kind text,p_id bigint,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();name text;exists_source boolean;rows_value jsonb;
BEGIN
 PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','tech','admin_faskes']);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset audit tidak valid';END IF;
 name:=CASE p_kind WHEN 'ticket' THEN 'tech_support_tickets' WHEN 'change' THEN 'tech_changes' WHEN 'deployment' THEN 'tech_module_deployments' END;
 IF name IS NULL THEN RAISE EXCEPTION 'Jenis audit tidak valid';END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE id=$1 AND tenant_id=$2)',name) INTO exists_source USING p_id,t;
 IF NOT exists_source THEN RAISE EXCEPTION 'Sumber audit tenant tidak ditemukan';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',h.id,'action',h.action,'actor_id',h.actor_id,'actor_name',u.full_name,'reason',h.reason,'at',h.created_at,'before_state',coalesce(h.before_row->>'status',h.before_row->>'state'),'after_state',coalesce(h.after_row->>'status',h.after_row->>'state'),'version',h.after_row->'ops_version','resolution',h.after_row->>'resolution','preflight',h.after_row->'preflight_evidence'->>'reference','result',h.after_row->'result_evidence'->>'reference','release',coalesce(h.after_row->>'release_version',h.after_row->>'release'),'installation_evidence',h.after_row->>'evidence') ORDER BY h.id DESC),'[]') INTO rows_value
 FROM (SELECT * FROM tech_ops_history WHERE tenant_id=t AND entity_kind=p_kind AND entity_id=p_id ORDER BY id DESC LIMIT 51 OFFSET p_offset)h LEFT JOIN user_profiles u ON u.id=h.actor_id AND u.tenant_id=t;
 RETURN jsonb_build_object('rows',rows_value);
END $$;
REVOKE ALL ON FUNCTION tech_ops_audit(text,bigint,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tech_ops_audit(text,bigint,integer) TO authenticated;
COMMIT;
