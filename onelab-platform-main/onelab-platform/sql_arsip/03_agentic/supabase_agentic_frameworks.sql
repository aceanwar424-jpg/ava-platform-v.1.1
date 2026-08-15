-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC — SEED FRAMEWORK KEPATUHAN TAMBAHAN
-- Melengkapi checklist yang semula HANYA ISO 15189:2022 dengan:
--   • AKREDITASI_KLINIK  — Standar Akreditasi Klinik (fokus Klinik Utama
--                          dengan pelayanan laboratorium): Bab TKK · PMKP · PPK
--   • ISO9001:2015       — Sistem Manajemen Mutu
-- Ketiganya hidup berdampingan (kolom `framework`); gap analysis & compliance
-- score sudah per-framework. ISO 15189 tetap dari supabase_agentic_fase12.sql.
-- ----------------------------------------------------------------------
-- CATATAN AKREDITASI: kode Elemen Penilaian (EP) resmi mengikuti Standar
-- Akreditasi Klinik (Kepdirjen Yankes terbaru). clause_ref di sini memakai
-- pengelompokan standar (TKK/PMKP/PPK + topik) agar dokumen wajib terpetakan;
-- SESUAIKAN clause_ref ke nomor EP resmi bila dibutuhkan untuk berkas survei.
-- IDEMPOTEN — aman dijalankan ulang.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. AKREDITASI KLINIK — Bab I Tata Kelola Klinik (TKK)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.compliance_checklist
  (framework, clause_ref, requirement, required_doc_level, required_doc_type, department, is_mandatory)
VALUES
('AKREDITASI_KLINIK','TKK — Legalitas & Perizinan','Bukti badan hukum, izin operasional klinik, dan sertifikat standar yang masih berlaku',1,'SK','UMUM',true),
('AKREDITASI_KLINIK','TKK — Visi Misi & Struktur','Visi, misi, tujuan, dan struktur organisasi klinik ditetapkan dan disahkan penanggung jawab',1,'SK','MUTU',true),
('AKREDITASI_KLINIK','TKK — Penanggung Jawab Klinik','Penetapan penanggung jawab klinik beserta uraian tugas, wewenang, dan tanggung jawab',1,'SK','MUTU',true),
('AKREDITASI_KLINIK','TKK — Tata Kelola SDM','Pola ketenagaan, pemenuhan SDM, dan kebijakan pengelolaan sumber daya manusia',1,'PEDOMAN','HRD',true),
('AKREDITASI_KLINIK','TKK — Kredensial STR/SIP','Kredensial tenaga kesehatan: verifikasi STR/SIP, kewenangan klinis, uraian tugas, dan rekamnya',2,'SOP','HRD',true),
('AKREDITASI_KLINIK','TKK — Orientasi & Diklat','Program orientasi pegawai baru serta pendidikan & pelatihan berkelanjutan',2,'PROGRAM','HRD',true),
('AKREDITASI_KLINIK','TKK — MFK Keselamatan & Bencana','Manajemen fasilitas & keselamatan: keselamatan gedung, tanggap darurat/bencana, dan pengamanan kebakaran',2,'SOP','UMUM',true),
('AKREDITASI_KLINIK','TKK — MFK Bahan Berbahaya (B3)','Pengelolaan bahan & limbah berbahaya beracun (B3): penyimpanan, pelabelan, MSDS, dan pembuangan',2,'SOP','UMUM',true),
('AKREDITASI_KLINIK','TKK — MFK Alat Kesehatan','Pengelolaan alat kesehatan: inventaris, pemeliharaan, kalibrasi, dan penarikan alat rusak',2,'SOP','LAB',true),
('AKREDITASI_KLINIK','TKK — PPI Kewaspadaan Standar','Program pencegahan & pengendalian infeksi: kewaspadaan standar, kebersihan tangan, dan APD',2,'PROGRAM','MUTU',true),
('AKREDITASI_KLINIK','TKK — PPI Dekontaminasi & Limbah','PPI: dekontaminasi alat, pengelolaan linen, dan pembuangan limbah medis',2,'SOP','MUTU',true),

