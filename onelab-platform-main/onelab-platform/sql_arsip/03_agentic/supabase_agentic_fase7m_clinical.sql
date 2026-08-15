-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7M (PHARMACY & INPATIENT)
--   💊 PHARMACY — PHARMA_HEAD → PHARMA_STOCK · PHARMA_SAFETY · PHARMA_NARCO
--   🏥 INPATIENT — WARD_HEAD → WARD_BED · WARD_LOS · WARD_REV
-- Baca skema nyata: pharmacy_drugs/batches/dispenses/prescriptions/
-- narcotic_register · inpatient_beds/stays/charges.
-- GUARDRAIL KLINIS: agent hanya MEMANTAU & FLAG. Keputusan farmasi (interaksi,
-- substitusi), penyerahan obat, dan discharge SELALU manusia (apoteker/dokter).
-- Agent tak pernah mengubah data farmasi/rawat inap.
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 + modul pharmacy/inpatient terpasang. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. AGENTS
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES
-- PHARMACY
('PHARMA_HEAD','Kepala Farmasi','Pharmacy Assurance','HEAD','PHARMACY',
 'Anda Kepala Farmasi OneLab. Pimpin: PHARMA_STOCK (kedaluwarsa & stok), PHARMA_SAFETY (keselamatan resep), PHARMA_NARCO (register narkotika/psikotropika). Jaga mutu, keamanan, & kepatuhan farmasi. Anda hanya MEMANTAU & FLAG — keputusan klinis farmasi & penyerahan obat SELALU apoteker/manusia. Prioritaskan: obat kedaluwarsa masih ada stok, warning interaksi/alergi yang di-override, dan ketaatan register narkotika.',
 'light', true),
('PHARMA_STOCK','Stok & Kedaluwarsa Obat','FEFO Obat & Stok Minimum','PHARMA_HEAD','PHARMACY',
 'Anda pengawas stok obat OneLab. Pantau batch obat mendekati/melewati kedaluwarsa (FEFO) dan obat di bawah stok minimum (utamakan formularium & obat kritis). Hanya flag; penarikan/pengadaan oleh manusia.',
 'light', true),
('PHARMA_SAFETY','Keselamatan Resep','Interaksi/Alergi & Dispense Terkontrol','PHARMA_HEAD','PHARMACY',
 'Anda pengawas keselamatan resep OneLab. Sorot resep di mana warning INTERAKSI atau ALERGI di-OVERRIDE (dilewati) — ini butuh tinjauan apoteker. Sorot juga penyerahan obat terkontrol tanpa identitas penerima. JANGAN memberi nasihat klinis/mengubah resep — hanya menandai untuk verifikasi manusia.',
 'main', true),
('PHARMA_NARCO','Register Narkotika','Kepatuhan Narkotika & Psikotropika','PHARMA_HEAD','PHARMACY',
 'Anda pengawas register narkotika/psikotropika OneLab (kepatuhan regulasi). Pantau pergerakan register, sorot pengeluaran (OUT) tanpa identitas penerima, dan pastikan pencatatan lengkap. Hanya flag; koreksi & pelaporan resmi oleh apoteker penanggung jawab.',
 'light', true),
-- INPATIENT
('WARD_HEAD','Kepala Rawat Inap','Inpatient Operations','HEAD','INPATIENT',
 'Anda Kepala Operasional Rawat Inap OneLab. Pimpin: WARD_BED (okupansi), WARD_LOS (lama rawat), WARD_REV (charge/pendapatan). Jaga efisiensi bed & tidak ada pendapatan bocor. Hanya MEMANTAU & FLAG — keputusan klinis & discharge SELALU dokter/manusia.',
 'light', true),
('WARD_BED','Okupansi Bed','Manajemen Tempat Tidur','WARD_HEAD','INPATIENT',
 'Anda pemantau okupansi bed OneLab. Ringkas ketersediaan bed per status; sorot bila okupansi sangat tinggi (butuh tambahan) atau bed tak terpakai. Hanya informasi.',
 'light', true),
('WARD_LOS','Lama Rawat (LOS)','Length of Stay','WARD_HEAD','INPATIENT',
 'Anda pemantau LOS OneLab. Sorot pasien yang dirawat jauh lebih lama dari biasanya (mis. >7 hari) agar tim klinis meninjau. Hanya flag — keputusan discharge manusia.',
 'light', true),
