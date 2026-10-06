-- OWNED_BY: generic. Existing bed ownership must be mapped in preflight.
BEGIN;
ALTER TABLE public.inpatient_beds ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.inpatient_beds ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.inpatient_beds ADD COLUMN IF NOT EXISTS cleanup_order_id bigint REFERENCES public.rs_work_orders(id);
ALTER TABLE public.inpatient_stays ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
CREATE TABLE IF NOT EXISTS public.rs_bed_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  admission_id bigint NOT NULL REFERENCES public.admissions(id),
  bed_id bigint REFERENCES public.inpatient_beds(id),
  status text NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','reserved','admitted','cancelled','expired')),
  requirements text NOT NULL CHECK(length(trim(requirements))>=3),
  expires_at timestamptz,
  created_by uuid NOT NULL,
  request_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS rs_bed_one_reservation ON public.rs_bed_reservations(bed_id) WHERE status='reserved';
CREATE UNIQUE INDEX IF NOT EXISTS rs_admission_one_request ON public.rs_bed_reservations(admission_id) WHERE status IN ('reserved','waiting');
ALTER TABLE public.rs_bed_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inpatient_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inpatient_stays ENABLE ROW LEVEL SECURITY;
-- Permissive legacy policies cannot widen these boundaries.
DROP POLICY IF EXISTS rs_bed_tenant_guard ON public.inpatient_beds;
CREATE POLICY rs_bed_tenant_guard ON public.inpatient_beds AS RESTRICTIVE FOR ALL TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id());
DROP POLICY IF EXISTS rs_stay_tenant_guard ON public.inpatient_stays;
CREATE POLICY rs_stay_tenant_guard ON public.inpatient_stays AS RESTRICTIVE FOR ALL TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id());
DROP POLICY IF EXISTS rs_reservations_read ON public.rs_bed_reservations;
CREATE POLICY rs_reservations_read ON public.rs_bed_reservations FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id());
REVOKE ALL ON public.rs_bed_reservations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.rs_bed_reservations TO authenticated;

CREATE OR REPLACE FUNCTION public.rs_request_bed(p_admission_id bigint,p_requirements text,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid; v_tenant uuid:=public.current_tenant_id(); v_row rs_bed_reservations;
BEGIN
  v_actor:=rs_assert_actor(ARRAY['admin','admin_faskes','nurse','perawat']);
  IF length(coalesce(p_request_key,'')) NOT BETWEEN 8 AND 150 THEN RAISE EXCEPTION 'Request key wajib'; END IF;
  IF NOT EXISTS(SELECT 1 FROM admissions a WHERE a.id=p_admission_id AND (to_jsonb(a)->>'tenant_id')::uuid=v_tenant) THEN RAISE EXCEPTION 'Kunjungan bukan milik tenant aktif'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_tenant::text || p_request_key));
  SELECT * INTO v_row FROM rs_bed_reservations WHERE tenant_id=v_tenant AND request_key=p_request_key;
  IF FOUND THEN
    IF v_row.admission_id<>p_admission_id OR v_row.requirements<>p_requirements THEN RAISE EXCEPTION 'Request key sudah digunakan untuk input berbeda'; END IF;
    RETURN to_jsonb(v_row);
  END IF;
  IF EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=p_admission_id AND status='Dirawat') THEN RAISE EXCEPTION 'Pasien sudah dirawat'; END IF;
  INSERT INTO rs_bed_reservations(tenant_id,admission_id,requirements,request_key,created_by)
  VALUES(v_tenant,p_admission_id,p_requirements,p_request_key,v_actor) RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.rs_allocate_bed(p_id bigint,p_bed_id bigint,p_hours integer DEFAULT 4)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row rs_bed_reservations; v_tenant uuid:=public.current_tenant_id(); v_bed inpatient_beds;
