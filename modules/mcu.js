// ═══════════════════════════════════════════════════════════════
// MODULE: Project MCU B2B — v5
// 31 Stage (S01–S31), 6 Fase, Gate System, RAB terintegrasi
// Data flows: S01→S03→S04→S08→S15→S23→S25
// ═══════════════════════════════════════════════════════════════

// ── KONSTANTA FASE & STAGE ────────────────────────────────────
const MCU_PHASES = [
  { id:'F1', label:'Perencanaan & Penjualan',  color:'#0891B2', stages:['S01','S02','S03','S04','S05','S06'] },
  { id:'F2', label:'Persiapan & Mobilisasi',   color:'#7C3AED', stages:['S07','S08','S09','S10','S11','S12'] },
  { id:'F3', label:'Pelaksanaan Lapangan',      color:'#059669', stages:['S13','S14','S15','S16'] },
  { id:'F4', label:'Pasca MCU & QC',            color:'#D97706', stages:['S17','S18','S19','S20','S21','S22','S23','S24'] },
  { id:'F5', label:'Billing & Penutupan',       color:'#DC2626', stages:['S25','S26','S27','S28','S29'] },
  { id:'F6', label:'Evaluasi & Feedback',       color:'#6B7280', stages:['S30','S31'] },
];

const MCU_STAGES = {
  S01:{ id:'S01', no:1,  phase:'F1', name:'Discovery & Kebutuhan Klien',          pic:'Sales/AM',      icon:'🔍', form:'F-01-B2B',
    fields:['nama_perusahaan','industri_klien','pic_klien_nama_jabatan','pic_klien_kontak','sales_pic_internal',
      'target_peserta','kapasitas_per_hari','durasi_hari','preferensi_tanggal_1','waktu_pelaksanaan','lokasi_pelaksanaan','alamat_lokasi',
      'tujuan_mcu','jenis_parameter','fasilitas_dibutuhkan','kebutuhan_khusus_medis','emergency_support',
      'format_hasil','target_sla_hasil','bahasa_laporan','integrasi_sistem','primary_key_data','special_request',
      'jumlah_ruangan','kapasitas_listrik','koneksi_internet','suhu_ruang','akses_kendaraan','limbah_b3',
      'skema_pembayaran_s01','mg_diperlukan','dokumen_legalitas','risiko_diantisipasi','credit_hold_status',
      'kontak_pic_klien','kebutuhan_hardcopy'],
    gate:['credit_hold_status_clear','f01_lengkap'],
    gateLabel:'F-01 terisi lengkap + Status Credit Hold klien = CLEAR' },
  S02:{ id:'S02', no:2,  phase:'F1', name:'Mapping Parameter & Validasi Klinis',  pic:'Sales + PJ Medis', icon:'🧬', form:'F-02-B2B',
    fields:['nama_paket_mcu','dokter_pj_medis','admin_project_s02','kejelasan_parameter','kesesuaian_risiko_industri',
      'persyaratan_pra_analitik','kebutuhan_dokter_spesialis','catatan_klinis','konektivitas_autolog','bridging_his_lis',
      'parameter_belum_ada','status_mapping_final','parameter_risiko_tinggi','potensi_kendala','mitigasi_kendala','validasi_pj_medis'],
    gate:['f01_done','signoff_pj_medis'],
    gateLabel:'F-01 selesai + Sign-off PJ Medis + Admin Project' },
  S03:{ id:'S03', no:3,  phase:'F1', name:'Pra-Kalkulasi & Approval Harga (RAB)', pic:'Sales + Finance', icon:'💰', form:'F-03-B2B',
    fields:['nama_klien_s03','estimasi_peserta_s03','estimasi_peserta_per_hari','durasi_kegiatan_s03','lokasi_pelaksanaan_s03',
      'jenis_pelaksanaan_s03','mg_s03','harga_jual_per_pax','total_nilai_proyek_s03','estimasi_pph23','skema_addon','skema_pembayaran_s03',
      'tingkat_risiko_s03','faktor_risiko_s03','catatan_mitigasi_risiko','status_form_s03',
      'rab_hpp_total','rab_harga_per_peserta','rab_minimum_guarantee','approval_head_ops','margin_pct','catatan_harga',
      ...['estimasi_peserta','revenue','total_cogs','gross_profit','gross_margin_pct','cost_per_pax','harga_per_pax','profit_per_pax','bep','est_pph23']
        .flatMap(k=>['best','normal','worst'].map(s=>`skenario_${k}_${s}`))],
    gate:['f02_done','rab_exists'],
    gateLabel:'F-02 selesai + RAB sudah diisi & disetujui Head of Operations' },
  S04:{ id:'S04', no:4,  phase:'F1', name:'Penguncian Order MCU (F-05)',          pic:'Sales + SPV',   icon:'🔒', form:'F-05-B2B',
    fields:['no_po_kontrak','status_order_s04','pic_finance_klien','total_estimasi_peserta_s04','minimum_guarantee',
      'jenis_pelaksanaan_s04','tanggal_pelaksanaan_s04','durasi_kegiatan_s04','batas_manifest','total_nilai_proyek_s04',
      'termin_pembayaran','skema_pembayaran','mg_dasar_tagihan','ketentuan_addon','harga_per_peserta','sla_hasil_kontraktual',
      'laporan_individu','metode_pengiriman_s04','status_order_final','signed_by_sales','signed_by_spv'],
    gate:['f03_approved','signed_by_sales','signed_by_spv'],
    gateLabel:'F-03 disetujui + F-05 ditandatangani Sales & SPV Project' },
  S05:{ id:'S05', no:5,  phase:'F1', name:'Technical Meeting & Site Survey',      pic:'Sales + SPV',   icon:'📋', form:'F-TM-B2B',
    fields:['hari_tanggal_survey','waktu_pelaksanaan_tm','alamat_lokasi_onsite','pic_klien_tm','tim_survei_onelab',
      'suhu_status','suhu_catatan','listrik_status','listrik_catatan','toilet_status','toilet_catatan',
      'akses_logistik_status','akses_logistik_catatan','alur_ruangan_status','alur_ruangan_catatan','internet_status_tm','internet_catatan',
      'validasi_data_utama','konektivitas_internet_tm','printer_scanner','batas_manifest_tm','format_file_manifest',
      'risiko_internet_mati','risiko_addon','risiko_sampel_rusak','risiko_limbah_b3','risiko_alat_rusak','risiko_peserta_pingsan',
      'temuan_site','catatan_tm','signed_tm'],
    gate:['f05_locked'],
    gateLabel:'F-05 sudah dikunci (kedua tanda tangan terpenuhi)' },
  S06:{ id:'S06', no:6,  phase:'F1', name:'Handover Project ke SPV Project',      pic:'Sales → SPV',   icon:'🤝', form:'F-06-B2B',
    fields:[...[1,2,3,4,5,6,7].flatMap(n=>[`syarat${n}`,`syarat${n}_ket`]), ...[1,2,3,4,5,6,7,8].map(n=>`dok${n}`),
      'pic_spv_project','no_hp_pic','dokter_umum_qty','dokter_spesialis_jenis','analis_lab_qty','radiografer_qty',
      'admin_registrasi_qty','pic_admin_project','tingkat_risiko_s06','kesiapan_logistik','catatan_khusus_sales',
      'catatan_handover','signed_handover_sales','signed_handover_spv'],
    gate:['f05_done','7_syarat_handover'],
    gateLabel:'F-05 selesai + 7 syarat handover F-06 terpenuhi + tanda tangan kedua pihak' },
  S07:{ id:'S07', no:7,  phase:'F2', name:'Konfigurasi Sistem & Distribusi F-OPS-02', pic:'SPV + IT Ops', icon:'⚙️', form:'F-OPS-02',
    fields:['parameter_sistem','konfirmasi_it_ops','master_data_ready'],
    gate:['f06_done'],
    gateLabel:'F-06 Handover selesai & ditandatangani' },
  S08:{ id:'S08', no:8,  phase:'F2', name:'Database Cleansing & Master Data Peserta', pic:'Admin Project', icon:'🗃️', form:'F-OPS-02 (lampiran)',
    fields:['file_peserta_upload','jumlah_peserta_final','status_cleansing','validasi_admin','validasi_spv'],
    gate:['s07_done'],
    gateLabel:'S07 selesai + Master Data divalidasi Admin Project & SPV' },
  S09:{ id:'S09', no:9,  phase:'F2', name:'Pengajuan & Approval Dana Kas Gantung', pic:'SPV + Finance', icon:'💵', form:'F-OPS-01',
    fields:['no_order_s09','spv_pemohon','admin_project_s09','tanggal_pengajuan_s09',
      'metode_pencairan','nama_bank_cabang','no_rekening_s09','nama_pemilik_rekening',
      'plafon_f03','pengajuan_sekarang','selisih_plafon','status_plafon',
      'rab_ops_total','pengajuan_dana','approval_finance','dana_cair'],
    gate:['s07_done'],
    gateLabel:'S07/S08 paralel selesai + Finance verifikasi & cairkan dana' },
  S10:{ id:'S10', no:10, phase:'F2', name:'Persiapan Logistik, Alat & BMHP',     pic:'SPV + PIC BMHP', icon:'📦', form:'F-OPS-02 + F-CKL-01',
    fields:['total_peserta_final_s10','estimasi_durasi_s10','teknisi_pemeriksa','baterai_power_status',
      'kabel_aksesoris_status','sertifikat_kalibrasi_status','uji_koneksi_lis','alat_cadangan_status','keputusan_keberangkatan',
      'catatan_teknis_kerusakan','list_bmhp','function_test_result','kalibrasi_status','bmhp_terkemas'],
    gate:['s09_done'],
    gateLabel:'S09 approved + Semua alat LAYAK di F-CKL-01 + BMHP terkemas' },
  S11:{ id:'S11', no:11, phase:'F2', name:'Penugasan SDM (F-OPS-03)',             pic:'Admin + SPV',   icon:'👥', form:'F-OPS-03',
    fields:['no_order_s11','spv_project_s11','admin_project_s11',
      ...['registrasi','fisik_tensi','lab_flebotomi','dokter','ekg_penunjang','checkout'].flatMap(k=>[`rasio_${k}_jml`,`rasio_${k}_kap`,`rasio_${k}_ket`]),
      'list_personel','peran_personel','konfirmasi_personel','akses_sistem_diberikan'],
    gate:['s10_done'],
    gateLabel:'S10 paralel selesai + Semua personel terkonfirmasi + akses sistem diberikan' },
  S12:{ id:'S12', no:12, phase:'F2', name:'Briefing & Dry Run (GO/NO-GO)',        pic:'SPV Project',   icon:'📢', form:'F-OPS-04',
    fields:['waktu_briefing','lokasi_briefing','pimpinan_briefing',
      ...[1,2,3,4,5,6,7].map(n=>`topik${n}_status`),
      'catatan_khusus_briefing','hasil_go_nogo','alasan_ditunda','tanggal_briefing','absensi_briefing','go_nogo_checklist','catatan_briefing'],
    gate:['s10_done','s11_done'],
    gateLabel:'S10+S11 selesai + Absensi 100% personel kunci + GO/NO-GO = GO' },
  S13:{ id:'S13', no:13, phase:'F3', name:'Setup Lokasi & Konfirmasi Kesiapan Final', pic:'SPV Project', icon:'🏗️', form:'F-CKL-03',
    fields:['tanggal_hari_ke','pic_stasiun_s13','nama_stasiun_s13',
      ...[1,2,3,4,5,6,7,8,9].flatMap(n=>[`verif${n}_status`,`verif${n}_catatan`]),
      'waktu_tiba','setup_selesai','sistem_online','koneksi_stabil','konfirmasi_spv'],
    gate:['s12_go'],
    gateLabel:'S12 GO/NO-GO = GO + SPV konfirmasi setup selesai & sistem online' },
  S14:{ id:'S14', no:14, phase:'F3', name:'Pelaksanaan Layanan Peserta (Hari-H)', pic:'SPV Project',   icon:'⚕️', form:'F-CKL-03 + LOG-UNREG',
    fields:['total_unreg_diproses','total_kendala_hari_ini','kendala_diselesaikan','kendala_eskalasi',
      'total_hadir','total_unreg','log_unreg_notes','catatan_eksepsi','jam_selesai_layanan'],
    gate:['s13_done'],
    gateLabel:'S13 selesai + Semua peserta sudah Checkout' },
  S15:{ id:'S15', no:15, phase:'F3', name:'Rekonsiliasi Total & Penerbitan BAST', pic:'SPV + Klien',   icon:'📝', form:'F-OPS-06',
    fields:['spv_project_s15','pic_klien_s15','total_nilai_addon_s15',
      ...[1,2,3,4,5].map(n=>`rekon${n}_status`),
      'total_terdaftar','total_hadir_bast','total_tidak_hadir','total_unregistered','dasar_tagihan_awal','deviasi_notes','signed_by_spv_bast','signed_by_klien','signed_klien_jabatan'],
    gate:['s14_done','signed_by_klien'],
    gateLabel:'S14 selesai + BAST ditandatangani PIC Klien yang berwenang' },
  S16:{ id:'S16', no:16, phase:'F3', name:'Laporan Harian & Serah Terima Dokumen', pic:'SPV → Admin', icon:'📄', form:'Daily Report',
    fields:['tanggal_hari_ke_s16','jam_laporan_dibuat',
      'target_terdaftar_s16','realisasi_terdaftar_s16','kumulatif_terdaftar_s16',
      'target_hadir_s16','realisasi_hadir_s16','kumulatif_hadir_s16',
      'target_unreg_s16','realisasi_unreg_s16','kumulatif_unreg_s16',
      'target_tdkhadir_s16','realisasi_tdkhadir_s16','kumulatif_tdkhadir_s16',
      'target_addon_s16','realisasi_addon_s16','kumulatif_addon_s16',
      'target_incomplete_s16','realisasi_incomplete_s16','kumulatif_incomplete_s16',
      'total_sampel_diambil','total_sampel_dikirim','sampel_ditolak_resampling','manifest_sinkron_status',
      'data_sinkron_status','pengeluaran_harian','rab_tersisa','exception_hari_ini','no_form_exception',
      'estimasi_peserta_besok','catatan_khusus_headops',
      'laporan_harian','manifest_sampel','log_addon','dokumen_fisik_diterima','admin_konfirmasi'],
    gate:['s15_done'],
    gateLabel:'S15 selesai + Admin Project konfirmasi terima semua dokumen fisik' },
  S17:{ id:'S17', no:17, phase:'F4', name:'Konsolidasi Master Data & Generate Hasil', pic:'Admin + IT Ops', icon:'🔄', form:'F-19',
    fields:['sumber_internal_status','sumber_vendor_status','sumber_bast_status','sumber_addon_status','sumber_unreg_status',
      'dedup_nik_status','standarisasi_nama_status','format_nik_status','format_tgl_lahir_status','validasi_unreg_konsolidasi',
      'masterdata_approved_admin','masterdata_approved_spv',
      'jumlah_record_generate','jumlah_peserta_masterdata','selisih_record','jumlah_pdf_generated',
      'deviasi_kat1_count','deviasi_kat2_count','deviasi_kat3_count','deviasi_kat4_count','catatan_deviasi_rekon',
      'rekonsiliasi_vendor_status',
      'data_source_integrated','status_complete','status_incomplete','status_missed','catatan_konsolidasi'],
    gate:['s16_done'],
    gateLabel:'S16 selesai + Semua data source terintegrasi' },
  S18:{ id:'S18', no:18, phase:'F4', name:'QC Layer 1 — Administratif',           pic:'Admin Project', icon:'✅', form:'F-027 L1',
    fields:['qc1_identitas','qc1_barcode_tabung','qc1_tipe_paket','qc1_cleansing_spelling','qc1_hasil_vendor','qc1_kesesuaian_f05','qc1_kelengkapan_lampiran',
      'cek_identitas','cek_parameter','cek_vendor','error_list_l1','resolved_l1','signoff_qc_l1'],
    gate:['s17_done'],
    gateLabel:'S17 selesai + Tidak ada error administratif ATAU semua error resolved' },
  S19:{ id:'S19', no:19, phase:'F4', name:'QC Layer 2 — Teknis/Analis',           pic:'Analis/Lab PIC', icon:'🔬', form:'F-027 L2',
    fields:['qc2_null_value','qc2_delta_check','qc2_critical_value_flag','qc2_resampling_kesesuaian','qc2_alat_validasi','qc2_unit_satuan',
      'null_value_check','critical_value_flag','catatan_teknis','signoff_qc_l2'],
    gate:['s18_done'],
    gateLabel:'S18 selesai + Tidak ada null value tanpa alasan + Critical Value di-flag' },
  S20:{ id:'S20', no:20, phase:'F4', name:'QC Layer 3 — Medis/Dokter PJ',        pic:'Dokter PJ',     icon:'👨‍⚕️', form:'F-027 L3',
    fields:['qc3_korelasi_klinis','jumlah_kesimpulan_fit','jumlah_kesimpulan_fwn','jumlah_kesimpulan_unfit',
      'cv_terkonfirmasi_klinis','cv_notifikasi_pic_klien','cv_waktu_notifikasi','cv_log_tersedia',
      'review_dokter','kesimpulan_fit','kesimpulan_fwn','kesimpulan_unfit','catatan_medis','signoff_qc_l3','data_locked'],
    gate:['s19_done'],
    gateLabel:'S19 selesai + Semua peserta punya kesimpulan + Dokter approve digital' },
  S21:{ id:'S21', no:21, phase:'F4', name:'QC Layer 4 — Produksi PDF & Locking', pic:'Admin Project', icon:'📊', form:'F-027 L4',
    fields:['qc4_layout_visual','qc4_lampiran_ekg_rontgen','qc4_enkripsi_password','qc4_text_rendering','qc4_narasi_dokter_lengkap',
      'pdf_individu_count','rekap_kolektif_status','executive_summary_status','re_open_data_log',
      'pdf_generated','placeholder_incomplete','admin_finalize','signoff_qc_l4'],
    gate:['s20_done'],
    gateLabel:'S20 selesai + PDF ter-generate semua + Admin klik Finalize' },
  S22:{ id:'S22', no:22, phase:'F4', name:'QC Layer 5 — Final Sign-Off SPV',     pic:'SPV Project',   icon:'🏆', form:'F-027 L5',
    fields:['qc5_cross_check_bast','qc5_otorisasi_rilis','sla_status_s22','sla_eskalasi_proaktif',
      'sampling_pct','sampling_hasil','report_clean','signoff_qc_l5'],
    gate:['s21_done'],
    gateLabel:'S21 selesai + SPV klik REPORT CLEAN — membuka S23 & S24 paralel' },
  S23:{ id:'S23', no:23, phase:'F4', name:'Rekonsiliasi Data & Rekap Billing Final', pic:'Admin + SPV + Finance', icon:'💳', form:'F-019 + F-020',
    fields:['tanggal_rekon_h1',
      'qty_complete','qty_incomplete','qty_missed','qty_cancelled','qty_unreg_billing',
      'total_sampel_vendor_kirim','total_hasil_vendor_terima','ketidaksesuaian_vendor_status',
      'komponen1_qty','komponen1_harga','komponen1_total','komponen2_qty','komponen2_harga','komponen2_total',
      'komponen3_qty','komponen3_harga','komponen3_total','komponen4_total','komponen5_diskon',
      'total_tagihan_final','dasar_tagihan_dipakai',
      ...[1,2,3,4,5,6,7,8,9].map(n=>`invoice_elemen${n}_status`),
      'deviasi_kat1','deviasi_kat2','deviasi_kat3','deviasi_kat4','total_dapat_ditagih','rekap_billing_komponen','signed_admin_f020','signed_spv_f020','signed_finance_f020'],
    gate:['s22_done'],
    gateLabel:'S22 selesai + Semua deviasi resolved + F-020 ditandatangani 3 pihak' },
  S24:{ id:'S24', no:24, phase:'F4', name:'Serah Terima Laporan ke Sales & Klien', pic:'Admin → SPV → Sales', icon:'📨', form:'F-028',
    fields:['mode_penyerahan_s24','jumlah_buku_individu','jumlah_files_digital','exec_summary_qty','lampiran_film_qty',
      'final_format_validation','paket_laporan','serah_terima_sales','kirim_ke_klien','client_receipt_confirmed_at'],
    gate:['s22_done'],
    gateLabel:'S22 selesai (paralel S23) + Klien konfirmasi penerimaan laporan' },
  S25:{ id:'S25', no:25, phase:'F5', name:'Penerbitan Invoice',                   pic:'Finance',       icon:'🧾', form:'F-Faktur',
    fields:['nomor_invoice','nilai_invoice','tanggal_invoice','deadline_bayar','npwp_klien_status','rekening_tujuan_invoice','ar_register_updated'],
    gate:['s23_done','s24_done','all_deviasi_resolved','f020_3_ttd'],
    gateLabel:'S23+S24 selesai + Semua deviasi resolved + F-020 sudah 3 tanda tangan' },
  S26:{ id:'S26', no:26, phase:'F5', name:'Monitoring AR & Aging Piutang',        pic:'Finance',       icon:'📈', form:'F-021',
    fields:['status_ar_terkini','hari_overdue','tindakan_terakhir_ar','tgl_tindakan_ar','pic_followup_ar',
      'ar_register','aging_status','follow_up_notes'],
    gate:['s25_done'],
    gateLabel:'S25 selesai + Invoice sudah dikirim ke klien' },
  S27:{ id:'S27', no:27, phase:'F5', name:'Verifikasi Pembayaran & PPh 23',       pic:'Finance',       icon:'💰', form:'F-032',
    fields:['jenis_pph','tarif_pph','potongan_pajak_rp','nilai_cair_netto','no_seri_bukti_potong','tgl_terima_bukti_potong',
      'bukti_transfer','nominal_bayar','tanggal_bayar','pph23_status','invoice_status_lunas'],
    gate:['s26_done'],
    gateLabel:'S26 selesai + Pembayaran masuk terverifikasi' },
  S28:{ id:'S28', no:28, phase:'F5', name:'Laporan Realisasi RAB & Gross Margin', pic:'SPV + Finance', icon:'📋', form:'F-031',
    fields:['target_margin_pct',
      'rev_paket_utama_plan','rev_paket_utama_aktual','rev_addon_plan','rev_addon_aktual','total_revenue_plan','total_revenue_aktual',
      'cogs_bmhp_plan','cogs_bmhp_aktual','cogs_fee_medis_plan','cogs_fee_medis_aktual',
      'cogs_transport_plan','cogs_transport_aktual','cogs_exception_plan','cogs_exception_aktual',
      'total_cogs_plan','total_cogs_aktual','gross_profit_plan','gross_profit_aktual','margin_pct_plan','margin_pct_aktual',
      'analisis_akar_masalah_deviasi',
      'rab_realisasi','gross_margin_actual','selisih_plan_actual','laporan_verified_finance'],
    gate:['s27_done'],
    gateLabel:'S27 selesai + SPV submit + Finance verifikasi laporan RAB' },
  S29:{ id:'S29', no:29, phase:'F5', name:'Financial Closing Notice',             pic:'Finance + Head of Ops', icon:'🔐', form:'F-030',
    fields:[...[1,2,3,4,5,6,7].map(n=>`closing_kondisi${n}_status`),
      'no_surat_closing','nilai_tagihan_final_closing','tgl_efektif_dana_masuk',
      '7_kondisi_closing','financial_closing_notice','signed_finance_closing','signed_head_ops'],
    gate:['s28_done','status_financial_paid'],
    gateLabel:'7 kondisi closing terpenuhi + status_financial = PAID + tanda tangan Finance & Head of Ops' },
  S30:{ id:'S30', no:30, phase:'F6', name:'Rapat Evaluasi Internal',              pic:'SPV (fasilitator)', icon:'🗣️', form:'F-EVAL-01',
    fields:['tat_aktual_evaluasi','kualitas_data_deviasi_count','qc_return_count','revenue_loss_rp','revenue_delay_hari','over_service_rp','kepuasan_internal_skala',
      'item_perlu_diperbaiki','rekomendasi_tindakan','pic_target_selesai',
      'tanggal_evaluasi','peserta_evaluasi','temuan_evaluasi','cap_terdokumentasi','signoff_evaluasi'],
    gate:['s24_done'],
    gateLabel:'S24 selesai (trigger pertama) — berjalan paralel dengan FASE 5' },
  S31:{ id:'S31', no:31, phase:'F6', name:'Survei Kepuasan Klien (NPS)',          pic:'Sales/AM',      icon:'⭐', form:'F-KPK-01',
    fields:['nps_score','feedback_klien','response_received','tanggal_survey'],
    gate:['s24_done'],
    gateLabel:'S24 selesai + Sales kirim kuesioner (maks H+3) + Response atau deadline H+14' },
};

// ── GATE CONDITIONS ────────────────────────────────────────────
// Returns array of unmet conditions (empty = gate open)
function checkGate(stage, project, stepsData) {
  const unmet = [];
  const isDone = (sid) => {
    const sno = parseInt(sid.replace('S',''));
    return (project.current_step||1) > sno ||
      stepsData.some(s => s.step_id === sid && s.status === 'Done');
  };
  const getField = (field) => project[field] || null;

  switch(stage.id) {
    case 'S02':
      if (!isDone('S01')) unmet.push('S01 (Discovery) belum selesai');
      if (getField('credit_hold_status') === 'HOLD') unmet.push('Klien berstatus Credit Hold — butuh approval Direksi');
      break;
    case 'S03':
      if (!isDone('S02')) unmet.push('S02 (Mapping Parameter) belum selesai');
      break;
    case 'S04':
      if (!isDone('S03')) unmet.push('S03 (RAB) belum selesai');
      if (!project.rab_total || project.rab_total <= 0) unmet.push('RAB belum diisi — buka RAB Calculator dulu');
      break;
    case 'S05':
      if (!isDone('S04')) unmet.push('S04 (F-05 Order) belum selesai');
      if (!project.f05_locked) unmet.push('F-05 belum dikunci (belum ada 2 tanda tangan)');
      break;
    case 'S06':
      if (!isDone('S05')) unmet.push('S05 (Technical Meeting) belum selesai');
      break;
    case 'S07':
      if (!isDone('S06')) unmet.push('S06 (Handover) belum selesai — F-06 harus ditandatangani Sales & SPV');
      break;
    case 'S08': case 'S09':
      if (!isDone('S07')) unmet.push('S07 (Konfigurasi Sistem) belum selesai');
      break;
    case 'S10':
      if (!isDone('S09')) unmet.push('S09 (Dana Kas Gantung) belum cair');
      break;
    case 'S11':
      if (!isDone('S10')) unmet.push('S10 (Logistik & BMHP) belum selesai');
      break;
    case 'S12':
      if (!isDone('S10')) unmet.push('S10 (Logistik) belum selesai');
      if (!isDone('S11')) unmet.push('S11 (SDM) belum selesai');
      break;
    case 'S13':
      if (!isDone('S12')) unmet.push('S12 (Briefing GO/NO-GO) belum selesai');
      const gono = stepsData.find(s=>s.step_id==='S12');
      let gonoData = {};
      try { gonoData = JSON.parse(gono?.form_data||'{}'); } catch(e){}
      if (gonoData.hasil_go_nogo && gonoData.hasil_go_nogo !== 'GO') unmet.push('GO/NO-GO = NO — tidak bisa setup. Hubungi Head of Operations');
      break;
    case 'S14':
      if (!isDone('S13')) unmet.push('S13 (Setup Lokasi) belum selesai');
      break;
    case 'S15':
      if (!isDone('S14')) unmet.push('S14 (Pelaksanaan Hari-H) belum selesai');
      break;
    case 'S16':
      if (!isDone('S15')) unmet.push('S15 (BAST) belum selesai');
      const bast = stepsData.find(s=>s.step_id==='S15');
      let bastData = {};
      try { bastData = JSON.parse(bast?.form_data||'{}'); } catch(e){}
      if (!bastData.signed_by_klien) unmet.push('BAST belum ditandatangani PIC Klien yang berwenang');
      break;
    case 'S17': if (!isDone('S16')) unmet.push('S16 (Serah Terima Dokumen) belum selesai'); break;
    case 'S18': if (!isDone('S17')) unmet.push('S17 (Konsolidasi Data) belum selesai'); break;
    case 'S19': if (!isDone('S18')) unmet.push('QC Layer 1 (Admin) belum selesai'); break;
    case 'S20': if (!isDone('S19')) unmet.push('QC Layer 2 (Teknis/Analis) belum selesai'); break;
    case 'S21': if (!isDone('S20')) unmet.push('QC Layer 3 (Dokter PJ) belum selesai'); break;
    case 'S22': if (!isDone('S21')) unmet.push('QC Layer 4 (Produksi PDF) belum selesai'); break;
    case 'S23': case 'S30': case 'S31':
      if (!isDone('S22') && stage.id !== 'S30' && stage.id !== 'S31') unmet.push('QC Layer 5 (SPV Sign-off) belum selesai');
      if ((stage.id==='S30'||stage.id==='S31') && !isDone('S24')) unmet.push('S24 (Serah Terima Laporan ke Klien) belum selesai');
      break;
    case 'S24': if (!isDone('S22')) unmet.push('QC Layer 5 (SPV Sign-off) belum selesai — S23 & S24 buka paralel'); break;
    case 'S25':
      if (!isDone('S23')) unmet.push('S23 (Rekap Billing) belum selesai');
      if (!isDone('S24')) unmet.push('S24 (Laporan ke Klien) belum selesai');
      if (!project.all_deviasi_resolved) unmet.push('Masih ada deviasi rekonsiliasi yang belum diselesaikan');
      if (!project.f020_signed_3) unmet.push('F-020 belum ditandatangani 3 pihak (Admin+SPV+Finance)');
      break;
    case 'S26': if (!isDone('S25')) unmet.push('S25 (Invoice) belum diterbitkan'); break;
    case 'S27': if (!isDone('S26')) unmet.push('S26 (Monitoring AR) belum aktif'); break;
    case 'S28': if (!isDone('S27')) unmet.push('S27 (Verifikasi Pembayaran) belum selesai'); break;
    case 'S29':
      if (!isDone('S28')) unmet.push('S28 (Laporan RAB) belum selesai');
      if (project.status_financial !== 'PAID') unmet.push(`Status financial masih ${project.status_financial||'OPEN'} — harus PAID`);
      break;
  }
  return unmet;
}

// ── SLA HELPERS ────────────────────────────────────────────────
function getSLACategory(peserta) {
  if (peserta <= 250) return 'SMALL';
  if (peserta <= 500) return 'MEDIUM';
  return 'LARGE';
}
function getSLAPrep(peserta) {
  const cat = getSLACategory(peserta);
  return cat === 'SMALL' ? 3 : cat === 'MEDIUM' ? 5 : 7;
}
function calcSLADeadline(tanggal, peserta) {
  if (!tanggal) return null;
  const d = new Date(tanggal);
  d.setDate(d.getDate() - getSLAPrep(peserta));
  return d.toISOString().split('T')[0];
}