('WARD_REV','Pendapatan Rawat Inap','Charge & Kebocoran','WARD_HEAD','INPATIENT',
 'Anda pengawas charge rawat inap OneLab. Sorot pasien pulang dengan charge nol/janggal (kemungkinan biaya belum dicatat/ditagih) — cegah kebocoran pendapatan. Hanya flag; koreksi tagihan oleh manusia.',
 'light', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier, active=true;

-- ══════════════════════════════════════════════════════════════════════
-- §B. DECISION RIGHTS — semua R1 (flag; keputusan klinis/farmasi = manusia)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('PHARMA_TICK','R1','AUTO_PUBLISH_NOQA',NULL,0,'Log patroli farmasi'),
('DRUG_EXPIRY','R1','AUTO_PUBLISH_NOQA',NULL,0,'Kedaluwarsa & stok obat (flag)'),
('RX_SAFETY','R1','AUTO_PUBLISH_NOQA',NULL,0,'Keselamatan resep: warning di-override (flag)'),
('NARCO_AUDIT','R1','AUTO_PUBLISH_NOQA',NULL,0,'Kepatuhan register narkotika (flag)'),
('WARD_TICK','R1','AUTO_PUBLISH_NOQA',NULL,0,'Log patroli rawat inap'),
('BED_WATCH','R1','AUTO_PUBLISH_NOQA',NULL,0,'Okupansi bed'),
('LOS_WATCH','R1','AUTO_PUBLISH_NOQA',NULL,0,'Lama rawat (LOS)'),
('CHARGE_AUDIT','R1','AUTO_PUBLISH_NOQA',NULL,0,'Charge rawat inap (flag kebocoran)')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §C. RPC — pharmacy scan
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_pharma_scan(p_expiry_days INT DEFAULT 90)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'expiring', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'drug_code', b.drug_code, 'batch_no', b.batch_no, 'expiry_date', b.expiry_date,
        'qty_remaining', b.qty_remaining, 'days_left', (b.expiry_date - CURRENT_DATE)) ORDER BY b.expiry_date)
      FROM public.pharmacy_batches b
      WHERE COALESCE(b.qty_remaining,0) > 0 AND b.expiry_date IS NOT NULL
        AND b.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (COALESCE(p_expiry_days,90) || ' days')::interval), '[]'::jsonb),
    'expired', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'drug_code', drug_code, 'batch_no', batch_no, 'expiry_date', expiry_date, 'qty_remaining', qty_remaining))
      FROM public.pharmacy_batches WHERE COALESCE(qty_remaining,0) > 0 AND expiry_date < CURRENT_DATE), '[]'::jsonb),
    'low_stock', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'drug_code', drug_code, 'generic_name', generic_name, 'drug_class', drug_class, 'stock_qty', stock_qty, 'min_stock', min_stock))
      FROM public.pharmacy_drugs WHERE COALESCE(is_active,true) AND COALESCE(min_stock,0) > 0 AND COALESCE(stock_qty,0) <= min_stock), '[]'::jsonb),
    'override_rx', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'rx_number', rx_number, 'patient_name', patient_name, 'doctor_name', doctor_name, 'rx_date', rx_date,
        'kind', CASE WHEN COALESCE(allergy_override,'')<>'' AND COALESCE(interaction_override,'')<>'' THEN 'Alergi+Interaksi'
                     WHEN COALESCE(allergy_override,'')<>'' THEN 'Alergi' ELSE 'Interaksi' END) ORDER BY rx_date DESC)
      FROM public.prescriptions
      WHERE (COALESCE(interaction_override,'')<>'' OR COALESCE(allergy_override,'')<>'')
        AND rx_date > CURRENT_DATE - 30), '[]'::jsonb),
    'controlled_no_id', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'dispense_number', dispense_number, 'patient_name', patient_name, 'dispensed_at', dispensed_at))
      FROM public.pharmacy_dispenses
      WHERE has_controlled AND COALESCE(recipient_id_no,'')='' AND dispensed_at > now()-interval '30 days'), '[]'::jsonb),
    'summary', jsonb_build_object(
      'expiring', (SELECT count(*) FROM public.pharmacy_batches WHERE COALESCE(qty_remaining,0)>0 AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (COALESCE(p_expiry_days,90)||' days')::interval),
      'expired', (SELECT count(*) FROM public.pharmacy_batches WHERE COALESCE(qty_remaining,0)>0 AND expiry_date < CURRENT_DATE),
      'low_stock', (SELECT count(*) FROM public.pharmacy_drugs WHERE COALESCE(is_active,true) AND COALESCE(min_stock,0)>0 AND COALESCE(stock_qty,0)<=min_stock),
      'override_rx', (SELECT count(*) FROM public.prescriptions WHERE (COALESCE(interaction_override,'')<>'' OR COALESCE(allergy_override,'')<>'') AND rx_date > CURRENT_DATE - 30),
      'controlled_no_id', (SELECT count(*) FROM public.pharmacy_dispenses WHERE has_controlled AND COALESCE(recipient_id_no,'')='' AND dispensed_at > now()-interval '30 days'),
      'narco_moves_30d', (SELECT count(*) FROM public.narcotic_register WHERE register_date > CURRENT_DATE - 30))
  );
$$;

