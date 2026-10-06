-- Forward-only completion: 0070–0072 were committed/pushed by another workspace process during implementation.
-- OWNED_BY: generic. Reapply idempotent definitions, role seeds, RLS and new audit/capacity controls.
BEGIN;
-- OWNED_BY: generic. Approved for local schema/test; production requires preflight/UAT.
CREATE TABLE IF NOT EXISTS public.rs_workflow_types (
  code text PRIMARY KEY, label text NOT NULL, stages jsonb NOT NULL,
  patient_required boolean NOT NULL DEFAULT true,
  owner_roles text[] NOT NULL,
  version text NOT NULL DEFAULT '1.0-2026-10-06'
);
CREATE TABLE IF NOT EXISTS public.rs_work_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kind text NOT NULL REFERENCES public.rs_workflow_types(code),
  admission_id bigint REFERENCES public.admissions(id),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
  location text NOT NULL CHECK (length(trim(location)) BETWEEN 1 AND 200),
  priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','urgent')),
  stage integer NOT NULL DEFAULT 0 CHECK(stage >= 0),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  assignee_id uuid REFERENCES public.user_profiles(id),
  details jsonb NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  request_key text NOT NULL CHECK(length(request_key) BETWEEN 8 AND 150),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, request_key)
);
CREATE INDEX IF NOT EXISTS rs_work_orders_board ON public.rs_work_orders(tenant_id, kind, status, updated_at DESC);
CREATE TABLE IF NOT EXISTS public.rs_work_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  order_id bigint NOT NULL REFERENCES public.rs_work_orders(id),
  actor_id uuid NOT NULL, action text NOT NULL, from_stage integer, to_stage integer,
  evidence jsonb NOT NULL, request_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,request_key)
);
ALTER TABLE public.rs_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rs_work_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rs_orders_read ON public.rs_work_orders;
CREATE POLICY rs_orders_read ON public.rs_work_orders FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS rs_events_read ON public.rs_work_events;
CREATE POLICY rs_events_read ON public.rs_work_events FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
REVOKE ALL ON public.rs_work_orders, public.rs_work_events, public.rs_workflow_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rs_work_orders, public.rs_work_events, public.rs_workflow_types TO authenticated;

CREATE OR REPLACE FUNCTION public.rs_assert_actor(p_roles text[] DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_tenant uuid := public.current_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL THEN RAISE EXCEPTION 'Login dan tenant aktif diperlukan'; END IF;
  SELECT lower(role) INTO v_role FROM public.user_profiles WHERE id=auth.uid() AND tenant_id=v_tenant;
  IF v_role='finance_staff' THEN v_role:='finance'; END IF;
  IF v_role='operasional' THEN v_role:='lab'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('super_admin','head_operation','direktur','admin','admin_faskes','doctor','dokter','nurse','perawat','pharmacist','apoteker','finance','cashier','clinical_governance','housekeeping','cssd','nutrition','porter','facility','midwife','bidan','lab','analis') THEN
    RAISE EXCEPTION 'Peran tidak berwenang mengerjakan operasional RS';
  END IF;
  IF p_roles IS NOT NULL AND v_role NOT IN ('super_admin','head_operation','direktur') AND NOT(v_role = ANY(p_roles)) THEN
    RAISE EXCEPTION 'Tahap ini memerlukan peran %', array_to_string(p_roles,', ');
  END IF;
  RETURN auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.rs_staff_directory()
RETURNS TABLE(id uuid,full_name text,role text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM rs_assert_actor();
  RETURN QUERY SELECT p.id,p.full_name::text,
    CASE lower(p.role) WHEN 'finance_staff' THEN 'finance' WHEN 'operasional' THEN 'lab' ELSE lower(p.role) END
  FROM user_profiles p WHERE p.tenant_id=public.current_tenant_id()
    AND lower(p.role) NOT IN ('patient','vendor','viewer','sales','corporate','ihc','tech','hrd_staff');
END $$;

CREATE OR REPLACE FUNCTION public.rs_assert_stage(p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_role text;
BEGIN
  PERFORM rs_assert_actor();
  SELECT CASE lower(role) WHEN 'finance_staff' THEN 'finance' WHEN 'operasional' THEN 'lab' ELSE lower(role) END
  INTO v_role FROM user_profiles WHERE id=auth.uid() AND tenant_id=public.current_tenant_id();
  IF NOT(v_role=ANY(p_roles)) THEN RAISE EXCEPTION 'Tahap memerlukan peran %; administrator tidak menggantikan profesi',array_to_string(p_roles,', '); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rs_can_read(p_kind text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM user_profiles p WHERE p.id=auth.uid() AND p.tenant_id=public.current_tenant_id() AND (
    lower(p.role) IN ('super_admin','head_operation','direktur','admin','admin_faskes')
    OR (p_kind IS NULL AND lower(p.role) IN ('nurse','perawat','dokter','doctor'))
    OR EXISTS(SELECT 1 FROM rs_workflow_types t WHERE t.code=p_kind AND (
      CASE lower(p.role) WHEN 'finance_staff' THEN 'finance' WHEN 'operasional' THEN 'lab' ELSE lower(p.role) END=ANY(t.owner_roles)
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(t.stages) s WHERE s->'roles' ? CASE lower(p.role) WHEN 'finance_staff' THEN 'finance' WHEN 'operasional' THEN 'lab' ELSE lower(p.role) END)
    ))
  ));
$$;
DROP POLICY IF EXISTS rs_orders_read ON public.rs_work_orders;
CREATE POLICY rs_orders_read ON public.rs_work_orders FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.rs_can_read(kind));
DROP POLICY IF EXISTS rs_events_read ON public.rs_work_events;
CREATE POLICY rs_events_read ON public.rs_work_events FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND EXISTS(SELECT 1 FROM rs_work_orders o WHERE o.id=order_id));

