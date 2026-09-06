-- OWNED_BY: ava. Requires 0051. No catalog/reference-value changes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.lis_result_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL, actor_id uuid NOT NULL,
  admission_id bigint NOT NULL, action text NOT NULL,
  result_ids bigint[] NOT NULL, snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lis_result_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lis_result_events FROM anon,authenticated;

-- Restrictive policies intersect existing permissions; never broaden access.
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lis_result_staff_read ON public.lab_results;
CREATE POLICY lis_result_staff_read ON public.lab_results FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND lower(role) IN
 ('super_admin','superadmin','admin','registration','registrasi','admin_faskes','lab_analyst','lab_supervisor','analis','lab','doctor_sppk','sp_pk')));
DROP POLICY IF EXISTS lis_result_tenant_boundary ON public.lab_results;
CREATE POLICY lis_result_tenant_boundary ON public.lab_results AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS(SELECT 1 FROM public.admissions a JOIN public.user_profiles u ON u.tenant_id=a.tenant_id
  WHERE a.id=lab_results.admission_id AND u.id=auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.admissions a JOIN public.user_profiles u ON u.tenant_id=a.tenant_id
  WHERE a.id=lab_results.admission_id AND u.id=auth.uid()));
ALTER TABLE public.critical_value_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lis_critical_staff_read ON public.critical_value_notifications;
CREATE POLICY lis_critical_staff_read ON public.critical_value_notifications FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND lower(role) IN
 ('super_admin','superadmin','admin','lab_analyst','lab_supervisor','analis','lab','doctor_sppk','sp_pk')));
REVOKE INSERT,UPDATE,DELETE ON public.critical_value_notifications FROM authenticated;
DROP POLICY IF EXISTS lis_critical_tenant_boundary ON public.critical_value_notifications;
CREATE POLICY lis_critical_tenant_boundary ON public.critical_value_notifications AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS(SELECT 1 FROM public.admissions a JOIN public.user_profiles u ON u.tenant_id=a.tenant_id
  WHERE a.id=critical_value_notifications.admission_id AND u.id=auth.uid()))
WITH CHECK (EXISTS(SELECT 1 FROM public.admissions a JOIN public.user_profiles u ON u.tenant_id=a.tenant_id
  WHERE a.id=critical_value_notifications.admission_id AND u.id=auth.uid()));

CREATE OR REPLACE FUNCTION public.lis_guard_result_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status IS DISTINCT FROM 'Draft' OR nullif(btrim(OLD.result_value),'') IS NOT NULL THEN
      RAISE EXCEPTION 'Hasil klinis tidak boleh dihapus';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'Draft' THEN RAISE EXCEPTION 'Hasil baru harus berstatus Draft'; END IF;
    RETURN NEW;
  END IF;
  IF current_setting('ava.lis_transition',true) IS DISTINCT FROM 'authorized' THEN
    IF OLD.status='Validated' AND NEW.status='Draft' THEN
      NEW.validated_by:=NULL; NEW.validated_at:=NULL;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Gunakan transaksi verifikasi/rilis LIS';
    END IF;
    IF OLD.status='Validated' AND NEW.status='Validated' AND
      (NEW.result_value IS DISTINCT FROM OLD.result_value OR NEW.result_numeric IS DISTINCT FROM OLD.result_numeric) THEN
      RAISE EXCEPTION 'Perubahan hasil harus kembali ke Draft';
    END IF;
    IF OLD.status IN ('Approved','Released') AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION 'Hasil final terkunci; koreksi membutuhkan alur revisi terotorisasi';
    END IF;
    IF (to_jsonb(NEW)->>'critical_ack_at') IS DISTINCT FROM (to_jsonb(OLD)->>'critical_ack_at') THEN
      RAISE EXCEPTION 'Gunakan transaksi pelaporan nilai kritis';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lis_result_write_guard ON public.lab_results;
CREATE TRIGGER lis_result_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lab_results
FOR EACH ROW EXECUTE FUNCTION public.lis_guard_result_write();