// ── RAB TEMPLATE ───────────────────────────────────────────────
const RAB_SOURCES = ['KAS GANTUNG','XENDIT','PR / PO','VENDOR','STOCK INTERNAL'];
const RAB_SCHEMES = ['PRA MCU','MCU','PASCA MCU'];
const RAB_TEMPLATE = [
  {cat:'I. FIXED COST', sub:'Tenaga Medis (Dokter Pemeriksa)', items:[
    {name:'Dokter Pemeriksa Fisik', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:60},
    {name:'Dokter Pemeriksa Gigi', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:40},
    {name:'Dokter Okupasi', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:60},
    {name:'Dokter Spesialis Radiologi', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:30},
    {name:'Dokter Spesialis Jantung', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:25},
    {name:'Dokter Spesialis Fisiotherapi', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:25},
  ]},
  {cat:'I. FIXED COST', sub:'Dokter Baca', items:[
    {name:'Rontgen', uom:'PACK',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:200},
    {name:'USG', uom:'PACK',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:200},
    {name:'EKG', uom:'PACK',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:200},
    {name:'Treadmill', uom:'PACK',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:200},
    {name:'Audiometri / Spiro', uom:'PACK',source:'XENDIT', scheme:'PASCA MCU',price:500000, cap:200},
  ]},
  {cat:'I. FIXED COST', sub:'Tenaga Medis Internal', items:[
    {name:'PIC Lapangan', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Admin', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Analis', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Radiografer', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Perawat', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Runner', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Driver/Kurir', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Incentive Overtime / Biaya Lembur SDM', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:1000000, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Tenaga Medis External', items:[
    {name:'PIC Lapangan', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:250000, cap:1},
    {name:'Admin', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:200000, cap:1},
    {name:'Analis', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:250000, cap:1},
    {name:'Radiografer', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:250000, cap:1},
    {name:'Perawat', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:250000, cap:1},
    {name:'Runner', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:200000, cap:1},
    {name:'Driver/Kurir', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:150000, cap:1},
    {name:'Tim Logistik', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:150000, cap:1},
    {name:'Incentive Overtime / Biaya Lembur SDM', uom:'DAY',source:'XENDIT', scheme:'PASCA MCU',price:1000000, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Transportasi dan Logistik', items:[
    {name:'Transport Mobilisasi (Pulang-Pergi) - Biaya Tol - Bensin', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:500000, cap:1},
    {name:'Transport Logistik (Bongkar/Muat)* - Biaya Tol - Bensin', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:500000, cap:1},
    {name:'Transport Operasional Lokasi - Biaya Tol - Bensin', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:250000, cap:1},
    {name:'Transport Khusus (Urgensi) - Biaya Tol - Bensin', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:250000, cap:1},
    {name:'Transport Antar Sampel', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:100000, cap:1},
    {name:'Sewa Mobil', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:350000, cap:1},
    {name:'Biaya Pengiriman Barangan (Expedisi/Gojek/GoBox/dll)', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:100000, cap:1},
    {name:'Biaya Sewa Alat Pendingin Portable', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:250000, cap:1},
    {name:'Biaya Parkir & Tiket Keamanan Lokasi', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:100000, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Akomodasi', items:[
    {name:'Sewa Hotel', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:500000, cap:1},
    {name:'Sewa Rumah/Kosan/Kontrakan', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:500000, cap:1},
    {name:'Biaya Laundry Seragam Medis Tim', uom:'DAY',source:'KAS GANTUNG', scheme:'PASCA MCU',price:50000, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Konsumsi Petugas', items:[
    {name:'Penyediaan Air Minum Galon/Dus untuk Petugas', uom:'BOX',source:'KAS GANTUNG', scheme:'PRA MCU',price:100000, cap:1},
    {name:'Snack Petugas', uom:'PACK',source:'KAS GANTUNG', scheme:'PRA MCU',price:20000, cap:1},
    {name:'Makan Pagi Petugas', uom:'PACK',source:'KAS GANTUNG', scheme:'PRA MCU',price:30000, cap:1},
    {name:'Makan Siang Petugas', uom:'PACK',source:'KAS GANTUNG', scheme:'PRA MCU',price:30000, cap:1},
    {name:'Makan Malam Petugas', uom:'PACK',source:'KAS GANTUNG', scheme:'PRA MCU',price:30000, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Perangkat Pemeriksaan', items:[
    {name:'Biaya Sewa BUS X-Ray', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:2500000, cap:1},
    {name:'Sewa Alat EKG Portable.', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:1500000, cap:1},
    {name:'Sewa Alat Audiometri + Pembuatan Soundproof Booth', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:1500000, cap:1},
    {name:'Sewa Alat Spirometri', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:1500000, cap:1},
    {name:'Sewa Alat Refraktometer', uom:'DAY',source:'KAS GANTUNG', scheme:'PRA MCU',price:900000, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Tanda - Tanda Vital (TTV)', items:[
    {name:'Tensi Meter', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Stetoscope', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Thermometer', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Pulse Oxymeter', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Antropometri', items:[
    {name:'Timbangan Berat Badan', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Microtoise / Stature Meter', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Meteran Lingkar Perut *', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'BMI Chart *', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Snelen Chart *', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Perangkat Cetak', items:[
    {name:'Printer Biasa', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Printer Label Thermal', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Laptop', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Scanner', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Flashdisk (backup data)', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Perangkat Phlebotomy', items:[
    {name:'Vacutainer (Holder)', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
    {name:'Torniquet', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1},
  ]},
  {cat:'I. FIXED COST', sub:'Handling & Transport', items:[
    {name:'Rak Tabung', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1, perPeserta:true},
    {name:'Cool Box', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1, perPeserta:true},
    {name:'Ice Pack', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PRA MCU',price:0, cap:1, perPeserta:true},
  ]},
  {cat:'I. FIXED COST', sub:'Legalitas Dokter', items:[
    {name:'Cap Klinik', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Cap Dokter', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Tinta Stampel', uom:'UNIT',source:'STOCK INTERNAL', scheme:'PASCA MCU',price:0, cap:1},
    {name:'Kop surat', uom:'PACK',source:'STOCK INTERNAL', scheme:'PASCA MCU',price:0, cap:1},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya Konsumsi Peserta', items:[
    {name:'Snack Peserta', uom:'PC',source:'KAS GANTUNG', scheme:'PRA MCU',price:20000, cap:1, perPeserta:true},
    {name:'Makan Siang', uom:'PC',source:'KAS GANTUNG', scheme:'PRA MCU',price:35000, cap:1, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Kertas & Media Cetak, Tinta, ATK, & Administrasi Tambahan', items:[
    {name:'Tinta Hitam', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:80000, cap:1},
    {name:'Tinta Warna Set', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:130000, cap:1},
    {name:'Kertas HVS', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:58000, cap:1},
    {name:'Kertas Bufalo (Map/COver)', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:4500, cap:1},
    {name:'Stapler', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:18000, cap:1},
    {name:'Isi staples', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:28000, cap:1},
    {name:'Paper clip', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:15000, cap:1},
    {name:'Binder clip', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:128000, cap:1},
    {name:'Lakban / double tape', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:20000, cap:1},
    {name:'Gunting', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:25000, cap:1},
    {name:'Cutter', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:20000, cap:1},
    {name:'Lem kertas', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:5000, cap:1},
    {name:'Map snelhecter', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:5000, cap:1},
    {name:'Ordner / binder arsip', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:40000, cap:1},
    {name:'Clipboard', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:22000, cap:1},
    {name:'Sticky notes', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:17000, cap:1},
    {name:'Label Barcode', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:82000, cap:1},
    {name:'Kertas Thermal', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:27000, cap:1},
    {name:'Foto Kopi Kartu Kontrol/Checklis Form', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:500, cap:1},
    {name:'Form Anamnesa & Fisik', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:500, cap:1},
  ]},
  {cat:'II. VARIABLE COST', sub:'Alat Tulis Kantor', items:[
    {name:'Pulpen', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:25000, cap:1},
    {name:'Pensil', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:25000, cap:1},
    {name:'Spidol', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:7000, cap:1},
    {name:'Stabilo', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:18000, cap:1},
  ]},
  {cat:'II. VARIABLE COST', sub:'Desinfektan dan Pemebersih', items:[
    {name:'Handsanitizer', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:125000, cap:1},
    {name:'Disinfektan', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:110000, cap:1},
    {name:'Tissu Kasar', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:15000, cap:1},
    {name:'Tissu Halus', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:15000, cap:1},
  ]},
  {cat:'II. VARIABLE COST', sub:'Alat dan Bahan Sampling Darah', items:[
    {name:'Needle Vacutainer', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:215000, cap:50, perPeserta:true},
    {name:'Spuit 3 cc', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:95000, cap:100, perPeserta:true},
    {name:'Spuit 5 cc', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:120000, cap:100, perPeserta:true},
    {name:'Wing Needle / Needle uk 25', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:250000, cap:50, perPeserta:true},
    {name:'Kapas/Kasa Steril', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:25000, cap:100, perPeserta:true},
    {name:'Alkohol Swab', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:50000, cap:100, perPeserta:true},
    {name:'Plesterin', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:25000, cap:100, perPeserta:true},
    {name:'Sarung Tangan', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:90000, cap:400, perPeserta:true},
    {name:'Masker', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:45000, cap:400, perPeserta:true},
    {name:'Apron', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:150000, cap:400, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Tabung Sampel (Collection TUbe)', items:[
    {name:'Tabung EDTA', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:165000, cap:100, perPeserta:true},
    {name:'Tabung CA / PLAIN', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:155000, cap:100, perPeserta:true},
    {name:'Tabung SST (Kuning)', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:230000, cap:100, perPeserta:true},
    {name:'Tabung Heparin', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:240000, cap:100, perPeserta:true},
    {name:'Tabung Fluoride', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:185000, cap:100, perPeserta:true},
    {name:'Tabng NA Citrat', uom:'BOX',source:'PR / PO', scheme:'PRA MCU',price:195000, cap:100, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Perlengkapan Sampling Urine', items:[
    {name:'Botol urine', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:2000, cap:1, perPeserta:true},
    {name:'Urine cup steril', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:2500, cap:1, perPeserta:true},
    {name:'Plastik biohazard', uom:'PACK',source:'PR / PO', scheme:'PRA MCU',price:35000, cap:10, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Perlengkapan Sampling Fecal', items:[
    {name:'Pot feses', uom:'PAC',source:'PR / PO', scheme:'PRA MCU',price:1500, cap:1, perPeserta:true},
    {name:'Plastik biohazard', uom:'PACK',source:'PR / PO', scheme:'PRA MCU',price:35000, cap:10, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Safety & Limbah', items:[
    {name:'Safety Box', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:15000, cap:80, perPeserta:true},
    {name:'Kantong Limbah Medis', uom:'PACK',source:'PR / PO', scheme:'PRA MCU',price:30000, cap:10, perPeserta:true},
    {name:'Kantong Limbah Non Medis', uom:'PACK',source:'PR / PO', scheme:'PRA MCU',price:20000, cap:10, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya Pemeriksaan Lab Darah', items:[
    {name:'Hematologi Lengkap + LED', uom:'UNT',source:'PR / PO', scheme:'MCU',price:10438, cap:1, perPeserta:true},
    {name:'Gambaran Darah Tepi', uom:'UNT',source:'VENDOR', scheme:'MCU',price:50000, cap:1, perPeserta:true},
    {name:'Urine Lengkap', uom:'UNT',source:'PR / PO', scheme:'MCU',price:2750, cap:1, perPeserta:true},
    {name:'Gula Darah Puasa', uom:'UNT',source:'PR / PO', scheme:'MCU',price:8599, cap:1, perPeserta:true},
    {name:'Glucosa 2 PP', uom:'UNT',source:'PR / PO', scheme:'MCU',price:8599, cap:1, perPeserta:true},
    {name:'SGOT', uom:'UNT',source:'PR / PO', scheme:'MCU',price:8321, cap:1, perPeserta:true},
    {name:'SGPT', uom:'UNT',source:'PR / PO', scheme:'MCU',price:8321, cap:1, perPeserta:true},
    {name:'Ureum', uom:'UNT',source:'PR / PO', scheme:'MCU',price:4000, cap:1, perPeserta:true},
    {name:'Creatinin', uom:'UNT',source:'PR / PO', scheme:'MCU',price:8413, cap:1, perPeserta:true},
    {name:'Asam Urat', uom:'UNT',source:'PR / PO', scheme:'MCU',price:8573, cap:1, perPeserta:true},
    {name:'Kolestrol Total', uom:'UNT',source:'PR / PO', scheme:'MCU',price:8573, cap:1, perPeserta:true},
    {name:'Cholesterol HDL', uom:'UNT',source:'PR / PO', scheme:'MCU',price:14615, cap:1, perPeserta:true},
    {name:'Cholesterol LDL', uom:'UNT',source:'PR / PO', scheme:'MCU',price:14615, cap:1, perPeserta:true},
    {name:'Gamma GT', uom:'UNT',source:'PR / PO', scheme:'MCU',price:0, cap:1, perPeserta:true},
    {name:'HBsAg Strip', uom:'UNT',source:'PR / PO', scheme:'MCU',price:0, cap:1, perPeserta:true},
    {name:'Anti HAV', uom:'UNT',source:'PR / PO', scheme:'MCU',price:0, cap:1, perPeserta:true},
    {name:'Widal', uom:'UNT',source:'PR / PO', scheme:'MCU',price:0, cap:1, perPeserta:true},
    {name:'PSA Total', uom:'UNT',source:'PR / PO', scheme:'MCU',price:0, cap:1, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya Consumabel Lab', items:[
    {name:'Yellow Tip', uom:'PAC',source:'PR / PO', scheme:'MCU',price:45000, cap:1, perPeserta:true},
    {name:'Blue Tip', uom:'PAC',source:'PR / PO', scheme:'MCU',price:55000, cap:1, perPeserta:true},
    {name:'Cup Serum', uom:'PAC',source:'PR / PO', scheme:'MCU',price:130000, cap:1, perPeserta:true},
    {name:'Aqua Des', uom:'BTL',source:'PR / PO', scheme:'MCU',price:25000, cap:1, perPeserta:true},
    {name:'Plastik Kuning Infeksius', uom:'PAC',source:'PR / PO', scheme:'MCU',price:35000, cap:1, perPeserta:true},
    {name:'Plastik Hitam Sampah', uom:'PAC',source:'PR / PO', scheme:'MCU',price:15000, cap:1, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya Pemeriksaan Lab Non Darah', items:[
    {name:'Cov-19 Antigen', uom:'BOX',source:'PR / PO', scheme:'MCU',price:450000, cap:25, perPeserta:true},
    {name:'Cov-19 PCR', uom:'BOX',source:'PR / PO', scheme:'MCU',price:450000, cap:100, perPeserta:true},
    {name:'Urine Strip', uom:'BOX',source:'PR / PO', scheme:'MCU',price:165000, cap:100, perPeserta:true},
    {name:'Narkoba 3 Parameter', uom:'BOX',source:'PR / PO', scheme:'MCU',price:550000, cap:25, perPeserta:true},
    {name:'Narkoba 6 Parameter', uom:'BOX',source:'PR / PO', scheme:'MCU',price:1200000, cap:25, perPeserta:true},
    {name:'Faeces Lengkap', uom:'BOX',source:'PR / PO', scheme:'MCU',price:5000, cap:1, perPeserta:true},
    {name:'Anal Swab / Culture Faeces', uom:'BOX',source:'PR / PO', scheme:'MCU',price:25000, cap:1, perPeserta:true},
    {name:'Papsmear', uom:'BOX',source:'PR / PO', scheme:'MCU',price:65000, cap:1, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya BHP Pemeriksaan Dokter', items:[
    {name:'Spatula Kayu', uom:'PACK',source:'PR / PO', scheme:'MCU',price:45000, cap:100, perPeserta:true},
    {name:'Cotton Bud', uom:'PACK',source:'PR / PO', scheme:'MCU',price:15000, cap:50, perPeserta:true},
    {name:'Gel Pelumas', uom:'PACK',source:'PR / PO', scheme:'MCU',price:200000, cap:100, perPeserta:true},
    {name:'Dental Kit', uom:'PC',source:'PR / PO', scheme:'MCU',price:15000, cap:1, perPeserta:true},
    {name:'Alkohol Cuci', uom:'PC',source:'PR / PO', scheme:'MCU',price:135000, cap:100, perPeserta:true},
    {name:'Kapas Medis', uom:'PC',source:'PR / PO', scheme:'MCU',price:45000, cap:100, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya Pemeriksaan Radiologi (Vendor)', items:[
    {name:'Rontgen Thorax PA', uom:'PC',source:'VENDOR', scheme:'PASCA MCU',price:22000, cap:1, perPeserta:true},
    {name:'USG Abdomen / Lowdomen', uom:'PC',source:'VENDOR', scheme:'PASCA MCU',price:30000, cap:1, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya BHP Pemeriksaan Radiologi', items:[
    {name:'Kertas Film Rontgen', uom:'PACK',source:'PR / PO', scheme:'PRA MCU',price:560000, cap:50, perPeserta:true},
    {name:'Kertas Film USG', uom:'PACK',source:'PR / PO', scheme:'PRA MCU',price:280000, cap:240, perPeserta:true},
    {name:'Kertas print hasil radiologi (CR/DR)', uom:'PACK',source:'PR / PO', scheme:'PRA MCU',price:485000, cap:100, perPeserta:true},
    {name:'Amplop hasil rontgen', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:2500, cap:1, perPeserta:true},
    {name:'Gel USG', uom:'BTL',source:'PR / PO', scheme:'PRA MCU',price:180000, cap:50, perPeserta:true},
    {name:'Tissue pembersih gel', uom:'PACK',source:'PR / PO', scheme:'PRA MCU',price:30000, cap:100, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya Pemeriksaan EKG (Vendor)', items:[
    {name:'EKG', uom:'PC',source:'VENDOR', scheme:'PASCA MCU',price:39000, cap:1, perPeserta:true},
  ]},
  {cat:'II. VARIABLE COST', sub:'Biaya BHP Pemeriksaan EKG', items:[
    {name:'Kertas Roll EKG', uom:'PC',source:'PR / PO', scheme:'PRA MCU',price:45000, cap:50, perPeserta:true},
  ]},
];

// ── STATE ──────────────────────────────────────────────────────
let mcuProjects = [], mcuFilter = { search:'', status:'', type:'' };

// Dynamic table row state per stage form (Mapping Parameter, Penugasan SDM, dll)
// Keyed by table name so multiple dynamic tables can coexist in one stage form.
let mcuDynTables = {};
let rabParams   = {};   // { peserta, days, margin, selectedTests, items }

// ══════════════════════════════════════════════════════════════
// RENDER UTAMA
// ══════════════════════════════════════════════════════════════
async function renderMCU() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>🏥 Project MCU</h1>
        <p>Manajemen project MCU korporat B2B — 6 Fase, 31 Tahapan, Gate System</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderMCU()">↻ Refresh</button>
        <button class="btn btn-teal" onclick="openMCUForm()">+ Buat Project MCU</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:20px" id="mcu-kpi">
      ${[1,2,3,4,5,6].map(()=>`<div class="kpi-card"><div class="kpi-icon" style="background:var(--bg2)"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div></div><div><div class="kpi-val">—</div><div class="kpi-label">Memuat...</div></div></div>`).join('')}
    </div>

    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="mcu-q" placeholder="Cari project, partner..."
          oninput="mcuFilter.search=this.value.toLowerCase();filterMCU()" style="flex:1">
        <select class="table-filter" id="mcu-status" onchange="mcuFilter.status=this.value;filterMCU()">
          <option value="">Semua Status</option>
          <option>Planning</option><option>Active</option><option>Completed</option><option>Cancelled</option>
        </select>
        <select class="table-filter" id="mcu-type" onchange="mcuFilter.type=this.value;filterMCU()">
          <option value="">Semua Tipe</option>
          <option>MCU</option><option>HealthDay</option><option>Screening</option><option>Wellness</option>
        </select>
      </div>
      <div id="mcu-list"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  mcuProjects = [];
  await loadMCUProjects();
}

async function loadMCUProjects() {
  try {
    const data = await sbGet('projects','select=*&order=created_at.desc');
    mcuProjects = Array.isArray(data) ? data : [];
    renderMCUKPI();
    filterMCU();
  } catch(e) {
    document.getElementById('mcu-list').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderMCUKPI() {
  const el = document.getElementById('mcu-kpi'); if (!el) return;
  const total   = mcuProjects.length;
  const aktif   = mcuProjects.filter(p=>p.status==='Active').length;
  const plan    = mcuProjects.filter(p=>p.status==='Planning').length;
  const selesai = mcuProjects.filter(p=>p.status==='Completed').length;
  const totalVal= mcuProjects.reduce((s,p)=>s+(p.value||0),0);
  const totalRAB= mcuProjects.reduce((s,p)=>s+(p.rab_total||0),0);

  const kpis = [
    {icon:'📁', val:total,               label:'Total Project', color:'#0891B2'},
    {icon:'🔥', val:aktif,               label:'Aktif',         color:'#EF4444'},
    {icon:'📋', val:plan,                label:'Planning',      color:'#8B5CF6'},
    {icon:'✅', val:selesai,             label:'Selesai',       color:'#22C55E'},
    {icon:'💰', val:formatCurrency(totalVal), label:'Total Nilai', color:'#F59E0B'},
    {icon:'📊', val:formatCurrency(totalRAB), label:'Total RAB',   color:'#06B6D4'},
  ];
  el.innerHTML = kpis.map(k=>`
    <div class="kpi-card" style="border-top:3px solid ${k.color}">
      <div class="kpi-icon" style="background:${k.color}18;font-size:20px">${k.icon}</div>
      <div>
        <div class="kpi-val" style="font-size:${typeof k.val==='string'&&k.val.length>8?'13px':'20px'}">${k.val}</div>
        <div class="kpi-label">${k.label}</div>
      </div>
    </div>`).join('');
}

function filterMCU() {
  let data = [...mcuProjects];
  const q = mcuFilter.search, s = mcuFilter.status, t = mcuFilter.type;
  if (q) data = data.filter(p=>(p.project_name||'').toLowerCase().includes(q)||(p.partner_name||'').toLowerCase().includes(q));
  if (s) data = data.filter(p=>p.status===s);
  if (t) data = data.filter(p=>p.project_type===t);
  renderMCUList(data);
}

function renderMCUList(projects) {
  const el = document.getElementById('mcu-list'); if (!el) return;
  if (!projects.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="ico">🏥</div>
      <h3>${mcuProjects.length ? 'Tidak ada hasil filter' : 'Belum ada Project MCU'}</h3>
      <p>Klik "+ Buat Project MCU" untuk memulai.</p>
      <button class="btn btn-teal" style="margin-top:14px" onclick="openMCUForm()">+ Buat Project MCU</button>
    </div>`; return;
  }

  const STATUS_COLOR = {Planning:'#8B5CF6',Active:'#22C55E',Completed:'#0891B2',Cancelled:'#EF4444'};

  el.innerHTML = projects.map(p => {
    const sc       = STATUS_COLOR[p.status]||'#94A3B8';
    const progress = Math.round(((p.current_step||0) / 31) * 100);
    const stageObj = Object.values(MCU_STAGES).find(s=>s.no===(p.current_step||1)) || MCU_STAGES.S01;
    const phase    = MCU_PHASES.find(f=>f.stages.includes(stageObj.id));
    const peserta  = p.target_participants||0;
    const slaDeadline = calcSLADeadline(p.tanggal_pelaksanaan, peserta);
    const daysToSLA = slaDeadline ? Math.ceil((new Date(slaDeadline)-new Date())/(1000*60*60*24)) : null;

    return `
    <div style="border-bottom:1px solid var(--border);padding:16px 20px;transition:background .15s"
      onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background=''">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="width:4px;align-self:stretch;border-radius:4px;background:${sc};flex-shrink:0;margin:-4px 0"></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-weight:800;font-size:14px;color:var(--text);cursor:pointer"
              onclick="openMCUDetail(${p.id})">${p.project_name}</span>
            <span style="background:${sc}20;color:${sc};font-size:11px;font-weight:700;padding:2px 9px;border-radius:10px">${p.status}</span>
            ${p.project_type&&p.project_type!=='MCU'?`<span class="badge badge-gray" style="font-size:10px">${p.project_type}</span>`:''}
            ${p.f05_locked?'<span class="badge badge-teal" style="font-size:10px">F-05 Locked</span>':''}
          </div>
          <div style="font-size:12px;color:var(--text3);display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
            ${p.partner_name?`<span>🤝 ${p.partner_name}</span>`:''}
            ${peserta?`<span>👥 ${peserta} peserta · ${getSLACategory(peserta)}</span>`:''}
            ${p.tanggal_pelaksanaan?`<span>📅 ${formatDateShort(p.tanggal_pelaksanaan)}</span>`:''}
            ${daysToSLA!==null?`<span style="color:${daysToSLA<3?'#EF4444':daysToSLA<7?'#F59E0B':'var(--text3)'}">⏱ SLA prep: ${daysToSLA>0?daysToSLA+'h lagi':'LEWAT'}</span>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1;height:8px;background:var(--bg2);border-radius:8px;overflow:hidden;cursor:pointer"
              onclick="openMCUDetail(${p.id})">
              <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,${phase?.color||sc},${phase?.color||sc}99);border-radius:8px;transition:width .5s"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:${phase?.color||sc};white-space:nowrap">${progress}%</span>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">
            ${stageObj.id} — <span style="color:var(--text);font-weight:600">${stageObj.name}</span>
            ${phase?`· <span style="color:${phase.color}">${phase.label}</span>`:''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;min-width:130px">
          ${p.value?`<div style="font-size:13px;font-weight:800;color:var(--teal)">${formatCurrency(p.value)}</div>`:''}
          ${p.rab_total?`<div style="font-size:11px;color:var(--text3)">RAB: ${formatCurrency(p.rab_total)}</div>`:''}
          <div style="display:flex;gap:5px;margin-top:8px;justify-content:flex-end;flex-wrap:wrap">
            <button class="btn btn-ghost btn-xs" onclick="openMCUDetail(${p.id})">📋 Detail</button>
            <button class="btn btn-outline btn-xs" onclick="openMCUForm(${p.id})">✏️</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// FORM BUAT / EDIT PROJECT
// ══════════════════════════════════════════════════════════════
async function openMCUForm(id=null) {
  let p = {};
  if (id) { const d=await sbGet('projects',`select=*&id=eq.${id}`); p=d[0]||{}; }

  let partnerOpts = '<option value="">-- Pilih Partner --</option>';
  let corpOpts    = '<option value="">-- Tidak terkait Corporate --</option>';
  try {
    const pts = await sbGet('partners','select=id,partner_name,status&order=partner_name&limit=300');
    partnerOpts += (pts||[]).map(pt=>`<option value="${pt.id}" ${p.partner_id==pt.id?'selected':''}>${pt.partner_name} [${pt.status||'—'}]</option>`).join('');
  } catch(e){}
  try {
    const corps = await sbGet('corporates','select=id,corporate_name&status=eq.Aktif&order=corporate_name');
    corpOpts += (corps||[]).map(c=>`<option value="${c.id}" ${p.corporate_id==c.id?'selected':''}>${c.corporate_name}</option>`).join('');
  } catch(e){}

  const today = new Date().toISOString().split('T')[0];
  const user  = getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Project MCU':'🏥 Buat Project MCU Baru'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="status-box status-warn" style="margin-bottom:14px;font-size:12.5px">
      📌 Setelah membuat project, langsung lanjut ke <strong>RAB Calculator</strong> untuk mengisi
      parameter tes & biaya operasional. Data RAB akan mengisi otomatis ke form-form berikutnya.
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Nama Project *</label>
        <input type="text" id="mf-name" value="${p.project_name||''}" placeholder="MCU Karyawan PT. ABC — Juni 2026">
      </div>
      <div class="form-group">
        <label>Tipe Project</label>
        <select id="mf-type">
          ${['MCU','HealthDay','Screening','Wellness','Vaksinasi'].map(t=>`<option${(p.project_type||'MCU')===t?' selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Partner / Klien *</label>
        <select id="mf-partner">${partnerOpts}</select>
      </div>
      <div class="form-group">
        <label>Corporate (jika korporat)</label>
        <select id="mf-corporate">${corpOpts}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tanggal Pelaksanaan (Hari-H)</label>
        <input type="date" id="mf-tgl" value="${p.tanggal_pelaksanaan||''}">
        <div class="form-hint" id="mf-sla-hint"></div>
      </div>
      <div class="form-group">
        <label>Target Peserta *</label>
        <input type="number" id="mf-peserta" value="${p.target_participants||100}" min="1"
          oninput="updateSLAHint()">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>PIC Sales / AM</label>
        <input type="text" id="mf-sales" value="${p.pic_sales||user}">
      </div>
      <div class="form-group">
        <label>PIC SPV Project</label>
        <input type="text" id="mf-spv" value="${p.pic_spv||''}">
      </div>
    </div>
    <div class="form-group">
      <label>Lokasi Pelaksanaan</label>
      <input type="text" id="mf-loc" value="${p.location||''}" placeholder="Nama gedung / alamat klien">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Target SLA Hasil</label>
        <select id="mf-sla">
          ${['H+3','H+5','H+7','H+10','Lainnya'].map(s=>`<option${(p.sla_hasil_kontraktual||'H+5')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Skema Pembayaran</label>
        <select id="mf-payment">
          ${['CREDIT','DP50','FULLPAYMENT','CREDIT_HOLD_EXCEPTION'].map(s=>`<option${(p.skema_pembayaran||'CREDIT')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveMCU(${id||'null'})">
        ${id?'💾 Simpan':'🏥 Buat Project → Lanjut ke RAB'}
      </button>
    </div>`);

  updateSLAHint();
}

function updateSLAHint() {
  const tgl = document.getElementById('mf-tgl')?.value;
  const pes = parseInt(document.getElementById('mf-peserta')?.value||0);
  const el  = document.getElementById('mf-sla-hint');
  if (!el) return;
  if (tgl && pes) {
    const cat = getSLACategory(pes);
    const sl  = getSLAPrep(pes);
    const dl  = calcSLADeadline(tgl, pes);
    el.textContent = `SLA Persiapan (${cat}): H-${sl} = deadline ${dl}`;
    el.style.color = 'var(--teal)';
  } else {
    el.textContent = 'Isi tanggal & peserta untuk lihat SLA';
  }
}

async function saveMCU(id) {
  const name      = document.getElementById('mf-name')?.value.trim();
  const partnerId = document.getElementById('mf-partner')?.value;
  if (!name)     { toast('Nama project wajib','err'); return; }
  if (!partnerId){ toast('Pilih partner dulu','err'); return; }

  const pEl     = document.getElementById('mf-partner');
  const partnerName = pEl.options[pEl.selectedIndex]?.text?.split(' [')[0]||'';
  const peserta = parseInt(document.getElementById('mf-peserta')?.value||0);
  const tgl     = document.getElementById('mf-tgl')?.value||null;
  const user    = getUserName?getUserName():'User';
  const code    = id ? undefined : `MCU-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  const payload = {
    project_name:          name,
    project_type:          document.getElementById('mf-type')?.value||'MCU',
    partner_id:            parseInt(partnerId),
    partner_name:          partnerName,
    corporate_id:          parseInt(document.getElementById('mf-corporate')?.value)||null,
    tanggal_pelaksanaan:   tgl,
    target_participants:   peserta,
    sla_category:          peserta ? getSLACategory(peserta) : null,
    sla_deadline_persiapan:tgl && peserta ? calcSLADeadline(tgl, peserta) : null,
    sla_hasil_kontraktual: document.getElementById('mf-sla')?.value||'H+5',
    skema_pembayaran:      document.getElementById('mf-payment')?.value||'CREDIT',
    pic_sales:             document.getElementById('mf-sales')?.value.trim()||user,
    pic_spv:               document.getElementById('mf-spv')?.value.trim()||null,
    location:              document.getElementById('mf-loc')?.value.trim()||null,
    status:                'Planning',
    credit_hold_status:    'CLEAR',
    status_financial:      'OPEN',
    updated_at:            new Date().toISOString(),
  };
  if (code) { payload.project_code = code; payload.current_step = 1; payload.created_by_name = user; }

  // If new columns not yet migrated, try without them
  const tryPayload = async (pl) => {
    try {
      if (id) {
        await sbPatch('projects', id, pl);
        toast('✅ Project diupdate','ok');
        closeModalForce();
        openMCUDetail(id);
      } else {
        const res = await sbPost('projects', pl);
        const projId = res[0]?.id;
        toast('✅ Project dibuat! Lanjut ke RAB...','ok');
        closeModalForce();
        mcuProjects = [];
        await loadMCUProjects();
        if (projId) setTimeout(()=>openRABModal(projId), 400);
      }
    } catch(e) {
      // Jika error kolom tidak ada, coba dengan kolom minimal saja
      if (e.message && (e.message.includes('column') || e.message.includes('schema cache'))) {
        toast('⚠️ Database perlu migration — menjalankan mode kompatibel...','warn', 3000);
        const safePayload = {
          project_name:       pl.project_name,
          project_type:       pl.project_type,
          partner_id:         pl.partner_id,
          partner_name:       pl.partner_name,
          corporate_id:       pl.corporate_id,
          start_date:         pl.tanggal_pelaksanaan || null,
          target_participants:pl.target_participants,
          value:              pl.nilai_kontrak || 0,
          location:           pl.location || null,
          pic_onelab:         pl.pic_sales || null,
          pic_partner:        pl.pic_spv || null,
          status:             pl.status,
          created_by_name:    pl.created_by_name,
          updated_at:         pl.updated_at,
          ...(pl.project_code ? { project_code: pl.project_code, current_step: 1 } : {}),
        };
        if (id) {
          await sbPatch('projects', id, safePayload);
          toast('✅ Disimpan (mode kompatibel). Jalankan migration SQL untuk fitur penuh.','warn', 5000);
          closeModalForce();
          openMCUDetail(id);
        } else {
          const res = await sbPost('projects', safePayload);
          const projId = res[0]?.id;
          toast('✅ Project dibuat (mode kompatibel). Jalankan supabase_mcu_v5_migration.sql!','warn', 6000);
          closeModalForce();
          mcuProjects = [];
          await loadMCUProjects();
          if (projId) setTimeout(()=>openRABModal(projId), 400);
        }
      } else {
        toast('❌ '+e.message,'err');
      }
    }
  };
  await tryPayload(payload);
}

// ══════════════════════════════════════════════════════════════
// RAB CALCULATOR — REBUILT
// Parameter tes PERTAMA, biaya operasional auto-template
// ══════════════════════════════════════════════════════════════
async function openRABModal(projectId) {
  const d = await sbGet('projects',`select=*&id=eq.${projectId}`);
  const p = d[0]||{};
  const peserta = p.target_participants||100;

  // Load existing RAB items & master products
  const [existing, masterProds] = await Promise.all([
    sbGet('rab_items',`select=*&project_id=eq.${projectId}`).catch(()=>[]),
    sbGet('products','select=id,kode_internal,nama_tes,hpp,harga_normal,kategori&is_active=eq.true&order=kategori,nama_tes').catch(()=>[]),
  ]);

  // Restore state
  const existingTests = (existing||[]).filter(r=>r.category==='LAB_TEST');
  const existingOps   = (existing||[]).filter(r=>r.category!=='LAB_TEST');
  const opMap = {};
  existingOps.forEach(r=>{ opMap[r.item_name] = r; });

  rabParams = {
    peserta,
    days:   p.rab_days||1,
    margin: p.rab_margin_pct||30,
    selectedTests: existingTests.map(r=>({
      id: r.product_id||'', name:r.item_name, hpp:r.unit_price||0,
      kat:r.notes?.split('|')[0]||'', qty:r.qty||1, perPeserta:true,
    })),
  };

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">💰 RAB — ${p.project_name}</div>
        <div style="font-size:11.5px;color:var(--text3)">
          ${peserta} peserta · ${getSLACategory(peserta)} · SLA Prep H-${getSLAPrep(peserta)}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="printRAB(${projectId})">🖨 Print</button>
        <button class="modal-close" onclick="closeModalForce()">✕</button>
      </div>
    </div>

    <!-- BAGIAN 1: PARAMETER TES (WAJIB DIISI DULU) -->
    <div style="background:var(--teal-light);border-radius:var(--r);padding:14px 16px;margin-bottom:16px;border-left:4px solid var(--teal)">
      <div style="font-weight:800;font-size:13px;color:var(--teal);margin-bottom:10px">
        🧬 STEP 1 — Pilih Parameter Tes (Menentukan Scope & HPP)
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <select id="rab-test-sel" class="table-filter" style="flex:1;min-width:220px">
          <option value="">-- Pilih Tes dari Master Produk --</option>
          ${(masterProds||[]).map(pr=>`
            <option value="${pr.id}" data-name="${pr.nama_tes}" data-hpp="${pr.hpp||0}"
              data-harga="${pr.harga_normal||0}" data-kat="${pr.kategori||''}">
              [${pr.kode_internal||'—'}] ${pr.nama_tes} · HPP ${formatCurrency(pr.hpp||0)}
            </option>`).join('')}
        </select>
        <button class="btn btn-teal btn-sm" onclick="rabAddTest()">+ Tambah Tes</button>
        <button class="btn btn-ghost btn-sm" onclick="rabAddAllTests()">+ Semua Tes Aktif</button>
      </div>
      <div id="rab-test-list">
        ${rabParams.selectedTests.length ? '' : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:10px">Belum ada parameter tes dipilih</div>'}
      </div>
      <div id="rab-test-summary" style="margin-top:8px"></div>
    </div>

    <!-- BAGIAN 2: PARAMETER PROJECT -->
    <div style="background:var(--bg2);border-radius:var(--r);padding:12px 16px;margin-bottom:14px">
      <div style="font-weight:700;font-size:12px;color:var(--text);margin-bottom:10px">⚙️ STEP 2 — Parameter Project</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:3px">Jumlah Peserta</label>
          <input type="number" id="rab-peserta" value="${peserta}" min="1" style="width:90px;padding:6px 10px;border:1.5px solid var(--teal);border-radius:6px;font-size:14px;font-weight:700"
            oninput="rabRecalc()">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:3px">Hari Pelaksanaan</label>
          <input type="number" id="rab-days" value="${rabParams.days}" min="1" style="width:70px;padding:6px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:14px;font-weight:700"
            oninput="rabRecalc()">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:3px">Minimum Guarantee</label>
          <input type="number" id="rab-mg" value="${p.minimum_guarantee||Math.round(peserta*0.8)}" min="0" style="width:90px;padding:6px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:14px;font-weight:700">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:3px">Target Margin (%)</label>
          <input type="number" id="rab-margin" value="${rabParams.margin}" min="0" max="100" style="width:70px;padding:6px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:14px;font-weight:700"
            oninput="rabRecalc()">
        </div>
      </div>
    </div>

    <!-- DASHBOARD SUMMARY -->
    <div id="rab-dashboard" style="margin-bottom:14px"></div>

    <!-- BAGIAN 3: BIAYA OPERASIONAL (TEMPLATE) -->
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:12px;color:var(--text)">📦 STEP 3 — Biaya Operasional (Template)</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-xs" onclick="rabToggleMode()">🔄 <span id="rab-mode-lbl">Mode Realisasi</span></button>
        </div>
      </div>
      <div id="rab-ops-table" style="max-height:35vh;overflow-y:auto;border-radius:var(--r);border:1px solid var(--border)"></div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Kembali</button>
      <button class="btn btn-outline btn-sm" onclick="printRAB(${projectId})">🖨 Print RAB</button>
      <button class="btn btn-teal" onclick="saveRAB(${projectId})">💾 Simpan & Kunci ke Project</button>
    </div>`,'wide');

  rabRenderTests();
  await rabRenderOpsTable(opMap, peserta, rabParams.days);
  rabRecalc();
}

// ── RAB: Tambah Tes ───────────────────────────────────────────
function rabAddTest() {
  const sel = document.getElementById('rab-test-sel');
  const opt = sel?.options[sel.selectedIndex];
  if (!opt?.value) { toast('Pilih tes dulu','warn'); return; }
  if (rabParams.selectedTests.find(t=>t.id===opt.value)) { toast('Sudah ditambahkan','warn'); return; }
  rabParams.selectedTests.push({
    id: opt.value, name: opt.dataset.name, hpp: parseFloat(opt.dataset.hpp)||0,
    harga: parseFloat(opt.dataset.harga)||0, kat: opt.dataset.kat, qty:1, perPeserta:true,
  });
  sel.value = '';
  rabRenderTests();
  rabRecalc();
}

async function rabAddAllTests() {
  if (!confirm('Tambahkan SEMUA produk aktif ke RAB?')) return;
  const all = await sbGet('products','select=id,kode_internal,nama_tes,hpp,harga_normal,kategori&is_active=eq.true&order=kategori,nama_tes').catch(()=>[]);
  let added = 0;
  (all||[]).forEach(pr=>{
    if (!rabParams.selectedTests.find(t=>t.id===String(pr.id))) {
      rabParams.selectedTests.push({
        id:String(pr.id), name:pr.nama_tes, hpp:pr.hpp||0, harga:pr.harga_normal||0,
        kat:pr.kategori||'', qty:1, perPeserta:true,
      });
      added++;
    }
  });
  toast(`${added} tes ditambahkan`,'ok');
  rabRenderTests();
  rabRecalc();
}

function rabRenderTests() {
  const el = document.getElementById('rab-test-list'); if (!el) return;
  if (!rabParams.selectedTests.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:10px">Belum ada parameter tes dipilih</div>';
    return;
  }
  const peserta = parseInt(document.getElementById('rab-peserta')?.value||rabParams.peserta||100);
  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:var(--navy)">
          <th style="padding:6px 10px;color:#fff;text-align:left;font-size:11px">Nama Tes</th>
          <th style="padding:6px 10px;color:#fff;text-align:left;font-size:11px">Kategori</th>
          <th style="padding:6px 10px;color:#fff;text-align:right;font-size:11px">HPP/unit</th>
          <th style="padding:6px 10px;color:#fff;text-align:center;font-size:11px">Qty</th>
          <th style="padding:6px 10px;color:#fff;text-align:center;font-size:11px">Per Peserta?</th>
          <th style="padding:6px 10px;color:#fff;text-align:right;font-size:11px">Total HPP</th>
          <th style="padding:6px;color:#fff;text-align:center;font-size:11px">Hapus</th>
        </tr>
      </thead>
      <tbody>
        ${rabParams.selectedTests.map((t,i)=>{
          const totalHPP = t.hpp * (t.qty||1) * (t.perPeserta ? peserta : 1);
          return `<tr style="background:${i%2?'var(--bg2)':'#fff'};border-bottom:1px solid var(--border)">
            <td style="padding:6px 10px;font-weight:600">${t.name}</td>
            <td style="padding:6px 10px;color:var(--text3)">${t.kat||'—'}</td>
            <td style="padding:6px 10px;text-align:right">${formatCurrency(t.hpp)}</td>
            <td style="padding:6px;text-align:center">
              <input type="number" value="${t.qty||1}" min="1" style="width:50px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px 4px"
                onchange="rabParams.selectedTests[${i}].qty=parseInt(this.value)||1;rabRenderTests();rabRecalc()">
            </td>
            <td style="padding:6px;text-align:center">
              <input type="checkbox" ${t.perPeserta?'checked':''} 
                onchange="rabParams.selectedTests[${i}].perPeserta=this.checked;rabRenderTests();rabRecalc()">
            </td>
            <td style="padding:6px 10px;text-align:right;font-weight:700;color:var(--teal)">${formatCurrency(totalHPP)}</td>
            <td style="padding:6px;text-align:center">
              <button onclick="rabParams.selectedTests.splice(${i},1);rabRenderTests();rabRecalc()" 
                class="act-btn del" style="padding:3px 7px">✕</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  rabRecalc();
}

async function rabRenderOpsTable(opMap={}, peserta=100, days=1) {
  const el = document.getElementById('rab-ops-table'); if (!el) return;
  const isAct = rabParams.mode === 'actual';
  let html = '';
  RAB_TEMPLATE.forEach(section=>{
    html += `<div style="background:var(--navy);color:#fff;padding:5px 12px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${section.cat} — ${section.sub}</div>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:11.5px">
      <thead><tr style="background:var(--bg)">
        <th style="padding:5px 10px;text-align:left;font-size:10px;color:var(--text3)">Item</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;color:var(--text3)">UoM</th>
        <th style="padding:5px 8px;text-align:right;font-size:10px;color:var(--text3)">Harga</th>
        <th style="padding:5px 8px;text-align:center;font-size:10px;color:var(--text3)">Qty Plan</th>
        ${isAct?'<th style="padding:5px 8px;text-align:center;font-size:10px;color:var(--text3)">Qty Aktual</th>':''}
        <th style="padding:5px 8px;text-align:right;font-size:10px;color:var(--text3)">Total Plan</th>
        ${isAct?'<th style="padding:5px 8px;text-align:right;font-size:10px;color:var(--text3)">Total Aktual</th>':''}
      </tr></thead><tbody>`;

    section.items.forEach(item=>{
      const key     = item.name;
      const exist   = opMap[key]||{};
      const defQty  = item.perPeserta ? peserta : (item.uom==='DAY'?days:1);
      const qtyPlan = exist.qty ?? defQty;
      const qtyAct  = exist.qty_actual ?? 0;
      const price   = exist.unit_price ?? item.price;
      const safeKey = key.replace(/[^a-zA-Z0-9]/g,'_');
      html += `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px 10px">
          <div style="font-weight:600">${key}</div>
          <div style="font-size:10px;color:var(--text3)">${item.source} · ${item.scheme}</div>
        </td>
        <td style="padding:5px 8px;text-align:center;color:var(--text3)">${item.uom}</td>
        <td style="padding:5px 8px;text-align:right">
          <input type="number" class="rab-price" data-key="${safeKey}" data-name="${key}" data-source="${item.source}" data-scheme="${item.scheme}" data-uom="${item.uom}"
            value="${price}" min="0" style="width:90px;text-align:right;border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-size:11px"
            oninput="rabRecalc()">
        </td>
        <td style="padding:5px 8px;text-align:center">
          <input type="number" class="rab-qty-plan" data-key="${safeKey}" value="${qtyPlan}" min="0" style="width:55px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-size:11px"
            oninput="rabRecalc()">
        </td>
        ${isAct?`<td style="padding:5px 8px;text-align:center">
          <input type="number" class="rab-qty-actual" data-key="${safeKey}" value="${qtyAct}" min="0" style="width:55px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-size:11px"
            oninput="rabRecalc()">
        </td>`:''}
        <td style="padding:5px 8px;text-align:right;font-weight:600" id="rab-row-total-${safeKey}">${formatCurrency(price*qtyPlan)}</td>
        ${isAct?`<td style="padding:5px 8px;text-align:right;font-weight:600;color:#06B6D4" id="rab-row-act-${safeKey}">${formatCurrency(price*qtyAct)}</td>`:''}
      </tr>`;
    });
    html += '</tbody></table>';
  });
  el.innerHTML = html;
}

function rabToggleMode() {
  rabParams.mode = rabParams.mode === 'actual' ? 'plan' : 'actual';
  const lbl = document.getElementById('rab-mode-lbl');
  if (lbl) lbl.textContent = rabParams.mode === 'actual' ? 'Mode Plan' : 'Mode Realisasi';
  const opMap = {};
  document.querySelectorAll('.rab-price').forEach(el=>{
    const key     = el.dataset.name;
    const planEl  = document.querySelector(`.rab-qty-plan[data-key="${el.dataset.key}"]`);
    const actEl   = document.querySelector(`.rab-qty-actual[data-key="${el.dataset.key}"]`);
    opMap[key] = { unit_price:parseFloat(el.value||0), qty:parseFloat(planEl?.value||0), qty_actual:parseFloat(actEl?.value||0) };
  });
  rabRenderOpsTable(opMap, parseInt(document.getElementById('rab-peserta')?.value||100), parseInt(document.getElementById('rab-days')?.value||1))
    .then(()=>rabRecalc());
}

function rabRecalc() {
  const peserta = parseInt(document.getElementById('rab-peserta')?.value||100);
  const margin  = parseFloat(document.getElementById('rab-margin')?.value||30);
  const mg      = parseInt(document.getElementById('rab-mg')?.value||0);

  // ── HPP dari parameter tes ─────────────────
  let hppTests = 0;
  rabParams.selectedTests.forEach(t=>{
    hppTests += (t.hpp||0) * (t.qty||1) * (t.perPeserta ? peserta : 1);
  });

  // ── HPP dari operasional, breakdown by SCHEME & SOURCE ──
  const byScheme  = {'PRA MCU':0, 'MCU':0, 'PASCA MCU':0};
  const bySource  = {'KAS GANTUNG':0, 'XENDIT':0, 'PR / PO':0, 'VENDOR':0, 'STOCK INTERNAL':0};
  let hppOps = 0, hppOpsActual = 0;

  document.querySelectorAll('.rab-price').forEach(priceEl=>{
    const key     = priceEl.dataset.key;
    const price   = parseFloat(priceEl.value||0);
    const scheme  = priceEl.dataset.scheme||'';
    const source  = priceEl.dataset.source||'';
    const planEl  = document.querySelector(`.rab-qty-plan[data-key="${key}"]`);
    const actEl   = document.querySelector(`.rab-qty-actual[data-key="${key}"]`);
    const qtyP    = parseFloat(planEl?.value||0);
    const qtyA    = parseFloat(actEl?.value||0);
    const total   = price * qtyP;
    const totalA  = price * qtyA;
    hppOps       += total;
    hppOpsActual += totalA;

    // Accumulate breakdown
    if (byScheme[scheme] !== undefined) byScheme[scheme] += total;
    if (bySource[source] !== undefined) bySource[source] += total;

    // Update row totals
    const rowEl    = document.getElementById(`rab-row-total-${key}`);
    const rowActEl = document.getElementById(`rab-row-act-${key}`);
    if (rowEl)    rowEl.textContent    = formatCurrency(total);
    if (rowActEl) rowActEl.textContent = formatCurrency(totalA);
  });

  // ── Totals ─────────────────────────────────
  const hppTotal     = hppTests + hppOps;
  const hppActual    = hppTests + hppOpsActual;
  const hppPerPes    = peserta > 0 ? hppTotal / peserta : 0;
  const hargaJual    = margin < 100 ? hppTotal / (1 - margin/100) : hppTotal;
  const hargaPerPes  = peserta > 0 ? hargaJual / peserta : 0;
  const grossMargin  = hargaJual - hppTotal;
  const grossMarginPct = hargaJual > 0 ? (grossMargin/hargaJual*100).toFixed(1) : 0;
  const mgValue      = mg > 0 ? mg * hargaPerPes : 0;
  const isActual     = rabParams.mode === 'actual';

  // ── Update test summary ────────────────────
  const sumEl = document.getElementById('rab-test-summary');
  if (sumEl) sumEl.innerHTML = `
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;margin-top:6px;
      padding:8px 10px;background:rgba(8,145,178,.06);border-radius:6px">
      <span>🧬 HPP Tes: <strong style="color:var(--teal)">${formatCurrency(hppTests)}</strong></span>
      <span>📦 HPP Ops: <strong style="color:var(--text)">${formatCurrency(hppOps)}</strong></span>
      <span style="font-weight:700;color:var(--teal)">= HPP Total: ${formatCurrency(hppTotal)}</span>
      <span>👤 Per Peserta: <strong>${formatCurrency(hppPerPes)}</strong></span>
    </div>`;

  // ── Main Dashboard ─────────────────────────
  const dash = document.getElementById('rab-dashboard');
  if (!dash) return;

  dash.innerHTML = `
    <!-- Row 1: Summary utama -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:12px">
      ${[
        {label:'Total Pengeluaran (HPP)',val:formatCurrency(hppTotal), color:'#EF4444',sub:'Plan total cost',      icon:'📤'},
        {label:'Total Pemasukan',        val:formatCurrency(hargaJual),color:'#0891B2',sub:'Harga jual project',   icon:'📥'},
        {label:'Gross Margin',           val:formatCurrency(grossMargin),color:'#22C55E',sub:`${grossMarginPct}% dari revenue`,icon:'📈'},
        {label:'Harga per Peserta',      val:formatCurrency(hargaPerPes),color:'#7C3AED',sub:'Harga jual/orang',  icon:'👤'},
        {label:'Nilai MG (${mg} peserta)',val:formatCurrency(mgValue),  color:'#F59E0B',sub:'Minimum guarantee',  icon:'🔒'},
        {label:isActual?'HPP Aktual':'HPP Plan',val:formatCurrency(isActual?hppActual:hppTotal),color:isActual&&hppActual>hargaJual?'#EF4444':'#6B7280',sub:isActual?'Realisasi biaya':'Estimasi biaya',icon:isActual?'🔄':'📋'},
      ].map(k=>`
        <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;border-top:3px solid ${k.color}">
          <div style="font-size:10px;color:var(--text3);margin-bottom:2px">${k.icon} ${k.label}</div>
          <div style="font-size:13px;font-weight:800;color:${k.color}">${k.val}</div>
          <div style="font-size:10px;color:var(--text3)">${k.sub}</div>
        </div>`).join('')}
    </div>

    <!-- Row 2: Breakdown by Scheme (Pra/MCU/Pasca) -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">

      <!-- Breakdown Scheme -->
      <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:12px">
        <div style="font-size:11px;font-weight:800;color:var(--text);margin-bottom:10px;text-transform:uppercase;letter-spacing:.04em">
          📅 Breakdown per Fase Biaya
        </div>
        ${Object.entries(byScheme).map(([scheme,val])=>{
          const pct = hppOps > 0 ? Math.round(val/hppOps*100) : 0;
          const colors = {'PRA MCU':'#7C3AED','MCU':'#0891B2','PASCA MCU':'#F59E0B'};
          const c = colors[scheme]||'#94A3B8';
          return `
            <div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="font-size:12px;font-weight:600;color:${c}">${scheme}</span>
                <span style="font-size:12px;font-weight:700">${formatCurrency(val)}</span>
              </div>
              <div style="height:6px;background:var(--bg2);border-radius:6px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${c};border-radius:6px;transition:width .4s"></div>
              </div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px">${pct}% dari total ops</div>
            </div>`;
        }).join('')}
        <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;font-size:12px">
          <span style="color:var(--text3)">Lab HPP (tes)</span>
          <span style="font-weight:700;color:var(--teal)">${formatCurrency(hppTests)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px">
          <span style="color:var(--text3)">Total Operasional</span>
          <span style="font-weight:700">${formatCurrency(hppOps)}</span>
        </div>
      </div>

      <!-- Breakdown Source (Sumber Dana) -->
      <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:12px">
        <div style="font-size:11px;font-weight:800;color:var(--text);margin-bottom:10px;text-transform:uppercase;letter-spacing:.04em">
          💳 Breakdown Sumber Dana
        </div>
        ${Object.entries(bySource).filter(([,v])=>v>0).map(([src,val])=>{
          const pct = hppOps > 0 ? Math.round(val/hppOps*100) : 0;
          const colors = {'KAS GANTUNG':'#F59E0B','XENDIT':'#8B5CF6','PR / PO':'#0EA5E9','VENDOR':'#EF4444','STOCK INTERNAL':'#22C55E'};
          const c = colors[src]||'#94A3B8';
          return `
            <div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <div style="display:flex;align-items:center;gap:5px">
                  <div style="width:8px;height:8px;border-radius:2px;background:${c};flex-shrink:0"></div>
                  <span style="font-size:11.5px;font-weight:600;color:var(--text)">${src}</span>
                </div>
                <span style="font-size:11.5px;font-weight:700">${formatCurrency(val)}</span>
              </div>
              <div style="height:5px;background:var(--bg2);border-radius:5px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${c};border-radius:5px;transition:width .4s"></div>
              </div>
              <div style="font-size:10px;color:var(--text3);margin-top:1px">${pct}% · diajukan ke Finance</div>
            </div>`;
        }).join('')}
        ${Object.values(bySource).every(v=>v===0)?'<div style="font-size:12px;color:var(--text3);text-align:center;padding:20px 0">Isi qty pada tabel operasional</div>':''}
      </div>
    </div>

    <!-- Row 3: Fee Margin -->
    <div style="background:linear-gradient(135deg,#0891B2,#0E7490);border-radius:var(--r);padding:12px 16px;color:#fff">
      <div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;opacity:.8">
        💰 Analisis Margin & Fee
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        ${[
          {label:'Target Margin',   val:`${margin}%`,               sub:'Setting margin'},
          {label:'Gross Margin Rp', val:formatCurrency(grossMargin),sub:`${grossMarginPct}% actual`},
          {label:'Margin/Peserta',  val:formatCurrency(peserta>0?grossMargin/peserta:0), sub:'Kontribusi per orang'},
          {label:'Fee vs HPP',      val:`${hppTotal>0?(grossMargin/hppTotal*100).toFixed(1):0}%`, sub:'Markup dari HPP'},
        ].map(k=>`
          <div>
            <div style="font-size:10px;opacity:.7;margin-bottom:3px">${k.label}</div>
            <div style="font-size:15px;font-weight:800">${k.val}</div>
            <div style="font-size:10px;opacity:.6">${k.sub}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

async function saveRAB(projectId) {
  const peserta = parseInt(document.getElementById('rab-peserta')?.value||100);
  const days    = parseInt(document.getElementById('rab-days')?.value||1);
  const margin  = parseFloat(document.getElementById('rab-margin')?.value||30);
  const mg      = parseInt(document.getElementById('rab-mg')?.value||0);
  const user    = getUserName?getUserName():'User';

  const items = [];
  let hppTotal = 0;

  // Save parameter tes
  rabParams.selectedTests.forEach(t=>{
    const totalHPP = (t.hpp||0) * (t.qty||1) * (t.perPeserta ? peserta : 1);
    hppTotal += totalHPP;
    items.push({
      project_id: projectId, category:'LAB_TEST', product_id: t.id,
      item_name: t.name, unit:'UNT', qty: (t.qty||1)*(t.perPeserta?peserta:1),
      unit_price: t.hpp||0, total_price: totalHPP, total_actual:0,
      notes: `${t.kat||''}|${t.perPeserta?'per_peserta':'fixed'}`,
    });
  });

  // Save ops items
  document.querySelectorAll('.rab-price').forEach(priceEl=>{
    const key   = priceEl.dataset.key;
    const name  = priceEl.dataset.name;
    const price = parseFloat(priceEl.value||0);
    const planEl= document.querySelector(`.rab-qty-plan[data-key="${key}"]`);
    const actEl = document.querySelector(`.rab-qty-actual[data-key="${key}"]`);
    const qtyP  = parseFloat(planEl?.value||0);
    const qtyA  = parseFloat(actEl?.value||0);
    if (qtyP > 0 || qtyA > 0) {
      const total = price * qtyP;
      hppTotal += total;
      items.push({
        project_id: projectId, category:'OPS',
        item_name: name, unit: priceEl.dataset.uom||'UNT',
        qty: qtyP, qty_actual: qtyA, unit_price: price,
        total_price: total, total_actual: price*qtyA,
        notes: `${priceEl.dataset.source||''}|${priceEl.dataset.scheme||''}`,
      });
    }
  });

  const hargaJual  = margin < 100 ? hppTotal / (1 - margin/100) : hppTotal;
  const hargaPerPes= peserta > 0 ? Math.round(hargaJual / peserta) : 0;

  try {
    // Delete old & insert new
    await fetch(`${SUPABASE_URL}/rest/v1/rab_items?project_id=eq.${projectId}`,{
      method:'DELETE', headers:{...SB_HEADERS,'Prefer':'return=minimal'}
    });
    if (items.length) await sbPost('rab_items', items);

    // Update project — RAB data flows to project master
    const selectedTestIds = rabParams.selectedTests.map(t=>t.id);
    await sbPatch('projects', projectId, {
      rab_total:            Math.round(hargaJual),
      rab_hpp:              Math.round(hppTotal),
      rab_margin_pct:       margin,
      rab_days:             days,
      target_participants:  peserta,
      minimum_guarantee:    mg,
      nilai_kontrak:        Math.round(hargaJual),
      harga_per_peserta:    hargaPerPes,
      rab_parameter_tests:  JSON.stringify(selectedTestIds),
      sla_category:         getSLACategory(peserta),
      updated_at:           new Date().toISOString(),
    });

    toast('✅ RAB disimpan & data tersinkron ke project','ok');
    closeModalForce();
    mcuProjects = [];
    await loadMCUProjects();
    setTimeout(()=>openMCUDetail(projectId), 400);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function printRAB(projectId) {
  toast('⏳ Menyiapkan RAB untuk print...','info',2000);

  const isLiveModalOpen = !!document.getElementById('rab-peserta');
  let p, peserta, days, margin, mg, testRows, opsRows, hppTests, hppOps, hppOpsActual;

  try {
    const d = await sbGet('projects',`select=*&id=eq.${projectId}`);
    p = d?.[0];
    if (!p) { toast('❌ Project tidak ditemukan','err'); return; }

    if (isLiveModalOpen) {
      // Read live unsaved form state — gives an accurate printout even before clicking "Simpan"
      peserta = parseInt(document.getElementById('rab-peserta')?.value||p.target_participants||100);
      days    = parseInt(document.getElementById('rab-days')?.value||p.rab_days||1);
      margin  = parseFloat(document.getElementById('rab-margin')?.value||p.rab_margin_pct||30);
      mg      = parseInt(document.getElementById('rab-mg')?.value||p.minimum_guarantee||0);

      testRows = rabParams.selectedTests.map(t=>{
        const qty = (t.qty||1) * (t.perPeserta ? peserta : 1);
        return { name:t.name, kategori:t.kat||'—', uom:'UNT', qty, harga:t.hpp||0, total:(t.hpp||0)*qty };
      });
      hppTests = testRows.reduce((s,t)=>s+t.total,0);

      opsRows = []; hppOps = 0; hppOpsActual = 0;
      document.querySelectorAll('.rab-price').forEach(priceEl=>{
        const key   = priceEl.dataset.key;
        const name  = priceEl.dataset.name;
        const price = parseFloat(priceEl.value||0);
        const planEl= document.querySelector(`.rab-qty-plan[data-key="${key}"]`);
        const actEl = document.querySelector(`.rab-qty-actual[data-key="${key}"]`);
        const qtyP  = parseFloat(planEl?.value||0);
        const qtyA  = parseFloat(actEl?.value||0);
        if (qtyP > 0 || qtyA > 0) {
          const total = price*qtyP, totalA = price*qtyA;
          hppOps += total; hppOpsActual += totalA;
          opsRows.push({
            name, uom:priceEl.dataset.uom||'UNT', source:priceEl.dataset.source||'—', scheme:priceEl.dataset.scheme||'—',
            harga:price, qtyPlan:qtyP, qtyActual:qtyA, total, totalActual:totalA,
          });
        }
      });
    } else {
      // Fallback: read the last-saved version from rab_items
      const items = await sbGet('rab_items',`select=*&project_id=eq.${projectId}`).catch(()=>[]);
      peserta = p.target_participants||100;
      days    = p.rab_days||1;
      margin  = p.rab_margin_pct||30;
      mg      = p.minimum_guarantee||0;

      testRows = (items||[]).filter(r=>r.category==='LAB_TEST').map(r=>({
        name:r.item_name, kategori:(r.notes||'').split('|')[0]||'—', uom:r.unit||'UNT',
        qty:r.qty||0, harga:r.unit_price||0, total:r.total_price||0,
      }));
      opsRows = (items||[]).filter(r=>r.category!=='LAB_TEST').map(r=>{
        const [source,scheme] = (r.notes||'').split('|');
        return { name:r.item_name, uom:r.unit||'UNT', source:source||'—', scheme:scheme||'—',
          harga:r.unit_price||0, qtyPlan:r.qty||0, qtyActual:r.qty_actual||0,
          total:r.total_price||0, totalActual:r.total_actual||0 };
      });
      hppTests = testRows.reduce((s,t)=>s+t.total,0);
      hppOps = opsRows.reduce((s,o)=>s+o.total,0);
      hppOpsActual = opsRows.reduce((s,o)=>s+o.totalActual,0);

      if (!testRows.length && !opsRows.length) {
        toast('⚠️ RAB belum pernah disimpan untuk project ini','warn',4000);
        return;
      }
    }
  } catch(e) {
    toast('❌ Gagal menyiapkan data RAB: '+e.message,'err',6000);
    console.error('[printRAB] Failed:', e);
    return;
  }

  const hppTotal    = hppTests + hppOps;
  const hargaJual   = margin < 100 ? hppTotal / (1 - margin/100) : hppTotal;
  const hargaPerPes = peserta > 0 ? hargaJual / peserta : 0;
  const grossMargin = hargaJual - hppTotal;
  const grossMarginPct = hargaJual > 0 ? (grossMargin/hargaJual*100).toFixed(1) : 0;
  const mgValue     = mg > 0 ? mg * hargaPerPes : 0;

  // Group ops rows by source (mirrors the on-screen STEP 3 grouping)
  const opsBySource = {};
  opsRows.forEach(o => { (opsBySource[o.source] = opsBySource[o.source]||[]).push(o); });

  const w = window.open('','_blank');
  w.document.write(`
    <html><head><title>RAB — ${p.project_name}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px;color:#1E293B}
      h2{margin-bottom:2px} .sub{color:#666;margin-bottom:16px;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-bottom:14px}
      th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
      th{background:#f1f5f9} .r{text-align:right} .c{text-align:center}
      .section{font-weight:700;font-size:12.5px;color:#0891B2;text-transform:uppercase;margin:16px 0 6px}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
      .sumcard{border:1px solid #ddd;border-radius:6px;padding:10px}
      .sumcard .lbl{font-size:10px;color:#777} .sumcard .val{font-size:14px;font-weight:700}
      .total-row{font-weight:700;background:#f8fafc}
      .sign{margin-top:40px;display:flex;justify-content:space-between}
      .sign div{width:200px;text-align:center;border-top:1px solid #333;padding-top:4px}
    </style></head><body>
    <h2>💰 RAB (Rencana Anggaran Biaya) — ${p.project_name}</h2>
    <div class="sub">${p.partner_name||'—'} · ${peserta} peserta · ${days} hari · Dicetak: ${new Date().toLocaleString('id-ID')}</div>

    <div class="summary">
      <div class="sumcard"><div class="lbl">TOTAL HPP (Pengeluaran)</div><div class="val">${formatCurrency(hppTotal)}</div></div>
      <div class="sumcard"><div class="lbl">HARGA JUAL (Pemasukan)</div><div class="val">${formatCurrency(hargaJual)}</div></div>
      <div class="sumcard"><div class="lbl">GROSS MARGIN</div><div class="val">${formatCurrency(grossMargin)} (${grossMarginPct}%)</div></div>
      <div class="sumcard"><div class="lbl">HARGA / PESERTA</div><div class="val">${formatCurrency(hargaPerPes)}</div></div>
      <div class="sumcard"><div class="lbl">NILAI MG (${mg} peserta)</div><div class="val">${formatCurrency(mgValue)}</div></div>
      <div class="sumcard"><div class="lbl">TARGET MARGIN</div><div class="val">${margin}%</div></div>
    </div>

    <div class="section">Step 1 — Parameter Tes (HPP Lab)</div>
    <table><thead><tr><th>Nama Tes</th><th>Kategori</th><th class="c">UoM</th><th class="c">Qty</th><th class="r">HPP Satuan</th><th class="r">Total</th></tr></thead>
    <tbody>
      ${testRows.map(t=>`<tr><td>${t.name}</td><td>${t.kategori}</td><td class="c">${t.uom}</td><td class="c">${t.qty}</td><td class="r">${formatCurrency(t.harga)}</td><td class="r">${formatCurrency(t.total)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="5">TOTAL HPP TES</td><td class="r">${formatCurrency(hppTests)}</td></tr>
    </tbody></table>

    <div class="section">Step 3 — Biaya Operasional (per Sumber Dana)</div>
    ${Object.entries(opsBySource).map(([source, rows])=>{
      const subTotal = rows.reduce((s,o)=>s+o.total,0);
      return `<table><thead><tr><th colspan="7" style="background:#0891B2;color:#fff">${source}</th></tr>
        <tr><th>Item</th><th class="c">UoM</th><th>Skema</th><th class="r">Harga</th><th class="c">Qty Plan</th><th class="c">Qty Aktual</th><th class="r">Total Plan</th></tr></thead>
        <tbody>
          ${rows.map(o=>`<tr><td>${o.name}</td><td class="c">${o.uom}</td><td>${o.scheme}</td><td class="r">${formatCurrency(o.harga)}</td><td class="c">${o.qtyPlan}</td><td class="c">${o.qtyActual}</td><td class="r">${formatCurrency(o.total)}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="6">Subtotal ${source}</td><td class="r">${formatCurrency(subTotal)}</td></tr>
        </tbody></table>`;
    }).join('')}
    <table><tbody><tr class="total-row"><td style="width:80%">TOTAL HPP OPERASIONAL</td><td class="r">${formatCurrency(hppOps)}</td></tr></tbody></table>

    <div class="sign">
      <div>Disusun oleh<br><br><br>${getUserName?getUserName():'_______________'}</div>
      <div>Disetujui oleh<br><br><br>Head of Operations</div>
    </div>
    <script>window.print()</script></body></html>`);
  w.document.close();
}

// ══════════════════════════════════════════════════════════════
// DETAIL PROJECT — 31 STAGE
// ══════════════════════════════════════════════════════════════
async function openMCUDetail(id) {
  try {
    const [dArr, stepsArr] = await Promise.all([
      sbGet('projects',`select=*&id=eq.${id}`),
      sbGet('project_steps',`select=*&project_id=eq.${id}&order=step_number.asc`).catch(()=>[]),
    ]);
    const p = dArr?.[0]; if (!p) { toast('❌ Project tidak ditemukan','err'); return; }
    const steps = stepsArr||[];

  const curNo    = p.current_step||1;
  const progress = Math.round((curNo / 31) * 100);
  const curPhase = MCU_PHASES.find(f=>f.stages.includes(`S${String(curNo).padStart(2,'0')}`));

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">🏥 ${p.project_name}</div>
        <div style="font-size:11.5px;color:var(--text3)">
          ${p.partner_name||'—'} · ${p.project_type||'MCU'} · ${p.target_participants||0} peserta
          ${p.sla_category?`· ${p.sla_category}`:''}
          ${p.f05_locked?'· <span style="color:var(--teal);font-weight:700">F-05 Locked</span>':''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-teal btn-sm" onclick="closeModalForce();setTimeout(()=>openRABModal(${id}),100)">💰 RAB</button>
        <button class="btn btn-outline btn-sm" onclick="closeModalForce();setTimeout(()=>openMCUForm(${id}),100)">✏️ Edit</button>
        <button class="modal-close" onclick="closeModalForce()">✕</button>
      </div>
    </div>

    <!-- Progress & Summary -->
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div style="flex:1;height:10px;background:var(--bg2);border-radius:10px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,var(--teal),var(--accent));border-radius:10px;transition:width .5s"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:var(--teal)">${progress}% · S${String(curNo).padStart(2,'0')}/S31</span>
      </div>
      ${curPhase?`<div style="font-size:11px;color:${curPhase.color};font-weight:700">${curPhase.label}</div>`:''}
    </div>

    <!-- RAB Summary -->
    ${p.rab_total?`
    <div style="background:var(--bg2);border-radius:var(--r);padding:10px 14px;margin-bottom:14px;display:flex;gap:16px;flex-wrap:wrap">
      ${[
        ['RAB Plan', formatCurrency(p.rab_total),'var(--teal)'],
        ['HPP', formatCurrency(p.rab_hpp||0),'var(--danger)'],
        ['Harga/Peserta', formatCurrency(p.harga_per_peserta||0),'#7C3AED'],
        ['MG', `${p.minimum_guarantee||0} peserta`,'#F59E0B'],
        ['SLA Hasil', p.sla_hasil_kontraktual||'—','#06B6D4'],
        ['Financial', p.status_financial||'OPEN', p.status_financial==='PAID'?'#22C55E':'#94A3B8'],
      ].map(([l,v,c])=>`<div><div style="font-size:10px;color:var(--text3)">${l}</div><div style="font-size:13px;font-weight:700;color:${c}">${v}</div></div>`).join('')}
    </div>`:''}

    <!-- 6 Fase + 31 Stage -->
    <div style="max-height:52vh;overflow-y:auto">
      ${MCU_PHASES.map(phase=>{
        const phaseStages = phase.stages.map(sid=>MCU_STAGES[sid]).filter(Boolean);
        const doneCnt  = phaseStages.filter(s=>{
          const sno = s.no;
          return sno < curNo || steps.some(st=>st.step_id===s.id&&st.status==='Done');
        }).length;
        return `
          <div style="margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:${phase.color}18;border-radius:var(--r);margin-bottom:6px;border-left:4px solid ${phase.color}">
              <div style="font-size:11px;font-weight:800;color:${phase.color};text-transform:uppercase;flex:1">${phase.label}</div>
              <span style="font-size:11px;font-weight:700;color:${phase.color}">${doneCnt}/${phaseStages.length}</span>
            </div>
            ${phaseStages.map(stage=>{
              const stepData = steps.find(s=>s.step_id===stage.id)||{};
              const isActive = stage.no === curNo;
              const isDone   = stage.no < curNo || stepData.status === 'Done';
              const isBlocked= stage.no > curNo;
              const gateUnmet= isActive ? checkGate(stage, p, steps) : [];
              const hasIssue = gateUnmet.length > 0;
              return `
                <div onclick="${isDone||isActive?`openStepForm(${id},'${stage.id}')`:''}"
                  style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--r);
                    cursor:${isDone||isActive?'pointer':'default'};margin-bottom:4px;
                    background:${isActive?(hasIssue?'#FEF2F2':phase.color+'12'):isDone?'#F0FDF4':'var(--bg2)'};
                    border:1.5px solid ${isActive?(hasIssue?'#FECACA':phase.color):isDone?'#BBF7D0':'var(--border)'};
                    opacity:${isBlocked?.6:1};transition:all .15s"
                  ${isDone||isActive?`onmouseover="this.style.borderColor='${phase.color}'" onmouseout="this.style.borderColor='${isActive?(hasIssue?'#FECACA':phase.color):isDone?'#BBF7D0':'var(--border)'}'"`:''}>
                  <div style="width:26px;height:26px;border-radius:50%;
                    background:${isDone?'#22C55E':isActive?(hasIssue?'#EF4444':phase.color):'var(--border2)'};
                    color:#fff;display:flex;align-items:center;justify-content:center;
                    font-size:11px;font-weight:800;flex-shrink:0">
                    ${isDone?'✓':stage.no}
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:${isActive?700:600};
                      color:${isActive?(hasIssue?'#DC2626':phase.color):isDone?'#15803D':'var(--text2)'}">
                      ${stage.icon} ${stage.id} · ${stage.name}
                    </div>
                    <div style="font-size:10px;color:var(--text3)">
                      PIC: ${stage.pic} · ${stage.form}
                      ${stepData.done_by?` · ${stepData.done_by}`:''} ${stepData.done_date?`· ${formatDateShort(stepData.done_date)}`:''}
                    </div>
                    ${isActive&&hasIssue?`<div style="font-size:10.5px;color:#DC2626;margin-top:3px">⛔ ${gateUnmet[0]}</div>`:''}
                  </div>
                  <div style="font-size:10px;white-space:nowrap;text-align:right">
                    ${isDone?'<span class="badge badge-green" style="font-size:10px">✅ Done</span>':isActive?`<span class="badge ${hasIssue?'badge-red':'badge-teal'}" style="font-size:10px">${hasIssue?'⛔ Blocked':'🔵 Aktif'}</span>`:'<span style="color:var(--text3);font-size:11px">⚪</span>'}
                  </div>
                </div>`;
            }).join('')}
          </div>`;
      }).join('')}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      ${curNo<=31?`
        <button class="btn btn-outline btn-sm" onclick="openStepForm(${id},'S${String(curNo).padStart(2,'0')}')">
          📝 Isi Form ${`S${String(curNo).padStart(2,'0')}`}
        </button>
        <button class="btn btn-teal" onclick="advanceMCUStep(${id})">
          ▶ Lanjut ke ${`S${String(Math.min(curNo+1,31)).padStart(2,'0')}`}
        </button>`
        :`<button class="btn btn-teal" style="background:#22C55E" disabled>✅ Project Selesai!</button>`}
    </div>`,'wide');
  } catch(e) {
    console.error('[openMCUDetail] Failed:', e);
    toast('❌ Gagal membuka detail project: '+e.message,'err',6000);
  }
}

// ══════════════════════════════════════════════════════════════
// FORM PER STAGE — Data Prefill dari Stage Sebelumnya
// ══════════════════════════════════════════════════════════════
async function openStepForm(projectId, stageId) {
  const stage = MCU_STAGES[stageId]; if (!stage) { toast('❌ Tahapan tidak dikenali: '+stageId,'err'); return; }

  try {
    // Load project + all steps data
    const [dArr, stepsArr, rabItems] = await Promise.all([
      sbGet('projects',`select=*&id=eq.${projectId}`),
      sbGet('project_steps',`select=*&project_id=eq.${projectId}&order=step_number.asc`).catch(()=>[]),
      sbGet('rab_items',`select=*&project_id=eq.${projectId}&category=eq.LAB_TEST`).catch(()=>[]),
    ]);
    const p     = dArr?.[0];
    if (!p) { toast('❌ Project tidak ditemukan (mungkin sudah dihapus)','err'); return; }
    const steps = stepsArr||[];

  // Check gate
  const gateUnmet = checkGate(stage, p, steps);

  // Get existing data for THIS stage
  const existing  = steps.find(s=>s.step_id===stageId)||{};
  let formData    = {};
  try { formData  = JSON.parse(existing.form_data||'{}'); } catch(e){}

  // Build prefill from project + previous steps
  const prefill   = buildPrefill(stage, p, steps, rabItems);
  const merged    = { ...prefill, ...formData }; // existing data overrides prefill

  const phase     = MCU_PHASES.find(f=>f.stages.includes(stageId));
  const user      = getUserName?getUserName():'User';
  const isLocked  = p.f05_locked && parseInt(stageId.replace('S','')) <= 4 && stageId !== 'S01';

  // Reset dynamic table state for a fresh form open (prevents stale rows from a previous stage)
  mcuDynTables = {};
  // Preload any saved dynamic table data from form_data (keys prefixed with tbl_)
  Object.keys(merged).forEach(k => {
    if (k.startsWith('tbl_') && Array.isArray(merged[k])) {
      mcuDynTables[k] = { columns: null, rows: merged[k] }; // columns set on first dynTableInit call from the form itself
    }
  });

  openModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${stage.icon} ${stage.id} · ${stage.name}</div>
        <div style="font-size:11.5px;color:${phase?.color||'var(--text3)'}">
          ${phase?.label||''} · Form: ${stage.form} · PIC: ${stage.pic}
        </div>
      </div>
      <button class="modal-close" onclick="closeModalForce();openMCUDetail(${projectId})">✕</button>
    </div>

    ${gateUnmet.length?`
    <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:var(--r);padding:12px 16px;margin-bottom:14px">
      <div style="font-weight:700;color:#DC2626;margin-bottom:6px">⛔ Gate Condition Belum Terpenuhi</div>
      ${gateUnmet.map(g=>`<div style="font-size:12.5px;color:#DC2626;margin-bottom:4px">• ${g}</div>`).join('')}
      <div style="font-size:11.5px;color:#9CA3AF;margin-top:8px">Anda masih bisa melihat & mengisi form ini, namun tidak bisa menandai sebagai Done.</div>
    </div>`:''}

    ${isLocked?`<div class="status-box status-warn" style="margin-bottom:14px;font-size:12px">🔒 F-05 sudah dikunci. Data ini READ-ONLY. Perubahan hanya via Form Addendum.</div>`:''}

    ${renderStageForm(stage, merged, p, isLocked)}

    <div class="form-row" style="margin-top:12px">
      <div class="form-group">
        <label>Status</label>
        <select id="sf-status" ${isLocked?'disabled':''}>
          ${['In Progress','Done','Blocked','Pending'].map(s=>`<option${(existing.status||'In Progress')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Dikerjakan Oleh</label>
        <input type="text" id="sf-done-by" value="${existing.done_by||user}" ${isLocked?'disabled':''}>
      </div>
      <div class="form-group">
        <label>Tanggal / Waktu</label>
        <input type="datetime-local" id="sf-done-date" value="${existing.done_date||''}" ${isLocked?'disabled':''}>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce();openMCUDetail(${projectId})">Kembali</button>
      ${!isLocked?`<button class="btn btn-teal" onclick="saveStepForm(${projectId},'${stageId}')">💾 Simpan</button>`:''}
      ${gateUnmet.length===0&&!isLocked?`<button class="btn btn-accent" onclick="markStageDone(${projectId},'${stageId}')">✅ Tandai Done & Lanjut</button>`:''}
    </div>`,'wide');

  // Paint any dynamic tables now that the modal markup is actually in the DOM
  renderAllDynTables(Object.keys(mcuDynTables));
  } catch(e) {
    console.error('[openStepForm] Failed:', e);
    toast('❌ Gagal membuka form '+stageId+': '+e.message,'err',6000);
  }
}

// Prefill data dari project dan stage sebelumnya
function buildPrefill(stage, p, steps, rabItems) {
  const pf = {};
  const getStepData = (sid) => {
    const s = steps.find(x=>x.step_id===sid);
    let d = {};
    try { d = JSON.parse(s?.form_data||'{}'); } catch(e){}
    return d;
  };

  // Data project selalu tersedia
  pf.nama_project    = p.project_name||'';
  pf.nama_partner    = p.partner_name||'';
  pf.target_peserta  = p.target_participants||'';
  pf.tanggal_pelaksanaan = p.tanggal_pelaksanaan||'';
  pf.sla_category    = p.sla_category||'';
  pf.pic_sales       = p.pic_sales||'';
  pf.pic_spv         = p.pic_spv||'';
  pf.lokasi          = p.location||'';

  // S01 → S02, S03, S04
  const s01 = getStepData('S01');
  if (s01.target_peserta)     pf.target_peserta     = s01.target_peserta;
  if (s01.lokasi_pelaksanaan) pf.lokasi_pelaksanaan = s01.lokasi_pelaksanaan;
  if (s01.kontak_pic_klien)   pf.kontak_pic_klien   = s01.kontak_pic_klien;
  if (s01.tujuan_mcu)         pf.tujuan_mcu         = s01.tujuan_mcu;

  // RAB → S03, S04, S10, S11
  if (p.rab_total) {
    pf.rab_hpp_total        = p.rab_hpp||0;
    pf.rab_harga_per_peserta= p.harga_per_peserta||0;
    pf.rab_minimum_guarantee= p.minimum_guarantee||0;
    pf.harga_per_peserta    = p.harga_per_peserta||0;
    pf.minimum_guarantee    = p.minimum_guarantee||0;
    pf.nilai_kontrak        = p.nilai_kontrak||p.rab_total||0;
  }

  // S04 → S05..S25
  if (p.f05_locked) {
    pf.paket_terkunci = 'Yes — F-05 Locked';
    pf.skema_pembayaran = p.skema_pembayaran||'';
    pf.sla_hasil_kontraktual = p.sla_hasil_kontraktual||'';
  }

  // S08 → S14, S15, S23
  const s08 = getStepData('S08');
  if (s08.jumlah_peserta_final) pf.total_terdaftar = s08.jumlah_peserta_final;

  // S14 → S15
  const s14 = getStepData('S14');
  if (s14.total_hadir)  pf.total_hadir_bast  = s14.total_hadir;
  if (s14.total_unreg)  pf.total_unregistered = s14.total_unreg;

  // S15 → S23
  const s15 = getStepData('S15');
  if (s15.dasar_tagihan_awal) pf.dasar_tagihan_awal = s15.dasar_tagihan_awal;

  // Inline tes dari RAB
  if (rabItems?.length) {
    pf.parameter_tes_list = rabItems.map(r=>r.item_name).join(', ');
  }

  return pf;
}

// Render form fields per stage
// ══════════════════════════════════════════════════════════════
// DYNAMIC TABLE HELPERS — reusable untuk semua stage form dengan
// tabel multi-baris (Mapping Parameter, Penugasan SDM, Stasiun, dll)
// ══════════════════════════════════════════════════════════════
function dynTableInit(key, columns, initialRows) {
  if (!mcuDynTables[key]) {
    mcuDynTables[key] = { columns, rows: initialRows && initialRows.length ? initialRows : [dynTableEmptyRow(columns)] };
  } else if (!mcuDynTables[key].columns) {
    // Preloaded from saved form_data (rows only) — attach the column definition now
    mcuDynTables[key].columns = columns;
    if (!mcuDynTables[key].rows.length) mcuDynTables[key].rows = [dynTableEmptyRow(columns)];
  }
}
function dynTableEmptyRow(columns) {
  const row = {};
  columns.forEach(c => { row[c.key] = c.default !== undefined ? c.default : ''; });
  return row;
}
function dynTableAddRow(key) {
  const t = mcuDynTables[key]; if (!t) return;
  t.rows.push(dynTableEmptyRow(t.columns));
  renderDynTable(key);
}
function dynTableRemoveRow(key, idx) {
  const t = mcuDynTables[key]; if (!t) return;
  t.rows.splice(idx, 1);
  if (!t.rows.length) t.rows.push(dynTableEmptyRow(t.columns));
  renderDynTable(key);
}
function dynTableUpdateField(key, idx, field, value) {
  const t = mcuDynTables[key]; if (!t || !t.rows[idx]) return;
  t.rows[idx][field] = value;
}
function renderDynTable(key) {
  const t = mcuDynTables[key]; if (!t) return;
  const el = document.getElementById(`dyntable-${key}`);
  if (!el) return;
  el.innerHTML = `
    <table style="width:100%;font-size:11.5px;border-collapse:collapse">
      <thead><tr style="background:var(--bg)">
        <th style="padding:4px;width:24px">#</th>
        ${t.columns.map(c=>`<th style="padding:4px;text-align:left">${c.label}</th>`).join('')}
        <th style="padding:4px;width:30px"></th>
      </tr></thead>
      <tbody>
        ${t.rows.map((row,idx)=>`
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:4px;text-align:center;color:var(--text3)">${idx+1}</td>
            ${t.columns.map(c=>{
              const v = row[c.key]||'';
              if (c.type==='select') {
                return `<td style="padding:3px"><select style="font-size:11px;padding:3px;width:100%"
                  onchange="dynTableUpdateField('${key}',${idx},'${c.key}',this.value)">
                  <option value="">--</option>
                  ${c.options.map(o=>`<option value="${o}" ${v===o?'selected':''}>${o}</option>`).join('')}
                  </select></td>`;
              }
              return `<td style="padding:3px"><input type="${c.type||'text'}" value="${v}" style="font-size:11px;padding:3px;width:100%;min-width:${c.minWidth||'70px'}"
                oninput="dynTableUpdateField('${key}',${idx},'${c.key}',this.value)"></td>`;
            }).join('')}
            <td style="padding:3px;text-align:center">
              <button type="button" class="act-btn del" style="padding:2px 6px" onclick="dynTableRemoveRow('${key}',${idx})">✕</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}
function dynTableWidget(key, columns, initialRows, addLabel) {
  dynTableInit(key, columns, initialRows);
  return `
    <div style="margin-bottom:6px">
      <div id="dyntable-${key}"></div>
      <button type="button" class="btn btn-xs btn-ghost" style="margin-top:6px" onclick="dynTableAddRow('${key}')">+ ${addLabel||'Tambah Baris'}</button>
    </div>`;
}
// Call after openModal() to actually paint all dynamic tables referenced in a stage form
function renderAllDynTables(keys) {
  keys.forEach(k => renderDynTable(k));
}
// Collect all rows from a dynamic table key back into a plain array (called at save time)
function dynTableCollect(key) {
  return mcuDynTables[key]?.rows || [];
}

function renderStageForm(stage, data, project, readOnly) {
  const ro = readOnly ? 'disabled' : '';
  const val = (k) => data[k] !== undefined && data[k] !== null ? String(data[k]) : '';

  // Stage-specific forms
  const forms = {
    S01: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">A. Informasi Klien & PIC</div>
      <div class="form-row">
        <div class="form-group"><label>Nama Perusahaan / Instansi *</label><input type="text" id="sf_nama_perusahaan" value="${val('nama_perusahaan')}" ${ro}></div>
        <div class="form-group"><label>Sektor Industri / Profil Risiko Pekerjaan *</label><input type="text" id="sf_industri_klien" value="${val('industri_klien')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nama &amp; Jabatan PIC Klien *</label><input type="text" id="sf_pic_klien_nama_jabatan" value="${val('pic_klien_nama_jabatan')}" ${ro}></div>
        <div class="form-group"><label>No. HP / Email PIC Klien *</label><input type="text" id="sf_pic_klien_kontak" value="${val('pic_klien_kontak')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Sales / Account Manager PIC Internal</label><input type="text" id="sf_sales_pic_internal" value="${val('sales_pic_internal')||(getUserName?getUserName():'')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">B. Ruang Lingkup &amp; Jadwal</div>
      <div class="form-row">
        <div class="form-group"><label>Estimasi Jumlah Peserta (Orang) *</label><input type="number" id="sf_target_peserta" value="${val('target_peserta')||project.target_participants||''}" ${ro}></div>
        <div class="form-group"><label>Estimasi Kapasitas per Hari</label><input type="number" id="sf_kapasitas_per_hari" value="${val('kapasitas_per_hari')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Estimasi Durasi (Hari)</label><input type="number" id="sf_durasi_hari" value="${val('durasi_hari')}" ${ro}></div>
        <div class="form-group"><label>Preferensi Tanggal Pelaksanaan *</label><input type="date" id="sf_preferensi_tanggal_1" value="${val('preferensi_tanggal_1')||project.tanggal_pelaksanaan||''}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Waktu Pelaksanaan</label>
          <select id="sf_waktu_pelaksanaan" ${ro}>
            ${['Pagi (08.00–Selesai)','Shift (24 Jam)','Lainnya'].map(s=>`<option${val('waktu_pelaksanaan')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Jenis Pelaksanaan *</label>
          <select id="sf_lokasi_pelaksanaan" ${ro}>
            ${['ONSITE','OFFSITE','CLINIC'].map(s=>`<option${val('lokasi_pelaksanaan')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Alamat Lokasi Pelaksanaan</label><input type="text" id="sf_alamat_lokasi" value="${val('alamat_lokasi')||val('lokasi')}" ${ro} placeholder="Wajib jika ONSITE/OFFSITE"></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">C. Kebutuhan Medis &amp; Hasil</div>
      <div class="form-row">
        <div class="form-group"><label>Tujuan MCU *</label>
          <select id="sf_tujuan_mcu" ${ro}>
            ${['Tahunan (Annual)','Pra-Kerja (Pre-employment)','Berkala (Periodic)','Khusus (Exit MCU/Purna Bakti)'].map(s=>`<option${val('tujuan_mcu')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Jenis Parameter Pemeriksaan</label>
          <select id="sf_jenis_parameter" ${ro}>
            ${['Paket Standar (Lampirkan)','Custom sesuai Risiko Pekerjaan','Rekomendasi Tim Medis OneLab'].map(s=>`<option${val('jenis_parameter')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Fasilitas / Alat Dibutuhkan</label>
        <input type="text" id="sf_fasilitas_dibutuhkan" value="${val('fasilitas_dibutuhkan')}" ${ro} placeholder="Dokter Umum, Spesialis, Radiologi, EKG, Audiometri, Spirometri, Lab Darah/Urine/Fes..."></div>
      <div class="form-group"><label>Kebutuhan Khusus Medis</label><textarea id="sf_kebutuhan_khusus_medis" rows="2" ${ro} placeholder="Puasa, narkoba, peserta hamil, lansia, disabilitas, dll">${val('kebutuhan_khusus_medis')}</textarea></div>
      <div class="form-group"><label>Emergency Support</label>
        <select id="sf_emergency_support" ${ro}>
          ${['Tidak Ada','Dokter Standby On-site','Ambulance','Lainnya'].map(s=>`<option${val('emergency_support')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Format &amp; Pengiriman Hasil</div>
      <div class="form-row">
        <div class="form-group"><label>Format Hasil MCU</label>
          <select id="sf_format_hasil" ${ro}>
            ${['Hardcopy (Buku Individu)','Softcopy PDF Individu','Rekapitulasi Excel','Portal/Sistem Digital'].map(s=>`<option${val('format_hasil')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Target SLA Penyerahan Hasil *</label>
          <select id="sf_target_sla_hasil" ${ro}>
            ${['H+3','H+5','H+7','H+10','Lainnya'].map(s=>`<option${val('target_sla_hasil')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Bahasa Laporan</label>
          <select id="sf_bahasa_laporan" ${ro}>
            ${['Indonesia','Inggris','Bilingual'].map(s=>`<option${val('bahasa_laporan')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Integrasi Sistem</label>
          <select id="sf_integrasi_sistem" ${ro}>
            ${['Tidak Ada','API/Data Sync','Portal klien (whitelist)'].map(s=>`<option${val('integrasi_sistem')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Primary Key Data</label>
          <select id="sf_primary_key_data" ${ro}>
            ${['NIK Karyawan','NIK KTP','No. BPJS'].map(s=>`<option${val('primary_key_data')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Special Request</label><input type="text" id="sf_special_request" value="${val('special_request')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">E. Kesiapan Lokasi (Estimasi Awal)</div>
      <div class="form-row">
        <div class="form-group"><label>Jumlah Ruangan (Buah)</label><input type="number" id="sf_jumlah_ruangan" value="${val('jumlah_ruangan')}" ${ro}></div>
        <div class="form-group"><label>Kapasitas Daya Listrik (Watt/Ampere)</label><input type="text" id="sf_kapasitas_listrik" value="${val('kapasitas_listrik')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Koneksi Internet</label>
          <select id="sf_koneksi_internet" ${ro}>
            ${['Stabil','Tidak Ada','Perlu Modem Tim'].map(s=>`<option${val('koneksi_internet')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Suhu Ruang / Sampling</label>
          <select id="sf_suhu_ruang" ${ro}>
            ${['Ber-AC (≤25°C)','Non-AC/Terbuka'].map(s=>`<option${val('suhu_ruang')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Akses Kendaraan Logistik</label>
          <select id="sf_akses_kendaraan" ${ro}>
            ${['Mudah/Bebas','Terbatas','Perlu Izin'].map(s=>`<option${val('akses_kendaraan')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Penanganan Limbah B3</label>
          <select id="sf_limbah_b3" ${ro}>
            ${['Dibawa Tim OneLab','Manifes Lokal Klien'].map(s=>`<option${val('limbah_b3')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">F. Komersial &amp; Legalitas</div>
      <div class="form-row">
        <div class="form-group"><label>Skema Pembayaran</label>
          <select id="sf_skema_pembayaran_s01" ${ro}>
            ${['DP 30%+Pelunasan','NET 14 Hari','NET 30 Hari','Lainnya'].map(s=>`<option${val('skema_pembayaran_s01')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Minimum Guarantee (MG)</label>
          <select id="sf_mg_diperlukan" ${ro}>
            ${['Ya (sesuai kontrak)','Tidak diperlukan'].map(s=>`<option${val('mg_diperlukan')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Dokumen Legalitas</label>
        <input type="text" id="sf_dokumen_legalitas" value="${val('dokumen_legalitas')}" ${ro} placeholder="PO, LOI, PKS/Kontrak, Surat Pesanan"></div>
      <div class="form-group"><label>Risiko Diantisipasi</label>
        <input type="text" id="sf_risiko_diantisipasi" value="${val('risiko_diantisipasi')}" ${ro} placeholder="Lokasi terpencil, peserta >300/multi-hari, peserta hamil/disabilitas"></div>
      <div class="form-group"><label>Status Credit Hold Klien</label>
        <select id="sf_credit_hold_status" ${ro}>
          <option${val('credit_hold_status')==='CLEAR'?' selected':''}>CLEAR</option>
          <option${val('credit_hold_status')==='HOLD'?' selected':''}>HOLD</option>
          <option${val('credit_hold_status')==='HOLD_APPROVED'?' selected':''}>HOLD_APPROVED</option>
        </select>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">G. Kontak &amp; Catatan</div>
      <div class="form-group"><label>Kontak PIC Klien (Nama, Jabatan, HP/Email) *</label><input type="text" id="sf_kontak_pic_klien" value="${val('kontak_pic_klien')}" ${ro} placeholder="dr. Andi, HR Manager, 081234567"></div>
      <div class="form-group"><label>Kebutuhan Hardcopy?</label>
        <select id="sf_kebutuhan_hardcopy" ${ro}>
          <option${val('kebutuhan_hardcopy')==='true'?' selected':''}>true</option>
          <option${val('kebutuhan_hardcopy')==='false'?' selected':''}>false</option>
        </select>
      </div>`,

    S02: ()=>`
      <div class="form-row">
        <div class="form-group"><label>Nama Paket MCU</label><input type="text" id="sf_nama_paket_mcu" value="${val('nama_paket_mcu')}" ${ro}></div>
        <div class="form-group"><label>Dokter Penanggung Jawab (Medis)</label><input type="text" id="sf_dokter_pj_medis" value="${val('dokter_pj_medis')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Admin Project (Sistem)</label><input type="text" id="sf_admin_project_s02" value="${val('admin_project_s02')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:10px 0 6px">
        Daftar Parameter Pemeriksaan — Status: ✔ Ready · ⚠ Proses · ✖ Tidak Tersedia
      </div>
      ${!readOnly?dynTableWidget('tbl_s02_parameter',[
        {key:'nama_tes', label:'Nama Pemeriksaan', minWidth:'130px'},
        {key:'kode_lis', label:'Kode LIS', minWidth:'70px'},
        {key:'metode', label:'Metode', minWidth:'90px'},
        {key:'jenis_sampel', label:'Jenis Sampel', minWidth:'90px'},
        {key:'volume', label:'Volume', minWidth:'60px'},
        {key:'wadah', label:'Wadah/Tabung', minWidth:'80px'},
        {key:'nilai_rujukan', label:'Nilai Rujukan', minWidth:'90px'},
        {key:'tat', label:'TAT', minWidth:'50px'},
        {key:'stasiun', label:'Stasiun', minWidth:'80px'},
        {key:'vendor_rujukan', label:'Vendor Rujukan', minWidth:'90px'},
        {key:'input_type', label:'Input', type:'select', options:['Auto','Manual','Semi'], minWidth:'80px'},
        {key:'status_ready', label:'Status', type:'select', options:['✔ Ready','⚠ Proses','✖ Tidak Tersedia'], minWidth:'100px'},
      ], data.tbl_s02_parameter, 'Tambah Parameter') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s02_parameter||[]).length} parameter terdaftar (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Validasi &amp; Status</div>
      <div class="form-row">
        <div class="form-group"><label>Kejelasan Parameter</label>
          <select id="sf_kejelasan_parameter" ${ro}>
            ${['Sudah jelas & spesifik','Perlu klarifikasi ke klien'].map(s=>`<option${val('kejelasan_parameter')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Kesesuaian Risiko Industri</label>
          <select id="sf_kesesuaian_risiko_industri" ${ro}>
            ${['Sesuai','Perlu penyesuaian'].map(s=>`<option${val('kesesuaian_risiko_industri')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Persyaratan Pra-Analitik</label><input type="text" id="sf_persyaratan_pra_analitik" value="${val('persyaratan_pra_analitik')}" ${ro} placeholder="Puasa __ jam, tidak merokok sebelum spirometri..."></div>
        <div class="form-group"><label>Kebutuhan Dokter Spesialis</label><input type="text" id="sf_kebutuhan_dokter_spesialis" value="${val('kebutuhan_dokter_spesialis')}" ${ro} placeholder="Tidak diperlukan / Ya - Spesialisasi..."></div>
      </div>
      <div class="form-group"><label>Catatan Klinis Tambahan</label><textarea id="sf_catatan_klinis" rows="2" ${ro}>${val('catatan_klinis')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Konektivitas Auto-Log Alat</label>
          <select id="sf_konektivitas_autolog" ${ro}>
            ${['Tersedia & terkonfigurasi','Sebagian (manual sebagian)','Tidak tersedia — seluruh manual'].map(s=>`<option${val('konektivitas_autolog')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Bridging HIS/LIS</label>
          <select id="sf_bridging_his_lis" ${ro}>
            ${['Tidak diperlukan','Diperlukan — sudah dikonfigurasi','Diperlukan — dalam proses'].map(s=>`<option${val('bridging_his_lis')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Parameter Belum Ada di Sistem</label><input type="text" id="sf_parameter_belum_ada" value="${val('parameter_belum_ada')}" ${ro} placeholder="Tidak ada — semua tersedia / Ada — estimasi selesai..."></div>
      <div class="form-group"><label>Parameter Risiko Tinggi</label><input type="text" id="sf_parameter_risiko_tinggi" value="${val('parameter_risiko_tinggi')}" ${ro}></div>
      <div class="form-row">
        <div class="form-group"><label>Potensi Kendala</label><input type="text" id="sf_potensi_kendala" value="${val('potensi_kendala')}" ${ro} placeholder="Reagen terbatas, alat terbatas, TAT panjang, vendor eksternal..."></div>
        <div class="form-group"><label>Mitigasi</label><input type="text" id="sf_mitigasi_kendala" value="${val('mitigasi_kendala')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Status Mapping Final</label>
        <select id="sf_status_mapping_final" ${ro}>
          ${['Draft — masih perlu klarifikasi','LOCKED — siap Package Released'].map(s=>`<option${val('status_mapping_final')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Validasi PJ Medis</label>
        <select id="sf_validasi_pj_medis" ${ro}>
          <option${val('validasi_pj_medis')==='Belum'?' selected':''}>Belum</option>
          <option${val('validasi_pj_medis')==='Sudah / Ya'?' selected':''}>Sudah / Ya</option>
        </select>
      </div>`,

    S03: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">A. Informasi Dasar</div>
      <div class="form-row">
        <div class="form-group"><label>Nama Klien</label><input type="text" id="sf_nama_klien_s03" value="${val('nama_klien_s03')||project.partner_name||''}" ${ro}></div>
        <div class="form-group"><label>Jenis Pelaksanaan</label>
          <select id="sf_jenis_pelaksanaan_s03" ${ro}>
            ${['Onsite','Offsite','Klinik'].map(s=>`<option${val('jenis_pelaksanaan_s03')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Estimasi Peserta (Orang)</label><input type="number" id="sf_estimasi_peserta_s03" value="${val('estimasi_peserta_s03')||project.target_participants||''}" ${ro}></div>
        <div class="form-group"><label>Estimasi Peserta/Hari</label><input type="number" id="sf_estimasi_peserta_per_hari" value="${val('estimasi_peserta_per_hari')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Durasi Kegiatan (Hari)</label><input type="number" id="sf_durasi_kegiatan_s03" value="${val('durasi_kegiatan_s03')}" ${ro}></div>
        <div class="form-group"><label>Lokasi Pelaksanaan</label><input type="text" id="sf_lokasi_pelaksanaan_s03" value="${val('lokasi_pelaksanaan_s03')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Minimum Guarantee (MG)</label><input type="text" id="sf_mg_s03" value="${val('mg_s03')}" ${ro} placeholder="___ Orang / ___ %"></div>

      <div class="status-box status-ok" style="margin:12px 0;font-size:12px">
        ✅ Data RAB dari RAB Calculator (rincian biaya A-K): HPP/peserta = <strong>${formatCurrency(project.harga_per_peserta||0)}</strong> ·
        MG = <strong>${project.minimum_guarantee||'—'}</strong> peserta. Buka RAB Calculator untuk isi rincian COGS per kategori.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Total HPP / COGS (dari RAB)</label><input type="number" id="sf_rab_hpp_total" value="${val('rab_hpp_total')||project.rab_hpp||0}" ${ro}></div>
        <div class="form-group"><label>Margin (%)</label><input type="number" id="sf_margin_pct" value="${val('margin_pct')||project.rab_margin_pct||30}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">B. Struktur Harga &amp; Margin</div>
      <div class="form-row">
        <div class="form-group"><label>Harga Jual per Paket/Pax (Nett, excl. PPN)</label><input type="number" id="sf_harga_jual_per_pax" value="${val('harga_jual_per_pax')||project.harga_per_peserta||0}" ${ro}></div>
        <div class="form-group"><label>Total Nilai Proyek (Excl. PPN)</label><input type="number" id="sf_total_nilai_proyek_s03" value="${val('total_nilai_proyek_s03')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Estimasi Potongan PPh 23 (jika klien Badan)</label><input type="number" id="sf_estimasi_pph23" value="${val('estimasi_pph23')}" ${ro}></div>
      <div class="form-row">
        <div class="form-group"><label>Skema Add-On</label>
          <select id="sf_skema_addon" ${ro}>
            ${['Mengacu Pricelist','Diskon Khusus'].map(s=>`<option${val('skema_addon')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Skema Pembayaran</label>
          <select id="sf_skema_pembayaran_s03" ${ro}>
            ${['DP 30%+Pelunasan 70%','NET 14 Hari','NET 30 Hari'].map(s=>`<option${val('skema_pembayaran_s03')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Analisis Finansial &amp; Simulasi Skenario</div>
      <table style="width:100%;font-size:11.5px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)">
          <th style="padding:4px;text-align:left">Komponen</th><th style="padding:4px">Best Case (100%)</th><th style="padding:4px">Normal (~90%)</th><th style="padding:4px">Worst (Min. MG)</th>
        </tr></thead>
        <tbody>
          ${[
            ['estimasi_peserta','Estimasi Peserta (Orang)'],['revenue','Revenue (Rp)'],['total_cogs','Total COGS (Rp)'],
            ['gross_profit','Gross Profit (Rp)'],['gross_margin_pct','Gross Margin (%)'],['cost_per_pax','Cost per Pax (Rp)'],
            ['harga_per_pax','Harga per Pax (Rp)'],['profit_per_pax','Profit per Pax (Rp)'],['bep','BEP (Jumlah Peserta)'],['est_pph23','Est. PPh 23 (2% DPP)'],
          ].map(([key,label])=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${label}</td>
              ${['best','normal','worst'].map(scenario=>`
                <td style="padding:3px"><input type="text" id="sf_skenario_${key}_${scenario}" value="${val('skenario_'+key+'_'+scenario)}" ${ro}
                  style="font-size:11px;padding:3px;width:100%"></td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Validasi Risiko &amp; Status</div>
      <div class="form-row">
        <div class="form-group"><label>Tingkat Risiko</label>
          <select id="sf_tingkat_risiko_s03" ${ro}>
            ${['Low','Medium','High'].map(s=>`<option${val('tingkat_risiko_s03')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Faktor Risiko</label><input type="text" id="sf_faktor_risiko_s03" value="${val('faktor_risiko_s03')}" ${ro} placeholder="Peserta >300, lokasi remote, vendor dominan, margin ketat"></div>
      </div>
      <div class="form-group"><label>Catatan &amp; Mitigasi Risiko</label><textarea id="sf_catatan_mitigasi_risiko" rows="2" ${ro}>${val('catatan_mitigasi_risiko')}</textarea></div>
      <div class="form-group"><label>Status Form</label>
        <select id="sf_status_form_s03" ${ro}>
          ${['Draft','Final — Siap Penawaran','Approved — Siap F-05'].map(s=>`<option${val('status_form_s03')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">E. Approval</div>
      <div class="status-box status-warn" style="margin-bottom:10px;font-size:11.5px">
        ⚠️ F-03-B2B WAJIB diverifikasi Finance dan disetujui Head of Operations sebelum penawaran dikirim ke klien.
      </div>
      <div class="form-group"><label>Catatan / Justifikasi Harga</label><textarea id="sf_catatan_harga" rows="2" ${ro}>${val('catatan_harga')}</textarea></div>
      <div class="form-group"><label>Approval Head of Operations</label>
        <select id="sf_approval_head_ops" ${ro}>
          <option${val('approval_head_ops')==='Pending'?' selected':''}>Pending</option>
          <option${val('approval_head_ops')==='Approved'?' selected':''}>Approved</option>
          <option${val('approval_head_ops')==='Rejected'?' selected':''}>Rejected</option>
        </select>
      </div>`,

    S04: ()=>`
      <div class="status-box status-warn" style="margin-bottom:12px;font-size:12px">
        🔒 Setelah kedua tanda tangan → F-05 DIKUNCI. Data tidak bisa diubah kecuali via Addendum.
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">A. Informasi Utama Kontrak</div>
      <div class="form-row">
        <div class="form-group"><label>No. PO / Kontrak / LOI</label><input type="text" id="sf_no_po_kontrak" value="${val('no_po_kontrak')}" ${ro}></div>
        <div class="form-group"><label>Status Order</label>
          <select id="sf_status_order_s04" ${ro}>
            ${['Baru','Addendum'].map(s=>`<option${val('status_order_s04')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>PIC Penagihan Klien (Finance) / Kontak</label><input type="text" id="sf_pic_finance_klien" value="${val('pic_finance_klien')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">B. Ruang Lingkup &amp; Jadwal</div>
      <div class="form-row">
        <div class="form-group"><label>Total Estimasi Peserta</label><input type="number" id="sf_total_estimasi_peserta_s04" value="${val('total_estimasi_peserta_s04')||project.target_participants||''}" ${ro}></div>
        <div class="form-group"><label>Minimum Guarantee</label><input type="number" id="sf_minimum_guarantee" value="${val('minimum_guarantee')||project.minimum_guarantee||0}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Jenis Pelaksanaan</label>
          <select id="sf_jenis_pelaksanaan_s04" ${ro}>
            ${['Onsite','Offsite','Klinik'].map(s=>`<option${val('jenis_pelaksanaan_s04')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Tanggal Pelaksanaan</label><input type="date" id="sf_tanggal_pelaksanaan_s04" value="${val('tanggal_pelaksanaan_s04')||project.tanggal_pelaksanaan||''}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Durasi Kegiatan (Hari)</label><input type="number" id="sf_durasi_kegiatan_s04" value="${val('durasi_kegiatan_s04')}" ${ro}></div>
        <div class="form-group"><label>Batas Akhir Manifest Peserta (H-3)</label><input type="date" id="sf_batas_manifest" value="${val('batas_manifest')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Rincian Paket &amp; Harga (Fixed)</div>
      ${!readOnly?dynTableWidget('tbl_s04_paket',[
        {key:'nama_paket', label:'Nama Paket', minWidth:'140px'},
        {key:'jumlah_peserta', label:'Jumlah Peserta', type:'number', minWidth:'80px'},
        {key:'harga_nett', label:'Harga/Paket Nett (Rp)', type:'number', minWidth:'100px'},
        {key:'total_nilai', label:'Total Nilai Order (Rp)', type:'number', minWidth:'100px'},
      ], data.tbl_s04_paket, 'Tambah Paket') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s04_paket||[]).length} paket terdaftar (read-only)</div>`}
      <div class="form-group"><label>TOTAL NILAI PROYEK (Excl. PPN)</label><input type="number" id="sf_total_nilai_proyek_s04" value="${val('total_nilai_proyek_s04')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Ketentuan Keuangan &amp; Pembayaran</div>
      <div class="form-row">
        <div class="form-group"><label>Termin Pembayaran</label>
          <select id="sf_termin_pembayaran" ${ro}>
            ${['DP 30%+Pelunasan 70% setelah BAST','NET 14 Hari setelah invoice','NET 30 Hari setelah invoice','Lainnya'].map(s=>`<option${val('termin_pembayaran')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Skema Pembayaran (Internal)</label>
          <select id="sf_skema_pembayaran" ${ro}>
            ${['CREDIT','DP50','FULLPAYMENT','CREDIT_HOLD_EXCEPTION'].map(s=>`<option${(val('skema_pembayaran')||project.skema_pembayaran||'CREDIT')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>MG sebagai Dasar Tagihan</label>
          <select id="sf_mg_dasar_tagihan" ${ro}>
            <option${val('mg_dasar_tagihan')==='Ya'?' selected':''}>Ya</option>
            <option${val('mg_dasar_tagihan')==='Tidak'?' selected':''}>Tidak</option>
          </select>
        </div>
        <div class="form-group"><label>Ketentuan Add-On</label>
          <select id="sf_ketentuan_addon" ${ro}>
            ${['Tarif sama dengan kontrak','Tarif khusus','Wajib form persetujuan PIC Klien'].map(s=>`<option${val('ketentuan_addon')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">E. Spesifikasi Output &amp; SLA</div>
      <div class="form-row">
        <div class="form-group"><label>Harga per Peserta (Rp)</label><input type="number" id="sf_harga_per_peserta" value="${val('harga_per_peserta')||project.harga_per_peserta||0}" ${ro}></div>
        <div class="form-group"><label>SLA Hasil Kontraktual</label>
          <select id="sf_sla_hasil_kontraktual" ${ro}>
            ${['H+3','H+5','H+7','H+10'].map(s=>`<option${(val('sla_hasil_kontraktual')||project.sla_hasil_kontraktual||'H+5')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Laporan Individu</label>
          <select id="sf_laporan_individu" ${ro}>
            ${['Hardcopy (Buku)','Softcopy PDF'].map(s=>`<option${val('laporan_individu')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Metode Pengiriman</label>
          <select id="sf_metode_pengiriman_s04" ${ro}>
            ${['Kurir ke Kantor Pusat','Email/Portal Digital'].map(s=>`<option${val('metode_pengiriman_s04')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">F. Ketentuan Pembatalan</div>
      <div style="font-size:11.5px;color:var(--text3);margin-bottom:6px">
        ≥ H-7: 50% dari total nilai proyek &nbsp;·&nbsp; H-3 s/d H-6: 75% &nbsp;·&nbsp; ≤ H-2 atau saat pelaksanaan: 100%
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">G. Status &amp; Tanda Tangan</div>
      <div class="form-group"><label>Status Order</label>
        <select id="sf_status_order_final" ${ro}>
          ${['Draft','Final','Approved — Siap Eksekusi'].map(s=>`<option${val('status_order_final')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tanda Tangan Sales/AM *</label><input type="text" id="sf_signed_by_sales" value="${val('signed_by_sales')||project.pic_sales||''}" ${ro} placeholder="Nama Sales"></div>
        <div class="form-group"><label>Tanda Tangan SPV Project *</label><input type="text" id="sf_signed_by_spv" value="${val('signed_by_spv')||project.pic_spv||''}" ${ro} placeholder="Nama SPV"></div>
      </div>
      <div class="form-group">
        <label>Kunci F-05 (Wajib kedua tanda tangan terisi)</label>
        <select id="sf_f05_locked" ${ro}>
          <option value="false" ${project.f05_locked?'':'selected'}>Belum dikunci</option>
          <option value="true" ${project.f05_locked?'selected':''}>KUNCI F-05 ✓</option>
        </select>
        <div class="form-hint">Setelah dikunci, semua perubahan hanya via Form Addendum L4_035</div>
      </div>`,

    S05: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">A. Informasi Dasar</div>
      <div class="form-row">
        <div class="form-group"><label>Hari / Tanggal Survey</label><input type="date" id="sf_hari_tanggal_survey" value="${val('hari_tanggal_survey')}" ${ro}></div>
        <div class="form-group"><label>Waktu Pelaksanaan</label><input type="text" id="sf_waktu_pelaksanaan_tm" value="${val('waktu_pelaksanaan_tm')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Alamat Lokasi Onsite</label><input type="text" id="sf_alamat_lokasi_onsite" value="${val('alamat_lokasi_onsite')}" ${ro}></div>
      <div class="form-row">
        <div class="form-group"><label>PIC Klien (Nama &amp; Jabatan)</label><input type="text" id="sf_pic_klien_tm" value="${val('pic_klien_tm')}" ${ro}></div>
        <div class="form-group"><label>Tim Survei OneLab (Nama &amp; Jabatan)</label><input type="text" id="sf_tim_survei_onelab" value="${val('tim_survei_onelab')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Verifikasi Fasilitas &amp; Ruangan</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Komponen Fisik</th><th style="padding:4px">Status</th><th style="padding:4px;text-align:left">Catatan / Mitigasi</th></tr></thead>
        <tbody>
          ${[
            ['suhu','Suhu Area Sampling (AC aktif ≤25°C)'],['listrik','Kestabilan Listrik (min 2.200W)'],
            ['toilet','Fasilitas Toilet (≤15m dari stasiun)'],['akses_logistik','Akses Logistik (bebas hambatan)'],
            ['alur_ruangan','Sistem Alur Ruangan (One-Way Flow)'],['internet_status_tm','Koneksi Internet'],
          ].map(([key,label])=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${label}</td>
              <td style="padding:3px;text-align:center">
                <select id="sf_${key.endsWith('_tm')?key:key+'_status'}" ${ro} style="font-size:11px;padding:3px">
                  <option${val(key.endsWith('_tm')?key:key+'_status')==='Siap'?' selected':''}>Siap</option>
                  <option${val(key.endsWith('_tm')?key:key+'_status')==='Tidak Siap'?' selected':''}>Tidak Siap</option>
                </select>
              </td>
              <td style="padding:3px"><input type="text" id="sf_${key}_catatan" value="${val(key+'_catatan')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Pemetaan Stasiun Kerja</div>
      ${!readOnly?dynTableWidget('tbl_s05_stasiun',[
        {key:'nama_stasiun', label:'Nama Stasiun', minWidth:'150px'},
        {key:'perangkat', label:'Perangkat & Kebutuhan', minWidth:'150px'},
        {key:'pic_stasiun', label:'PIC', minWidth:'100px'},
        {key:'catatan_khusus', label:'Catatan Khusus', minWidth:'150px'},
      ], (data.tbl_s05_stasiun&&data.tbl_s05_stasiun.length)?data.tbl_s05_stasiun:[
        {nama_stasiun:'Registrasi Utama (Gatekeeper)'},{nama_stasiun:'Pemeriksaan Fisik & Tensi'},
        {nama_stasiun:'Lab & Flebotomi (Sampling)'},{nama_stasiun:'Pemeriksaan Dokter'},
        {nama_stasiun:'Penunjang (EKG/Audiometri/Spirometri)'},{nama_stasiun:'Checkout & Validasi Akhir'},
      ], 'Tambah Stasiun') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s05_stasiun||[]).length} stasiun terdaftar (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Integrasi Sistem, Hardware &amp; Manifes Data</div>
      <div class="form-group"><label>Validasi Data Utama</label>
        <select id="sf_validasi_data_utama" ${ro}>
          ${['NIK Karyawan (Internal)','NIK KTP (Dukcapil)','No. ID BPJS'].map(s=>`<option${val('validasi_data_utama')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Konektivitas Internet</label>
          <select id="sf_konektivitas_internet_tm" ${ro}>
            ${['Wi-Fi Klien (Whitelist IP LIS sudah diajukan)','Modem Router Portable Tim OneLab'].map(s=>`<option${val('konektivitas_internet_tm')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Printer &amp; Scanner</label>
          <select id="sf_printer_scanner" ${ro}>
            ${['Printer Barcode Thermal — tes cetak: OK','Scanner Barcode — tes koneksi: OK'].map(s=>`<option${val('printer_scanner')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Batas Akhir Manifest Peserta dari Klien</label><input type="date" id="sf_batas_manifest_tm" value="${val('batas_manifest_tm')}" ${ro}></div>
        <div class="form-group"><label>Format File Manifest yang Diterima</label><input type="text" id="sf_format_file_manifest" value="${val('format_file_manifest')}" ${ro} placeholder="Excel, CSV, dll"></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">E. Manajemen Risiko Klinis &amp; Operasional</div>
      ${[
        ['risiko_internet_mati','Internet Mati (Down)'],['risiko_addon','Peserta Tambahan (Add-On Susulan)'],
        ['risiko_sampel_rusak','Sampel Darah Rusak / Lisis'],['risiko_limbah_b3','Penanganan Limbah Medis B3'],
        ['risiko_alat_rusak','Alat Rusak di Lapangan'],['risiko_peserta_pingsan','Peserta Pingsan / Reaksi Medis'],
      ].map(([key,label])=>`
        <div class="form-group"><label>${label} — Rencana Mitigasi</label>
          <input type="text" id="sf_${key}" value="${val(key)}" ${ro}></div>`).join('')}

      <div class="form-group"><label>Temuan Tambahan di Lokasi</label><textarea id="sf_temuan_site" rows="2" ${ro}>${val('temuan_site')}</textarea></div>
      <div class="form-group"><label>Catatan Technical Meeting</label><textarea id="sf_catatan_tm" rows="2" ${ro}>${val('catatan_tm')}</textarea></div>
      <div class="form-group"><label>Status Tanda Tangan (Sales, SPV, Admin, PIC Klien)</label>
        <select id="sf_signed_tm" ${ro}>
          <option${val('signed_tm')==='Belum'?' selected':''}>Belum</option>
          <option${val('signed_tm')==='Sudah / Ya'?' selected':''}>Sudah / Ya</option>
        </select>
      </div>`,

    S06: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">B. Checklist 7 Syarat Handover — Wajib Semua Terpenuhi</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Syarat</th><th style="padding:4px">Status</th><th style="padding:4px;text-align:left">No. Dokumen / Keterangan</th></tr></thead>
        <tbody>
          ${[
            ['syarat1','F-01-B2B selesai & lengkap — diserahkan ke Admin Project & SPV Project'],
            ['syarat2','F-02-B2B disetujui — Package Released (signed Medis + Admin Project)'],
            ['syarat3','F-03-B2B disetujui — approved Finance + Head of Operations'],
            ['syarat4','F-05-B2B ditandatangani — Order LOCKED'],
            ['syarat5','Technical Meeting selesai — F-TM-B2B signed 3 pihak'],
            ['syarat6','Site Assessment selesai — laporan tertulis SPV Project tersedia'],
            ['syarat7','Risiko proyek telah diidentifikasi & strategi mitigasi didokumentasikan'],
          ].map(([key,label],i)=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${i+1}. ${label}</td>
              <td style="padding:3px;text-align:center">
                <select id="sf_${key}" ${ro} style="font-size:11px;padding:3px">
                  <option${val(key)==='Terpenuhi'?' selected':''}>Terpenuhi</option>
                  <option${val(key)==='Belum'?' selected':''}>Belum</option>
                </select>
              </td>
              <td style="padding:3px"><input type="text" id="sf_${key}_ket" value="${val(key+'_ket')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">C. Tim Pelaksana</div>
      <div class="form-row">
        <div class="form-group"><label>PIC Project Leader (SPV Lapangan)</label><input type="text" id="sf_pic_spv_project" value="${val('pic_spv_project')}" ${ro}></div>
        <div class="form-group"><label>No. HP PIC</label><input type="text" id="sf_no_hp_pic" value="${val('no_hp_pic')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Dokter Umum (Orang)</label><input type="number" id="sf_dokter_umum_qty" value="${val('dokter_umum_qty')}" ${ro}></div>
        <div class="form-group"><label>Dokter Spesialis (Jenis &amp; Jumlah)</label><input type="text" id="sf_dokter_spesialis_jenis" value="${val('dokter_spesialis_jenis')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Analis Laboratorium (Orang)</label><input type="number" id="sf_analis_lab_qty" value="${val('analis_lab_qty')}" ${ro}></div>
        <div class="form-group"><label>Radiografer (Orang)</label><input type="number" id="sf_radiografer_qty" value="${val('radiografer_qty')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Admin Registrasi (Orang)</label><input type="number" id="sf_admin_registrasi_qty" value="${val('admin_registrasi_qty')}" ${ro}></div>
        <div class="form-group"><label>Admin Project (Penerima Handover)</label><input type="text" id="sf_pic_admin_project" value="${val('pic_admin_project')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">D. Checklist Dokumen yang Diserahkan</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Dokumen</th><th style="padding:4px">Status</th></tr></thead>
        <tbody>
          ${[
            ['dok1','Kontrak / PO / LOI (dokumen legalitas)'],['dok2','F-03-B2B (Pra-Kalkulasi & Penawaran yang disetujui)'],
            ['dok3','F-05-B2B (Order MCU — copy signed)'],['dok4','Database Peserta (Excel format OneLab, sudah dicleansing)'],
            ['dok5','Berita Acara TM (F-TM-B2B — signed 3 pihak)'],['dok6','Laporan Survei Lapangan (Onsite)'],
            ['dok7','Special Request Klien (belum tercantum di F-05)'],['dok8','Catatan & Risiko Proyek dari Sales'],
          ].map(([key,label])=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${label}</td>
              <td style="padding:3px;text-align:center">
                <select id="sf_${key}" ${ro} style="font-size:11px;padding:3px">
                  <option${val(key)==='Diserahkan'?' selected':''}>Diserahkan</option>
                  <option${val(key)==='Belum'?' selected':''}>Belum</option>
                </select>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">E. Kesiapan Operasional &amp; Risiko</div>
      <div class="form-row">
        <div class="form-group"><label>Tingkat Risiko Proyek</label>
          <select id="sf_tingkat_risiko_s06" ${ro}>
            ${['Low','Medium','High'].map(s=>`<option${val('tingkat_risiko_s06')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Kesiapan Logistik</label><input type="text" id="sf_kesiapan_logistik" value="${val('kesiapan_logistik')}" ${ro} placeholder="Alat ✓ BMHP ✓ Sistem ✓ SDM ✓ Transportasi ✓"></div>
      </div>
      <div class="form-group"><label>Catatan Khusus dari Sales</label><textarea id="sf_catatan_khusus_sales" rows="2" ${ro} placeholder="Hal penting, permintaan sensitif, kondisi lapangan">${val('catatan_khusus_sales')}</textarea></div>
      <div class="status-box status-warn" style="margin:10px 0;font-size:11.5px">
        ⚠️ Setelah F-06 signed, Sales masih bisa dihubungi untuk konteks komersial, namun TIDAK lagi koordinator operasional.
      </div>
      <div class="form-group"><label>Catatan Handover Lainnya</label><textarea id="sf_catatan_handover" rows="2" ${ro}>${val('catatan_handover')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Tanda Tangan Sales (Penyerah)</label>
          <select id="sf_signed_handover_sales" ${ro}>
            <option${val('signed_handover_sales')==='Belum'?' selected':''}>Belum</option>
            <option${val('signed_handover_sales')==='Sudah / Ya'?' selected':''}>Sudah / Ya</option>
          </select>
        </div>
        <div class="form-group"><label>Tanda Tangan SPV Project (Penerima)</label>
          <select id="sf_signed_handover_spv" ${ro}>
            <option${val('signed_handover_spv')==='Belum'?' selected':''}>Belum</option>
            <option${val('signed_handover_spv')==='Sudah / Ya'?' selected':''}>Sudah / Ya</option>
          </select>
        </div>
      </div>`,

    S09: ()=>`
      <div class="status-box status-warn" style="margin-bottom:12px;font-size:11.5px">
        ⏰ Deadline pengajuan: HARI KAMIS setiap minggu. Jika Kamis terlewat → diproses Kamis berikutnya.
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">A. Informasi Proyek</div>
      <div class="form-row">
        <div class="form-group"><label>No. Order (F-05-B2B)</label><input type="text" id="sf_no_order_s09" value="${val('no_order_s09')}" ${ro}></div>
        <div class="form-group"><label>Tanggal Pengajuan</label><input type="date" id="sf_tanggal_pengajuan_s09" value="${val('tanggal_pengajuan_s09')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>SPV Project (Pemohon)</label><input type="text" id="sf_spv_pemohon" value="${val('spv_pemohon')||project.pic_spv||''}" ${ro}></div>
        <div class="form-group"><label>Admin Project (Pencatat)</label><input type="text" id="sf_admin_project_s09" value="${val('admin_project_s09')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Rincian Permintaan Dana Kas Gantung</div>
      <div class="status-box status-warn" style="margin-bottom:8px;font-size:11px">
        ⚠️ Total RAB-OPS TIDAK boleh melebihi batas margin F-03. Jika melebihi, lapor Head of Operations.
      </div>
      ${!readOnly?dynTableWidget('tbl_s09_pengeluaran',[
        {key:'kategori', label:'Kategori', minWidth:'140px'},
        {key:'uraian', label:'Uraian Detail (Qty × Harga)', minWidth:'150px'},
        {key:'qty', label:'Qty', type:'number', minWidth:'50px'},
        {key:'harga_satuan', label:'Harga Satuan', type:'number', minWidth:'90px'},
        {key:'total', label:'Total (Rp)', type:'number', minWidth:'90px'},
      ], (data.tbl_s09_pengeluaran&&data.tbl_s09_pengeluaran.length)?data.tbl_s09_pengeluaran:[
        {kategori:'A. Logistik Fisik (Kendaraan, BBM, Pengiriman Sampel, Tol)'},
        {kategori:'B. Akomodasi & Konsumsi Tim'},{kategori:'C. Sewa / Alat Tambahan'},
        {kategori:'D. Sistem & Laporan (Cetak Hardcopy, Ekspedisi, Portal)'},
        {kategori:'E. Kontinjensi (min 5% dari total — WAJIB terpisah dari buffer BMHP)'},
      ], 'Tambah Kategori') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s09_pengeluaran||[]).length} kategori (read-only)</div>`}
      <div class="form-group"><label>TOTAL PENGAJUAN DANA KAS GANTUNG</label><input type="number" id="sf_rab_ops_total" value="${val('rab_ops_total')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">C. Informasi Rekening Pencairan</div>
      <div class="form-row">
        <div class="form-group"><label>Metode Pencairan</label>
          <select id="sf_metode_pencairan" ${ro}>
            <option${val('metode_pencairan')==='Transfer Bank'?' selected':''}>Transfer Bank</option>
            <option${val('metode_pencairan')==='Tunai (Cash)'?' selected':''}>Tunai (Cash)</option>
          </select>
        </div>
        <div class="form-group"><label>Nama Bank &amp; Cabang</label><input type="text" id="sf_nama_bank_cabang" value="${val('nama_bank_cabang')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>No. Rekening</label><input type="text" id="sf_no_rekening_s09" value="${val('no_rekening_s09')}" ${ro}></div>
        <div class="form-group"><label>Nama Pemilik Rekening</label><input type="text" id="sf_nama_pemilik_rekening" value="${val('nama_pemilik_rekening')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Verifikasi Plafon vs RAB-OPS</div>
      <div class="form-row">
        <div class="form-group"><label>Total Plafon Operasional F-03 (Rp)</label><input type="number" id="sf_plafon_f03" value="${val('plafon_f03')}" ${ro}></div>
        <div class="form-group"><label>Total Pengajuan Sekarang (Rp)</label><input type="number" id="sf_pengajuan_sekarang" value="${val('pengajuan_sekarang')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Selisih (Plafon − Pengajuan)</label><input type="number" id="sf_selisih_plafon" value="${val('selisih_plafon')}" ${ro}></div>
        <div class="form-group"><label>Status</label>
          <select id="sf_status_plafon" ${ro}>
            <option${val('status_plafon')==='Dalam plafon'?' selected':''}>Dalam plafon</option>
            <option${val('status_plafon')==='Overrun — lapor Head of Ops (F-EXCP-01)'?' selected':''}>Overrun — lapor Head of Ops (F-EXCP-01)</option>
          </select>
        </div>
      </div>
      <div class="status-box status-info" style="margin:10px 0;font-size:11.5px">
        ℹ️ Dana dicairkan sebagai KAS GANTUNG. Laporan pertanggungjawaban + sisa kas WAJIB dikembalikan ke Finance maks H+3 setelah proyek selesai.
      </div>
      <div class="form-group"><label>Approval Finance</label>
        <select id="sf_approval_finance" ${ro}>
          <option${val('approval_finance')==='Pending'?' selected':''}>Pending</option>
          <option${val('approval_finance')==='Approved'?' selected':''}>Approved</option>
          <option${val('approval_finance')==='Rejected'?' selected':''}>Rejected</option>
        </select>
      </div>
      <div class="form-group"><label>Status Dana Cair</label>
        <select id="sf_dana_cair" ${ro}>
          <option${val('dana_cair')==='Belum'?' selected':''}>Belum</option>
          <option${val('dana_cair')==='Sudah'?' selected':''}>Sudah</option>
        </select>
      </div>`,

    S10: ()=>`
      <div class="status-box status-err" style="margin-bottom:12px;font-size:11.5px">
        🚫 LARANGAN ABSOLUT: Tidak diperkenankan membawa alat tanpa pengecekan & pencatatan. Function Test WAJIB sebelum dikemas.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Total Peserta Final (Orang)</label><input type="number" id="sf_total_peserta_final_s10" value="${val('total_peserta_final_s10')||project.target_participants||''}" ${ro}></div>
        <div class="form-group"><label>Estimasi Durasi (Hari)</label><input type="number" id="sf_estimasi_durasi_s10" value="${val('estimasi_durasi_s10')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">
        A. Tabel Kontrol BMHP — Perhitungan: (Jumlah Peserta × Pemakaian) + Buffer 10%
      </div>
      ${!readOnly?dynTableWidget('tbl_s10_bmhp',[
        {key:'nama_bmhp', label:'Nama BMHP/Material', minWidth:'140px'},
        {key:'satuan', label:'Satuan', minWidth:'60px'},
        {key:'qty_kebutuhan', label:'Qty Kebutuhan', type:'number', minWidth:'70px'},
        {key:'buffer_10pct', label:'Buffer 10%', type:'number', minWidth:'70px'},
        {key:'total_request', label:'Total Request', type:'number', minWidth:'80px'},
        {key:'qty_out', label:'Keluar (OUT)', type:'number', minWidth:'70px'},
        {key:'qty_in', label:'Kembali (IN)', type:'number', minWidth:'70px'},
        {key:'qty_terpakai', label:'Terpakai', type:'number', minWidth:'70px'},
      ], (data.tbl_s10_bmhp&&data.tbl_s10_bmhp.length)?data.tbl_s10_bmhp:[{nama_bmhp:'Jarum Vacutainer'},{nama_bmhp:'Syringe'},{nama_bmhp:'Wing Needle'},{nama_bmhp:'Tabung EDTA (Ungu)'},{nama_bmhp:'Tabung Serum Gel (SST)'},{nama_bmhp:'Tabung Urine'},{nama_bmhp:'Pot Feses'},{nama_bmhp:'Kapas Alkohol'},{nama_bmhp:'Plester Bulat'},{nama_bmhp:'Masker (Box)'},{nama_bmhp:'Handscoon M (Box)'},{nama_bmhp:'Handscoon L (Box)'},{nama_bmhp:'Micropore'},{nama_bmhp:'Apron Plastik'},{nama_bmhp:'Plastik Sampel'},{nama_bmhp:'Plastik Sampah Medis'},{nama_bmhp:'Plastik Sampah Non-Medis'},{nama_bmhp:'Safety Box Jarum'},{nama_bmhp:'Hand Sanitizer'},{nama_bmhp:'Tissue Kasar/Halus'},{nama_bmhp:'Rak Tabung Sampel'},{nama_bmhp:'Strip Tes Urine'},{nama_bmhp:'Strip Tes Glukosa'},{nama_bmhp:'Ice Pack / Gel Pendingin'}], 'Tambah BMHP') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s10_bmhp||[]).length} item BMHP (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Tabel Kontrol Alat &amp; Tools (Aset)</div>
      ${!readOnly?dynTableWidget('tbl_s10_alat',[
        {key:'nama_alat', label:'Nama Alat/Tools', minWidth:'150px'},
        {key:'qty', label:'Qty', type:'number', minWidth:'50px'},
        {key:'id_aset', label:'ID Aset', minWidth:'80px'},
        {key:'status_keluar', label:'Status Keluar', type:'select', options:['Layak','Tidak Layak'], minWidth:'90px'},
        {key:'status_kembali', label:'Status Kembali', type:'select', options:['Layak','Tidak Layak'], minWidth:'90px'},
        {key:'uji_fungsi', label:'Uji Fungsi', type:'select', options:['OK','Gagal'], minWidth:'70px'},
      ], (data.tbl_s10_alat&&data.tbl_s10_alat.length)?data.tbl_s10_alat:[{nama_alat:'Laptop / Tablet Admin (+ charger)'},{nama_alat:'Router Modem Portable'},{nama_alat:'Printer Barcode Thermal'},{nama_alat:'Scanner Barcode'},{nama_alat:'Tensimeter Digital'},{nama_alat:'Tensimeter Manual (cadangan)'},{nama_alat:'Thermometer Digital'},{nama_alat:'Timbangan Digital'},{nama_alat:'Pulse Oximeter'},{nama_alat:'Reflex Hammer'},{nama_alat:'Buku Ishihara (Tes Buta Warna)'},{nama_alat:'Snellen Chart / Projector Visus'},{nama_alat:'Penlight'},{nama_alat:'Stethoscope'},{nama_alat:'Stadiometer (Tinggi Badan)'},{nama_alat:'EKG (+ kabel lead)'},{nama_alat:'Spirometer'},{nama_alat:'Audiometer'},{nama_alat:'Centrifuge Portable'},{nama_alat:'Cool Box (+ Ice Pack)'},{nama_alat:'Rak Tabung'},{nama_alat:'Tourniquet'},{nama_alat:'Kotak P3K Darurat'}], 'Tambah Alat') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s10_alat||[]).length} alat (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">C. Parameter Kesiapan Pendukung (F-CKL-01)</div>
      <div class="form-row">
        <div class="form-group"><label>Teknisi / Petugas Cek (Maintenance/IT)</label><input type="text" id="sf_teknisi_pemeriksa" value="${val('teknisi_pemeriksa')}" ${ro}></div>
        <div class="form-group"><label>Baterai / Power</label>
          <select id="sf_baterai_power_status" ${ro}>
            <option${val('baterai_power_status')==='Semua alat baterai penuh / cadangan tersedia'?' selected':''}>Semua alat baterai penuh / cadangan tersedia</option>
            <option${val('baterai_power_status')==='Perlu charge / penggantian baterai'?' selected':''}>Perlu charge / penggantian baterai</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Kabel &amp; Aksesoris</label>
          <select id="sf_kabel_aksesoris_status" ${ro}>
            <option${val('kabel_aksesoris_status')==='Lengkap & tidak cacat'?' selected':''}>Lengkap & tidak cacat</option>
            <option${val('kabel_aksesoris_status')==='Ada yang kurang/rusak'?' selected':''}>Ada yang kurang/rusak</option>
          </select>
        </div>
        <div class="form-group"><label>Sertifikat Kalibrasi</label>
          <select id="sf_sertifikat_kalibrasi_status" ${ro}>
            <option${val('sertifikat_kalibrasi_status')==='Tersedia di folder dokumen proyek'?' selected':''}>Tersedia di folder dokumen proyek</option>
            <option${val('sertifikat_kalibrasi_status')==='Belum ada — perlu diurus'?' selected':''}>Belum ada — perlu diurus</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Uji Koneksi LIS/HIS</label>
          <select id="sf_uji_koneksi_lis" ${ro}>
            <option${val('uji_koneksi_lis')==='Berhasil terkirim ke server'?' selected':''}>Berhasil terkirim ke server</option>
            <option${val('uji_koneksi_lis')==='Gagal — perlu investigasi IT Ops'?' selected':''}>Gagal — perlu investigasi IT Ops</option>
          </select>
        </div>
        <div class="form-group"><label>Alat Cadangan Stasiun Kritis</label>
          <select id="sf_alat_cadangan_status" ${ro}>
            <option${val('alat_cadangan_status')==='Tersedia (EKG, tensimeter, laptop)'?' selected':''}>Tersedia (EKG, tensimeter, laptop)</option>
            <option${val('alat_cadangan_status')==='Tidak tersedia — lapor Head Ops'?' selected':''}>Tidak tersedia — lapor Head Ops</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Catatan Teknis / Kerusakan Minor</label><textarea id="sf_catatan_teknis_kerusakan" rows="2" ${ro}>${val('catatan_teknis_kerusakan')}</textarea></div>
      <div class="form-group"><label>Keputusan Keberangkatan</label>
        <select id="sf_keputusan_keberangkatan" ${ro}>
          <option${val('keputusan_keberangkatan')==='LAYAK BERANGKAT'?' selected':''}>LAYAK BERANGKAT</option>
          <option${val('keputusan_keberangkatan')==='HOLD KEBERANGKATAN'?' selected':''}>HOLD KEBERANGKATAN</option>
        </select>
      </div>
      <div class="form-group"><label>Status Kemasan BMHP</label>
        <select id="sf_bmhp_terkemas" ${ro}>
          <option${val('bmhp_terkemas')==='Belum'?' selected':''}>Belum</option>
          <option${val('bmhp_terkemas')==='Sudah'?' selected':''}>Sudah</option>
        </select>
      </div>`,

    S11: ()=>`
      <div class="status-box status-warn" style="margin-bottom:12px;font-size:11.5px">
        ⚠️ Tenaga medis WAJIB memiliki STR/SIP yang MASIH BERLAKU. Pergantian personel wajib seizin SPV Project.
      </div>
      <div class="form-row">
        <div class="form-group"><label>No. Order (F-05-B2B)</label><input type="text" id="sf_no_order_s11" value="${val('no_order_s11')}" ${ro}></div>
        <div class="form-group"><label>SPV Project</label><input type="text" id="sf_spv_project_s11" value="${val('spv_project_s11')||project.pic_spv||''}" ${ro}></div>
      </div>
      <div class="form-group"><label>Admin Project (Data Gatekeeper)</label><input type="text" id="sf_admin_project_s11" value="${val('admin_project_s11')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">A. Daftar Personel &amp; Kualifikasi Klinis</div>
      ${!readOnly?dynTableWidget('tbl_s11_personel',[
        {key:'nama_lengkap', label:'Nama Lengkap', minWidth:'130px'},
        {key:'jabatan', label:'Jabatan/Posisi', minWidth:'110px'},
        {key:'profesi', label:'Profesi', minWidth:'90px'},
        {key:'no_str_sip', label:'No. STR/SIP', minWidth:'90px'},
        {key:'berlaku_sd', label:'Berlaku s/d', type:'date', minWidth:'110px'},
        {key:'no_hp_personel', label:'No. HP', minWidth:'90px'},
        {key:'keterangan_personel', label:'Keterangan', minWidth:'100px'},
      ], (data.tbl_s11_personel&&data.tbl_s11_personel.length)?data.tbl_s11_personel:[
        {jabatan:'SPV Project'},{jabatan:'Admin Project / Data Gatekeeper'},
      ], 'Tambah Personel') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s11_personel||[]).length} personel terdaftar (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Konfirmasi Akses Sistem (oleh Admin Project)</div>
      ${!readOnly?dynTableWidget('tbl_s11_akses',[
        {key:'nama_personel_akses', label:'Nama Personel', minWidth:'130px'},
        {key:'username_lis', label:'Username LIS/HIS', minWidth:'110px'},
        {key:'station_digital', label:'Station Digital', minWidth:'100px'},
        {key:'hak_akses', label:'Hak Akses', minWidth:'120px'},
        {key:'uji_login', label:'Uji Login', type:'select', options:['OK','Gagal'], minWidth:'70px'},
        {key:'update_terakhir', label:'Update Terakhir', type:'date', minWidth:'110px'},
      ], data.tbl_s11_akses, 'Tambah Akses') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s11_akses||[]).length} akses terdaftar (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Rasio Pelayanan per Stasiun</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Stasiun</th><th style="padding:4px">Jumlah Personel</th><th style="padding:4px">Kapasitas (pax/jam)</th><th style="padding:4px;text-align:left">Catatan</th></tr></thead>
        <tbody>
          ${[
            ['registrasi','Registrasi / Gatekeeper'],['fisik_tensi','Pemeriksaan Fisik & Tensi'],
            ['lab_flebotomi','Laboratorium / Flebotomi'],['dokter','Pemeriksaan Dokter'],
            ['ekg_penunjang','EKG / Penunjang Khusus'],['checkout','Checkout / Validasi Akhir'],
          ].map(([key,label])=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${label}</td>
              <td style="padding:3px"><input type="number" id="sf_rasio_${key}_jml" value="${val('rasio_'+key+'_jml')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
              <td style="padding:3px"><input type="number" id="sf_rasio_${key}_kap" value="${val('rasio_'+key+'_kap')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
              <td style="padding:3px"><input type="text" id="sf_rasio_${key}_ket" value="${val('rasio_'+key+'_ket')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="status-box status-info" style="margin-bottom:10px;font-size:11.5px">
        ℹ️ Personel yang tidak hadir briefing (F-OPS-04) tanpa alasan valid TIDAK diperkenankan bertugas di lapangan.
      </div>
      <div class="form-group"><label>Konfirmasi Seluruh Personel</label>
        <select id="sf_konfirmasi_personel" ${ro}>
          <option${val('konfirmasi_personel')==='Belum'?' selected':''}>Belum</option>
          <option${val('konfirmasi_personel')==='Terkonfirmasi'?' selected':''}>Terkonfirmasi</option>
        </select>
      </div>
      <div class="form-group"><label>Status Akses Sistem</label>
        <select id="sf_akses_sistem_diberikan" ${ro}>
          <option${val('akses_sistem_diberikan')==='Belum'?' selected':''}>Belum</option>
          <option${val('akses_sistem_diberikan')==='Sudah diberikan'?' selected':''}>Sudah diberikan</option>
        </select>
      </div>`,

    S12: ()=>`
      <div class="form-row">
        <div class="form-group"><label>Tanggal Briefing</label><input type="date" id="sf_tanggal_briefing" value="${val('tanggal_briefing')}" ${ro}></div>
        <div class="form-group"><label>Waktu Mulai – Selesai</label><input type="text" id="sf_waktu_briefing" value="${val('waktu_briefing')}" ${ro} placeholder="08:00 - 08:30"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Lokasi Briefing</label>
          <select id="sf_lokasi_briefing" ${ro}>
            ${['Kantor Pusat','Lokasi Proyek','Online'].map(s=>`<option${val('lokasi_briefing')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Pimpinan Briefing (SPV)</label><input type="text" id="sf_pimpinan_briefing" value="${val('pimpinan_briefing')||project.pic_spv||''}" ${ro}></div>
      </div>

      <div class="status-box status-warn" style="margin:10px 0;font-size:11.5px">
        ⚠️ SPV Project wajib pastikan 7 poin tersampaikan & dimengerti. Personel tidak hadir tanpa alasan valid = TIDAK diperkenankan bertugas.
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Materi Briefing Wajib — 7 Topik</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Topik</th><th style="padding:4px">Status</th></tr></thead>
        <tbody>
          ${[
            'Alur Pelayanan MCU — Station Map, one-way flow, titik registrasi & exit',
            'Target & Kapasitas — target peserta, kuota/jam, estimasi jam selesai',
            'Teknis Sistem/IT — login LIS/HIS, SLA input ≤5 menit, protokol offline',
            'SLA Data (1×24 Jam) — pengiriman data mentah ke Admin Project',
            'Penanganan Sampel & Limbah — labeling, cold-chain, manifest, limbah B3',
            'Safety, Insiden & Darurat — peserta pingsan, kontak darurat, lokasi P3K',
            'Pembagian Tugas & Etika — posisi per stasiun, standar penampilan',
          ].map((label,i)=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${i+1}. ${label}</td>
              <td style="padding:3px;text-align:center">
                <select id="sf_topik${i+1}_status" ${ro} style="font-size:11px;padding:3px">
                  <option${val('topik'+(i+1)+'_status')==='Tersampaikan & Dimengerti'?' selected':''}>Tersampaikan & Dimengerti</option>
                  <option${val('topik'+(i+1)+'_status')==='Belum'?' selected':''}>Belum</option>
                </select>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Daftar Hadir Personel</div>
      ${!readOnly?dynTableWidget('tbl_s12_absensi',[
        {key:'nama_lengkap_absen', label:'Nama Lengkap', minWidth:'130px'},
        {key:'posisi_station', label:'Posisi/Station', minWidth:'110px'},
        {key:'hadir', label:'Hadir', type:'select', options:['Ya','Tidak'], minWidth:'70px'},
        {key:'keterangan_absen', label:'Keterangan', minWidth:'120px'},
      ], (data.tbl_s12_absensi&&data.tbl_s12_absensi.length)?data.tbl_s12_absensi:[
        {posisi_station:'SPV Project'},{posisi_station:'Admin Project'},
      ], 'Tambah Personel') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s12_absensi||[]).length} hadir tercatat (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Catatan Khusus / Tanya Jawab</div>
      <div class="form-group"><textarea id="sf_catatan_khusus_briefing" rows="2" ${ro} placeholder="Hal spesifik yang dibahas atau kendala yang diantisipasi tim">${val('catatan_khusus_briefing')}</textarea></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">E. Pernyataan Kesiapan</div>
      <div class="form-group"><label>Status Proyek</label>
        <select id="sf_hasil_go_nogo" ${ro}>
          <option${val('hasil_go_nogo')==='SIAP JALAN'?' selected':''}>SIAP JALAN</option>
          <option${val('hasil_go_nogo')==='DITUNDA'?' selected':''}>DITUNDA</option>
        </select>
      </div>
      <div class="form-group"><label>Alasan (jika DITUNDA)</label><input type="text" id="sf_alasan_ditunda" value="${val('alasan_ditunda')}" ${ro}></div>
      <div class="status-box status-info" style="margin-top:10px;font-size:11.5px">
        ℹ️ Jika ada perubahan teknis setelah briefing (lokasi stasiun berubah, personel last-minute), SPV WAJIB briefing tambahan untuk item yang berubah.
      </div>`,

    S13: ()=>`
      <div class="form-row">
        <div class="form-group"><label>Tanggal / Hari Ke-</label><input type="text" id="sf_tanggal_hari_ke" value="${val('tanggal_hari_ke')}" ${ro} placeholder="Hari ke-1 dari 3"></div>
        <div class="form-group"><label>Nama Stasiun</label><input type="text" id="sf_nama_stasiun_s13" value="${val('nama_stasiun_s13')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>PIC Stasiun</label><input type="text" id="sf_pic_stasiun_s13" value="${val('pic_stasiun_s13')}" ${ro}></div>
        <div class="form-group"><label>SPV Project</label><input type="text" id="sf_spv_project_s13" value="${project.pic_spv||''}" disabled></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Verifikasi Pra-Pelayanan (Isi Sebelum Peserta Pertama Masuk)</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Item Verifikasi</th><th style="padding:4px">Status</th><th style="padding:4px;text-align:left">Catatan</th></tr></thead>
        <tbody>
          ${[
            'Alat utama stasiun berfungsi normal (Function Test pagi hari done)',
            'BMHP tersedia cukup untuk target peserta hari ini',
            'Akun sistem/login aktif dan dapat menerima input data',
            'Form manual/backup tersedia jika sistem offline',
            'Label/printer barcode siap (khusus stasiun sampling)',
            'Log manifest sampel pre-print (F-CKL-02) tersedia',
            'Briefing pra-operasional sudah diikuti (F-OPS-04)',
            'Posisi meja dan alur peserta sesuai Station Map',
            'APD lengkap: Apron, Masker, Handscoon tersedia',
          ].map((label,i)=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${i+1}. ${label}</td>
              <td style="padding:3px;text-align:center">
                <select id="sf_verif${i+1}_status" ${ro} style="font-size:11px;padding:3px">
                  <option${val('verif'+(i+1)+'_status')==='OK'?' selected':''}>OK</option>
                  <option${val('verif'+(i+1)+'_status')==='NOK'?' selected':''}>NOK</option>
                </select>
              </td>
              <td style="padding:3px"><input type="text" id="sf_verif${i+1}_catatan" value="${val('verif'+(i+1)+'_catatan')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Konfirmasi Kesiapan Final</div>
      <div class="form-row">
        <div class="form-group"><label>Waktu Tiba Tim</label><input type="time" id="sf_waktu_tiba" value="${val('waktu_tiba')}" ${ro}></div>
        <div class="form-group"><label>Setup Selesai</label>
          <select id="sf_setup_selesai" ${ro}>
            <option${val('setup_selesai')==='Belum'?' selected':''}>Belum</option>
            <option${val('setup_selesai')==='Selesai'?' selected':''}>Selesai</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Sistem Online</label>
          <select id="sf_sistem_online" ${ro}>
            <option${val('sistem_online')==='Belum'?' selected':''}>Belum</option>
            <option${val('sistem_online')==='Online'?' selected':''}>Online</option>
          </select>
        </div>
        <div class="form-group"><label>Koneksi Stabil</label>
          <select id="sf_koneksi_stabil" ${ro}>
            <option${val('koneksi_stabil')==='Tidak'?' selected':''}>Tidak</option>
            <option${val('koneksi_stabil')==='Stabil'?' selected':''}>Stabil</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Konfirmasi SPV Project</label>
        <select id="sf_konfirmasi_spv" ${ro}>
          <option${val('konfirmasi_spv')==='Belum'?' selected':''}>Belum</option>
          <option${val('konfirmasi_spv')==='Dikonfirmasi — Siap Layanan'?' selected':''}>Dikonfirmasi — Siap Layanan</option>
        </select>
      </div>`,

    S14: ()=>`
      <div class="status-box status-ok" style="margin-bottom:12px;font-size:12px">
        📋 Data dari Master Peserta (S08): <strong>${val('total_terdaftar')||project.target_participants||'—'}</strong> terdaftar
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">Log Peserta per Stasiun (C. F-CKL-03)</div>
      ${!readOnly?dynTableWidget('tbl_s14_peserta',[
        {key:'nama_peserta', label:'Nama Peserta', minWidth:'130px'},
        {key:'tgl_lahir', label:'Tanggal Lahir', type:'date', minWidth:'110px'},
        {key:'waktu_in', label:'Waktu In', type:'time', minWidth:'80px'},
        {key:'waktu_out', label:'Waktu Out', type:'time', minWidth:'80px'},
        {key:'status_periksa', label:'Status', type:'select', options:['Selesai','Incomplete'], minWidth:'90px'},
        {key:'input_sistem', label:'Input', type:'select', options:['Sistem','Manual'], minWidth:'80px'},
        {key:'is_addon', label:'Add-on?', type:'select', options:['Ya','Tidak'], minWidth:'70px'},
      ], data.tbl_s14_peserta, 'Tambah Peserta') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s14_peserta||[]).length} peserta tercatat (read-only)</div>`}
      <div class="form-row">
        <div class="form-group"><label>Total Hadir Hari Ini</label><input type="number" id="sf_total_hadir" value="${val('total_hadir')}" ${ro}></div>
        <div class="form-group"><label>Jam Selesai Layanan</label><input type="time" id="sf_jam_selesai_layanan" value="${val('jam_selesai_layanan')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">
        LOG-UNREG — Peserta Tambahan / Unregistered
      </div>
      <div class="status-box status-err" style="margin-bottom:8px;font-size:11px">
        🚫 LARANGAN: Peserta yang belum dikonfirmasi PIC Klien TIDAK boleh dapat barcode/mengikuti pemeriksaan.
      </div>
      ${!readOnly?dynTableWidget('tbl_s14_unreg',[
        {key:'nama_unreg', label:'Nama Peserta', minWidth:'130px'},
        {key:'nik_unreg', label:'NIK', minWidth:'100px'},
        {key:'departemen_unreg', label:'Departemen', minWidth:'100px'},
        {key:'waktu_datang', label:'Waktu Datang', type:'time', minWidth:'80px'},
        {key:'konfirmasi_pic', label:'Konfirmasi PIC', type:'select', options:['Ya - Valid','Tidak terkonfirmasi'], minWidth:'100px'},
        {key:'status_akhir_unreg', label:'Status Akhir', type:'select', options:['Diproses (Add-on)','Ditolak/Pulang'], minWidth:'100px'},
      ], data.tbl_s14_unreg, 'Tambah Unregistered') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s14_unreg||[]).length} unregistered tercatat (read-only)</div>`}
      <div class="form-group"><label>Total Peserta Unregistered</label><input type="number" id="sf_total_unreg" value="${val('total_unreg')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Log Persetujuan Add-On Lapangan</div>
      <div class="status-box status-warn" style="margin-bottom:8px;font-size:11px">
        ⚠️ PRINSIP MUTLAK: TIDAK ADA ADD-ON TANPA FORM INI. Add-on verbal = pelanggaran prosedur.
      </div>
      ${!readOnly?dynTableWidget('tbl_s14_addon',[
        {key:'no_form_addon', label:'No. Form', minWidth:'80px'},
        {key:'nama_peserta_addon', label:'Nama Peserta', minWidth:'120px'},
        {key:'jenis_addon', label:'Jenis Pemeriksaan', minWidth:'120px'},
        {key:'harga_addon', label:'Harga (Rp)', type:'number', minWidth:'90px'},
        {key:'persetujuan_pic_addon', label:'Persetujuan PIC', type:'select', options:['Ya','Tidak'], minWidth:'90px'},
        {key:'input_sistem_addon', label:'Input Sistem', type:'select', options:['Done','Pending'], minWidth:'80px'},
      ], data.tbl_s14_addon, 'Tambah Add-on') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s14_addon||[]).length} add-on tercatat (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Log Kendala &amp; Insiden Lapangan</div>
      ${!readOnly?dynTableWidget('tbl_s14_kendala',[
        {key:'waktu_kendala', label:'Waktu', type:'time', minWidth:'70px'},
        {key:'kategori_kendala', label:'Kategori', type:'select', options:['Sistem/IT','Alat Medis','Insiden Medis','Unregistered','Sampel','Add-on Verbal','Lainnya'], minWidth:'110px'},
        {key:'deskripsi_kendala', label:'Deskripsi Kejadian', minWidth:'150px'},
        {key:'tindakan_koreksi', label:'Tindakan Koreksi', minWidth:'140px'},
        {key:'status_kendala', label:'Status', type:'select', options:['Terselesaikan','Eskalasi Head Ops','Pending'], minWidth:'110px'},
      ], data.tbl_s14_kendala, 'Tambah Kendala') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s14_kendala||[]).length} kendala tercatat (read-only)</div>`}
      <div class="form-row">
        <div class="form-group"><label>Total Kendala Hari Ini</label><input type="number" id="sf_total_kendala_hari_ini" value="${val('total_kendala_hari_ini')}" ${ro}></div>
        <div class="form-group"><label>Diselesaikan di Tempat</label><input type="number" id="sf_kendala_diselesaikan" value="${val('kendala_diselesaikan')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Dieskalasi ke Head of Operations</label><input type="number" id="sf_kendala_eskalasi" value="${val('kendala_eskalasi')}" ${ro}></div>
      <div class="form-group"><label>Catatan Eksepsi Lainnya</label><textarea id="sf_catatan_eksepsi" rows="2" ${ro}>${val('catatan_eksepsi')}</textarea></div>`,

    S15: ()=>`
      <div class="status-box status-ok" style="margin-bottom:12px;font-size:12px">
        📋 Data dari Master Peserta (S08): <strong>${val('total_terdaftar')||project.target_participants||'—'}</strong> terdaftar
      </div>
      <div class="form-row">
        <div class="form-group"><label>SPV Project (OneLab)</label><input type="text" id="sf_spv_project_s15" value="${val('spv_project_s15')||project.pic_spv||''}" ${ro}></div>
        <div class="form-group"><label>PIC Klien (Nama &amp; Jabatan)</label><input type="text" id="sf_pic_klien_s15" value="${val('pic_klien_s15')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Rekapitulasi Kehadiran &amp; Pemeriksaan per Paket</div>
      ${!readOnly?dynTableWidget('tbl_s15_rekap',[
        {key:'nama_paket_s15', label:'Nama Paket/Parameter', minWidth:'150px'},
        {key:'peserta_kontrak', label:'Peserta Kontrak (F-05)', type:'number', minWidth:'90px'},
        {key:'realisasi_hadir', label:'Realisasi Hadir', type:'number', minWidth:'90px'},
        {key:'keterangan_rekap', label:'Keterangan', minWidth:'110px'},
      ], data.tbl_s15_rekap, 'Tambah Paket') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s15_rekap||[]).length} paket direkap (read-only)</div>`}

      <div class="form-row">
        <div class="form-group"><label>Total Terdaftar (dari S08)</label><input type="number" id="sf_total_terdaftar" value="${val('total_terdaftar')||project.target_participants||0}" ${ro}></div>
        <div class="form-group"><label>Total Hadir *</label><input type="number" id="sf_total_hadir_bast" value="${val('total_hadir_bast')||val('total_hadir')||0}" ${ro} oninput="calcBAST()"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Total Unregistered (LOG-UNREG)</label><input type="number" id="sf_total_unregistered" value="${val('total_unregistered')||0}" ${ro} oninput="calcBAST()"></div>
        <div class="form-group"><label>Total Tidak Hadir (auto)</label><input type="number" id="sf_total_tidak_hadir" value="${val('total_tidak_hadir')||0}" disabled style="background:var(--bg2)"></div>
      </div>
      <div class="form-group">
        <label>Dasar Tagihan Awal (MAX(hadir+unreg, MG) — auto)</label>
        <input type="number" id="sf_dasar_tagihan_awal" value="${val('dasar_tagihan_awal')||0}" disabled style="background:var(--bg2);font-weight:700">
        <div class="form-hint">MG = ${project.minimum_guarantee||'—'} peserta</div>
      </div>
      <div class="form-group"><label>Catatan Deviasi</label><textarea id="sf_deviasi_notes" rows="2" ${ro}>${val('deviasi_notes')}</textarea></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Rekapitulasi Add-On</div>
      <div class="form-group"><label>Total Nilai Add-On (Rp, dari Log Add-on S14)</label><input type="number" id="sf_total_nilai_addon_s15" value="${val('total_nilai_addon_s15')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">D. Checklist Rekonsiliasi Final</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Item Rekonsiliasi</th><th style="padding:4px">Status</th></tr></thead>
        <tbody>
          ${[
            'Total peserta hadir (sistem = manifest = laporan harian — tidak ada selisih)',
            'Total add-on tervalidasi & tersinkron di sistem billing',
            'Data vendor/lab eksternal diterima & sesuai manifest pengiriman',
            'BMHP rekonsiliasi fisik: dibawa vs digunakan vs tersisa sudah dicatat',
            'Semua dokumen lapangan fisik lengkap (manifest, log add-on, log kendala)',
          ].map((label,i)=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${i+1}. ${label}</td>
              <td style="padding:3px;text-align:center">
                <select id="sf_rekon${i+1}_status" ${ro} style="font-size:11px;padding:3px">
                  <option${val('rekon'+(i+1)+'_status')==='Sesuai'?' selected':''}>Sesuai</option>
                  <option${val('rekon'+(i+1)+'_status')==='Tidak Sesuai'?' selected':''}>Tidak Sesuai</option>
                </select>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div class="status-box status-warn" style="margin-bottom:10px;font-size:11.5px">
        ⚠️ DOKUMEN LEGAL & FINANSIAL — Angka di BAST adalah DASAR PENAGIHAN. Hanya PIC Klien berwenang (HR/HSE/Purchasing) yang dapat menandatangani.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tanda Tangan SPV Project *</label><input type="text" id="sf_signed_by_spv_bast" value="${val('signed_by_spv_bast')||project.pic_spv||''}" ${ro}></div>
        <div class="form-group"><label>Tanda Tangan PIC Klien *</label><input type="text" id="sf_signed_by_klien" value="${val('signed_by_klien')||''}" ${ro} placeholder="Nama + Jabatan PIC Klien"></div>
      </div>`,

    S16: ()=>`
      <div class="status-box status-warn" style="margin-bottom:12px;font-size:11.5px">
        ⏰ Dikirim ke Head of Operations & Admin Project MAKSIMAL pukul 21:00 WIB hari yang sama.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tanggal / Hari Ke-</label><input type="text" id="sf_tanggal_hari_ke_s16" value="${val('tanggal_hari_ke_s16')}" ${ro} placeholder="Hari ke-1 dari 3"></div>
        <div class="form-group"><label>Jam Laporan Dibuat</label><input type="time" id="sf_jam_laporan_dibuat" value="${val('jam_laporan_dibuat')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Statistik Peserta</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Kategori</th><th style="padding:4px">Target (F-05)</th><th style="padding:4px">Realisasi Hari Ini</th><th style="padding:4px">Kumulatif s/d Hari Ini</th></tr></thead>
        <tbody>
          ${[
            ['terdaftar_s16','Total Terdaftar (sesuai F-05)'],['hadir_s16','Total Hadir & Selesai MCU'],
            ['unreg_s16','Peserta Unregistered (Sisipan)'],['tdkhadir_s16','Peserta Tidak Hadir'],
            ['addon_s16','Total Add-on Dilakukan'],['incomplete_s16','Total Peserta INCOMPLETE (menunggu hasil)'],
          ].map(([key,label])=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${label}</td>
              <td style="padding:3px"><input type="number" id="sf_target_${key}" value="${val('target_'+key)}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
              <td style="padding:3px"><input type="number" id="sf_realisasi_${key}" value="${val('realisasi_'+key)}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
              <td style="padding:3px"><input type="number" id="sf_kumulatif_${key}" value="${val('kumulatif_'+key)}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Rekap Sampel</div>
      <div class="form-row">
        <div class="form-group"><label>Total Sampel Diambil Hari Ini</label><input type="number" id="sf_total_sampel_diambil" value="${val('total_sampel_diambil')}" ${ro}></div>
        <div class="form-group"><label>Total Dikirim ke Lab/Vendor</label><input type="number" id="sf_total_sampel_dikirim" value="${val('total_sampel_dikirim')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Sampel Ditolak/Re-sampling</label><input type="number" id="sf_sampel_ditolak_resampling" value="${val('sampel_ditolak_resampling')}" ${ro}></div>
        <div class="form-group"><label>Manifest Sinkron dengan Sistem?</label>
          <select id="sf_manifest_sinkron_status" ${ro}>
            <option${val('manifest_sinkron_status')==='Ya'?' selected':''}>Ya</option>
            <option${val('manifest_sinkron_status')==='Tidak'?' selected':''}>Tidak</option>
          </select>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Log Manifest Sampel Pre-Print</div>
      <div class="status-box status-err" style="margin-bottom:8px;font-size:11px">
        🚫 Sampel TIDAK boleh dikirim sebelum seluruh baris manifest tercentang & diverifikasi Analis.
      </div>
      ${!readOnly?dynTableWidget('tbl_s16_manifest',[
        {key:'nama_peserta_manifest', label:'Nama Peserta', minWidth:'120px'},
        {key:'jenis_sampel_manifest', label:'Jenis Sampel', minWidth:'90px'},
        {key:'tabung_wadah', label:'Tabung/Wadah', minWidth:'90px'},
        {key:'volume_manifest', label:'Volume (mL)', type:'number', minWidth:'70px'},
        {key:'jam_ambil', label:'Jam Ambil', type:'time', minWidth:'80px'},
        {key:'label_barcode_manifest', label:'Label Barcode', minWidth:'90px'},
        {key:'kualitas_sampel', label:'Kualitas', type:'select', options:['Layak','Lisis/Kurang'], minWidth:'80px'},
        {key:'status_kirim_manifest', label:'Status Kirim', type:'select', options:['Terkirim','Ditolak'], minWidth:'80px'},
      ], data.tbl_s16_manifest, 'Tambah Sampel') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s16_manifest||[]).length} sampel tercatat (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Kendala &amp; Tindakan Hari Ini</div>
      <div class="form-group"><label>Catatan Kendala (jika ada)</label><textarea id="sf_kendala_harian_s16" rows="2" ${ro}></textarea></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">E. Status Data &amp; Keuangan Harian</div>
      <div class="form-group"><label>Data Sistem, Manifest &amp; Catatan Manual SINKRON?</label>
        <select id="sf_data_sinkron_status" ${ro}>
          <option${val('data_sinkron_status')==='Ya — SINKRON (konfirmasi Admin Project)'?' selected':''}>Ya — SINKRON (konfirmasi Admin Project)</option>
          <option${val('data_sinkron_status')==='Tidak — ada perbedaan'?' selected':''}>Tidak — ada perbedaan</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Pengeluaran Harian (Rp)</label><input type="number" id="sf_pengeluaran_harian" value="${val('pengeluaran_harian')}" ${ro}></div>
        <div class="form-group"><label>RAB Tersisa (Rp)</label><input type="number" id="sf_rab_tersisa" value="${val('rab_tersisa')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Exception Hari Ini (F-EXCP-01)</label>
          <select id="sf_exception_hari_ini" ${ro}>
            <option${val('exception_hari_ini')==='Tidak ada'?' selected':''}>Tidak ada</option>
            <option${val('exception_hari_ini')==='Ada'?' selected':''}>Ada</option>
          </select>
        </div>
        <div class="form-group"><label>No. Form Exception</label><input type="text" id="sf_no_form_exception" value="${val('no_form_exception')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Estimasi Peserta Besok</label><input type="number" id="sf_estimasi_peserta_besok" value="${val('estimasi_peserta_besok')}" ${ro}></div>
      <div class="form-group"><label>Catatan Khusus untuk Head of Operations</label><textarea id="sf_catatan_khusus_headops" rows="2" ${ro}>${val('catatan_khusus_headops')}</textarea></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">Serah Terima Dokumen Fisik</div>
      <div class="form-group"><label>Dokumen Fisik Diterima Admin Project</label>
        <select id="sf_dokumen_fisik_diterima" ${ro}>
          <option${val('dokumen_fisik_diterima')==='Belum'?' selected':''}>Belum</option>
          <option${val('dokumen_fisik_diterima')==='Diterima Lengkap'?' selected':''}>Diterima Lengkap</option>
        </select>
      </div>
      <div class="form-group"><label>Konfirmasi Admin Project</label>
        <select id="sf_admin_konfirmasi" ${ro}>
          <option${val('admin_konfirmasi')==='Belum'?' selected':''}>Belum</option>
          <option${val('admin_konfirmasi')==='Dikonfirmasi'?' selected':''}>Dikonfirmasi</option>
        </select>
      </div>`,

    S17: ()=>`
      <div class="status-box status-info" style="margin-bottom:12px;font-size:11.5px">
        ℹ️ "No Data, No Bill" — setiap rupiah ditagihkan harus punya bukti kehadiran dan hasil medis.
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">A. Konsolidasi 5 Sumber Data — Tidak boleh ada yang dilewati</div>
      ${[
        ['sumber_internal_status','Data Internal (hasil stasiun internal selama pelaksanaan)'],
        ['sumber_vendor_status','Data Vendor / Lab Eksternal'],
        ['sumber_bast_status','Data BAST (kehadiran lapangan)'],
        ['sumber_addon_status','Log Add-on Lapangan'],
        ['sumber_unreg_status','LOG-UNREG (peserta sisipan tervalidasi)'],
      ].map(([key,label])=>`
        <div class="form-group" style="margin-bottom:6px"><label>${label}</label>
          <select id="sf_${key}" ${ro}>
            <option${val(key)==='Belum diterima'?' selected':''}>Belum diterima</option>
            <option${val(key)==='Diterima & terintegrasi'?' selected':''}>Diterima & terintegrasi</option>
          </select>
        </div>`).join('')}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Proses Cleansing Data (Wajib)</div>
      ${[
        ['dedup_nik_status','Deduplikasi berdasarkan NIK'],
        ['standarisasi_nama_status','Standarisasi Nama (KAPITAL, tanpa gelar/singkatan)'],
        ['format_nik_status','Format NIK (16 digit, numeric)'],
        ['format_tgl_lahir_status','Format Tanggal Lahir (DD/MM/YYYY konsisten)'],
        ['validasi_unreg_konsolidasi','Peserta Sisipan Divalidasi ke PIC Klien'],
      ].map(([key,label])=>`
        <div class="form-group" style="margin-bottom:6px"><label>${label}</label>
          <select id="sf_${key}" ${ro}>
            <option${val(key)==='Belum'?' selected':''}>Belum</option>
            <option${val(key)==='Selesai'?' selected':''}>Selesai</option>
          </select>
        </div>`).join('')}

      <div class="status-box status-err" style="margin:10px 0;font-size:11.5px">
        🚫 Tidak ada proses generate yang boleh dimulai dari Master Data yang belum disetujui.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Master Data Diverifikasi Admin Project</label>
          <select id="sf_masterdata_approved_admin" ${ro}>
            <option${val('masterdata_approved_admin')==='Belum'?' selected':''}>Belum</option>
            <option${val('masterdata_approved_admin')==='Diverifikasi'?' selected':''}>Diverifikasi</option>
          </select>
        </div>
        <div class="form-group"><label>Disetujui SPV Project</label>
          <select id="sf_masterdata_approved_spv" ${ro}>
            <option${val('masterdata_approved_spv')==='Belum'?' selected':''}>Belum</option>
            <option${val('masterdata_approved_spv')==='Disetujui'?' selected':''}>Disetujui</option>
          </select>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Klasifikasi Status Peserta (3 Kategori Wajib)</div>
      <div class="form-row">
        <div class="form-group"><label>Status COMPLETE (jumlah)</label><input type="number" id="sf_status_complete" value="${val('status_complete')}" ${ro}></div>
        <div class="form-group"><label>Status INCOMPLETE (jumlah)</label><input type="number" id="sf_status_incomplete" value="${val('status_incomplete')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Status MISSED TEST (jumlah)</label><input type="number" id="sf_status_missed" value="${val('status_missed')}" ${ro}></div>
      <div class="status-box status-warn" style="margin:10px 0;font-size:11.5px">
        ⚠️ INCOMPLETE wajib menampilkan placeholder: "Hasil sedang diproses — akan dikirimkan melalui Addendum Laporan..."
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Verifikasi Hasil Generate</div>
      <div class="form-row">
        <div class="form-group"><label>Jumlah Record Ter-generate</label><input type="number" id="sf_jumlah_record_generate" value="${val('jumlah_record_generate')}" ${ro}></div>
        <div class="form-group"><label>Jumlah Peserta di Master Data</label><input type="number" id="sf_jumlah_peserta_masterdata" value="${val('jumlah_peserta_masterdata')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Selisih (wajib 0)</label><input type="number" id="sf_selisih_record" value="${val('selisih_record')}" ${ro}></div>
        <div class="form-group"><label>Jumlah PDF Ter-generate</label><input type="number" id="sf_jumlah_pdf_generated" value="${val('jumlah_pdf_generated')}" ${ro}></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">D. Rekonsiliasi Data Operasional — 4 Kategori Deviasi</div>
      <div class="status-box status-err" style="margin-bottom:8px;font-size:11px">
        🚫 LARANGAN MUTLAK: tidak boleh lanjut ke QC jika masih ada deviasi Kategori 1 atau 2 yang belum terselesaikan.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Kategori 1 — Hadir, Tanpa Hasil (jumlah)</label><input type="number" id="sf_deviasi_kat1_count" value="${val('deviasi_kat1_count')}" ${ro}></div>
        <div class="form-group"><label>Kategori 2 — Hasil, Tanpa Kehadiran (jumlah)</label><input type="number" id="sf_deviasi_kat2_count" value="${val('deviasi_kat2_count')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Kategori 3 — Pemeriksaan Tanpa Rekam (jumlah)</label><input type="number" id="sf_deviasi_kat3_count" value="${val('deviasi_kat3_count')}" ${ro}></div>
        <div class="form-group"><label>Kategori 4 — Paket Tidak Sesuai (jumlah)</label><input type="number" id="sf_deviasi_kat4_count" value="${val('deviasi_kat4_count')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Rekonsiliasi Data Vendor</label>
        <select id="sf_rekonsiliasi_vendor_status" ${ro}>
          <option${val('rekonsiliasi_vendor_status')==='Belum'?' selected':''}>Belum</option>
          <option${val('rekonsiliasi_vendor_status')==='Sesuai — sampel terkirim = hasil diterima'?' selected':''}>Sesuai — sampel terkirim = hasil diterima</option>
        </select>
      </div>
      <div class="form-group"><label>Catatan Deviasi &amp; Rekonsiliasi</label><textarea id="sf_catatan_deviasi_rekon" rows="2" ${ro}>${val('catatan_deviasi_rekon')}</textarea></div>

      <div class="form-group"><label>Status Integrasi Data Source Keseluruhan</label>
        <select id="sf_data_source_integrated" ${ro}>
          <option${val('data_source_integrated')==='Belum'?' selected':''}>Belum</option>
          <option${val('data_source_integrated')==='Terintegrasi Lengkap'?' selected':''}>Terintegrasi Lengkap</option>
        </select>
      </div>
      <div class="form-group"><label>Catatan Konsolidasi</label><textarea id="sf_catatan_konsolidasi" rows="2" ${ro}>${val('catatan_konsolidasi')}</textarea></div>`,

    S18: ()=>`
      <div class="status-box status-info" style="margin-bottom:12px;font-size:11.5px">
        🔒 QC berlapis bersifat SEKUENSIAL — tidak ada lapisan yang boleh dilompati.
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">Layer 1: Administratif — 7 Item Wajib</div>
      ${[
        ['qc1_identitas','Kesesuaian identitas peserta master data'],
        ['qc1_barcode_tabung','Nomor barcode tabung sampel'],
        ['qc1_tipe_paket','Tipe paket pemeriksaan sesuai F-05'],
        ['qc1_cleansing_spelling','Pembersihan data entry (cleansing spelling)'],
        ['qc1_hasil_vendor','Hasil dari pihak ketiga (vendor/lab eksternal)'],
        ['qc1_kesesuaian_f05','Kesesuaian jumlah parameter dengan paket dipesan'],
        ['qc1_kelengkapan_lampiran','Kelengkapan lampiran pendukung'],
      ].map(([key,label],i)=>`
        <div class="form-group" style="margin-bottom:6px"><label>${i+1}. ${label}</label>
          <select id="sf_${key}" ${ro}>
            <option${val(key)==='OK'?' selected':''}>OK</option>
            <option${val(key)==='NOK'?' selected':''}>NOK</option>
          </select>
        </div>`).join('')}
      <div class="status-box status-warn" style="margin:10px 0;font-size:11.5px">
        PASSED → Semua 7 item lulus: lanjut ke QC Teknis. TIDAK LULUS → Return to source, perbaiki, catat di Log Kendala Produksi.
      </div>
      <div class="form-group"><label>Error List (jika ada)</label><textarea id="sf_error_list_l1" rows="2" ${ro}>${val('error_list_l1')}</textarea></div>
      <div class="form-group"><label>Status Resolved</label>
        <select id="sf_resolved_l1" ${ro}>
          <option${val('resolved_l1')==='Belum'?' selected':''}>Belum</option>
          <option${val('resolved_l1')==='Semua Resolved'?' selected':''}>Semua Resolved</option>
        </select>
      </div>
      <div class="form-group"><label>Sign-off QC Layer 1 (Admin Project)</label>
        <select id="sf_signoff_qc_l1" ${ro}>
          <option${val('signoff_qc_l1')==='Belum'?' selected':''}>Belum</option>
          <option${val('signoff_qc_l1')==='PASSED'?' selected':''}>PASSED</option>
        </select>
      </div>`,

    S19: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">Layer 2: Teknis &amp; Analis — 6 Item Wajib</div>
      ${[
        ['qc2_null_value','Tidak ada nilai kosong (null) tanpa keterangan'],
        ['qc2_delta_check','Uji delta check dengan instrumen'],
        ['qc2_critical_value_flag','Seluruh nilai kritis (Critical Value) ter-flag'],
        ['qc2_resampling_kesesuaian','Kesesuaian sampel re-run (jika ada deviasi)'],
        ['qc2_alat_validasi','Validasi teknis pembacaan alat laboratorium'],
        ['qc2_unit_satuan','Kesesuaian satuan & unit pengukuran'],
      ].map(([key,label],i)=>`
        <div class="form-group" style="margin-bottom:6px"><label>${i+1}. ${label}</label>
          <select id="sf_${key}" ${ro}>
            <option${val(key)==='OK'?' selected':''}>OK</option>
            <option${val(key)==='NOK'?' selected':''}>NOK</option>
          </select>
        </div>`).join('')}
      <div class="status-box status-warn" style="margin:10px 0;font-size:11.5px">
        PASSED → Semua 6 item lulus: lanjut ke QC Medis. TIDAK LULUS → Catat di Log Kendala Produksi, ulang verifikasi.
      </div>
      <div class="form-group"><label>Catatan Teknis</label><textarea id="sf_catatan_teknis" rows="2" ${ro}>${val('catatan_teknis')}</textarea></div>
      <div class="form-group"><label>Sign-off QC Layer 2 (Analis/Lab PIC)</label>
        <select id="sf_signoff_qc_l2" ${ro}>
          <option${val('signoff_qc_l2')==='Belum'?' selected':''}>Belum</option>
          <option${val('signoff_qc_l2')==='PASSED'?' selected':''}>PASSED</option>
        </select>
      </div>`,

    S20: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">Layer 3: Medis &amp; Review Dokter</div>
      <div class="form-group"><label>Korelasi Klinis Antar Parameter</label>
        <select id="sf_qc3_korelasi_klinis" ${ro}>
          <option${val('qc3_korelasi_klinis')==='Belum'?' selected':''}>Belum</option>
          <option${val('qc3_korelasi_klinis')==='Sudah dikorelasikan'?' selected':''}>Sudah dikorelasikan</option>
        </select>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">Kesimpulan Medis (Fit / Fit dengan Catatan / Unfit)</div>
      <div class="form-row">
        <div class="form-group"><label>Jumlah Fit</label><input type="number" id="sf_jumlah_kesimpulan_fit" value="${val('jumlah_kesimpulan_fit')}" ${ro}></div>
        <div class="form-group"><label>Jumlah Fit dengan Catatan (FWN)</label><input type="number" id="sf_jumlah_kesimpulan_fwn" value="${val('jumlah_kesimpulan_fwn')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Jumlah Unfit</label><input type="number" id="sf_jumlah_kesimpulan_unfit" value="${val('jumlah_kesimpulan_unfit')}" ${ro}></div>

      <div class="status-box status-err" style="margin:10px 0;font-size:11.5px">
        🚨 Protokol Critical Value — WAJIB sebelum laporan dikirim, notifikasi maks 1×24 jam sejak diketahui.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nilai Kritis Terkonfirmasi Klinis</label>
          <select id="sf_cv_terkonfirmasi_klinis" ${ro}>
            <option${val('cv_terkonfirmasi_klinis')==='Tidak ada CV'?' selected':''}>Tidak ada CV</option>
            <option${val('cv_terkonfirmasi_klinis')==='Terkonfirmasi'?' selected':''}>Terkonfirmasi</option>
          </select>
        </div>
        <div class="form-group"><label>Notifikasi ke PIC Klien</label>
          <select id="sf_cv_notifikasi_pic_klien" ${ro}>
            <option${val('cv_notifikasi_pic_klien')==='N/A'?' selected':''}>N/A</option>
            <option${val('cv_notifikasi_pic_klien')==='Sudah dinotifikasi'?' selected':''}>Sudah dinotifikasi</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Waktu Notifikasi CV</label><input type="datetime-local" id="sf_cv_waktu_notifikasi" value="${val('cv_waktu_notifikasi')}" ${ro}></div>
        <div class="form-group"><label>Critical Value Notification Log</label>
          <select id="sf_cv_log_tersedia" ${ro}>
            <option${val('cv_log_tersedia')==='Belum'?' selected':''}>Belum</option>
            <option${val('cv_log_tersedia')==='Terdokumentasi'?' selected':''}>Terdokumentasi</option>
          </select>
        </div>
      </div>

      <div class="form-group"><label>Catatan Medis &amp; Rekomendasi</label><textarea id="sf_catatan_medis" rows="2" ${ro} placeholder="Rekomendasi actionable, bukan 'konsultasikan ke dokter'">${val('catatan_medis')}</textarea></div>
      <div class="form-group"><label>Sign-off QC Layer 3 (Dokter PJ — Approval Digital)</label>
        <select id="sf_signoff_qc_l3" ${ro}>
          <option${val('signoff_qc_l3')==='Belum'?' selected':''}>Belum</option>
          <option${val('signoff_qc_l3')==='Approved'?' selected':''}>Approved</option>
        </select>
      </div>
      <div class="form-group"><label>Data Locked (setelah approval dokter)</label>
        <select id="sf_data_locked" ${ro}>
          <option${val('data_locked')==='Belum'?' selected':''}>Belum</option>
          <option${val('data_locked')==='Locked'?' selected':''}>Locked</option>
        </select>
      </div>`,

    S21: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">Layer 4: Produksi PDF &amp; Locking</div>
      ${[
        ['qc4_layout_visual','Verifikasi visual tata letak'],
        ['qc4_lampiran_ekg_rontgen','Keutuhan grafik/lampiran (EKG, Rontgen)'],
        ['qc4_enkripsi_password','Enkripsi password berkas PDF'],
        ['qc4_text_rendering','Eliminasi error text rendering'],
        ['qc4_narasi_dokter_lengkap','Kelengkapan narasi dokter (Kesimpulan & Rekomendasi tidak kosong)'],
      ].map(([key,label],i)=>`
        <div class="form-group" style="margin-bottom:6px"><label>${i+1}. ${label}</label>
          <select id="sf_${key}" ${ro}>
            <option${val(key)==='OK'?' selected':''}>OK</option>
            <option${val(key)==='NOK'?' selected':''}>NOK</option>
          </select>
        </div>`).join('')}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Produksi Dokumen Final</div>
      <div class="form-row">
        <div class="form-group"><label>Jumlah PDF Laporan Individu</label><input type="number" id="sf_pdf_individu_count" value="${val('pdf_individu_count')}" ${ro}></div>
        <div class="form-group"><label>Rekapitulasi Kolektif (Excel)</label>
          <select id="sf_rekap_kolektif_status" ${ro}>
            <option${val('rekap_kolektif_status')==='Belum'?' selected':''}>Belum</option>
            <option${val('rekap_kolektif_status')==='Selesai'?' selected':''}>Selesai</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Executive Summary (jika dipersyaratkan F-05)</label>
        <select id="sf_executive_summary_status" ${ro}>
          <option${val('executive_summary_status')==='Tidak dipersyaratkan'?' selected':''}>Tidak dipersyaratkan</option>
          <option${val('executive_summary_status')==='Selesai'?' selected':''}>Selesai</option>
        </select>
      </div>
      <div class="form-group"><label>Re-open Data Log (jika ada perubahan pasca-locking)</label><textarea id="sf_re_open_data_log" rows="2" ${ro}>${val('re_open_data_log')}</textarea></div>

      <div class="form-group"><label>PDF Ter-generate (jumlah = peserta active)</label>
        <select id="sf_pdf_generated" ${ro}>
          <option${val('pdf_generated')==='Belum'?' selected':''}>Belum</option>
          <option${val('pdf_generated')==='Sesuai'?' selected':''}>Sesuai</option>
        </select>
      </div>
      <div class="form-group"><label>Placeholder INCOMPLETE Tertera Benar</label>
        <select id="sf_placeholder_incomplete" ${ro}>
          <option${val('placeholder_incomplete')==='N/A'?' selected':''}>N/A</option>
          <option${val('placeholder_incomplete')==='Sesuai'?' selected':''}>Sesuai</option>
        </select>
      </div>
      <div class="form-group"><label>Sign-off QC Layer 4 (Admin Project — Finalize)</label>
        <select id="sf_signoff_qc_l4" ${ro}>
          <option${val('signoff_qc_l4')==='Belum'?' selected':''}>Belum</option>
          <option${val('signoff_qc_l4')==='Finalized'?' selected':''}>Finalized</option>
        </select>
      </div>
      <div class="form-group"><label>Admin Finalize</label>
        <select id="sf_admin_finalize" ${ro}>
          <option${val('admin_finalize')==='Belum'?' selected':''}>Belum</option>
          <option${val('admin_finalize')==='Done'?' selected':''}>Done</option>
        </select>
      </div>`,

    S22: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">Layer 5: Final Sign-Off SPV Project</div>
      <div class="form-group"><label>Cross-check Total Data Lulus QC vs Manifes BAST</label>
        <select id="sf_qc5_cross_check_bast" ${ro}>
          <option${val('qc5_cross_check_bast')==='Belum'?' selected':''}>Belum</option>
          <option${val('qc5_cross_check_bast')==='Cocok'?' selected':''}>Cocok</option>
          <option${val('qc5_cross_check_bast')==='Ada selisih'?' selected':''}>Ada selisih</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Persentase Sampling QC</label><input type="number" id="sf_sampling_pct" value="${val('sampling_pct')}" ${ro} placeholder="%"></div>
        <div class="form-group"><label>Hasil Sampling</label>
          <select id="sf_sampling_hasil" ${ro}>
            <option${val('sampling_hasil')==='Belum'?' selected':''}>Belum</option>
            <option${val('sampling_hasil')==='Clean — tidak ada temuan'?' selected':''}>Clean — tidak ada temuan</option>
            <option${val('sampling_hasil')==='Ada temuan — perlu perbaikan'?' selected':''}>Ada temuan — perlu perbaikan</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>SLA Penyerahan Hasil</label>
        <select id="sf_sla_status_s22" ${ro}>
          <option${val('sla_status_s22')==='On Track'?' selected':''}>On Track</option>
          <option${val('sla_status_s22')==='Terancam — perlu eskalasi'?' selected':''}>Terancam — perlu eskalasi</option>
        </select>
      </div>
      <div class="form-group"><label>Eskalasi Proaktif ke Klien &amp; Head of Operations (jika SLA terancam)</label>
        <select id="sf_sla_eskalasi_proaktif" ${ro}>
          <option${val('sla_eskalasi_proaktif')==='N/A'?' selected':''}>N/A</option>
          <option${val('sla_eskalasi_proaktif')==='Sudah dilakukan'?' selected':''}>Sudah dilakukan</option>
        </select>
      </div>
      <div class="form-group"><label>Otorisasi Rilis Data Final ke Server Pengiriman</label>
        <select id="sf_qc5_otorisasi_rilis" ${ro}>
          <option${val('qc5_otorisasi_rilis')==='Belum'?' selected':''}>Belum</option>
          <option${val('qc5_otorisasi_rilis')==='Dirilis'?' selected':''}>Dirilis</option>
        </select>
      </div>
      <div class="status-box status-ok" style="margin:10px 0;font-size:12px">
        🏆 Setelah REPORT CLEAN, tahapan S23 (Billing) dan S24 (Penyusunan Paket Laporan) terbuka paralel.
      </div>
      <div class="form-group"><label>Sign-off QC Layer 5 — Status Final</label>
        <select id="sf_signoff_qc_l5" ${ro}>
          <option${val('signoff_qc_l5')==='Belum'?' selected':''}>Belum</option>
          <option${val('signoff_qc_l5')==='REPORT CLEAN'?' selected':''}>REPORT CLEAN</option>
        </select>
      </div>
      <div class="form-group"><label>Report Clean (Final Confirmation)</label>
        <select id="sf_report_clean" ${ro}>
          <option${val('report_clean')==='Belum'?' selected':''}>Belum</option>
          <option${val('report_clean')==='Ya'?' selected':''}>Ya</option>
        </select>
      </div>`,

    S23: ()=>`
      <div class="status-box status-err" style="margin-bottom:12px;font-size:11.5px">
        🚫 No Data, No Bill — QC & draft billing TIDAK boleh dilanjutkan jika masih ada deviasi Kategori 1/2 belum selesai.
      </div>
      <div class="form-group"><label>Tanggal Rekonsiliasi (H+1)</label><input type="date" id="sf_tanggal_rekon_h1" value="${val('tanggal_rekon_h1')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. Rekap Status Peserta (Master Data)</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Kategori Status</th><th style="padding:4px">Jumlah</th><th style="padding:4px;text-align:left">Dapat Ditagihkan?</th></tr></thead>
        <tbody>
          ${[
            ['qty_complete','COMPLETE — semua parameter lengkap & valid','Ya'],
            ['qty_incomplete','INCOMPLETE — ada parameter belum keluar (tunggu vendor)','Ya'],
            ['qty_missed','MISSED TEST — hadir, ada parameter tidak dilakukan','Sebagian'],
            ['qty_cancelled','CANCELLED — tidak hadir sama sekali','Tidak (kecuali MG)'],
            ['qty_unreg_billing','UNREGISTERED diproses (add-on)','Ya'],
          ].map(([key,label,billable])=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${label}</td>
              <td style="padding:3px"><input type="number" id="sf_${key}" value="${val(key)}" ${ro} style="font-size:11px;padding:3px;width:80px"></td>
              <td style="padding:4px;color:var(--text3)">${billable}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Log Deviasi (4 Kategori)</div>
      ${!readOnly?dynTableWidget('tbl_s23_deviasi',[
        {key:'kategori_dev', label:'Kategori', type:'select', options:['1','2','3','4'], minWidth:'60px'},
        {key:'nama_peserta_dev', label:'Nama Peserta', minWidth:'110px'},
        {key:'deskripsi_dev', label:'Deskripsi Deviasi', minWidth:'140px'},
        {key:'tindakan_dev', label:'Tindakan Wajib', minWidth:'130px'},
        {key:'status_resolusi_dev', label:'Status', type:'select', options:['Resolved','Pending','Eskalasi'], minWidth:'90px'},
        {key:'dampak_billing_dev', label:'Dampak Billing', type:'select', options:['Tagih','HOLD','Tidak tagih'], minWidth:'90px'},
      ], data.tbl_s23_deviasi, 'Tambah Deviasi') : `<div style="font-size:12px;color:var(--text3)">${(data.tbl_s23_deviasi||[]).length} deviasi tercatat (read-only)</div>`}

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">D. Rekonsiliasi Data Vendor</div>
      <div class="form-row">
        <div class="form-group"><label>Total Sampel Dikirim ke Vendor</label><input type="number" id="sf_total_sampel_vendor_kirim" value="${val('total_sampel_vendor_kirim')}" ${ro}></div>
        <div class="form-group"><label>Total Hasil Diterima dari Vendor</label><input type="number" id="sf_total_hasil_vendor_terima" value="${val('total_hasil_vendor_terima')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Ketidaksesuaian Data Vendor?</label>
        <select id="sf_ketidaksesuaian_vendor_status" ${ro}>
          <option${val('ketidaksesuaian_vendor_status')==='Tidak ada'?' selected':''}>Tidak ada</option>
          <option${val('ketidaksesuaian_vendor_status')==='Ada — terdokumentasi'?' selected':''}>Ada — terdokumentasi</option>
        </select>
      </div>

      <div class="status-box status-ok" style="margin:14px 0 12px;font-size:12px">
        📋 Dasar tagihan awal (dari BAST S15): <strong>${formatCurrency(parseFloat(val('dasar_tagihan_awal')||project.dasar_tagihan_bast||0))}</strong>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">Penyesuaian Deviasi (F-019 → F-020)</div>
      <div class="form-row">
        <div class="form-group"><label>Deviasi Kategori 1 (Hadir–Tanpa Hasil)</label><input type="number" id="sf_deviasi_kat1" value="${val('deviasi_kat1')||0}" ${ro} oninput="calcBilling()"></div>
        <div class="form-group"><label>Deviasi Kategori 2 (Hasil–Tanpa Kehadiran)</label><input type="number" id="sf_deviasi_kat2" value="${val('deviasi_kat2')||0}" ${ro} oninput="calcBilling()"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Deviasi Kategori 3 (Pemeriksaan Tanpa Rekam)</label><input type="number" id="sf_deviasi_kat3" value="${val('deviasi_kat3')||0}" ${ro} oninput="calcBilling()"></div>
        <div class="form-group"><label>Deviasi Kategori 4 (Paket Tidak Sesuai)</label><input type="number" id="sf_deviasi_kat4" value="${val('deviasi_kat4')||0}" ${ro} oninput="calcBilling()"></div>
      </div>
      <div class="form-group">
        <label>Total Dapat Ditagih (auto)</label>
        <input type="number" id="sf_total_dapat_ditagih" value="${val('total_dapat_ditagih')||0}" disabled style="background:var(--bg2);font-weight:700">
        <div class="form-hint" id="billing-hint"></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Rincian Tagihan — 5 Komponen (F-020)</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Komponen</th><th style="padding:4px">Qty</th><th style="padding:4px">Harga Satuan</th><th style="padding:4px">Total</th></tr></thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:4px">1. Paket MCU Utama (per hadir/MG)</td>
            <td style="padding:3px"><input type="number" id="sf_komponen1_qty" value="${val('komponen1_qty')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="number" id="sf_komponen1_harga" value="${val('komponen1_harga')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="number" id="sf_komponen1_total" value="${val('komponen1_total')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td></tr>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:4px">2. Pemeriksaan Add-on</td>
            <td style="padding:3px"><input type="number" id="sf_komponen2_qty" value="${val('komponen2_qty')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="number" id="sf_komponen2_harga" value="${val('komponen2_harga')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="number" id="sf_komponen2_total" value="${val('komponen2_total')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td></tr>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:4px">3. Biaya Pengiriman Hasil</td>
            <td style="padding:3px"><input type="number" id="sf_komponen3_qty" value="${val('komponen3_qty')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="number" id="sf_komponen3_harga" value="${val('komponen3_harga')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            <td style="padding:3px"><input type="number" id="sf_komponen3_total" value="${val('komponen3_total')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td></tr>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:4px" colspan="3">4. PPN 11% × (Komponen 1+2+3)</td>
            <td style="padding:3px"><input type="number" id="sf_komponen4_total" value="${val('komponen4_total')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td></tr>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:4px" colspan="3">5. Diskon/Kredit (−, wajib approval tertulis)</td>
            <td style="padding:3px"><input type="number" id="sf_komponen5_diskon" value="${val('komponen5_diskon')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td></tr>
        </tbody>
      </table>
      <div class="form-group"><label>TOTAL TAGIHAN (1+2+3+4−5)</label><input type="number" id="sf_total_tagihan_final" value="${val('total_tagihan_final')}" ${ro} style="font-weight:700"></div>
      <div class="form-group"><label>Dasar Tagihan yang Digunakan</label>
        <select id="sf_dasar_tagihan_dipakai" ${ro}>
          <option${val('dasar_tagihan_dipakai')==='Realisasi Aktual'?' selected':''}>Realisasi Aktual — karena Aktual ≥ MG</option>
          <option${val('dasar_tagihan_dipakai')==='Minimum Guarantee'?' selected':''}>Minimum Guarantee — karena Aktual < MG</option>
        </select>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Checklist 9 Elemen Invoice Wajib (Finance)</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Elemen Invoice</th><th style="padding:4px">Status</th></tr></thead>
        <tbody>
          ${[
            'Nomor Invoice (sequential, tidak duplikasi)','Tanggal terbit & jatuh tempo (sesuai NET F-05)',
            'Identitas lengkap klien (NPWP, alamat, No. PO/LOI)','Identitas penerbit (NPWP, rekening bank)',
            'Rincian per komponen tagihan (1–5 terpisah)','Subtotal + PPN 11% + Total (kalkulasi benar)',
            'Kesesuaian nominal dengan Rekap Billing Final ini','Rekening tujuan pembayaran (jelas)',
            'Instruksi pembayaran (nomor invoice di keterangan transfer)',
          ].map((label,i)=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${i+1}. ${label}</td>
              <td style="padding:3px;text-align:center">
                <select id="sf_invoice_elemen${i+1}_status" ${ro} style="font-size:11px;padding:3px">
                  <option${val('invoice_elemen'+(i+1)+'_status')==='Terverifikasi'?' selected':''}>Terverifikasi</option>
                  <option${val('invoice_elemen'+(i+1)+'_status')==='Belum — tahan invoice'?' selected':''}>Belum — tahan invoice</option>
                </select>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div class="form-row">
        <div class="form-group"><label>Tanda Tangan Admin Project *</label><input type="text" id="sf_signed_admin_f020" value="${val('signed_admin_f020')||''}" ${ro}></div>
        <div class="form-group"><label>Tanda Tangan SPV Project *</label><input type="text" id="sf_signed_spv_f020" value="${val('signed_spv_f020')||project.pic_spv||''}" ${ro}></div>
      </div>
      <div class="form-group"><label>Tanda Tangan Finance *</label><input type="text" id="sf_signed_finance_f020" value="${val('signed_finance_f020')||''}" ${ro} placeholder="Tanda tangan ke-3 → membuka Invoice (S25)"></div>`,

    S24: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">Komponen Data Hasil yang Diserahkan</div>
      <div class="form-row">
        <div class="form-group"><label>Buku Laporan Individu — Hardcopy (jumlah)</label><input type="number" id="sf_jumlah_buku_individu" value="${val('jumlah_buku_individu')}" ${ro}></div>
        <div class="form-group"><label>Berkas Digital Terenkripsi (jumlah files)</label><input type="number" id="sf_jumlah_files_digital" value="${val('jumlah_files_digital')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Executive Summary (rangkap)</label><input type="number" id="sf_exec_summary_qty" value="${val('exec_summary_qty')}" ${ro}></div>
        <div class="form-group"><label>Lampiran Rontgen/EKG (pack)</label><input type="number" id="sf_lampiran_film_qty" value="${val('lampiran_film_qty')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Mode Penyerahan</label>
        <select id="sf_mode_penyerahan_s24" ${ro}>
          <option${val('mode_penyerahan_s24')==='Fisik (Hardcopy/USB) — SPV menyerahkan langsung & sign BA-PH'?' selected':''}>Fisik (Hardcopy/USB) — SPV menyerahkan langsung & sign BA-PH</option>
          <option${val('mode_penyerahan_s24')==='Digital (Email/Portal) — Sales/AM mengirimkan file'?' selected':''}>Digital (Email/Portal) — Sales/AM mengirimkan file</option>
        </select>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 4px">Alur Serah Terima</div>
      <div class="form-group"><label>Final Format Validation (SPV Project)</label>
        <select id="sf_final_format_validation" ${ro}>
          <option${val('final_format_validation')==='Belum'?' selected':''}>Belum</option>
          <option${val('final_format_validation')==='Tervalidasi'?' selected':''}>Tervalidasi</option>
        </select>
      </div>
      <div class="form-group"><label>Paket Laporan Lengkap (Individu, Kolektif, Exec. Summary, By-name List, copy F-020)</label>
        <select id="sf_paket_laporan" ${ro}>
          <option${val('paket_laporan')==='Belum'?' selected':''}>Belum</option>
          <option${val('paket_laporan')==='Lengkap'?' selected':''}>Lengkap</option>
        </select>
      </div>
      <div class="form-group"><label>Serah Terima ke Sales</label>
        <select id="sf_serah_terima_sales" ${ro}>
          <option${val('serah_terima_sales')==='Belum'?' selected':''}>Belum</option>
          <option${val('serah_terima_sales')==='Diterima Sales'?' selected':''}>Diterima Sales</option>
        </select>
      </div>
      <div class="form-group"><label>Kirim ke Klien</label>
        <select id="sf_kirim_ke_klien" ${ro}>
          <option${val('kirim_ke_klien')==='Belum'?' selected':''}>Belum</option>
          <option${val('kirim_ke_klien')==='Terkirim'?' selected':''}>Terkirim</option>
        </select>
      </div>
      <div class="status-box status-warn" style="margin:10px 0;font-size:11.5px">
        ⚠️ Konfirmasi penerimaan klien wajib diterima maks 1×24 jam setelah pengiriman.
      </div>
      <div class="form-group"><label>Client Receipt Confirmed At</label><input type="datetime-local" id="sf_client_receipt_confirmed_at" value="${val('client_receipt_confirmed_at')}" ${ro}></div>`,

    S25: ()=>`
      <div class="status-box status-info" style="margin-bottom:12px;font-size:11.5px">
        ℹ️ Deadline: Invoice diterbitkan & dikirim MAKSIMAL H+2 setelah Client Receipt Confirmation diterima.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nomor Invoice *</label><input type="text" id="sf_nomor_invoice" value="${val('nomor_invoice')}" ${ro}></div>
        <div class="form-group"><label>Tanggal Invoice</label><input type="date" id="sf_tanggal_invoice" value="${val('tanggal_invoice')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nilai Invoice (Rp) *</label><input type="number" id="sf_nilai_invoice" value="${val('nilai_invoice')}" ${ro}></div>
        <div class="form-group"><label>Deadline Bayar (NET Terms)</label><input type="date" id="sf_deadline_bayar" value="${val('deadline_bayar')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>NPWP Klien Valid &amp; Aktif</label>
          <select id="sf_npwp_klien_status" ${ro}>
            <option${val('npwp_klien_status')==='Belum diverifikasi'?' selected':''}>Belum diverifikasi</option>
            <option${val('npwp_klien_status')==='Valid & Aktif'?' selected':''}>Valid & Aktif</option>
          </select>
        </div>
        <div class="form-group"><label>Rekening Tujuan Pembayaran</label><input type="text" id="sf_rekening_tujuan_invoice" value="${val('rekening_tujuan_invoice')}" ${ro}></div>
      </div>
      <div class="form-group"><label>AR Register Sudah Diupdate</label>
        <select id="sf_ar_register_updated" ${ro}>
          <option${val('ar_register_updated')==='Belum'?' selected':''}>Belum</option>
          <option${val('ar_register_updated')==='Sudah'?' selected':''}>Sudah</option>
        </select>
      </div>`,

    S26: ()=>`
      <div class="status-box status-warn" style="margin-bottom:12px;font-size:11.5px">
        ⏰ Finance wajib update AR Register MINIMUM 2×/minggu (Senin &amp; Kamis). Reminder T-3 hari SEBELUM jatuh tempo.
      </div>
      <div class="form-group"><label>Status AR Terkini</label>
        <select id="sf_status_ar_terkini" ${ro}>
          <option${val('status_ar_terkini')==='Current'?' selected':''}>Current</option>
          <option${val('status_ar_terkini')==='Overdue Level 1 (1-7 hari)'?' selected':''}>Overdue Level 1 (1-7 hari)</option>
          <option${val('status_ar_terkini')==='Overdue Level 2 (8-14 hari)'?' selected':''}>Overdue Level 2 (8-14 hari)</option>
          <option${val('status_ar_terkini')==='Overdue Level 3 (15-30 hari)'?' selected':''}>Overdue Level 3 (15-30 hari)</option>
          <option${val('status_ar_terkini')==='Overdue Level 4 — KRITIS (>30 hari)'?' selected':''}>Overdue Level 4 — KRITIS (>30 hari)</option>
          <option${val('status_ar_terkini')==='Lunas'?' selected':''}>Lunas</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Hari Overdue (jika ada)</label><input type="number" id="sf_hari_overdue" value="${val('hari_overdue')}" ${ro}></div>
        <div class="form-group"><label>PIC Follow-up</label><input type="text" id="sf_pic_followup_ar" value="${val('pic_followup_ar')}" ${ro}></div>
      </div>
      <div class="status-box status-info" style="margin:10px 0;font-size:11px">
        Matriks eskalasi: Lv1 (1-7h)=Finance reminder formal · Lv2 (8-14h)=Finance+Sales hubungi langsung ·
        Lv3 (15-30h)=Surat Penagihan Formal + eskalasi Head Ops · Lv4 (>30h)=Head Ops+Direksi, Credit Hold Customer.
      </div>
      <div class="form-group"><label>Tindakan Terakhir</label><input type="text" id="sf_tindakan_terakhir_ar" value="${val('tindakan_terakhir_ar')}" ${ro}></div>
      <div class="form-group"><label>Tanggal Tindakan</label><input type="date" id="sf_tgl_tindakan_ar" value="${val('tgl_tindakan_ar')}" ${ro}></div>
      <div class="form-group"><label>Catatan Follow-up</label><textarea id="sf_follow_up_notes" rows="2" ${ro}>${val('follow_up_notes')}</textarea></div>`,

    S27: ()=>`
      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:4px 0">Verifikasi Pembayaran</div>
      <div class="form-row">
        <div class="form-group"><label>Bukti Transfer</label>
          <select id="sf_bukti_transfer" ${ro}>
            <option${val('bukti_transfer')==='Belum diterima'?' selected':''}>Belum diterima</option>
            <option${val('bukti_transfer')==='Diterima'?' selected':''}>Diterima</option>
          </select>
        </div>
        <div class="form-group"><label>Nominal Bayar (Rp)</label><input type="number" id="sf_nominal_bayar" value="${val('nominal_bayar')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Tanggal Bayar</label><input type="date" id="sf_tanggal_bayar" value="${val('tanggal_bayar')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Log Kontrol Bukti Potong PPh 23/21</div>
      <div class="form-row">
        <div class="form-group"><label>Jenis PPh</label>
          <select id="sf_jenis_pph" ${ro}>
            <option${val('jenis_pph')==='PPh 23 (Jasa)'?' selected':''}>PPh 23 (Jasa)</option>
            <option${val('jenis_pph')==='PPh 21'?' selected':''}>PPh 21</option>
            <option${val('jenis_pph')==='Tidak ada potongan'?' selected':''}>Tidak ada potongan</option>
          </select>
        </div>
        <div class="form-group"><label>Tarif (%)</label><input type="number" id="sf_tarif_pph" value="${val('tarif_pph')||2.0}" ${ro} step="0.1"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Potongan Pajak (Rp)</label><input type="number" id="sf_potongan_pajak_rp" value="${val('potongan_pajak_rp')}" ${ro}></div>
        <div class="form-group"><label>Nilai Cair Netto (Rp)</label><input type="number" id="sf_nilai_cair_netto" value="${val('nilai_cair_netto')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>No. Seri Bukti Potong</label><input type="text" id="sf_no_seri_bukti_potong" value="${val('no_seri_bukti_potong')}" ${ro}></div>
        <div class="form-group"><label>Tanggal Terima Bukti Potong</label><input type="date" id="sf_tgl_terima_bukti_potong" value="${val('tgl_terima_bukti_potong')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Status Bukti Potong PPh</label>
        <select id="sf_pph23_status" ${ro}>
          <option${val('pph23_status')==='PENDING'?' selected':''}>PENDING</option>
          <option${val('pph23_status')==='RECEIVED'?' selected':''}>RECEIVED</option>
          <option${val('pph23_status')==='Tidak applicable'?' selected':''}>Tidak applicable</option>
        </select>
      </div>
      <div class="form-group"><label>Status Invoice</label>
        <select id="sf_invoice_status_lunas" ${ro}>
          <option${val('invoice_status_lunas')==='Belum Lunas'?' selected':''}>Belum Lunas</option>
          <option${val('invoice_status_lunas')==='LUNAS'?' selected':''}>LUNAS</option>
        </select>
      </div>`,

    S28: ()=>`
      <div class="form-group"><label>Target Margin (%)</label><input type="number" id="sf_target_margin_pct" value="${val('target_margin_pct')}" ${ro}></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">A. Revenue / Pendapatan</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Komponen</th><th style="padding:4px">Rencana (F-03)</th><th style="padding:4px">Realisasi Aktual</th></tr></thead>
        <tbody>
          ${[
            ['rev_paket_utama','1. Pendapatan Paket Utama (BAST Qty Kehadiran)'],
            ['rev_addon','2. Pendapatan Paket Tambahan (Add-on Tervalidasi)'],
          ].map(([key,label])=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${label}</td>
              <td style="padding:3px"><input type="number" id="sf_${key}_plan" value="${val(key+'_plan')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
              <td style="padding:3px"><input type="number" id="sf_${key}_aktual" value="${val(key+'_aktual')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            </tr>`).join('')}
          <tr style="border-top:2px solid var(--border);font-weight:700">
            <td style="padding:4px">TOTAL PENDAPATAN PROYEK (A)</td>
            <td style="padding:3px"><input type="number" id="sf_total_revenue_plan" value="${val('total_revenue_plan')}" ${ro} style="font-size:11px;padding:3px;width:100%;font-weight:700"></td>
            <td style="padding:3px"><input type="number" id="sf_total_revenue_aktual" value="${val('total_revenue_aktual')}" ${ro} style="font-size:11px;padding:3px;width:100%;font-weight:700"></td>
          </tr>
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">B. COGS / Biaya Langsung Operasional</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Komponen</th><th style="padding:4px">Rencana (F-03)</th><th style="padding:4px">Realisasi Aktual</th></tr></thead>
        <tbody>
          ${[
            ['cogs_bmhp','1. Biaya BMHP & Logistik Reagen Medis'],
            ['cogs_fee_medis','2. Fee Jasa Medis Personel (Dokter, Perawat, Analis)'],
            ['cogs_transport','3. Biaya Transportasi, Akomodasi & Mobilisasi'],
            ['cogs_exception','4. Pengeluaran Tambahan Darurat (F-014 Exception)'],
          ].map(([key,label])=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${label}</td>
              <td style="padding:3px"><input type="number" id="sf_${key}_plan" value="${val(key+'_plan')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
              <td style="padding:3px"><input type="number" id="sf_${key}_aktual" value="${val(key+'_aktual')}" ${ro} style="font-size:11px;padding:3px;width:100%"></td>
            </tr>`).join('')}
          <tr style="border-top:2px solid var(--border);font-weight:700">
            <td style="padding:4px">TOTAL BIAYA LANGSUNG OPERASIONAL (B)</td>
            <td style="padding:3px"><input type="number" id="sf_total_cogs_plan" value="${val('total_cogs_plan')}" ${ro} style="font-size:11px;padding:3px;width:100%;font-weight:700"></td>
            <td style="padding:3px"><input type="number" id="sf_total_cogs_aktual" value="${val('total_cogs_aktual')}" ${ro} style="font-size:11px;padding:3px;width:100%;font-weight:700"></td>
          </tr>
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">C. Hasil Akhir Profitabilitas</div>
      <div class="form-row">
        <div class="form-group"><label>Gross Profit Nominal — Plan (Rp)</label><input type="number" id="sf_gross_profit_plan" value="${val('gross_profit_plan')}" ${ro}></div>
        <div class="form-group"><label>Gross Profit Nominal — Aktual (Rp)</label><input type="number" id="sf_gross_profit_aktual" value="${val('gross_profit_aktual')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>% Gross Margin — Plan</label><input type="number" id="sf_margin_pct_plan" value="${val('margin_pct_plan')}" ${ro}></div>
        <div class="form-group"><label>% Gross Margin — Aktual</label><input type="number" id="sf_margin_pct_aktual" value="${val('margin_pct_aktual')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Analisis Akar Masalah Deviasi (jika Aktual &lt; Target)</label><textarea id="sf_analisis_akar_masalah_deviasi" rows="3" ${ro}>${val('analisis_akar_masalah_deviasi')}</textarea></div>
      <div class="form-group"><label>Status Verifikasi Laporan</label>
        <select id="sf_laporan_verified_finance" ${ro}>
          <option${val('laporan_verified_finance')==='Belum'?' selected':''}>Belum</option>
          <option${val('laporan_verified_finance')==='Diverifikasi Finance'?' selected':''}>Diverifikasi Finance</option>
        </select>
      </div>`,

    S29: ()=>`
      <div class="status-box status-err" style="margin-bottom:12px;font-size:11.5px">
        🔐 Checklist 7 Kondisi Penutupan Finansial — SEMUA wajib Terpenuhi sebelum proyek dinyatakan Closed.
      </div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:var(--bg)"><th style="padding:4px;text-align:left">Kondisi Penutupan</th><th style="padding:4px">Status</th></tr></thead>
        <tbody>
          ${[
            'Invoice lunas 100% (tidak ada sisa tagihan)','PPh Pasal 23 Bukti Potong diterima (jika klien memotong)',
            'Tidak ada dispute billing yang outstanding','Rekap Billing Final diarsip (digital + hardcopy)',
            'Laporan Realisasi RAB sudah diterima & diverifikasi Finance','Sisa kas gantung dikembalikan ke Finance',
            'Financial Closing Notice dikirim ke klien & dikonfirmasi',
          ].map((label,i)=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px">${i+1}. ${label}</td>
              <td style="padding:3px;text-align:center">
                <select id="sf_closing_kondisi${i+1}_status" ${ro} style="font-size:11px;padding:3px">
                  <option${val('closing_kondisi'+(i+1)+'_status')==='Belum'?' selected':''}>Belum</option>
                  <option${val('closing_kondisi'+(i+1)+'_status')==='Terpenuhi'?' selected':''}>Terpenuhi</option>
                </select>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Financial Closing Notice (Surat ke Klien)</div>
      <div class="form-row">
        <div class="form-group"><label>No. Surat</label><input type="text" id="sf_no_surat_closing" value="${val('no_surat_closing')}" ${ro}></div>
        <div class="form-group"><label>Nilai Tagihan Total Aktual (Net)</label><input type="number" id="sf_nilai_tagihan_final_closing" value="${val('nilai_tagihan_final_closing')}" ${ro}></div>
      </div>
      <div class="form-group"><label>Tanggal Efektif Dana Masuk (Pelunasan)</label><input type="date" id="sf_tgl_efektif_dana_masuk" value="${val('tgl_efektif_dana_masuk')}" ${ro}></div>
      <div class="form-group"><label>Status Financial Closing Notice</label>
        <select id="sf_financial_closing_notice" ${ro}>
          <option${val('financial_closing_notice')==='Belum dikirim'?' selected':''}>Belum dikirim</option>
          <option${val('financial_closing_notice')==='Terkirim — LUNAS/SELESAI SECARA FINANSIAL'?' selected':''}>Terkirim — LUNAS/SELESAI SECARA FINANSIAL</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tanda Tangan Finance</label><input type="text" id="sf_signed_finance_closing" value="${val('signed_finance_closing')}" ${ro}></div>
        <div class="form-group"><label>Tanda Tangan Head of Operations</label><input type="text" id="sf_signed_head_ops" value="${val('signed_head_ops')}" ${ro}></div>
      </div>`,

    S30: ()=>`
      <div class="status-box status-info" style="margin-bottom:12px;font-size:11.5px">
        ℹ️ Diserahkan ke Head of Operations MAKSIMAL H+7 setelah proyek ditutup.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tanggal Rapat Evaluasi (maks H+7)</label><input type="date" id="sf_tanggal_evaluasi" value="${val('tanggal_evaluasi')}" ${ro}></div>
        <div class="form-group"><label>Peserta Rapat Evaluasi</label><input type="text" id="sf_peserta_evaluasi" value="${val('peserta_evaluasi')}" ${ro} placeholder="Sales, Admin Project, IT Ops, Analis/Lab PIC"></div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">7 Aspek Evaluasi Proyek</div>
      <div class="form-row">
        <div class="form-group"><label>1. TAT Aktual vs SLA F-05 (Hari Kerja)</label><input type="number" id="sf_tat_aktual_evaluasi" value="${val('tat_aktual_evaluasi')}" ${ro}></div>
        <div class="form-group"><label>2. Kualitas Data — Jumlah Deviasi</label><input type="number" id="sf_kualitas_data_deviasi_count" value="${val('kualitas_data_deviasi_count')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>3. Kinerja QC — Jumlah Return per Layer</label><input type="number" id="sf_qc_return_count" value="${val('qc_return_count')}" ${ro}></div>
        <div class="form-group"><label>4. Revenue Loss (Rp) — Tidak Dapat Direcovery</label><input type="number" id="sf_revenue_loss_rp" value="${val('revenue_loss_rp')}" ${ro}></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>5. Revenue Delay (Hari)</label><input type="number" id="sf_revenue_delay_hari" value="${val('revenue_delay_hari')}" ${ro}></div>
        <div class="form-group"><label>6. Over-Service (Rp) — Tanpa Persetujuan</label><input type="number" id="sf_over_service_rp" value="${val('over_service_rp')}" ${ro}></div>
      </div>
      <div class="form-group"><label>7. Kepuasan Operasional Internal (Skala 1-5)</label><input type="number" id="sf_kepuasan_internal_skala" value="${val('kepuasan_internal_skala')}" ${ro} min="1" max="5"></div>

      <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;margin:14px 0 6px">Rekomendasi Tindak Lanjut</div>
      <div class="form-group"><label>Item Perlu Diperbaiki</label><textarea id="sf_item_perlu_diperbaiki" rows="2" ${ro}>${val('item_perlu_diperbaiki')}</textarea></div>
      <div class="form-group"><label>Rekomendasi Tindakan</label><textarea id="sf_rekomendasi_tindakan" rows="2" ${ro}>${val('rekomendasi_tindakan')}</textarea></div>
      <div class="form-group"><label>PIC &amp; Target Selesai</label><input type="text" id="sf_pic_target_selesai" value="${val('pic_target_selesai')}" ${ro}></div>

      <div class="form-group"><label>Temuan Evaluasi (Ringkasan)</label><textarea id="sf_temuan_evaluasi" rows="2" ${ro}>${val('temuan_evaluasi')}</textarea></div>
      <div class="form-group"><label>F-EVAL-01 Terdokumentasi</label>
        <select id="sf_cap_terdokumentasi" ${ro}>
          <option${val('cap_terdokumentasi')==='Belum'?' selected':''}>Belum</option>
          <option${val('cap_terdokumentasi')==='Terdokumentasi'?' selected':''}>Terdokumentasi</option>
        </select>
      </div>
      <div class="form-group"><label>Sign-off Evaluasi (3 pihak)</label>
        <select id="sf_signoff_evaluasi" ${ro}>
          <option${val('signoff_evaluasi')==='Belum'?' selected':''}>Belum</option>
          <option${val('signoff_evaluasi')==='Lengkap'?' selected':''}>Lengkap</option>
        </select>
      </div>`,

    S31: ()=>`
      <div class="status-box status-info" style="margin-bottom:12px;font-size:11.5px">
        ℹ️ Sales kirim kuesioner maks H+3 setelah laporan diterima klien. Deadline response H+14.
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tanggal Survey Dikirim</label><input type="date" id="sf_tanggal_survey" value="${val('tanggal_survey')}" ${ro}></div>
        <div class="form-group"><label>NPS Score (0-10)</label><input type="number" id="sf_nps_score" value="${val('nps_score')}" ${ro} min="0" max="10"></div>
      </div>
      <div class="form-group"><label>Feedback / Komentar Klien</label><textarea id="sf_feedback_klien" rows="3" ${ro}>${val('feedback_klien')}</textarea></div>
      <div class="form-group"><label>Status Response</label>
        <select id="sf_response_received" ${ro}>
          <option${val('response_received')==='Belum merespons'?' selected':''}>Belum merespons</option>
          <option${val('response_received')==='Sudah merespons'?' selected':''}>Sudah merespons</option>
          <option${val('response_received')==='Deadline lewat — tidak merespons'?' selected':''}>Deadline lewat — tidak merespons</option>
        </select>
      </div>`,
  };


  // Default form untuk stage lain
  const defaultForm = ()=>`
    ${stage.fields.map(f=>{
      const label = f.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const v = val(f);
      const isArea = ['catatan','notes','temuan','hasil','list','cap','feedback','lessons'].some(k=>f.includes(k));
      const isDate = f.includes('tanggal')||f.includes('date');
      const isNum  = f.includes('total')||f.includes('jumlah')||f.includes('qty')||f.includes('nilai');
      const type   = isDate?'date':isNum?'number':'text';
      if (isArea) return `<div class="form-group" style="grid-column:1/-1"><label>${label}</label><textarea id="sf_${f}" rows="2" ${ro}>${v}</textarea></div>`;
      if (f.includes('signed')||f.includes('status')||f.includes('hasil_go_nogo')) {
        return `<div class="form-group"><label>${label}</label>
          <select id="sf_${f}" ${ro}>
            ${f.includes('signed')||f.includes('konfirmasi')?
              ['Belum','Sudah / Ya'].map(s=>`<option${v===s?' selected':''}>${s}</option>`).join(''):
              ['Pending','Yes','No','GO','NO-GO','Done'].map(s=>`<option${v===s?' selected':''}>${s}</option>`).join('')
            }
          </select></div>`;
      }
      return `<div class="form-group"><label>${label}</label><input type="${type}" id="sf_${f}" value="${v}" ${ro} placeholder="${label}..."></div>`;
    }).join('')}`;

  const render = forms[stage.id] || defaultForm;
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px">${render()}</div>`;
}

// Kalkulasi BAST otomatis
function calcBAST() {
  const hadir  = parseInt(document.getElementById('sf_total_hadir_bast')?.value||0);
  const terd   = parseInt(document.getElementById('sf_total_terdaftar')?.value||0);
  const unreg  = parseInt(document.getElementById('sf_total_unregistered')?.value||0);
  const tdkHd  = Math.max(0, terd - hadir);
  const mg     = parseInt(document.getElementById('sf_rab_minimum_guarantee')?.value||0) ||
                 parseInt(document.querySelector('#sf_minimum_guarantee')?.value||0);
  const dasar  = Math.max(hadir + unreg, mg || 0);
  const tdkHdEl = document.getElementById('sf_total_tidak_hadir');
  const dasarEl = document.getElementById('sf_dasar_tagihan_awal');
  if (tdkHdEl) tdkHdEl.value = tdkHd;
  if (dasarEl)  dasarEl.value = dasar;
}

// Kalkulasi Billing S23 otomatis
function calcBilling() {
  const dasar = parseInt(document.getElementById('sf_dasar_tagihan_awal')?.value||0);
  const k1 = parseInt(document.getElementById('sf_deviasi_kat1')?.value||0);
  const k2 = parseInt(document.getElementById('sf_deviasi_kat2')?.value||0);
  const k3 = parseInt(document.getElementById('sf_deviasi_kat3')?.value||0);
  const k4 = parseInt(document.getElementById('sf_deviasi_kat4')?.value||0);
  const total = Math.max(0, dasar - k1 - k2 - k3 - k4);
  const el = document.getElementById('sf_total_dapat_ditagih');
  const hint = document.getElementById('billing-hint');
  if (el) el.value = total;
  if (hint) hint.textContent = `${dasar} - ${k1}(K1) - ${k2}(K2) - ${k3}(K3) - ${k4}(K4) = ${total} peserta dapat ditagih`;
}

// ── SAVE STEP FORM ─────────────────────────────────────────────
async function saveStepForm(projectId, stageId) {
  const stage = MCU_STAGES[stageId]; if (!stage) return;
  const user = getUserName?getUserName():'User';

  // Collect all form data
  const formData = {};
  stage.fields.forEach(f=>{
    const el = document.getElementById(`sf_${f}`);
    if (el) formData[f] = el.value;
  });

  // Collect any dynamic tables used in this stage's form (Mapping Parameter, Penugasan SDM, dll)
  Object.keys(mcuDynTables).forEach(key => {
    formData[key] = dynTableCollect(key);
  });

  // Extra meta fields
  const extraFields = ['f05_locked','credit_hold_status','signed_by_sales','signed_by_spv',
    'harga_per_peserta','minimum_guarantee','sla_hasil_kontraktual','skema_pembayaran',
    'total_terdaftar','total_hadir_bast','total_unregistered','total_tidak_hadir','dasar_tagihan_awal','signed_by_klien',
    'deviasi_kat1','deviasi_kat2','deviasi_kat3','deviasi_kat4','total_dapat_ditagih',
    'signed_admin_f020','signed_spv_f020','signed_finance_f020','approval_head_ops'];
  extraFields.forEach(f=>{ const el=document.getElementById(`sf_${f}`); if(el) formData[f]=el.value; });

  const status    = document.getElementById('sf-status')?.value||'In Progress';
  const done_by   = document.getElementById('sf-done-by')?.value||user;
  const done_date = document.getElementById('sf-done-date')?.value||null;

  // Project-level updates based on stage
  const projUpdate = { updated_at: new Date().toISOString() };

  if (stageId === 'S01') {
    if (formData.credit_hold_status) projUpdate.credit_hold_status = formData.credit_hold_status;
    if (formData.target_peserta)     projUpdate.target_participants = parseInt(formData.target_peserta)||null;
    if (formData.preferensi_tanggal_1) projUpdate.tanggal_pelaksanaan = formData.preferensi_tanggal_1;
    if (formData.lokasi_pelaksanaan) projUpdate.lokasi_pelaksanaan = formData.lokasi_pelaksanaan;
  }
  if (stageId === 'S04') {
    if (formData.harga_per_peserta) projUpdate.harga_per_peserta = parseFloat(formData.harga_per_peserta)||0;
    if (formData.minimum_guarantee) projUpdate.minimum_guarantee = parseInt(formData.minimum_guarantee)||0;
    if (formData.sla_hasil_kontraktual) projUpdate.sla_hasil_kontraktual = formData.sla_hasil_kontraktual;
    if (formData.skema_pembayaran)  projUpdate.skema_pembayaran = formData.skema_pembayaran;
    if (formData.f05_locked === 'true' && formData.signed_by_sales && formData.signed_by_spv) {
      projUpdate.f05_locked = true;
      projUpdate.f05_signed_at = new Date().toISOString();
      toast('🔒 F-05 dikunci! Data order tidak bisa diubah lagi.','warn',4000);
    }
  }
  if (stageId === 'S06') {
    projUpdate.f06_signed_at = new Date().toISOString();
  }
  if (stageId === 'S15') {
    if (formData.dasar_tagihan_awal) projUpdate.dasar_tagihan_bast = parseInt(formData.dasar_tagihan_awal)||0;
    if (formData.signed_by_klien)    projUpdate.bast_signed_at = new Date().toISOString();
  }
  if (stageId === 'S23') {
    const allResolved = ['deviasi_kat1','deviasi_kat2','deviasi_kat3'].every(k=>!parseInt(formData[k]||0));
    projUpdate.all_deviasi_resolved = allResolved;
    projUpdate.f020_signed_3 = !!(formData.signed_admin_f020 && formData.signed_spv_f020 && formData.signed_finance_f020);
    if (formData.total_dapat_ditagih) projUpdate.rekap_billing_final = parseFloat(formData.total_dapat_ditagih)||0;
  }
  if (stageId === 'S24') {
    if (formData.client_receipt_confirmed_at||status==='Done') {
      projUpdate.client_receipt_confirmed_at = formData.client_receipt_confirmed_at || new Date().toISOString();
    }
  }
  if (stageId === 'S27') {
    projUpdate.status_financial = 'PAID';
  }

  try {
    // Save step record
    const existing = await sbGet('project_steps',`select=id&project_id=eq.${projectId}&step_id=eq.${stageId}`).catch(()=>[]);
    const stepNo   = stage.no;
    const payload  = {
      project_id: projectId, step_id: stageId, step_number: stepNo,
      step_name: stage.name, phase_id: stage.phase,
      status, done_by, done_date: done_date||null,
      form_data: JSON.stringify(formData),
      updated_at: new Date().toISOString(),
    };
    if (existing[0]?.id) await sbPatch('project_steps', existing[0].id, payload);
    else await sbPost('project_steps', {...payload, created_at: new Date().toISOString()});

    // Update project
    if (Object.keys(projUpdate).length > 1) await sbPatch('projects', projectId, projUpdate);

    toast(`✅ ${stage.id} disimpan`,'ok');
    closeModalForce();
    mcuProjects = [];
    await loadMCUProjects();
    setTimeout(()=>openMCUDetail(projectId), 300);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── MARK DONE & ADVANCE ────────────────────────────────────────
async function markStageDone(projectId, stageId) {
  const stage    = MCU_STAGES[stageId]; if (!stage) return;
  const [dArr, stepsArr] = await Promise.all([
    sbGet('projects',`select=*&id=eq.${projectId}`),
    sbGet('project_steps',`select=*&project_id=eq.${projectId}`).catch(()=>[]),
  ]);
  const p = dArr[0]||{};

  // Final gate check
  const unmet = checkGate(stage, p, stepsArr||[]);
  if (unmet.length) {
    toast('⛔ ' + unmet[0],'err',5000);
    return;
  }

  // Save as Done first
  document.getElementById('sf-status').value = 'Done';
  await saveStepForm(projectId, stageId);

  // Advance current_step
  const nextNo = Math.min(stage.no + 1, 31);
  await sbPatch('projects', projectId, {
    current_step: nextNo,
    status: stage.no >= 31 ? 'Completed' : 'Active',
    updated_at: new Date().toISOString(),
  });

  toast(`✅ ${stageId} selesai → Lanjut ke S${String(nextNo).padStart(2,'0')}`,'ok',3000);
}

async function advanceMCUStep(projectId) {
  const d = await sbGet('projects',`select=current_step&id=eq.${projectId}`);
  const curNo = d[0]?.current_step||1;
  const curId = `S${String(curNo).padStart(2,'0')}`;
  openStepForm(projectId, curId);
}