-- ══════════════════════════════════════════════════════════════════════
-- §B. AKREDITASI KLINIK — Bab II Peningkatan Mutu & Keselamatan Pasien (PMKP)
-- ══════════════════════════════════════════════════════════════════════
('AKREDITASI_KLINIK','PMKP — Indikator Mutu','Penetapan, pengukuran, analisis, dan pelaporan indikator mutu klinik (termasuk INM)',2,'SOP','MUTU',true),
('AKREDITASI_KLINIK','PMKP — Manajemen Risiko','Program manajemen risiko klinis & non-klinis: register risiko dan penilaian (FMEA/risk grading)',2,'PROGRAM','MUTU',true),
('AKREDITASI_KLINIK','PMKP — Insiden Keselamatan Pasien','Pelaporan & investigasi Insiden Keselamatan Pasien (IKP): pencatatan, grading, RCA, dan tindak lanjut',2,'SOP','MUTU',true),
('AKREDITASI_KLINIK','PMKP — SKP1 Identifikasi Pasien','Sasaran Keselamatan Pasien 1: ketepatan identifikasi pasien',2,'SOP','FO',true),
('AKREDITASI_KLINIK','PMKP — SKP2 Komunikasi Efektif','SKP 2: peningkatan komunikasi efektif (mis. SBAR, read-back, nilai kritis)',2,'SOP','MUTU',true),
('AKREDITASI_KLINIK','PMKP — SKP3 Keamanan Obat','SKP 3: peningkatan keamanan obat yang perlu diwaspadai (high-alert)',2,'SOP','FARMASI',true),
('AKREDITASI_KLINIK','PMKP — SKP4 Tepat Prosedur','SKP 4: kepastian tepat lokasi, tepat prosedur, tepat pasien tindakan/operasi',2,'SOP','MUTU',true),
('AKREDITASI_KLINIK','PMKP — SKP5 Risiko Infeksi','SKP 5: pengurangan risiko infeksi terkait pelayanan kesehatan (kebersihan tangan)',2,'SOP','MUTU',true),
('AKREDITASI_KLINIK','PMKP — SKP6 Risiko Jatuh','SKP 6: pengurangan risiko cedera pasien akibat jatuh',2,'SOP','MUTU',true),

-- ══════════════════════════════════════════════════════════════════════
-- §C. AKREDITASI KLINIK — Bab III Penyelenggaraan Pelayanan Klinik (PPK)
--     (termasuk PELAYANAN LABORATORIUM — fokus utama)
-- ══════════════════════════════════════════════════════════════════════
('AKREDITASI_KLINIK','PPK — Hak & Kewajiban Pasien','Kebijakan hak dan kewajiban pasien serta pemberian informasi & persetujuan (informed consent)',1,'SK','FO',true),
('AKREDITASI_KLINIK','PPK — Pendaftaran','Prosedur pendaftaran, skrining, dan pemberian informasi pelayanan',2,'SOP','FO',true),
('AKREDITASI_KLINIK','PPK — Pengkajian Pasien','Pengkajian awal pasien (asesmen) oleh tenaga kompeten dan pencatatannya',2,'SOP','MUTU',true),
('AKREDITASI_KLINIK','PPK — Rencana & Pelayanan Klinis','Penyusunan rencana asuhan dan pelaksanaan pelayanan klinis sesuai standar',2,'SOP','MUTU',true),
('AKREDITASI_KLINIK','PPK — Rujukan','Prosedur rujukan pasien: kriteria, komunikasi, dan transfer informasi klinis',2,'SOP','FO',true),
('AKREDITASI_KLINIK','PPK — Rekam Medis','Pengelolaan rekam medis: kelengkapan, kerahasiaan, akses, retensi, dan pemusnahan',2,'SOP','MUTU',true),
-- ── Pelayanan Laboratorium (fokus) ──
('AKREDITASI_KLINIK','PPK-LAB — Jenis & PJ Layanan','Penetapan jenis pelayanan laboratorium dan penanggung jawab lab yang kompeten',1,'SK','LAB',true),
('AKREDITASI_KLINIK','PPK-LAB — Pra-analitik','Prosedur pra-analitik: permintaan, persiapan pasien, pengambilan, pelabelan, transport, penerimaan spesimen',2,'SOP','LAB',true),
('AKREDITASI_KLINIK','PPK-LAB — Analitik & IK Alat','Prosedur analitik & instruksi kerja alat/metode pemeriksaan yang mutakhir',3,'IK','LAB',true),
('AKREDITASI_KLINIK','PPK-LAB — Pemantapan Mutu Internal','Pemantapan Mutu Internal (PMI/QC): aturan kontrol, frekuensi, dan tindakan out-of-control',2,'SOP','LAB',true),
('AKREDITASI_KLINIK','PPK-LAB — Pemantapan Mutu Eksternal','Pemantapan Mutu Eksternal (PME/EQA): keikutsertaan, evaluasi, dan tindak lanjut',2,'SOP','LAB',true),
('AKREDITASI_KLINIK','PPK-LAB — Nilai Kritis','Pelaporan nilai kritis hasil laboratorium: daftar, alur eskalasi, dan pencatatan',2,'SOP','LAB',true),
('AKREDITASI_KLINIK','PPK-LAB — Pelaporan Hasil','Prosedur pelaporan & pelepasan hasil, termasuk amandemen hasil yang sudah dirilis',2,'SOP','LAB',true),
('AKREDITASI_KLINIK','PPK-LAB — Reagensia','Pengelolaan reagensia esensial: penerimaan, penyimpanan, uji akseptabilitas, dan penelusuran lot',2,'SOP','LAB',true),
('AKREDITASI_KLINIK','PPK-LAB — K3 Laboratorium','Keselamatan & kesehatan kerja laboratorium: APD, penanganan tumpahan, dan pajanan',2,'SOP','LAB',true),
('AKREDITASI_KLINIK','PPK — Pelayanan Farmasi','Pelayanan farmasi: pengelolaan sediaan farmasi, penyimpanan, dan penggunaan obat yang aman',2,'SOP','FARMASI',true),