CREATE OR REPLACE FUNCTION public.lis_transition_results(p_action text,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant uuid:=public.lis_his_actor(); v_role text; r public.lab_results;
  e jsonb; v_ids bigint[]:='{}'; v_adm bigint; v_snapshot jsonb:='[]'; v_now timestamptz:=now(); v_numeric numeric;
BEGIN
  SELECT lower(role) INTO v_role FROM public.user_profiles WHERE id=auth.uid();
  IF p_action IS NULL OR p_rows IS NULL OR p_action NOT IN ('validate','release') OR jsonb_typeof(p_rows)<>'array'
     OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Permintaan transisi tidak valid'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('lab_analyst','lab_supervisor','analis','lab','doctor_sppk','sp_pk') THEN
    RAISE EXCEPTION 'Kewenangan klinis diperlukan';
  END IF;
  IF p_action='release' AND v_role NOT IN ('doctor_sppk','sp_pk') THEN RAISE EXCEPTION 'Otorisasi dokter penanggung jawab diperlukan'; END IF;
  -- Same lock order as service changes: admission first, then result IDs.
  PERFORM 1 FROM public.admissions WHERE id IN (SELECT admission_id FROM public.lab_results
    WHERE id IN (SELECT (value->>'id')::bigint FROM jsonb_array_elements(p_rows))) AND tenant_id=v_tenant ORDER BY id FOR UPDATE;
  -- Lock all requested results in stable order, then validate each expected version.
  PERFORM 1 FROM public.lab_results WHERE id IN (SELECT (value->>'id')::bigint FROM jsonb_array_elements(p_rows)) ORDER BY id FOR UPDATE;
  FOR e IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    SELECT l.* INTO r FROM public.lab_results l JOIN public.admissions a ON a.id=l.admission_id
      WHERE l.id=(e->>'id')::bigint AND a.tenant_id=v_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'Hasil tidak ditemukan dalam tenant aktif'; END IF;
    IF r.id=ANY(v_ids) THEN RAISE EXCEPTION 'Hasil duplikat'; END IF;
    IF v_adm IS NOT NULL AND v_adm<>r.admission_id THEN RAISE EXCEPTION 'Proses satu kunjungan per transaksi'; END IF;
    v_adm:=r.admission_id;
    IF (to_jsonb(r)->>'updated_at') IS DISTINCT FROM (e->>'updated_at') THEN RAISE EXCEPTION 'Hasil telah berubah; muat ulang'; END IF;
    IF r.status IS DISTINCT FROM (CASE WHEN p_action='validate' THEN 'Draft' ELSE 'Validated' END) THEN RAISE EXCEPTION 'Status hasil tidak sesuai'; END IF;
    IF nullif(btrim(r.result_value),'') IS NULL THEN RAISE EXCEPTION 'Hasil kosong tidak dapat diteruskan'; END IF;
    v_numeric:=r.result_numeric;
    IF btrim(r.result_value) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' THEN
      IF v_numeric IS NOT NULL AND v_numeric<>btrim(r.result_value)::numeric THEN RAISE EXCEPTION 'Nilai numerik tidak sesuai hasil'; END IF;
      v_numeric:=btrim(r.result_value)::numeric;
    END IF;
    IF (coalesce((to_jsonb(r)->>'is_critical')::boolean,false)
       OR (v_numeric IS NOT NULL AND ((r.critical_low IS NOT NULL AND v_numeric<=r.critical_low)
          OR (r.critical_high IS NOT NULL AND v_numeric>=r.critical_high))))
       AND r.critical_ack_at IS NULL THEN RAISE EXCEPTION 'Pelaporan nilai kritis belum selesai'; END IF;
    v_ids:=array_append(v_ids,r.id);
  END LOOP;
  -- Serialise with service changes on this admission; partial panels cannot be released.
  PERFORM 1 FROM public.admissions WHERE id=v_adm FOR UPDATE;
  IF p_action='release' AND EXISTS(SELECT 1 FROM public.lab_results WHERE admission_id=v_adm
      AND status NOT IN ('Validated','Approved','Released','Cancelled','Canceled')) THEN
    RAISE EXCEPTION 'Masih ada analit belum diverifikasi dalam kunjungan';
  END IF;
  PERFORM set_config('ava.lis_transition','authorized',true);
  IF p_action='validate' THEN
    UPDATE public.lab_results l SET status='Validated',validated_by=auth.uid()::text,validated_at=v_now,updated_at=v_now,
      notes=CASE WHEN e.value ? 'notes' THEN e.value->>'notes' ELSE l.notes END
      FROM jsonb_array_elements(p_rows) e WHERE l.id=(e.value->>'id')::bigint;
  ELSE
    UPDATE public.lab_results SET status='Approved',approved_by=auth.uid()::text,approved_at=v_now,
      released_by=auth.uid()::text,released_at=v_now,updated_at=v_now WHERE id=ANY(v_ids);
  END IF;
  SELECT jsonb_agg(to_jsonb(l)) INTO v_snapshot FROM public.lab_results l WHERE id=ANY(v_ids);
  INSERT INTO public.lis_result_events(tenant_id,actor_id,admission_id,action,result_ids,snapshot)
    VALUES(v_tenant,auth.uid(),v_adm,p_action,v_ids,v_snapshot);
  PERFORM set_config('ava.lis_transition','',true);
  RETURN jsonb_build_object('ok',true,'count',cardinality(v_ids),'ids',to_jsonb(v_ids),'action',p_action);
END $$;

CREATE OR REPLACE FUNCTION public.lis_result_history(p_admission_id bigint,p_product_id bigint,p_item_id bigint DEFAULT NULL,p_exclude_id bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant uuid:=public.lis_his_actor(); a public.admissions; v_patient text; v_mr text; v_rows jsonb;
BEGIN
  SELECT * INTO a FROM public.admissions WHERE id=p_admission_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kunjungan tidak tersedia'; END IF;
  v_patient:=nullif(to_jsonb(a)->>'patient_id',''); v_mr:=nullif(btrim(a.mr_number),'');
  IF v_patient IS NULL AND v_mr IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC),'[]') INTO v_rows FROM (
    SELECT l.* FROM public.lab_results l JOIN public.admissions x ON x.id=l.admission_id
    WHERE x.tenant_id=v_tenant AND
      CASE WHEN v_patient IS NOT NULL THEN to_jsonb(x)->>'patient_id'=v_patient ELSE x.mr_number=v_mr END
      AND l.product_id=p_product_id AND l.product_item_id IS NOT DISTINCT FROM p_item_id
      AND (p_exclude_id IS NULL OR l.id<>p_exclude_id) AND l.status IN ('Approved','Released')
      AND nullif(btrim(l.result_value),'') IS NOT NULL ORDER BY l.created_at DESC,l.id DESC LIMIT 30
  ) q;
  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.lis_record_critical(p_result_id bigint,p_body jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant uuid:=public.lis_his_actor(); r public.lab_results; v_success boolean;
  v_id bigint; v_when timestamptz; v_role text;
BEGIN
  SELECT lower(role) INTO v_role FROM public.user_profiles WHERE id=auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('lab_analyst','lab_supervisor','analis','lab','doctor_sppk','sp_pk') THEN RAISE EXCEPTION 'Kewenangan klinis diperlukan'; END IF;
  SELECT l.* INTO r FROM public.lab_results l JOIN public.admissions a ON a.id=l.admission_id
    WHERE l.id=p_result_id AND a.tenant_id=v_tenant FOR UPDATE OF l;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hasil tidak tersedia'; END IF;
  IF nullif(btrim(p_body->>'notified_to'),'') IS NULL THEN RAISE EXCEPTION 'Penerima wajib diisi'; END IF;
  IF p_body->>'attempt_status' IS NULL OR p_body->>'attempt_status' NOT IN ('Berhasil','Tidak Terjangkau','Tidak Terhubung','Tidak Dijawab','Gagal','Ditolak') THEN RAISE EXCEPTION 'Status pelaporan tidak valid'; END IF;
  v_success:=p_body->>'attempt_status'='Berhasil';
  IF v_success AND NOT coalesce((p_body->>'readback')::boolean,false) THEN RAISE EXCEPTION 'Read-back wajib untuk pelaporan berhasil'; END IF;
  v_when:=coalesce(nullif(p_body->>'notified_at','')::timestamptz,now());
  IF v_when>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Waktu pelaporan di masa depan'; END IF;
  INSERT INTO public.critical_value_notifications(result_id,sample_id,admission_id,patient_name,test_name,result_value,unit,
    notified_by,notified_to,notified_role,method,notified_at,readback,response,attempt_status,notes,updated_at)
  VALUES(r.id,r.sample_id,r.admission_id,r.patient_name,r.product_name,r.result_value,r.unit,auth.uid()::text,
    p_body->>'notified_to',p_body->>'notified_role',p_body->>'method',v_when,v_success AND (p_body->>'readback')::boolean,
    p_body->>'response',p_body->>'attempt_status',p_body->>'notes',now()) RETURNING id INTO v_id;
  IF v_success THEN
    PERFORM set_config('ava.lis_transition','authorized',true);
    UPDATE public.lab_results SET critical_ack_at=now(),critical_ack_by=auth.uid()::text,
      critical_ack_note='Read-back: '||(p_body->>'notified_to'),critical_notified_at=v_when,critical_notified_by=auth.uid()::text,
      updated_at=now() WHERE id=r.id;
    PERFORM set_config('ava.lis_transition','',true);
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v_id,'acknowledged',v_success);
END $$;
REVOKE ALL ON FUNCTION public.lis_record_critical(bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lis_record_critical(bigint,jsonb) TO authenticated;

-- The archived evaluator did not enforce clinical/tenant/state guards. Fail closed.
CREATE OR REPLACE FUNCTION public.mark_autoverified(p_result_id bigint,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Autoverifikasi ditahan; gunakan Verifikasi Teknis sampai aturan server tervalidasi'; END $$;

REVOKE ALL ON FUNCTION public.lis_transition_results(text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.lis_result_history(bigint,bigint,bigint,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lis_transition_results(text,jsonb),public.lis_result_history(bigint,bigint,bigint,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.mark_autoverified(bigint,text) FROM PUBLIC,anon,authenticated;
COMMIT;