CREATE OR REPLACE FUNCTION public.rs_create_order(p_kind text,p_title text,p_location text,p_admission_id bigint,p_priority text,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_tenant uuid := public.current_tenant_id(); v_type rs_workflow_types; v_order rs_work_orders; v_owner uuid;
BEGIN
  SELECT * INTO v_type FROM rs_workflow_types WHERE code=p_kind;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jenis workflow tidak dikenal'; END IF;
  v_actor := rs_assert_actor(v_type.owner_roles);
  PERFORM pg_advisory_xact_lock(hashtext(v_tenant::text || p_request_key));
  SELECT * INTO v_order FROM rs_work_orders WHERE tenant_id=v_tenant AND request_key=p_request_key;
  IF FOUND THEN
    IF v_order.kind IS DISTINCT FROM p_kind OR v_order.title IS DISTINCT FROM p_title OR v_order.location IS DISTINCT FROM p_location OR v_order.admission_id IS DISTINCT FROM p_admission_id OR v_order.priority IS DISTINCT FROM p_priority THEN RAISE EXCEPTION 'Request key sudah dipakai untuk input berbeda'; END IF;
    RETURN to_jsonb(v_order);
  END IF;
  IF v_type.patient_required AND p_admission_id IS NULL THEN RAISE EXCEPTION 'Pilih kunjungan pasien'; END IF;
  IF p_admission_id IS NOT NULL THEN
    SELECT (to_jsonb(a)->>'tenant_id')::uuid INTO v_owner FROM admissions a WHERE id=p_admission_id;
    IF v_owner IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'Kunjungan bukan milik tenant aktif'; END IF;
  END IF;
  INSERT INTO rs_work_orders(tenant_id,kind,admission_id,title,location,priority,request_key,created_by)
  VALUES(v_tenant,p_kind,p_admission_id,p_title,p_location,p_priority,p_request_key,v_actor) RETURNING * INTO v_order;
  INSERT INTO rs_work_events(tenant_id,order_id,actor_id,action,to_stage,evidence,request_key)
  VALUES(v_tenant,v_order.id,v_actor,'create',0,jsonb_build_object('title',p_title,'location',p_location),p_request_key);
  RETURN to_jsonb(v_order);
END $$;

CREATE OR REPLACE FUNCTION public.rs_transition_order(p_id bigint,p_version integer,p_action text,p_evidence jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_tenant uuid := public.current_tenant_id(); v_order rs_work_orders; v_type rs_workflow_types; v_stage jsonb; v_field text; v_event rs_work_events; v_assignee uuid; v_next integer;
BEGIN
  v_actor := rs_assert_actor();
  IF length(coalesce(p_request_key,'')) NOT BETWEEN 8 AND 150 THEN RAISE EXCEPTION 'Request key wajib'; END IF;
  IF jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Bukti harus berupa field terstruktur'; END IF;
  SELECT * INTO v_order FROM rs_work_orders WHERE id=p_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pekerjaan tidak ditemukan pada tenant aktif'; END IF;
  SELECT * INTO v_event FROM rs_work_events WHERE tenant_id=v_tenant AND request_key=p_request_key;
  IF FOUND THEN
    IF v_event.order_id<>p_id OR v_event.action<>p_action OR v_event.evidence IS DISTINCT FROM p_evidence THEN RAISE EXCEPTION 'Request key sudah dipakai untuk aksi berbeda'; END IF;
    RETURN to_jsonb(v_order);
  END IF;
  IF v_order.version<>p_version THEN RAISE EXCEPTION 'Data berubah; muat ulang sebelum menyimpan'; END IF;
  IF v_order.status<>'active' THEN RAISE EXCEPTION 'Pekerjaan sudah ditutup'; END IF;
  SELECT * INTO v_type FROM rs_workflow_types WHERE code=v_order.kind;
  v_next := v_order.stage;
  IF p_action='assign' THEN
    PERFORM rs_assert_actor(v_type.owner_roles);
    v_assignee := NULLIF(p_evidence->>'assignee_id','')::uuid;
    IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=v_assignee AND tenant_id=v_tenant AND
      (CASE lower(role) WHEN 'finance_staff' THEN 'finance' WHEN 'operasional' THEN 'lab' ELSE lower(role) END=ANY(v_type.owner_roles)
       OR lower(role) IN ('super_admin','head_operation','direktur'))) THEN RAISE EXCEPTION 'Petugas tidak sesuai tenant/peran'; END IF;
    UPDATE rs_work_orders SET assignee_id=v_assignee WHERE id=p_id;
  ELSIF p_action='cancel' THEN
    PERFORM rs_assert_actor(v_type.owner_roles);
    IF v_order.kind='rs-housekeeping' AND v_order.details ? 'bed_id' THEN RAISE EXCEPTION 'Tugas kesiapan bed wajib diselesaikan; tidak dapat dibatalkan'; END IF;
    IF length(trim(coalesce(p_evidence->>'reason','')))<3 THEN RAISE EXCEPTION 'Alasan pembatalan wajib'; END IF;
    UPDATE rs_work_orders SET status='cancelled' WHERE id=p_id;
  ELSIF p_action='advance' THEN
    IF v_order.assignee_id IS NULL THEN RAISE EXCEPTION 'Tugaskan petugas sebelum melanjutkan'; END IF;
    v_stage := v_type.stages->v_order.stage;
    IF v_stage IS NULL THEN RAISE EXCEPTION 'Tahap workflow tidak valid'; END IF;
    PERFORM rs_assert_stage(ARRAY(SELECT jsonb_array_elements_text(v_stage->'roles')));
    FOR v_field IN SELECT jsonb_array_elements_text(v_stage->'fields') LOOP
      IF length(trim(coalesce(p_evidence->>v_field,'')))<3 THEN RAISE EXCEPTION 'Bukti % wajib diisi',v_field; END IF;
    END LOOP;
    IF v_stage->>'receiver'='true' AND EXISTS(SELECT 1 FROM rs_work_events WHERE order_id=p_id AND action='advance' AND to_stage=v_order.stage AND actor_id=v_actor) THEN RAISE EXCEPTION 'Penerima handover harus berbeda dari pengirim'; END IF;
    v_next := v_order.stage+1;
    UPDATE rs_work_orders SET stage=v_next, details=details || jsonb_build_object(v_order.stage::text,p_evidence),
      status=CASE WHEN v_next=jsonb_array_length(v_type.stages) THEN 'completed' ELSE 'active' END WHERE id=p_id;
  ELSE RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
  UPDATE rs_work_orders SET version=version+1,updated_at=now() WHERE id=p_id RETURNING * INTO v_order;
  INSERT INTO rs_work_events(tenant_id,order_id,actor_id,action,from_stage,to_stage,evidence,request_key)
  VALUES(v_tenant,p_id,v_actor,p_action,CASE WHEN p_action='advance' THEN v_next-1 ELSE v_next END,v_next,p_evidence,p_request_key);
  RETURN to_jsonb(v_order);
END $$;
REVOKE ALL ON FUNCTION public.rs_assert_actor(text[]),public.rs_can_read(text),public.rs_staff_directory(),public.rs_create_order(text,text,text,bigint,text,text),public.rs_transition_order(bigint,integer,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rs_can_read(text),public.rs_staff_directory(),public.rs_create_order(text,text,text,bigint,text,text),public.rs_transition_order(bigint,integer,text,jsonb,text) TO authenticated;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-housekeeping','Housekeeping & Kesiapan Bed',false,ARRAY['housekeeping'],'[{"label":"Mulai pembersihan","fields":["area","checklist_pembersihan"],"roles":["housekeeping"]},{"label":"Selesai pembersihan","fields":["hasil_pembersihan","disinfeksi"],"roles":["housekeeping"]},{"label":"Verifikasi kesiapan","fields":["verifikasi_kamar","petugas_verifikasi"],"roles":["admin","admin_faskes","nurse","perawat"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-nurse-station','Nurse Station & Handover',true,ARRAY['nurse','perawat'],'[{"label":"Penugasan & asesmen","fields":["shift","referensi_asesmen","tugas_tertunda"],"roles":["nurse","perawat"]},{"label":"Serah terima SBAR","fields":["situation","background","assessment","recommendation"],"roles":["nurse","perawat"]},{"label":"Penerimaan shift","fields":["konfirmasi_penerimaan","rencana_tindak_lanjut"],"roles":["nurse","perawat"],"receiver":true}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-discharge','Perencanaan & Checklist Pulang',true,ARRAY['admin','admin_faskes','nurse','perawat'],'[{"label":"Persetujuan klinis","fields":["referensi_resume","instruksi_kontrol","persetujuan_dpjp"],"roles":["doctor","dokter","clinical_governance"]},{"label":"Rekonsiliasi obat","fields":["referensi_obat_pulang","edukasi_obat"],"roles":["pharmacist","apoteker"]},{"label":"Kesiapan pasien & keluarga","fields":["edukasi_pulang","transportasi"],"roles":["nurse","perawat"]},{"label":"Rekonsiliasi penjamin & tagihan","fields":["referensi_tagihan","status_penjamin"],"roles":["finance","cashier"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-igd-flow','Tracking Pelayanan IGD',true,ARRAY['admin','admin_faskes','nurse','perawat'],'[{"label":"Penempatan zona","fields":["referensi_triase","zona","petugas"],"roles":["nurse","perawat"]},{"label":"Keputusan layanan","fields":["referensi_catatan_klinis","keputusan_layanan"],"roles":["doctor","dokter","clinical_governance"]},{"label":"Handoff layanan tujuan","fields":["unit_tujuan","konfirmasi_penerima"],"roles":["admin","admin_faskes","nurse","perawat"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-inpatient-billing','Rekonsiliasi Billing Rawat Inap',true,ARRAY['finance','cashier'],'[{"label":"Review sumber biaya","fields":["referensi_kamar","referensi_obat_bhp","referensi_tindakan_penunjang"],"roles":["finance","cashier"]},{"label":"Review penjamin & deposit","fields":["referensi_penjamin","referensi_deposit","selisih_rekonsiliasi"],"roles":["finance","cashier"]},{"label":"Verifikasi tagihan","fields":["referensi_invoice","hasil_verifikasi"],"roles":["finance","cashier"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-operating-room','Kamar Operasi & Anestesi',true,ARRAY['admin','admin_faskes','nurse','perawat'],'[{"label":"Booking & persiapan","fields":["jadwal_ruang","tim_operasi","referensi_persetujuan"],"roles":["admin","admin_faskes","nurse","perawat"]},{"label":"Checklist pra operasi","fields":["referensi_checklist","referensi_asesmen_anestesi"],"roles":["doctor","dokter","clinical_governance"]},{"label":"Tindakan & pemulihan","fields":["referensi_laporan_operasi","referensi_anestesi","referensi_recovery"],"roles":["doctor","dokter","clinical_governance"]},{"label":"Serah terima bangsal","fields":["unit_tujuan","konfirmasi_penerima"],"roles":["nurse","perawat"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-cssd','CSSD & Sterilisasi',false,ARRAY['cssd'],'[{"label":"Terima & cuci","fields":["set_instrumen","batch","hasil_pencucian"],"roles":["cssd"]},{"label":"Sterilisasi","fields":["mesin_siklus","indikator_sterilisasi"],"roles":["cssd"]},{"label":"Release","fields":["hasil_verifikasi","kedaluwarsa"],"roles":["cssd"]},{"label":"Distribusi","fields":["unit_tujuan","bukti_serah_terima"],"roles":["cssd"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-diet','Gizi & Dapur Pasien',true,ARRAY['nutrition'],'[{"label":"Review diet","fields":["referensi_order_diet","alergi","status_puasa"],"roles":["nutrition"]},{"label":"Produksi porsi","fields":["menu","jumlah_porsi","waktu_makan"],"roles":["nutrition"]},{"label":"Distribusi & penerimaan","fields":["bangsal","bukti_penerimaan"],"roles":["nutrition"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-transfusion','Bank Darah & Transfusi',true,ARRAY['lab','analis'],'[{"label":"Permintaan darah","fields":["referensi_order","komponen","identifikasi_pasien"],"roles":["doctor","dokter","clinical_governance"]},{"label":"Verifikasi komponen","fields":["referensi_komponen","referensi_kompatibilitas"],"roles":["lab","analis"]},{"label":"Transfusi & monitoring","fields":["referensi_pemberian","referensi_monitoring","reaksi_transfusi"],"roles":["nurse","perawat"]},{"label":"Evaluasi","fields":["referensi_evaluasi","disposisi_komponen"],"roles":["doctor","dokter","clinical_governance"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-ppi','PPI & Surveilans Infeksi',true,ARRAY['nurse','perawat'],'[{"label":"Identifikasi risiko","fields":["referensi_surveilans","kebutuhan_isolasi"],"roles":["nurse","perawat"]},{"label":"Tindak lanjut","fields":["referensi_intervensi","audit_kepatuhan"],"roles":["nurse","perawat"]},{"label":"Review efektivitas","fields":["hasil_review","rencana_lanjutan"],"roles":["doctor","dokter","clinical_governance"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-ward-pharmacy','Farmasi Bangsal & Unit Dose',true,ARRAY['pharmacist','apoteker'],'[{"label":"Skrining & rekonsiliasi","fields":["referensi_resep","referensi_rekonsiliasi"],"roles":["pharmacist","apoteker"]},{"label":"Dispensing","fields":["referensi_dispensing","batch_kedaluwarsa"],"roles":["pharmacist","apoteker"]},{"label":"Pemberian & retur","fields":["referensi_mar","referensi_retur"],"roles":["nurse","perawat"]},{"label":"Penutupan rekonsiliasi","fields":["hasil_rekonsiliasi"],"roles":["pharmacist","apoteker"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-transport','Transport Pasien & Ambulans',true,ARRAY['porter'],'[{"label":"Dispatch","fields":["asal","tujuan","petugas_kendaraan"],"roles":["porter"]},{"label":"Pengambilan","fields":["konfirmasi_identitas","waktu_pengambilan"],"roles":["porter"]},{"label":"Serah terima tujuan","fields":["waktu_tiba","bukti_penerimaan"],"roles":["porter"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-critical-care','ICU, HCU & Perawatan Neonatal',true,ARRAY['nurse','perawat'],'[{"label":"Persiapan unit","fields":["referensi_admisi","kesiapan_perangkat"],"roles":["nurse","perawat"]},{"label":"Pemantauan","fields":["referensi_flowsheet","referensi_balance_cairan"],"roles":["nurse","perawat"]},{"label":"Review & transfer","fields":["referensi_review_dpjp","unit_tujuan"],"roles":["doctor","dokter","clinical_governance"]},{"label":"Handover","fields":["konfirmasi_penerima"],"roles":["nurse","perawat"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-maternity','Persalinan & Perinatologi',true,ARRAY['midwife','bidan','doctor','dokter'],'[{"label":"Admisi ibu","fields":["referensi_asesmen","rencana_persalinan"],"roles":["midwife","bidan","doctor","dokter"]},{"label":"Persalinan","fields":["referensi_partograf","referensi_laporan"],"roles":["midwife","bidan","doctor","dokter"]},{"label":"Identifikasi ibu bayi","fields":["referensi_identitas_bayi","verifikasi_gelang"],"roles":["midwife","bidan","doctor","dokter"]},{"label":"Serah terima","fields":["unit_tujuan","konfirmasi_penerima"],"roles":["midwife","bidan","doctor","dokter"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-day-care','Hemodialisis & Kemoterapi',true,ARRAY['nurse','perawat'],'[{"label":"Jadwal & persiapan","fields":["jenis_layanan","jadwal_kursi_mesin","referensi_order"],"roles":["nurse","perawat"]},{"label":"Pelaksanaan sesi","fields":["referensi_catatan_sesi","referensi_bahan"],"roles":["nurse","perawat"]},{"label":"Review & tindak lanjut","fields":["referensi_review","jadwal_berikutnya"],"roles":["doctor","dokter","clinical_governance"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-linen','Laundry & Linen',false,ARRAY['housekeeping'],'[{"label":"Pengambilan","fields":["unit_asal","jumlah_jenis","kondisi_linen"],"roles":["housekeeping"]},{"label":"Pencucian","fields":["batch_pencucian","hasil_pemeriksaan"],"roles":["housekeeping"]},{"label":"Distribusi","fields":["unit_tujuan","jumlah_distribusi","selisih"],"roles":["housekeeping"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-facility','Fasilitas & Utilitas RS',false,ARRAY['facility'],'[{"label":"Triase kerusakan","fields":["lokasi_kerusakan","dampak_layanan","prioritas_perbaikan"],"roles":["facility"]},{"label":"Perbaikan","fields":["tindakan_perbaikan","referensi_material"],"roles":["facility"]},{"label":"Verifikasi layanan","fields":["hasil_uji","konfirmasi_unit"],"roles":["facility"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;
INSERT INTO public.rs_workflow_types(code,label,patient_required,owner_roles,stages) VALUES ('rs-mortuary','Pelayanan & Serah Terima Jenazah',true,ARRAY['nurse','perawat'],'[{"label":"Identifikasi & penerimaan","fields":["referensi_kematian","verifikasi_identitas","lokasi_penyimpanan"],"roles":["nurse","perawat"]},{"label":"Review dokumen","fields":["referensi_dokumen","identitas_penerima"],"roles":["admin","admin_faskes","nurse","perawat"]},{"label":"Serah terima","fields":["bukti_serah_terima","waktu_serah_terima"],"roles":["admin","admin_faskes","nurse","perawat"]}]'::jsonb) ON CONFLICT(code) DO NOTHING;

-- OWNED_BY: generic. Existing bed ownership must be mapped in preflight.
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
DROP POLICY IF EXISTS rs_bed_read ON public.inpatient_beds;
CREATE POLICY rs_bed_read ON public.inpatient_beds FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.rs_can_read(NULL));
DROP POLICY IF EXISTS rs_bed_role_guard ON public.inpatient_beds;
CREATE POLICY rs_bed_role_guard ON public.inpatient_beds AS RESTRICTIVE FOR SELECT TO authenticated USING(public.rs_can_read(NULL));
DROP POLICY IF EXISTS rs_stay_role_guard ON public.inpatient_stays;
CREATE POLICY rs_stay_role_guard ON public.inpatient_stays AS RESTRICTIVE FOR SELECT TO authenticated USING(public.rs_can_read(NULL));
REVOKE INSERT,UPDATE,DELETE ON public.inpatient_beds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.inpatient_beds,public.inpatient_stays TO authenticated;
DROP POLICY IF EXISTS rs_reservations_read ON public.rs_bed_reservations;
CREATE POLICY rs_reservations_read ON public.rs_bed_reservations FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id());
DROP POLICY IF EXISTS rs_reservations_read ON public.rs_bed_reservations;
CREATE POLICY rs_reservations_read ON public.rs_bed_reservations FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.rs_can_read(NULL));
REVOKE ALL ON public.rs_bed_reservations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.rs_bed_reservations TO authenticated;

CREATE TABLE IF NOT EXISTS public.rs_bed_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  reservation_id bigint NOT NULL REFERENCES public.rs_bed_reservations(id),
  actor_id uuid NOT NULL, before_data jsonb, after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rs_bed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rs_bed_events_read ON public.rs_bed_events;
CREATE POLICY rs_bed_events_read ON public.rs_bed_events FOR SELECT TO authenticated USING(tenant_id=public.current_tenant_id() AND public.rs_can_read(NULL));
REVOKE ALL ON public.rs_bed_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.rs_bed_events TO authenticated;
CREATE OR REPLACE FUNCTION public.rs_bed_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO rs_bed_events(tenant_id,reservation_id,actor_id,before_data,after_data)
  VALUES(NEW.tenant_id,NEW.id,auth.uid(),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rs_bed_audit ON public.rs_bed_reservations;
CREATE TRIGGER rs_bed_audit AFTER INSERT OR UPDATE ON public.rs_bed_reservations FOR EACH ROW EXECUTE FUNCTION public.rs_bed_audit();

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

CREATE OR REPLACE FUNCTION public.rs_bed_capacity()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM rs_assert_actor(ARRAY['admin','admin_faskes','nurse','perawat','doctor','dokter']);
  SELECT jsonb_build_object('active',count(*),'occupied',count(*) FILTER(WHERE b.status='Terisi'),
    'cleaning',count(*) FILTER(WHERE b.status='Dibersihkan'),'repair',count(*) FILTER(WHERE b.status='Perbaikan'),
    'reserved',count(*) FILTER(WHERE b.status='Kosong' AND EXISTS(SELECT 1 FROM rs_bed_reservations r WHERE r.bed_id=b.id AND r.status='reserved' AND r.expires_at>now())),
    'available',count(*) FILTER(WHERE b.status='Kosong' AND NOT EXISTS(SELECT 1 FROM rs_bed_reservations r WHERE r.bed_id=b.id AND r.status='reserved' AND r.expires_at>now())))
  INTO v_result FROM inpatient_beds b WHERE b.tenant_id=public.current_tenant_id() AND coalesce(b.is_active,true);
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.rs_save_beds(p_id bigint,p_beds jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_item jsonb;v_row inpatient_beds;v_rows jsonb:='[]';v_tenant uuid:=public.current_tenant_id();
BEGIN
  PERFORM rs_assert_stage(ARRAY['super_admin','head_operation','direktur','admin','admin_faskes']);
  IF jsonb_typeof(p_beds) IS DISTINCT FROM 'array' OR jsonb_array_length(p_beds) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Kirim 1–20 bed'; END IF;
  IF p_id IS NOT NULL AND jsonb_array_length(p_beds)<>1 THEN RAISE EXCEPTION 'Edit hanya satu bed'; END IF;
  FOR v_item IN SELECT jsonb_array_elements(p_beds) LOOP
    IF length(trim(coalesce(v_item->>'bed_no','')))<1 THEN RAISE EXCEPTION 'Nomor bed wajib'; END IF;
    IF NOT EXISTS(SELECT 1 FROM inpatient_wards WHERE id=(v_item->>'ward_id')::bigint) OR NOT EXISTS(SELECT 1 FROM inpatient_classes WHERE code=v_item->>'class_code') THEN RAISE EXCEPTION 'Bangsal/kelas tidak ditemukan'; END IF;
    IF p_id IS NULL THEN
      INSERT INTO inpatient_beds(tenant_id,ward_id,class_code,room_no,bed_no,notes,status,is_active)
      VALUES(v_tenant,(v_item->>'ward_id')::bigint,v_item->>'class_code',v_item->>'room_no',v_item->>'bed_no',v_item->>'notes','Kosong',true) RETURNING * INTO v_row;
    ELSE
      SELECT * INTO v_row FROM inpatient_beds WHERE id=p_id AND tenant_id=v_tenant FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Bed tidak ditemukan pada tenant aktif'; END IF;
      IF v_row.status='Terisi' OR EXISTS(SELECT 1 FROM rs_bed_reservations WHERE bed_id=p_id AND status='reserved' AND expires_at>now()) THEN RAISE EXCEPTION 'Bed sedang terisi/direservasi; identitas tidak dapat diubah'; END IF;
      UPDATE inpatient_beds SET ward_id=(v_item->>'ward_id')::bigint,class_code=v_item->>'class_code',room_no=v_item->>'room_no',bed_no=v_item->>'bed_no',notes=v_item->>'notes',updated_at=now() WHERE id=p_id RETURNING * INTO v_row;
    END IF;
    PERFORM write_audit('rs.bed_master','inpatient_beds',v_row.id::text,'Perubahan master bed terotorisasi',NULL);
    v_rows:=v_rows || jsonb_build_array(to_jsonb(v_row));
  END LOOP;
  RETURN v_rows;
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
    PERFORM rs_assert_stage(ARRAY['doctor','dokter']);
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
  IF NEW.status='Dibersihkan' AND (OLD.status<>'Dibersihkan' OR OLD.cleanup_order_id IS NULL) THEN
    INSERT INTO rs_work_orders(tenant_id,kind,title,location,request_key,created_by,details)
    VALUES(NEW.tenant_id,'rs-housekeeping','Pembersihan bed ' || NEW.bed_no,coalesce(NEW.room_no,'Bangsal'),
      'clean-' || NEW.id || '-' || txid_current(),auth.uid(),jsonb_build_object('bed_id',NEW.id)) RETURNING * INTO v_order;
    NEW.cleanup_order_id:=v_order.id;
    INSERT INTO rs_work_events(tenant_id,order_id,actor_id,action,to_stage,evidence,request_key)
    VALUES(NEW.tenant_id,v_order.id,auth.uid(),'create',0,jsonb_build_object('bed_id',NEW.id),v_order.request_key);
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
REVOKE ALL ON FUNCTION public.rs_request_bed(bigint,text,text),public.rs_allocate_bed(bigint,bigint,integer),public.rs_cancel_bed(bigint,text),public.rs_bed_capacity(),public.rs_stay_guard(),public.rs_bed_guard(),public.rs_housekeeping_release(),public.rs_bed_audit() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rs_request_bed(bigint,text,text),public.rs_allocate_bed(bigint,bigint,integer),public.rs_cancel_bed(bigint,text),public.rs_bed_capacity() TO authenticated;

-- Extend Super Admin provisioning with hospital roles; existing grants preserved.
CREATE OR REPLACE FUNCTION public.create_auth_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_corporate_id bigint,
  p_corp_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_tenant uuid;
  v_user_id uuid;
  v_existing_tenant uuid;
  v_email text := lower(btrim(p_email));
  v_role text := lower(btrim(coalesce(p_role, 'viewer')));
  v_password_hash text;
  v_instance uuid;
BEGIN
  SELECT lower(role), tenant_id INTO v_actor_role, v_tenant
    FROM public.user_profiles WHERE id = v_actor;
  IF v_actor IS NULL OR v_actor_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Hanya Super Admin yang dapat membuat akun.';
  END IF;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant Super Admin belum terpasang.';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Format email tidak valid.';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password awal minimal 8 karakter.';
  END IF;
  IF p_full_name IS NULL OR length(btrim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Nama lengkap wajib diisi.';
  END IF;
  IF v_role NOT IN (
    'super_admin','head_operation','direktur','manager','spv','sales',
    'operasional','hrd_staff','finance_staff','ihc','patient','dokter',
    'vendor','viewer','corporate','admin','admin_faskes','tech','nurse','pharmacist','housekeeping','cssd','nutrition','porter','facility','midwife'
  ) THEN
    RAISE EXCEPTION 'Role % tidak dikenali.', v_role;
  END IF;

  -- Never store a plaintext password. If pgcrypto is unavailable, fail closed.
  v_password_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
  SELECT id, instance_id INTO v_user_id, v_instance
    FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    SELECT tenant_id INTO v_existing_tenant
      FROM public.user_profiles WHERE id = v_user_id;
    IF v_existing_tenant IS NOT NULL AND v_existing_tenant IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'Akun sudah terdaftar pada tenant lain.';
    END IF;
    -- Existing accounts are linked/upserted without resetting their password.
    -- Password changes stay in the authenticated reset-password flow.
    UPDATE auth.users
       SET email = v_email,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           phone = nullif(btrim(p_phone), ''),
           phone_confirmed_at = CASE WHEN nullif(btrim(p_phone), '') IS NULL THEN NULL ELSE coalesce(phone_confirmed_at, now()) END,
           updated_at = now()
     WHERE id = v_user_id;
  ELSE
    v_user_id := gen_random_uuid();
    SELECT instance_id INTO v_instance FROM auth.users LIMIT 1;
    v_instance := coalesce(v_instance, '00000000-0000-0000-0000-000000000000'::uuid);
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_instance, v_user_id, 'authenticated', 'authenticated', v_email,
      v_password_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', btrim(p_full_name)), false,
      now(), now(), nullif(btrim(p_phone), ''),
      CASE WHEN nullif(btrim(p_phone), '') IS NULL THEN NULL ELSE now() END,
      '', '', '', ''
    );
  END IF;

  INSERT INTO public.user_profiles (
    id, tenant_id, full_name, email, phone, role, corporate_id, corp_role,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_tenant, btrim(p_full_name), v_email,
    nullif(btrim(p_phone), ''), v_role, p_corporate_id, nullif(btrim(p_corp_role), ''),
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    corporate_id = EXCLUDED.corporate_id,
    corp_role = EXCLUDED.corp_role,
    updated_at = now();

  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    INSERT INTO public.activity_logs(action, table_name, record_id, record_name, description, user_id, user_name, created_at)
    VALUES('user.provisioned', 'user_profiles', v_user_id::text, btrim(p_full_name),
           'Akun Auth dan profile tenant dibuat/ditautkan oleh Super Admin.', v_actor,
           coalesce((SELECT full_name FROM public.user_profiles WHERE id = v_actor), v_actor::text), now());
  END IF;

  RETURN v_user_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_user_access(
  p_user_id uuid,
  p_role text,
  p_pages text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_tenant uuid;
  v_target_tenant uuid;
  v_role text := lower(btrim(coalesce(p_role, 'viewer')));
  v_page text;
BEGIN
  SELECT lower(role), tenant_id INTO v_actor_role, v_tenant
    FROM public.user_profiles WHERE id = v_actor;
  IF v_actor_role <> 'super_admin' OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'Hanya Super Admin yang dapat mengubah role.';
  END IF;
  SELECT tenant_id INTO v_target_tenant FROM public.user_profiles WHERE id = p_user_id;
  IF v_target_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'User berada di tenant berbeda atau tidak ditemukan.';
  END IF;
  IF v_role NOT IN (
    'super_admin','head_operation','direktur','manager','spv','sales',
    'operasional','hrd_staff','finance_staff','ihc','patient','dokter',
    'vendor','viewer','corporate','admin','admin_faskes','tech','nurse','pharmacist','housekeeping','cssd','nutrition','porter','facility','midwife'
  ) THEN
    RAISE EXCEPTION 'Role % tidak dikenali.', v_role;
  END IF;
  IF coalesce(array_length(p_pages, 1), 0) > 250 THEN
    RAISE EXCEPTION 'Jumlah menu terlalu banyak.';
  END IF;
  FOREACH v_page IN ARRAY coalesce(p_pages, ARRAY[]::text[]) LOOP
    IF nullif(btrim(v_page), '') IS NULL THEN
      RAISE EXCEPTION 'Daftar menu berisi nilai kosong.';
    END IF;
  END LOOP;

  UPDATE public.user_profiles SET role = v_role, updated_at = now() WHERE id = p_user_id;
  DELETE FROM public.user_pages WHERE user_id = p_user_id;
  INSERT INTO public.user_pages(user_id, page)
  SELECT p_user_id, btrim(x) FROM unnest(coalesce(p_pages, ARRAY[]::text[])) x
  ON CONFLICT DO NOTHING;
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    INSERT INTO public.activity_logs(action, table_name, record_id, record_name, description, user_id, user_name, created_at)
    VALUES('user.access_changed', 'user_profiles', p_user_id::text, p_user_id::text,
           'Role dan akses menu diperbarui oleh Super Admin.', v_actor,
           coalesce((SELECT full_name FROM public.user_profiles WHERE id = v_actor), v_actor::text), now());
  END IF;
  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'role', v_role,
                            'page_count', coalesce(array_length(p_pages, 1), 0));
END;
$$;
INSERT INTO public.roles(kode,label,warna) VALUES('nurse','Perawat','#0d6470') ON CONFLICT(kode) DO NOTHING;
INSERT INTO public.roles(kode,label,warna) VALUES('pharmacist','Apoteker','#0d6470') ON CONFLICT(kode) DO NOTHING;
INSERT INTO public.roles(kode,label,warna) VALUES('housekeeping','Housekeeping','#0d6470') ON CONFLICT(kode) DO NOTHING;
INSERT INTO public.roles(kode,label,warna) VALUES('cssd','Petugas CSSD','#0d6470') ON CONFLICT(kode) DO NOTHING;
INSERT INTO public.roles(kode,label,warna) VALUES('nutrition','Petugas Gizi','#0d6470') ON CONFLICT(kode) DO NOTHING;
INSERT INTO public.roles(kode,label,warna) VALUES('porter','Transport Pasien','#0d6470') ON CONFLICT(kode) DO NOTHING;
INSERT INTO public.roles(kode,label,warna) VALUES('facility','Teknisi Fasilitas','#0d6470') ON CONFLICT(kode) DO NOTHING;
INSERT INTO public.roles(kode,label,warna) VALUES('midwife','Bidan','#0d6470') ON CONFLICT(kode) DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-patient-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-bed-reservation' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-housekeeping' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-nurse-station' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-igd-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-inpatient-billing' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-capacity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-operating-room' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-cssd' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-diet' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-transfusion' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-ppi' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-ward-pharmacy' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-transport' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-critical-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-maternity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-day-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-linen' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-facility' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'super_admin','rs-mortuary' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='super_admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-patient-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-bed-reservation' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-housekeeping' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-nurse-station' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-igd-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-inpatient-billing' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-capacity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-operating-room' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-cssd' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-diet' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-transfusion' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-ppi' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-ward-pharmacy' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-transport' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-critical-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-maternity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-day-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-linen' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-facility' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'head_operation','rs-mortuary' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='head_operation') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-patient-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-bed-reservation' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-housekeeping' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-nurse-station' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-igd-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-inpatient-billing' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-capacity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-operating-room' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-cssd' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-diet' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-transfusion' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-ppi' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-ward-pharmacy' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-transport' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-critical-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-maternity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-day-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-linen' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-facility' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'direktur','rs-mortuary' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='direktur') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-patient-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-bed-reservation' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-housekeeping' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-nurse-station' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-igd-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-capacity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-operating-room' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-transfusion' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-ppi' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-ward-pharmacy' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-critical-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-day-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','rs-mortuary' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','dashboard' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nurse','inpatient' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nurse') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'pharmacist','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='pharmacist') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'pharmacist','rs-ward-pharmacy' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='pharmacist') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'pharmacist','dashboard' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='pharmacist') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'housekeeping','rs-housekeeping' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='housekeeping') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'housekeeping','rs-linen' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='housekeeping') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'housekeeping','dashboard' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='housekeeping') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'cssd','rs-cssd' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='cssd') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'cssd','dashboard' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='cssd') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nutrition','rs-diet' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nutrition') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'nutrition','dashboard' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='nutrition') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'porter','rs-transport' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='porter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'porter','dashboard' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='porter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'facility','rs-facility' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='facility') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'facility','dashboard' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='facility') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'midwife','rs-maternity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='midwife') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'midwife','dashboard' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='midwife') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-patient-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-bed-reservation' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-igd-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-capacity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-operating-room' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-transfusion' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-ppi' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-critical-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-maternity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','rs-day-care' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'dokter','inpatient' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='dokter') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'operasional','rs-transfusion' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='operasional') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'finance_staff','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='finance_staff') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'finance_staff','rs-inpatient-billing' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='finance_staff') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin','rs-patient-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin','rs-bed-reservation' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin','rs-housekeeping' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin','rs-igd-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin','rs-capacity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin','rs-operating-room' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin','rs-mortuary' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin_faskes','rs-patient-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin_faskes') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin_faskes','rs-bed-reservation' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin_faskes') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin_faskes','rs-housekeeping' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin_faskes') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin_faskes','rs-discharge' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin_faskes') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin_faskes','rs-igd-flow' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin_faskes') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin_faskes','rs-capacity' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin_faskes') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin_faskes','rs-operating-room' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin_faskes') ON CONFLICT DO NOTHING;
INSERT INTO public.role_pages(role_kode,page) SELECT 'admin_faskes','rs-mortuary' WHERE EXISTS(SELECT 1 FROM public.roles WHERE kode='admin_faskes') ON CONFLICT DO NOTHING;
REVOKE ALL ON FUNCTION public.create_auth_user(text,text,text,text,text,bigint,text),public.set_user_access(uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_auth_user(text,text,text,text,text,bigint,text),public.set_user_access(uuid,text,text[]) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.rs_assert_stage(text[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.rs_save_beds(bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rs_save_beds(bigint,jsonb) TO authenticated;
COMMIT;