-- ══════════════════════════════════════════════════════════════════════
-- §D. ISO 9001:2015 — Sistem Manajemen Mutu
-- ══════════════════════════════════════════════════════════════════════
('ISO9001:2015','4.3','Penetapan ruang lingkup sistem manajemen mutu terdokumentasi',1,'PEDOMAN','MUTU',true),
('ISO9001:2015','4.4','Sistem manajemen mutu dan proses-prosesnya (peta proses & interaksinya)',1,'PEDOMAN','MUTU',true),
('ISO9001:2015','5.2','Kebijakan mutu ditetapkan, dikomunikasikan, dan dipelihara sebagai informasi terdokumentasi',1,'PEDOMAN','MUTU',true),
('ISO9001:2015','6.1','Tindakan menangani risiko dan peluang',2,'SOP','MUTU',true),
('ISO9001:2015','6.2','Sasaran mutu pada fungsi/tingkat terkait dan rencana pencapaiannya',1,'PEDOMAN','MUTU',true),
('ISO9001:2015','7.1.5','Sumber daya pemantauan & pengukuran: ketertelusuran pengukuran (kalibrasi alat ukur)',2,'SOP','LAB',true),
('ISO9001:2015','7.2','Kompetensi personel: penetapan, pemenuhan, dan rekam bukti kompetensi',2,'SOP','HRD',true),
('ISO9001:2015','7.5','Informasi terdokumentasi: pengendalian dokumen & rekaman (pembuatan, revisi, distribusi, retensi)',2,'SOP','MUTU',true),
('ISO9001:2015','8.1','Perencanaan & pengendalian operasional pelayanan',2,'SOP','MUTU',true),
('ISO9001:2015','8.2','Persyaratan produk & jasa: komunikasi pelanggan dan tinjauan persyaratan',2,'SOP','FO',true),
('ISO9001:2015','8.4','Pengendalian proses, produk, dan jasa yang disediakan pihak eksternal (pemasok & lab rujukan)',2,'SOP','UMUM',true),
('ISO9001:2015','8.5','Pengendalian penyediaan jasa: kondisi terkendali, identifikasi & mampu telusur',2,'SOP','LAB',true),
('ISO9001:2015','8.7','Pengendalian output tidak sesuai (nonconforming): identifikasi, pemisahan, dan tindakan',2,'SOP','MUTU',true),
('ISO9001:2015','9.1.2','Kepuasan pelanggan: pemantauan persepsi pelanggan dan pengelolaan umpan balik',2,'SOP','FO',true),
('ISO9001:2015','9.2','Audit internal: program audit terjadwal, auditor kompeten, dan tindak lanjut',2,'SOP','MUTU',true),
('ISO9001:2015','9.3','Tinjauan manajemen: masukan, agenda, notulen, dan tindak lanjut keputusan',2,'SOP','MUTU',true),
('ISO9001:2015','10.2','Ketidaksesuaian & tindakan korektif (CAPA): analisis akar masalah dan verifikasi efektivitas',2,'SOP','MUTU',true)
ON CONFLICT (framework, clause_ref, required_doc_type, department) DO NOTHING;

SELECT format('Checklist per framework: %s',
  (SELECT string_agg(framework || '=' || n, ', ' ORDER BY framework)
   FROM (SELECT framework, count(*)::text n FROM agentic.compliance_checklist
         WHERE active GROUP BY framework) x)) AS status;