BEGIN
  PERFORM rs_assert_actor(ARRAY['admin','admin_faskes','nurse','perawat']);
  IF p_hours NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Durasi reservasi 1–24 jam'; END IF;
  SELECT * INTO v_bed FROM inpatient_beds WHERE id=p_bed_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR v_bed.status<>'Kosong' OR NOT coalesce(v_bed.is_active,true) THEN RAISE EXCEPTION 'Bed tidak tersedia pada tenant aktif'; END IF;
  UPDATE rs_bed_reservations SET status='expired',updated_at=now() WHERE bed_id=p_bed_id AND status='reserved' AND expires_at<=now();
  SELECT * INTO v_row FROM rs_bed_reservations WHERE id=p_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permintaan bed tidak ditemukan'; END IF;
  IF v_row.status='reserved' AND v_row.bed_id=p_bed_id AND v_row.expires_at>now() THEN RETURN to_jsonb(v_row); END IF;
  IF v_row.status<>'waiting' THEN RAISE EXCEPTION 'Permintaan bukan dalam daftar tunggu'; END IF;
  UPDATE rs_bed_reservations SET bed_id=p_bed_id,status='reserved',expires_at=now()+make_interval(hours=>p_hours),updated_at=now()
  WHERE id=p_id RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.rs_cancel_bed(p_id bigint,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row rs_bed_reservations;
BEGIN
  PERFORM rs_assert_actor(ARRAY['admin','admin_faskes','nurse','perawat']);
  IF length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Alasan pembatalan wajib'; END IF;
  UPDATE rs_bed_reservations SET status='cancelled',requirements=requirements || E'\nPembatalan: ' || p_reason,updated_at=now()
  WHERE id=p_id AND tenant_id=public.current_tenant_id() AND status IN ('waiting','reserved','expired') RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permintaan tidak dapat dibatalkan'; END IF;
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.rs_stay_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant uuid:=public.current_tenant_id(); v_res rs_bed_reservations; v_owner uuid;
BEGIN
  PERFORM rs_assert_actor(ARRAY['admin','admin_faskes','nurse','perawat','doctor','dokter']);
  SELECT (to_jsonb(a)->>'tenant_id')::uuid INTO v_owner FROM admissions a WHERE id=NEW.admission_id;
  IF v_owner IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'Episode bukan milik tenant aktif'; END IF;
  NEW.tenant_id:=v_tenant;
  IF TG_OP='INSERT' OR NEW.bed_id IS DISTINCT FROM OLD.bed_id THEN
    IF NOT EXISTS(SELECT 1 FROM inpatient_beds WHERE id=NEW.bed_id AND tenant_id=v_tenant) THEN RAISE EXCEPTION 'Bed belum dipetakan ke tenant aktif'; END IF;
    SELECT * INTO v_res FROM rs_bed_reservations WHERE bed_id=NEW.bed_id AND status='reserved' AND expires_at>now() FOR UPDATE;
    IF FOUND AND v_res.admission_id<>NEW.admission_id THEN RAISE EXCEPTION 'Bed direservasi pasien lain'; END IF;
    UPDATE rs_bed_reservations SET status='admitted',updated_at=now() WHERE admission_id=NEW.admission_id AND status IN ('waiting','reserved');
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='Dirawat' AND NEW.status<>'Dirawat' THEN
    PERFORM rs_assert_actor(ARRAY['doctor','dokter']);
    IF NOT EXISTS(SELECT 1 FROM rs_work_orders WHERE kind='rs-discharge' AND admission_id=NEW.admission_id AND tenant_id=v_tenant AND status='completed' AND created_at>=NEW.admitted_at) THEN RAISE EXCEPTION 'Checklist pulang belum selesai'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rs_stay_guard ON public.inpatient_stays;
CREATE TRIGGER rs_stay_guard BEFORE INSERT OR UPDATE ON public.inpatient_stays FOR EACH ROW EXECUTE FUNCTION public.rs_stay_guard();

CREATE OR REPLACE FUNCTION public.rs_bed_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order rs_work_orders;
BEGIN
  PERFORM rs_assert_actor(ARRAY['admin','admin_faskes','nurse','perawat','doctor','dokter','housekeeping','facility']);
  IF NEW.tenant_id IS DISTINCT FROM public.current_tenant_id() OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'Bed bukan milik tenant aktif; mapping tenant memakai runbook'; END IF;
  IF NEW.status='Kosong' AND OLD.cleanup_order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM rs_work_orders WHERE id=OLD.cleanup_order_id AND status='completed' AND tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'Housekeeping belum diverifikasi'; END IF;
  IF NEW.cleanup_order_id IS DISTINCT FROM OLD.cleanup_order_id THEN RAISE EXCEPTION 'Relasi housekeeping tidak dapat diubah manual'; END IF;
  IF NEW.status='Dibersihkan' AND OLD.status<>'Dibersihkan' THEN
    INSERT INTO rs_work_orders(tenant_id,kind,title,location,request_key,created_by,details)
    VALUES(NEW.tenant_id,'rs-housekeeping','Pembersihan bed ' || NEW.bed_no,coalesce(NEW.room_no,'Bangsal'),
      'clean-' || NEW.id || '-' || txid_current(),auth.uid(),jsonb_build_object('bed_id',NEW.id)) RETURNING * INTO v_order;
    NEW.cleanup_order_id:=v_order.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rs_bed_guard ON public.inpatient_beds;
CREATE TRIGGER rs_bed_guard BEFORE UPDATE ON public.inpatient_beds FOR EACH ROW EXECUTE FUNCTION public.rs_bed_guard();

CREATE OR REPLACE FUNCTION public.rs_housekeeping_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.kind='rs-housekeeping' AND OLD.status='active' AND NEW.status='completed' AND NEW.details ? 'bed_id' THEN
    UPDATE inpatient_beds SET status='Kosong',updated_at=now() WHERE id=(NEW.details->>'bed_id')::bigint AND tenant_id=NEW.tenant_id AND status='Dibersihkan';
    IF NOT FOUND THEN RAISE EXCEPTION 'Bed tidak dalam status dibersihkan; hasil tidak disimpan'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rs_housekeeping_release ON public.rs_work_orders;
CREATE TRIGGER rs_housekeeping_release AFTER UPDATE ON public.rs_work_orders FOR EACH ROW EXECUTE FUNCTION public.rs_housekeeping_release();
REVOKE ALL ON FUNCTION public.rs_request_bed(bigint,text,text),public.rs_allocate_bed(bigint,bigint,integer),public.rs_cancel_bed(bigint,text),public.rs_stay_guard(),public.rs_bed_guard(),public.rs_housekeeping_release() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rs_request_bed(bigint,text,text),public.rs_allocate_bed(bigint,bigint,integer),public.rs_cancel_bed(bigint,text) TO authenticated;
COMMIT;
