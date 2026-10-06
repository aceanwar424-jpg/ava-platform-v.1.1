-- OWNED_BY: generic. Approved for local schema/test; production requires preflight/UAT.
BEGIN;
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
    IF length(trim(coalesce(p_evidence->>'reason','')))<3 THEN RAISE EXCEPTION 'Alasan pembatalan wajib'; END IF;
    UPDATE rs_work_orders SET status='cancelled' WHERE id=p_id;
  ELSIF p_action='advance' THEN
    IF v_order.assignee_id IS NULL THEN RAISE EXCEPTION 'Tugaskan petugas sebelum melanjutkan'; END IF;
    v_stage := v_type.stages->v_order.stage;
    IF v_stage IS NULL THEN RAISE EXCEPTION 'Tahap workflow tidak valid'; END IF;
    PERFORM rs_assert_actor(ARRAY(SELECT jsonb_array_elements_text(v_stage->'roles')));
    FOR v_field IN SELECT jsonb_array_elements_text(v_stage->'fields') LOOP
      IF length(trim(coalesce(p_evidence->>v_field,'')))<3 THEN RAISE EXCEPTION 'Bukti % wajib diisi',v_field; END IF;
    END LOOP;
    IF v_stage->>'receiver'='true' AND v_actor=v_order.created_by THEN RAISE EXCEPTION 'Penerima handover harus berbeda dari pengirim'; END IF;
    v_next := v_order.stage+1;
    UPDATE rs_work_orders SET stage=v_next, details=details || jsonb_build_object(v_order.stage::text,p_evidence),
      status=CASE WHEN v_next=jsonb_array_length(v_type.stages) THEN 'completed' ELSE 'active' END WHERE id=p_id;
  ELSE RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
  UPDATE rs_work_orders SET version=version+1,updated_at=now() WHERE id=p_id RETURNING * INTO v_order;
  INSERT INTO rs_work_events(tenant_id,order_id,actor_id,action,from_stage,to_stage,evidence,request_key)
  VALUES(v_tenant,p_id,v_actor,p_action,CASE WHEN p_action='advance' THEN v_next-1 ELSE v_next END,v_next,p_evidence,p_request_key);
  RETURN to_jsonb(v_order);
END $$;
REVOKE ALL ON FUNCTION public.rs_assert_actor(text[]),public.rs_staff_directory(),public.rs_create_order(text,text,text,bigint,text,text),public.rs_transition_order(bigint,integer,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rs_staff_directory(),public.rs_create_order(text,text,text,bigint,text,text),public.rs_transition_order(bigint,integer,text,jsonb,text) TO authenticated;
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
COMMIT;
