-- OWNED_BY: generic. Source profiles stay stable while their authorization is used.
-- Pharmacy source bridge uses private CASE normalization; it does not mutate actor roles.
BEGIN;
CREATE OR REPLACE FUNCTION ops_actor(p_roles text[] DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text;t uuid:=current_tenant_id();
BEGIN
 SELECT lower(role) INTO r FROM user_profiles WHERE id=auth.uid() AND tenant_id=t FOR SHARE;
 IF auth.uid() IS NULL OR t IS NULL OR r IS NULL THEN RAISE EXCEPTION 'Login dan tenant aktif diperlukan';END IF;
 IF p_roles IS NOT NULL AND NOT EXISTS(SELECT 1 FROM unnest(p_roles) allowed(role_name) WHERE ops_professional_role(allowed.role_name)=ops_professional_role(r)) THEN RAISE EXCEPTION 'Peran tidak berwenang';END IF;
 RETURN auth.uid();
END $$;
DO $$DECLARE body text;needle text;BEGIN
 SELECT pg_get_functiondef('ops_assert_individual_privilege(text,text,uuid)'::regprocedure) INTO body;
 needle:='IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=p_user AND tenant_id=t';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Individual profile source contract changed';END IF;
 body:=replace(body,needle,'PERFORM 1 FROM user_profiles WHERE id=p_user AND tenant_id=t FOR SHARE; '||needle);
 EXECUTE body;
END $$;
COMMIT;