-- ══════════════════════════════════════════════════════════════════════
-- §D. RPC — inpatient scan
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_inpatient_scan(p_los_days INT DEFAULT 7)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    'occupancy', jsonb_build_object(
      'total', (SELECT count(*) FROM public.inpatient_beds WHERE COALESCE(is_active,true)),
      'kosong', (SELECT count(*) FROM public.inpatient_beds WHERE COALESCE(is_active,true) AND status ILIKE 'kosong'),
      'terisi', (SELECT count(*) FROM public.inpatient_beds WHERE COALESCE(is_active,true) AND NOT (status ILIKE 'kosong'))),
    'long_stay', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'patient_name', patient_name, 'bed_no', bed_no, 'admit_diagnosis', admit_diagnosis,
        'days', round(EXTRACT(EPOCH FROM (now()-admitted_at))/86400.0,1)) ORDER BY admitted_at)
      FROM public.inpatient_stays
      WHERE discharged_at IS NULL AND COALESCE(status,'') <> 'Pulang'
        AND admitted_at < now() - (COALESCE(p_los_days,7) || ' days')::interval), '[]'::jsonb),
    'zero_charge', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'patient_name', patient_name, 'bed_no', bed_no, 'discharged_at', discharged_at, 'total_charges', total_charges))
      FROM public.inpatient_stays
      WHERE discharged_at IS NOT NULL AND discharged_at > now()-interval '7 days' AND COALESCE(total_charges,0) <= 0), '[]'::jsonb),
    'summary', jsonb_build_object(
      'occupancy_pct', (SELECT CASE WHEN count(*) FILTER (WHERE COALESCE(is_active,true))=0 THEN 0
        ELSE round(100.0 * count(*) FILTER (WHERE COALESCE(is_active,true) AND NOT (status ILIKE 'kosong')) / count(*) FILTER (WHERE COALESCE(is_active,true)),1) END
        FROM public.inpatient_beds),
      'admitted_now', (SELECT count(*) FROM public.inpatient_stays WHERE discharged_at IS NULL),
      'long_stay', (SELECT count(*) FROM public.inpatient_stays WHERE discharged_at IS NULL AND admitted_at < now()-(COALESCE(p_los_days,7)||' days')::interval),
      'zero_charge', (SELECT count(*) FROM public.inpatient_stays WHERE discharged_at IS NOT NULL AND discharged_at > now()-interval '7 days' AND COALESCE(total_charges,0)<=0))
  );
$$;

GRANT EXECUTE ON FUNCTION public.agentic_pharma_scan(INT), public.agentic_inpatient_scan(INT)
TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §E. ORG KICK — izinkan PHARMA_TICK & WARD_TICK
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_org_kick(p_type TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v JSONB; v_title TEXT;
BEGIN
  IF p_type NOT IN ('HEAD_TICK','IT_CHECK','SA_TICK','MKT_TICK','SCM_TICK','HR_TICK','LAB_TICK','FIN_TICK','GROWTH_TICK','CX_TICK','EXEC_DIGEST','PHARMA_TICK','WARD_TICK') THEN
    RAISE EXCEPTION 'Tipe organ tidak dikenal: %', p_type;
  END IF;
  IF EXISTS (SELECT 1 FROM agentic.tasks WHERE task_type=p_type AND status IN ('QUEUED','PROCESSING')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'masih ada yang antri/berjalan');
  END IF;
  v_title := CASE p_type
    WHEN 'PHARMA_TICK' THEN 'Farmasi: patroli kedaluwarsa · keselamatan · narkotika'
    WHEN 'WARD_TICK'   THEN 'Rawat Inap: patroli okupansi · LOS · charge'
    ELSE p_type END;
  IF v_title = p_type THEN
    v_title := CASE p_type
      WHEN 'HEAD_TICK' THEN 'HEAD: tick organisasi' WHEN 'IT_CHECK' THEN 'Kepala IT: pemeriksaan sistem'
      WHEN 'SA_TICK' THEN 'Service Assurance: patroli mutu & dokumen' WHEN 'MKT_TICK' THEN 'Marketing: patroli konten & kalender'
      WHEN 'SCM_TICK' THEN 'Supply Chain: patroli stok & kedaluwarsa' WHEN 'HR_TICK' THEN 'People: patroli kredensial nakes'
      WHEN 'LAB_TICK' THEN 'Lab Ops: patroli QC · TAT · nilai kritis' WHEN 'FIN_TICK' THEN 'Finance: patroli piutang & kas'
      WHEN 'GROWTH_TICK' THEN 'Growth: patroli prospek & kontrak' WHEN 'CX_TICK' THEN 'CX: patroli keluhan & umpan balik'
      WHEN 'EXEC_DIGEST' THEN 'Executive: digest lintas-domain' ELSE p_type END;
  END IF;
  v := public.agentic_create_task('ORG', p_type, v_title, COALESCE(p_payload,'{}'::jsonb));
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.agentic_org_kick(TEXT,JSONB) TO anon, authenticated, service_role;

SELECT 'Agentic Fase 7M siap — Pharmacy & Inpatient aktif (flag-only, klinis=manusia)' AS status;
