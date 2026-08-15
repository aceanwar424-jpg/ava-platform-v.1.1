-- SQL SEED: SINKRONISASI SELURUH DOKUMEN QMS QA-SOP (2026-08-15T09:39:54.525Z)

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L1_001', 'SK Formularium Obat, Daftar Obat High Alert, LASA, dan Obat Emergensi', 1, 'SK', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L1_001 - SK Formularium Obat, Daftar Obat High Alert, LASA, dan Obat Emergensi.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":105751,"full_text":"Dokumen resmi SK Formularium Obat, Daftar Obat High Alert, LASA, dan Obat Emergensi (CLN-FAR_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L1_001 - SK Formularium Obat, Daftar Obat High Alert, LASA, dan Obat Emergensi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L1_002', 'Pedoman Pelayanan Kefarmasian', 1, 'PEDOMAN', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L1_002 - Pedoman Pelayanan Kefarmasian.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":110339,"full_text":"Dokumen resmi Pedoman Pelayanan Kefarmasian (CLN-FAR_L1_002) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L1_002 - Pedoman Pelayanan Kefarmasian.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_001', 'SOP Penulisan Resep Obat', 2, 'SOP', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_001 - SOP Penulisan Resep Obat.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":105560,"full_text":"Dokumen resmi SOP Penulisan Resep Obat (CLN-FAR_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_001 - SOP Penulisan Resep Obat.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_002', 'SOP Pengkajian Resep & Penyiapan Obat (Dispensing)', 2, 'SOP', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_002 - SOP Pengkajian Resep & Penyiapan Obat (Dispensing).docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":105851,"full_text":"Dokumen resmi SOP Pengkajian Resep & Penyiapan Obat (Dispensing) (CLN-FAR_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_002 - SOP Pengkajian Resep & Penyiapan Obat (Dispensing).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_003', 'SOP Pengelolaan Obat High Alert', 2, 'SOP', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_003 - SOP Pengelolaan Obat High Alert.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":106347,"full_text":"Dokumen resmi SOP Pengelolaan Obat High Alert (CLN-FAR_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_003 - SOP Pengelolaan Obat High Alert.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_004', 'SOP Penyimpanan & Penanganan Obat LASA (Look-Alike Sound-Alike)', 2, 'SOP', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_004 - SOP Penyimpanan & Penanganan Obat LASA (Look-Alike Sound-Alike).docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":104763,"full_text":"Dokumen resmi SOP Penyimpanan & Penanganan Obat LASA (Look-Alike Sound-Alike) (CLN-FAR_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_004 - SOP Penyimpanan & Penanganan Obat LASA (Look-Alike Sound-Alike).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_005', 'SOP Pengelolaan Stok Obat & Alat Emergensi (Troli Emergensi)', 2, 'SOP', 'FARMASI', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_005 - SOP Pengelolaan Stok Obat & Alat Emergensi (Troli Emergensi).docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":104820,"full_text":"Dokumen resmi SOP Pengelolaan Stok Obat & Alat Emergensi (Troli Emergensi) (CLN-FAR_L2_005) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_005 - SOP Pengelolaan Stok Obat & Alat Emergensi (Troli Emergensi).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_006', 'SOP Pemasangan Infus & Pemberian Injeksi', 2, 'SOP', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_006 - SOP Pemasangan Infus & Pemberian Injeksi.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":105332,"full_text":"Dokumen resmi SOP Pemasangan Infus & Pemberian Injeksi (CLN-FAR_L2_006) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_006 - SOP Pemasangan Infus & Pemberian Injeksi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_007', 'SOP Pelayanan Informasi Obat (PIO) & Konseling', 2, 'SOP', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_007 - SOP Pelayanan Informasi Obat (PIO) & Konseling.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":104894,"full_text":"Dokumen resmi SOP Pelayanan Informasi Obat (PIO) & Konseling (CLN-FAR_L2_007) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_007 - SOP Pelayanan Informasi Obat (PIO) & Konseling.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_008', 'SOP Deteksi, Pelaporan & Penanganan Medication Error', 2, 'SOP', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_008 - SOP Deteksi, Pelaporan & Penanganan Medication Error.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":105141,"full_text":"Dokumen resmi SOP Deteksi, Pelaporan & Penanganan Medication Error (CLN-FAR_L2_008) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_008 - SOP Deteksi, Pelaporan & Penanganan Medication Error.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L2_009', 'SOP Monitoring Efek Samping Obat (MESO) & Farmakovigilans', 2, 'SOP', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_009 - SOP Monitoring Efek Samping Obat (MESO) & Farmakovigilans.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":103763,"full_text":"Dokumen resmi SOP Monitoring Efek Samping Obat (MESO) & Farmakovigilans (CLN-FAR_L2_009) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L2_009 - SOP Monitoring Efek Samping Obat (MESO) & Farmakovigilans.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L3_001', 'WI Pelabelan Obat & Reagensia (High Alert, LASA, Suhu Khusus)', 3, 'WI', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L3_001 - WI Pelabelan Obat & Reagensia (High Alert, LASA, Suhu Khusus).docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":101322,"full_text":"Dokumen resmi WI Pelabelan Obat & Reagensia (High Alert, LASA, Suhu Khusus) (CLN-FAR_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L3_001 - WI Pelabelan Obat & Reagensia (High Alert, LASA, Suhu Khusus).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L3_002', 'WI Pemeriksaan & Penyegelan Troli Emergensi', 3, 'WI', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L3_002 - WI Pemeriksaan & Penyegelan Troli Emergensi.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":101308,"full_text":"Dokumen resmi WI Pemeriksaan & Penyegelan Troli Emergensi (CLN-FAR_L3_002) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L3_002 - WI Pemeriksaan & Penyegelan Troli Emergensi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L4_001', 'Formulir Double Check Obat High Alert', 4, 'FORM', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_001 - Formulir Double Check Obat High Alert.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":101665,"full_text":"Dokumen resmi Formulir Double Check Obat High Alert (CLN-FAR_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_001 - Formulir Double Check Obat High Alert.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L4_002', 'Formulir Laporan Medication Error & Kejadian Nyaris Cedera', 4, 'FORM', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_002 - Formulir Laporan Medication Error & Kejadian Nyaris Cedera.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":102746,"full_text":"Dokumen resmi Formulir Laporan Medication Error & Kejadian Nyaris Cedera (CLN-FAR_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_002 - Formulir Laporan Medication Error & Kejadian Nyaris Cedera.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L4_003', 'Formulir Laporan Efek Samping Obat (MESO)', 4, 'FORM', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_003 - Formulir Laporan Efek Samping Obat (MESO).docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":102371,"full_text":"Dokumen resmi Formulir Laporan Efek Samping Obat (MESO) (CLN-FAR_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_003 - Formulir Laporan Efek Samping Obat (MESO).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L4_004', 'Checklist Inventaris & Audit Bulanan Troli Emergensi', 4, 'FORM', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_004 - Checklist Inventaris & Audit Bulanan Troli Emergensi.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":102526,"full_text":"Dokumen resmi Checklist Inventaris & Audit Bulanan Troli Emergensi (CLN-FAR_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_004 - Checklist Inventaris & Audit Bulanan Troli Emergensi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L4_005', 'Ceklis Kit Obat Emergensi Portabel (Poliklinik & Home Care)', 4, 'FORM', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_005 - Ceklis Kit Obat Emergensi Portabel (Poliklinik & Home Care).docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":102352,"full_text":"Dokumen resmi Ceklis Kit Obat Emergensi Portabel (Poliklinik & Home Care) (CLN-FAR_L4_005) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_005 - Ceklis Kit Obat Emergensi Portabel (Poliklinik & Home Care).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L4_006', 'Checklist Monitoring Masa Kedaluwarsa Obat & BMHP', 4, 'FORM', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_006 - Checklist Monitoring Masa Kedaluwarsa Obat & BMHP.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":102280,"full_text":"Dokumen resmi Checklist Monitoring Masa Kedaluwarsa Obat & BMHP (CLN-FAR_L4_006) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_006 - Checklist Monitoring Masa Kedaluwarsa Obat & BMHP.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L4_007', 'Kartu Stok Obat & BMHP', 4, 'FORM', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_007 - Kartu Stok Obat & BMHP.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":102179,"full_text":"Dokumen resmi Kartu Stok Obat & BMHP (CLN-FAR_L4_007) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_007 - Kartu Stok Obat & BMHP.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CLN-FAR_L4_008', 'Master List Dokumen Mutu PELAYANAN KEFARMASIAN', 4, 'FORM', 'FARMASI', 'PMK 34/2021 & ISO 15189', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_008 - Master List Dokumen Mutu PELAYANAN KEFARMASIAN.docx', '{"source_dir":"PELAYANAN KEFARMASIAN","file_size_bytes":101449,"full_text":"Dokumen resmi Master List Dokumen Mutu PELAYANAN KEFARMASIAN (CLN-FAR_L4_008) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN KEFARMASIAN/CLN-FAR_L4_008 - Master List Dokumen Mutu PELAYANAN KEFARMASIAN.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L1_001', 'Panduan Anestesi Lokal & Bedah Minor', 1, 'PEDOMAN', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - Panduan Anestesi Lokal & Bedah Minor.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":74860,"full_text":"Dokumen resmi Panduan Anestesi Lokal & Bedah Minor (OLD_CLN-PM_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - Panduan Anestesi Lokal & Bedah Minor.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L1_001', 'Panduan Praktik Klinis (PPK) Dokter', 1, 'PEDOMAN', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - Panduan Praktik Klinis (PPK) Dokter.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":225570,"full_text":"Dokumen resmi Panduan Praktik Klinis (PPK) Dokter (OLD_CLN-PM_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - Panduan Praktik Klinis (PPK) Dokter.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L1_001', 'Panduan Triase & Gawat Darurat', 1, 'PEDOMAN', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - Panduan Triase & Gawat Darurat.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":387761,"full_text":"Dokumen resmi Panduan Triase & Gawat Darurat (OLD_CLN-PM_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - Panduan Triase & Gawat Darurat.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L1_001', 'Pedoman Pelayanan Klinis (Asuhan Pasien)', 1, 'PEDOMAN', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - Pedoman Pelayanan Klinis (Asuhan Pasien).docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":231239,"full_text":"Dokumen resmi Pedoman Pelayanan Klinis (Asuhan Pasien) (OLD_CLN-PM_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - Pedoman Pelayanan Klinis (Asuhan Pasien).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L1_001', 'SK PENETAPAN JENIS-JENIS PELAYANAN KLINIK DAN STRATEGI RUJUKAN KERJASAMA SAMPEL LABORATORIUM', 1, 'SK', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - SK PENETAPAN JENIS-JENIS PELAYANAN KLINIK DAN STRATEGI RUJUKAN KERJASAMA SAMPEL LABORATORIUM.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":75038,"full_text":"Dokumen resmi SK PENETAPAN JENIS-JENIS PELAYANAN KLINIK DAN STRATEGI RUJUKAN KERJASAMA SAMPEL LABORATORIUM (OLD_CLN-PM_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_001 - SK PENETAPAN JENIS-JENIS PELAYANAN KLINIK DAN STRATEGI RUJUKAN KERJASAMA SAMPEL LABORATORIUM.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L1_002', 'SK KEBIJAKAN PELAYANAN ANESTESI LOKAL DAN TINDAKAN BEDAH MINOR', 1, 'SK', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_002 - SK KEBIJAKAN PELAYANAN ANESTESI LOKAL DAN TINDAKAN BEDAH MINOR.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":77905,"full_text":"Dokumen resmi SK KEBIJAKAN PELAYANAN ANESTESI LOKAL DAN TINDAKAN BEDAH MINOR (OLD_CLN-PM_L1_002) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_002 - SK KEBIJAKAN PELAYANAN ANESTESI LOKAL DAN TINDAKAN BEDAH MINOR.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L1_003', 'SK KEBIJAKAN UMUM PELAYANAN KLINIS', 1, 'SK', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_003 - SK KEBIJAKAN UMUM PELAYANAN KLINIS.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":72206,"full_text":"Dokumen resmi SK KEBIJAKAN UMUM PELAYANAN KLINIS (OLD_CLN-PM_L1_003) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_003 - SK KEBIJAKAN UMUM PELAYANAN KLINIS.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L1_004', 'SK KEBIJAKAN PELAYANAN PASIEN RISIKO TINGGI', 1, 'SK', 'PELAYANAN MEDIS', 'ISO 15189:2022 8.5', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_004 - SK KEBIJAKAN PELAYANAN PASIEN RISIKO TINGGI.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":70775,"full_text":"Dokumen resmi SK KEBIJAKAN PELAYANAN PASIEN RISIKO TINGGI (OLD_CLN-PM_L1_004) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L1_004 - SK KEBIJAKAN PELAYANAN PASIEN RISIKO TINGGI.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_001', 'Prosedur Anamnesis & Pemeriksaan Fisik', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_001 - Prosedur Anamnesis & Pemeriksaan Fisik.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":157242,"full_text":"Dokumen resmi Prosedur Anamnesis & Pemeriksaan Fisik (OLD_CLN-PM_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_001 - Prosedur Anamnesis & Pemeriksaan Fisik.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_002', 'Prosedur Anestesi Lokal & Tindakan Bedah Minor', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_002 - Prosedur Anestesi Lokal & Tindakan Bedah Minor.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":217372,"full_text":"Dokumen resmi Prosedur Anestesi Lokal & Tindakan Bedah Minor (OLD_CLN-PM_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_002 - Prosedur Anestesi Lokal & Tindakan Bedah Minor.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_003', 'Prosedur Edukasi Pasien Terintegrasi', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_003 - Prosedur Edukasi Pasien Terintegrasi.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":242337,"full_text":"Dokumen resmi Prosedur Edukasi Pasien Terintegrasi (OLD_CLN-PM_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_003 - Prosedur Edukasi Pasien Terintegrasi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_004', 'Prosedur Identifikasi Pasien', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_004 - Prosedur Identifikasi Pasien.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":265291,"full_text":"Dokumen resmi Prosedur Identifikasi Pasien (OLD_CLN-PM_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_004 - Prosedur Identifikasi Pasien.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_005', 'Prosedur Pelaporan dan Penanganan Nilai Kritis Hasil MCU', 2, 'SOP', 'PELAYANAN MEDIS', 'ISO 15189:2022 7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_005 - Prosedur Pelaporan dan Penanganan Nilai Kritis Hasil MCU.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":246508,"full_text":"Dokumen resmi Prosedur Pelaporan dan Penanganan Nilai Kritis Hasil MCU (OLD_CLN-PM_L2_005) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_005 - Prosedur Pelaporan dan Penanganan Nilai Kritis Hasil MCU.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_006', 'Prosedur Pelayanan Kegawatdaruratan & Syok Anafilaktik', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_006 - Prosedur Pelayanan Kegawatdaruratan & Syok Anafilaktik.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":264743,"full_text":"Dokumen resmi Prosedur Pelayanan Kegawatdaruratan & Syok Anafilaktik (OLD_CLN-PM_L2_006) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_006 - Prosedur Pelayanan Kegawatdaruratan & Syok Anafilaktik.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_007', 'Prosedur Pelayanan Pasien Risiko Tinggi (Geriatri & Disabilitas)', 2, 'SOP', 'PELAYANAN MEDIS', 'ISO 15189:2022 8.5', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_007 - Prosedur Pelayanan Pasien Risiko Tinggi (Geriatri & Disabilitas).docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":230144,"full_text":"Dokumen resmi Prosedur Pelayanan Pasien Risiko Tinggi (Geriatri & Disabilitas) (OLD_CLN-PM_L2_007) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_007 - Prosedur Pelayanan Pasien Risiko Tinggi (Geriatri & Disabilitas).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_008', 'Prosedur Penanganan Komplikasi Tindakan & Anestesi', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_008 - Prosedur Penanganan Komplikasi Tindakan & Anestesi.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":230089,"full_text":"Dokumen resmi Prosedur Penanganan Komplikasi Tindakan & Anestesi (OLD_CLN-PM_L2_008) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_008 - Prosedur Penanganan Komplikasi Tindakan & Anestesi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_009', 'Prosedur Penegakan Diagnosis & Informed Consent', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_009 - Prosedur Penegakan Diagnosis & Informed Consent.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":259761,"full_text":"Dokumen resmi Prosedur Penegakan Diagnosis & Informed Consent (OLD_CLN-PM_L2_009) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_009 - Prosedur Penegakan Diagnosis & Informed Consent.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_010', 'Prosedur Rekam Medis dan CPPT (SOAP)', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_010 - Prosedur Rekam Medis dan CPPT (SOAP).docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":214275,"full_text":"Dokumen resmi Prosedur Rekam Medis dan CPPT (SOAP) (OLD_CLN-PM_L2_010) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_010 - Prosedur Rekam Medis dan CPPT (SOAP).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_011_', 'Prosedur Rujukan Pasien Eksternal', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_011_ - Prosedur Rujukan Pasien Eksternal.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":297726,"full_text":"Dokumen resmi Prosedur Rujukan Pasien Eksternal (OLD_CLN-PM_L2_011_) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_011_ - Prosedur Rujukan Pasien Eksternal.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_012', 'Prosedur Skrining Visual & Triase', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_012 - Prosedur Skrining Visual & Triase.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":240151,"full_text":"Dokumen resmi Prosedur Skrining Visual & Triase (OLD_CLN-PM_L2_012) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_012 - Prosedur Skrining Visual & Triase.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_013', 'Prosedur Surat Keterangan (Sakit_Sehat)', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_013 - Prosedur Surat Keterangan (Sakit_Sehat).docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":242103,"full_text":"Dokumen resmi Prosedur Surat Keterangan (Sakit_Sehat) (OLD_CLN-PM_L2_013) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_013 - Prosedur Surat Keterangan (Sakit_Sehat).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L2_014', 'Prosedur Vaksinasi, Skrining Kanker Dini, Skrining Gizi', 2, 'SOP', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_014 - Prosedur Vaksinasi, Skrining Kanker Dini, Skrining Gizi.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":221583,"full_text":"Dokumen resmi Prosedur Vaksinasi, Skrining Kanker Dini, Skrining Gizi (OLD_CLN-PM_L2_014) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L2_014 - Prosedur Vaksinasi, Skrining Kanker Dini, Skrining Gizi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L3_001', 'Instruksi Kerja Pemeriksaan Fisik oleh Dokter', 3, 'WI', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L3_001 - Instruksi Kerja Pemeriksaan Fisik oleh Dokter.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":232858,"full_text":"Dokumen resmi Instruksi Kerja Pemeriksaan Fisik oleh Dokter (OLD_CLN-PM_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L3_001 - Instruksi Kerja Pemeriksaan Fisik oleh Dokter.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L3_002', 'Instruksi Kerja Pemeriksaan Tekanan Darah, EKG, Audiometri, Spirometri', 3, 'WI', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L3_002 - Instruksi Kerja Pemeriksaan Tekanan Darah, EKG, Audiometri, Spirometri.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":236716,"full_text":"Dokumen resmi Instruksi Kerja Pemeriksaan Tekanan Darah, EKG, Audiometri, Spirometri (OLD_CLN-PM_L3_002) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L3_002 - Instruksi Kerja Pemeriksaan Tekanan Darah, EKG, Audiometri, Spirometri.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L3_003', 'Instruksi Kerja Teknik Hecting (Penjahitan Luka)', 3, 'WI', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L3_003 - Instruksi Kerja Teknik Hecting (Penjahitan Luka).docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":161642,"full_text":"Dokumen resmi Instruksi Kerja Teknik Hecting (Penjahitan Luka) (OLD_CLN-PM_L3_003) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L3_003 - Instruksi Kerja Teknik Hecting (Penjahitan Luka).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L4_001', 'Log Book Buku Register Pelayanan & Rujukan', 4, 'FORM', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_001 - Log Book Buku Register Pelayanan & Rujukan.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":82951,"full_text":"Dokumen resmi Log Book Buku Register Pelayanan & Rujukan (OLD_CLN-PM_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_001 - Log Book Buku Register Pelayanan & Rujukan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L4_002', 'Checklist Monitoring Pasca Tindakan Bedah dan Tindakan Invasif', 4, 'FORM', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_002 - Checklist Monitoring Pasca Tindakan Bedah dan Tindakan Invasif.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":76004,"full_text":"Dokumen resmi Checklist Monitoring Pasca Tindakan Bedah dan Tindakan Invasif (OLD_CLN-PM_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_002 - Checklist Monitoring Pasca Tindakan Bedah dan Tindakan Invasif.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L4_003', 'Formulir Persetujuan Tindakan (Informed Consent)', 4, 'FORM', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_003 - Formulir Persetujuan Tindakan (Informed Consent).docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":76969,"full_text":"Dokumen resmi Formulir Persetujuan Tindakan (Informed Consent) (OLD_CLN-PM_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_003 - Formulir Persetujuan Tindakan (Informed Consent).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L4_004', 'Formulir Skrining Gizi & Psikososial_', 4, 'FORM', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_004 - Formulir Skrining Gizi & Psikososial_.docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":78663,"full_text":"Dokumen resmi Formulir Skrining Gizi & Psikososial_ (OLD_CLN-PM_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_004 - Formulir Skrining Gizi & Psikososial_.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_CLN-PM_L4_005', 'CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT)', 4, 'FORM', 'PELAYANAN MEDIS', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_005 - CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT).docx', '{"source_dir":"PELAYANAN MEDIS","file_size_bytes":73591,"full_text":"Dokumen resmi CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT) (OLD_CLN-PM_L4_005) tersimpan di D:/Dokumen QA-SOP Operational/CLINICAL SERVICES/PELAYANAN MEDIS/OLD_CLN-PM_L4_005 - CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CORP-LGL_L1_001', 'SK Kebijakan Tata Kelola Perikatan, Kemitraan & Batas Kewenangan Menandatangani', 1, 'SK', 'LEGAL & BUSINESS DEVELOPMENT', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L1_001 - SK Kebijakan Tata Kelola Perikatan, Kemitraan & Batas Kewenangan Menandatangani.docx', '{"source_dir":"LEGAL & BUSINESS DEVELOPMENT","file_size_bytes":103319,"full_text":"Dokumen resmi SK Kebijakan Tata Kelola Perikatan, Kemitraan & Batas Kewenangan Menandatangani (CORP-LGL_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L1_001 - SK Kebijakan Tata Kelola Perikatan, Kemitraan & Batas Kewenangan Menandatangani.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CORP-LGL_L2_001', 'SOP Siklus Hidup Perjanjian Kerja Sama (Inisiasi, Telaah, Registrasi & Evaluasi)', 2, 'SOP', 'LEGAL & BUSINESS DEVELOPMENT', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L2_001 - SOP Siklus Hidup Perjanjian Kerja Sama (Inisiasi, Telaah, Registrasi & Evaluasi).docx', '{"source_dir":"LEGAL & BUSINESS DEVELOPMENT","file_size_bytes":107846,"full_text":"Dokumen resmi SOP Siklus Hidup Perjanjian Kerja Sama (Inisiasi, Telaah, Registrasi & Evaluasi) (CORP-LGL_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L2_001 - SOP Siklus Hidup Perjanjian Kerja Sama (Inisiasi, Telaah, Registrasi & Evaluasi).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CORP-LGL_L2_002', 'SOP Penyusunan, Peninjauan & Persetujuan Rencana Anggaran Biaya', 2, 'SOP', 'LEGAL & BUSINESS DEVELOPMENT', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L2_002 - SOP Penyusunan, Peninjauan & Persetujuan Rencana Anggaran Biaya.docx', '{"source_dir":"LEGAL & BUSINESS DEVELOPMENT","file_size_bytes":107048,"full_text":"Dokumen resmi SOP Penyusunan, Peninjauan & Persetujuan Rencana Anggaran Biaya (CORP-LGL_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L2_002 - SOP Penyusunan, Peninjauan & Persetujuan Rencana Anggaran Biaya.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CORP-LGL_L2_003', 'SOP Uji Tuntas & Kualifikasi Legal Calon Mitra Fasilitas Pelayanan Kesehatan', 2, 'SOP', 'LEGAL & BUSINESS DEVELOPMENT', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L2_003 - SOP Uji Tuntas & Kualifikasi Legal Calon Mitra Fasilitas Pelayanan Kesehatan.docx', '{"source_dir":"LEGAL & BUSINESS DEVELOPMENT","file_size_bytes":106831,"full_text":"Dokumen resmi SOP Uji Tuntas & Kualifikasi Legal Calon Mitra Fasilitas Pelayanan Kesehatan (CORP-LGL_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L2_003 - SOP Uji Tuntas & Kualifikasi Legal Calon Mitra Fasilitas Pelayanan Kesehatan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CORP-LGL_L2_004', 'SOP Penyusunan Naskah Perjanjian Kerja Sama & Nota Kesepahaman', 2, 'SOP', 'LEGAL & BUSINESS DEVELOPMENT', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L2_004 - SOP Penyusunan Naskah Perjanjian Kerja Sama & Nota Kesepahaman.docx', '{"source_dir":"LEGAL & BUSINESS DEVELOPMENT","file_size_bytes":106544,"full_text":"Dokumen resmi SOP Penyusunan Naskah Perjanjian Kerja Sama & Nota Kesepahaman (CORP-LGL_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L2_004 - SOP Penyusunan Naskah Perjanjian Kerja Sama & Nota Kesepahaman.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('CORP-LGL_L4_001', 'Master List Dokumen Mutu LEGAL & BUSINESS DEVELOPMENT', 4, 'FORM', 'LEGAL & BUSINESS DEVELOPMENT', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L4_001 - Master List Dokumen Mutu LEGAL & BUSINESS DEVELOPMENT.docx', '{"source_dir":"LEGAL & BUSINESS DEVELOPMENT","file_size_bytes":101771,"full_text":"Dokumen resmi Master List Dokumen Mutu LEGAL & BUSINESS DEVELOPMENT (CORP-LGL_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/CORPORATE AFFAIRS/LEGAL & BUSINESS DEVELOPMENT/CORP-LGL_L4_001 - Master List Dokumen Mutu LEGAL & BUSINESS DEVELOPMENT.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L1_001', 'SK Kebijakan Pelayanan Pelanggan, Hak & Kewajiban Pasien, serta Perlindungan Data Pribadi', 1, 'SK', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L1_001 - SK Kebijakan Pelayanan Pelanggan, Hak & Kewajiban Pasien, serta Perlindungan Data Pribadi.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":105137,"full_text":"Dokumen resmi SK Kebijakan Pelayanan Pelanggan, Hak & Kewajiban Pasien, serta Perlindungan Data Pribadi (FO-REG_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L1_001 - SK Kebijakan Pelayanan Pelanggan, Hak & Kewajiban Pasien, serta Perlindungan Data Pribadi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L1_002', 'Pedoman Perlindungan Data Pribadi & Kerahasiaan Informasi Pasien', 1, 'PEDOMAN', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L1_002 - Pedoman Perlindungan Data Pribadi & Kerahasiaan Informasi Pasien.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":108311,"full_text":"Dokumen resmi Pedoman Perlindungan Data Pribadi & Kerahasiaan Informasi Pasien (FO-REG_L1_002) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L1_002 - Pedoman Perlindungan Data Pribadi & Kerahasiaan Informasi Pasien.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L2_001', 'SOP Pendaftaran & Registrasi Pasien (Walk-in, Rujukan Dokter & MCU Korporat)', 2, 'SOP', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L2_001 - SOP Pendaftaran & Registrasi Pasien (Walk-in, Rujukan Dokter & MCU Korporat).docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":108298,"full_text":"Dokumen resmi SOP Pendaftaran & Registrasi Pasien (Walk-in, Rujukan Dokter & MCU Korporat) (FO-REG_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L2_001 - SOP Pendaftaran & Registrasi Pasien (Walk-in, Rujukan Dokter & MCU Korporat).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L2_002', 'SOP Penerimaan Administratif Sampel Rujukan Masuk dari Fasilitas Mitra (B2B)', 2, 'SOP', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L2_002 - SOP Penerimaan Administratif Sampel Rujukan Masuk dari Fasilitas Mitra (B2B).docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":106234,"full_text":"Dokumen resmi SOP Penerimaan Administratif Sampel Rujukan Masuk dari Fasilitas Mitra (B2B) (FO-REG_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L2_002 - SOP Penerimaan Administratif Sampel Rujukan Masuk dari Fasilitas Mitra (B2B).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L2_003', 'SOP Kasir, Transaksi Keuangan & Serah Terima Shift', 2, 'SOP', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L2_003 - SOP Kasir, Transaksi Keuangan & Serah Terima Shift.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":106616,"full_text":"Dokumen resmi SOP Kasir, Transaksi Keuangan & Serah Terima Shift (FO-REG_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L2_003 - SOP Kasir, Transaksi Keuangan & Serah Terima Shift.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L2_004', 'SOP Penanganan Keluhan Pelanggan & Service Recovery', 2, 'SOP', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L2_004 - SOP Penanganan Keluhan Pelanggan & Service Recovery.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":107038,"full_text":"Dokumen resmi SOP Penanganan Keluhan Pelanggan & Service Recovery (FO-REG_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L2_004 - SOP Penanganan Keluhan Pelanggan & Service Recovery.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L3_001', 'WI Sapaan, Komunikasi Efektif & Edukasi Informasi Pasien', 3, 'WI', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L3_001 - WI Sapaan, Komunikasi Efektif & Edukasi Informasi Pasien.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":103243,"full_text":"Dokumen resmi WI Sapaan, Komunikasi Efektif & Edukasi Informasi Pasien (FO-REG_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L3_001 - WI Sapaan, Komunikasi Efektif & Edukasi Informasi Pasien.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L3_002', 'WI Pengenalan Tanda Bahaya, Pasien Kondisi Khusus & Aktivasi Bantuan Medis di Area Publik', 3, 'WI', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L3_002 - WI Pengenalan Tanda Bahaya, Pasien Kondisi Khusus & Aktivasi Bantuan Medis di Area Publik.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":104074,"full_text":"Dokumen resmi WI Pengenalan Tanda Bahaya, Pasien Kondisi Khusus & Aktivasi Bantuan Medis di Area Publik (FO-REG_L3_002) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L3_002 - WI Pengenalan Tanda Bahaya, Pasien Kondisi Khusus & Aktivasi Bantuan Medis di Area Publik.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L4_001', 'Master Database Tarif, Paket Layanan & Skema Penjaminan Pihak Ketiga', 4, 'FORM', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L4_001 - Master Database Tarif, Paket Layanan & Skema Penjaminan Pihak Ketiga.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":102624,"full_text":"Dokumen resmi Master Database Tarif, Paket Layanan & Skema Penjaminan Pihak Ketiga (FO-REG_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L4_001 - Master Database Tarif, Paket Layanan & Skema Penjaminan Pihak Ketiga.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L4_002', 'Logbook Registrasi Pasien, Kasir Harian & Penerimaan Sampel Rujukan', 4, 'LOGBOOK', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L4_002 - Logbook Registrasi Pasien, Kasir Harian & Penerimaan Sampel Rujukan.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":103002,"full_text":"Dokumen resmi Logbook Registrasi Pasien, Kasir Harian & Penerimaan Sampel Rujukan (FO-REG_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L4_002 - Logbook Registrasi Pasien, Kasir Harian & Penerimaan Sampel Rujukan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L4_003', 'Formulir General Consent & Berita Acara Serah Terima Kas Shift', 4, 'FORM', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L4_003 - Formulir General Consent & Berita Acara Serah Terima Kas Shift.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":103505,"full_text":"Dokumen resmi Formulir General Consent & Berita Acara Serah Terima Kas Shift (FO-REG_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L4_003 - Formulir General Consent & Berita Acara Serah Terima Kas Shift.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('FO-REG_L4_004', 'Master List Dokumen Mutu FRONT OFFICE', 4, 'FORM', 'PELAYANAN & REGISTRASI PASIEN', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L4_004 - Master List Dokumen Mutu FRONT OFFICE.docx', '{"source_dir":"PELAYANAN & REGISTRASI PASIEN","file_size_bytes":101990,"full_text":"Dokumen resmi Master List Dokumen Mutu FRONT OFFICE (FO-REG_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/FRONT OFFICE/PELAYANAN & REGISTRASI PASIEN/FO-REG_L4_004 - Master List Dokumen Mutu FRONT OFFICE.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L1_001', 'SK Kebijakan Sumber Daya Manusia, Kredensial & Penetapan Kewenangan Klinis', 1, 'SK', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L1_001 - SK Kebijakan Sumber Daya Manusia, Kredensial & Penetapan Kewenangan Klinis.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":104270,"full_text":"Dokumen resmi SK Kebijakan Sumber Daya Manusia, Kredensial & Penetapan Kewenangan Klinis (HC-SDM_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L1_001 - SK Kebijakan Sumber Daya Manusia, Kredensial & Penetapan Kewenangan Klinis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L1_002', 'Pedoman Pengelolaan Sumber Daya Manusia & Pengembangan Kompetensi', 1, 'PEDOMAN', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L1_002 - Pedoman Pengelolaan Sumber Daya Manusia & Pengembangan Kompetensi.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":108713,"full_text":"Dokumen resmi Pedoman Pengelolaan Sumber Daya Manusia & Pengembangan Kompetensi (HC-SDM_L1_002) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L1_002 - Pedoman Pengelolaan Sumber Daya Manusia & Pengembangan Kompetensi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L2_001', 'SOP Perencanaan Kebutuhan, Rekrutmen & Seleksi Personel', 2, 'SOP', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_001 - SOP Perencanaan Kebutuhan, Rekrutmen & Seleksi Personel.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":106673,"full_text":"Dokumen resmi SOP Perencanaan Kebutuhan, Rekrutmen & Seleksi Personel (HC-SDM_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_001 - SOP Perencanaan Kebutuhan, Rekrutmen & Seleksi Personel.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L2_002', 'SOP Kredensial & Rekredensial Tenaga Kesehatan serta Penetapan Kewenangan Klinis', 2, 'SOP', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_002 - SOP Kredensial & Rekredensial Tenaga Kesehatan serta Penetapan Kewenangan Klinis.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":107944,"full_text":"Dokumen resmi SOP Kredensial & Rekredensial Tenaga Kesehatan serta Penetapan Kewenangan Klinis (HC-SDM_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_002 - SOP Kredensial & Rekredensial Tenaga Kesehatan serta Penetapan Kewenangan Klinis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L2_003', 'SOP Orientasi & Penempatan Personel Baru', 2, 'SOP', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_003 - SOP Orientasi & Penempatan Personel Baru.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":107108,"full_text":"Dokumen resmi SOP Orientasi & Penempatan Personel Baru (HC-SDM_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_003 - SOP Orientasi & Penempatan Personel Baru.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L2_004', 'SOP Pelatihan, Pengembangan & Evaluasi Kompetensi', 2, 'SOP', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_004 - SOP Pelatihan, Pengembangan & Evaluasi Kompetensi.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":107210,"full_text":"Dokumen resmi SOP Pelatihan, Pengembangan & Evaluasi Kompetensi (HC-SDM_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_004 - SOP Pelatihan, Pengembangan & Evaluasi Kompetensi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L2_005', 'SOP Penilaian Kinerja, Pembinaan & Pengakhiran Hubungan Kerja', 2, 'SOP', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_005 - SOP Penilaian Kinerja, Pembinaan & Pengakhiran Hubungan Kerja.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":107281,"full_text":"Dokumen resmi SOP Penilaian Kinerja, Pembinaan & Pengakhiran Hubungan Kerja (HC-SDM_L2_005) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_005 - SOP Penilaian Kinerja, Pembinaan & Pengakhiran Hubungan Kerja.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L2_006', 'SOP Kesehatan Personel, Imunisasi & Pemantauan Pascapajanan', 2, 'SOP', 'SDM & KREDENSIAL', 'ISO 15189:2022 8.5', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_006 - SOP Kesehatan Personel, Imunisasi & Pemantauan Pascapajanan.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":106796,"full_text":"Dokumen resmi SOP Kesehatan Personel, Imunisasi & Pemantauan Pascapajanan (HC-SDM_L2_006) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L2_006 - SOP Kesehatan Personel, Imunisasi & Pemantauan Pascapajanan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L3_001', 'WI Verifikasi Sumber Primer Dokumen Kompetensi', 3, 'WI', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L3_001 - WI Verifikasi Sumber Primer Dokumen Kompetensi.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":102754,"full_text":"Dokumen resmi WI Verifikasi Sumber Primer Dokumen Kompetensi (HC-SDM_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L3_001 - WI Verifikasi Sumber Primer Dokumen Kompetensi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L4_001', 'Formulir Kredensial & Rincian Kewenangan Klinis', 4, 'FORM', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_001 - Formulir Kredensial & Rincian Kewenangan Klinis.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":104336,"full_text":"Dokumen resmi Formulir Kredensial & Rincian Kewenangan Klinis (HC-SDM_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_001 - Formulir Kredensial & Rincian Kewenangan Klinis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L4_002', 'Formulir Orientasi & Evaluasi Kesiapan Bekerja Mandiri', 4, 'FORM', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_002 - Formulir Orientasi & Evaluasi Kesiapan Bekerja Mandiri.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":104318,"full_text":"Dokumen resmi Formulir Orientasi & Evaluasi Kesiapan Bekerja Mandiri (HC-SDM_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_002 - Formulir Orientasi & Evaluasi Kesiapan Bekerja Mandiri.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L4_003', 'Matriks Kompetensi & Logbook Pelatihan', 4, 'LOGBOOK', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_003 - Matriks Kompetensi & Logbook Pelatihan.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":103944,"full_text":"Dokumen resmi Matriks Kompetensi & Logbook Pelatihan (HC-SDM_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_003 - Matriks Kompetensi & Logbook Pelatihan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L4_004', 'Formulir Penilaian Kinerja & Rencana Pengembangan Individu', 4, 'FORM', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_004 - Formulir Penilaian Kinerja & Rencana Pengembangan Individu.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":103610,"full_text":"Dokumen resmi Formulir Penilaian Kinerja & Rencana Pengembangan Individu (HC-SDM_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_004 - Formulir Penilaian Kinerja & Rencana Pengembangan Individu.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L4_005', 'Master Database Personel, Kredensial & Masa Berlaku Dokumen', 4, 'FORM', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_005 - Master Database Personel, Kredensial & Masa Berlaku Dokumen.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":104053,"full_text":"Dokumen resmi Master Database Personel, Kredensial & Masa Berlaku Dokumen (HC-SDM_L4_005) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_005 - Master Database Personel, Kredensial & Masa Berlaku Dokumen.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('HC-SDM_L4_006', 'Master List Dokumen Mutu SDM & KREDENSIAL', 4, 'FORM', 'SDM & KREDENSIAL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_006 - Master List Dokumen Mutu SDM & KREDENSIAL.docx', '{"source_dir":"SDM & KREDENSIAL","file_size_bytes":102588,"full_text":"Dokumen resmi Master List Dokumen Mutu SDM & KREDENSIAL (HC-SDM_L4_006) tersimpan di D:/Dokumen QA-SOP Operational/HUMAN CAPITAL/SDM & KREDENSIAL/HC-SDM_L4_006 - Master List Dokumen Mutu SDM & KREDENSIAL.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L1_001', 'SK Kebijakan Pengadaan, Pengelolaan Persediaan & Aset serta Batas Kewenangan Otorisasi', 1, 'SK', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L1_001 - SK Kebijakan Pengadaan, Pengelolaan Persediaan & Aset serta Batas Kewenangan Otorisasi.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103846,"full_text":"Dokumen resmi SK Kebijakan Pengadaan, Pengelolaan Persediaan & Aset serta Batas Kewenangan Otorisasi (PRC-INLO_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L1_001 - SK Kebijakan Pengadaan, Pengelolaan Persediaan & Aset serta Batas Kewenangan Otorisasi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L1_002', 'Pedoman Organisasi & Penyelenggaraan Logistik dan Pengadaan', 1, 'PEDOMAN', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L1_002 - Pedoman Organisasi & Penyelenggaraan Logistik dan Pengadaan.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":109265,"full_text":"Dokumen resmi Pedoman Organisasi & Penyelenggaraan Logistik dan Pengadaan (PRC-INLO_L1_002) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L1_002 - Pedoman Organisasi & Penyelenggaraan Logistik dan Pengadaan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L2_001', 'SOP Pengadaan Barang & Jasa serta Kualifikasi dan Evaluasi Kinerja Pemasok', 2, 'SOP', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L2_001 - SOP Pengadaan Barang & Jasa serta Kualifikasi dan Evaluasi Kinerja Pemasok.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":107765,"full_text":"Dokumen resmi SOP Pengadaan Barang & Jasa serta Kualifikasi dan Evaluasi Kinerja Pemasok (PRC-INLO_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L2_001 - SOP Pengadaan Barang & Jasa serta Kualifikasi dan Evaluasi Kinerja Pemasok.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L2_002', 'SOP Pengelolaan Persediaan Reagensia, BMHP & Barang Penunjang', 2, 'SOP', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L2_002 - SOP Pengelolaan Persediaan Reagensia, BMHP & Barang Penunjang.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":107649,"full_text":"Dokumen resmi SOP Pengelolaan Persediaan Reagensia, BMHP & Barang Penunjang (PRC-INLO_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L2_002 - SOP Pengelolaan Persediaan Reagensia, BMHP & Barang Penunjang.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L2_003', 'SOP Pengelolaan Aset — Registrasi, Mutasi, Kontrak KSO & Penghapusan', 2, 'SOP', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L2_003 - SOP Pengelolaan Aset — Registrasi, Mutasi, Kontrak KSO & Penghapusan.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":106874,"full_text":"Dokumen resmi SOP Pengelolaan Aset — Registrasi, Mutasi, Kontrak KSO & Penghapusan (PRC-INLO_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L2_003 - SOP Pengelolaan Aset — Registrasi, Mutasi, Kontrak KSO & Penghapusan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L3_001', 'WI Penerimaan Barang, Karantina & Retur kepada Pemasok', 3, 'WI', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L3_001 - WI Penerimaan Barang, Karantina & Retur kepada Pemasok.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":104287,"full_text":"Dokumen resmi WI Penerimaan Barang, Karantina & Retur kepada Pemasok (PRC-INLO_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L3_001 - WI Penerimaan Barang, Karantina & Retur kepada Pemasok.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L3_002', 'WI Pengeluaran Barang & Pelaksanaan Stok Opname', 3, 'WI', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L3_002 - WI Pengeluaran Barang & Pelaksanaan Stok Opname.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103801,"full_text":"Dokumen resmi WI Pengeluaran Barang & Pelaksanaan Stok Opname (PRC-INLO_L3_002) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L3_002 - WI Pengeluaran Barang & Pelaksanaan Stok Opname.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L3_003', 'WI Penyiapan & Pengepakan Logistik Kegiatan Lapangan (MCU Onsite & Home Care)', 3, 'WI', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L3_003 - WI Penyiapan & Pengepakan Logistik Kegiatan Lapangan (MCU Onsite & Home Care).docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103393,"full_text":"Dokumen resmi WI Penyiapan & Pengepakan Logistik Kegiatan Lapangan (MCU Onsite & Home Care) (PRC-INLO_L3_003) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L3_003 - WI Penyiapan & Pengepakan Logistik Kegiatan Lapangan (MCU Onsite & Home Care).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L4_001', 'Formulir Permintaan Barang Internal', 4, 'FORM', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_001 - Formulir Permintaan Barang Internal.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103397,"full_text":"Dokumen resmi Formulir Permintaan Barang Internal (PRC-INLO_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_001 - Formulir Permintaan Barang Internal.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L4_002', 'Formulir Stok Opname & Perencanaan Kebutuhan Barang', 4, 'FORM', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_002 - Formulir Stok Opname & Perencanaan Kebutuhan Barang.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103987,"full_text":"Dokumen resmi Formulir Stok Opname & Perencanaan Kebutuhan Barang (PRC-INLO_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_002 - Formulir Stok Opname & Perencanaan Kebutuhan Barang.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L4_003', 'Formulir Berita Acara Logistik (Ketidaksesuaian, Retur, Mutasi, Pemusnahan & Penghapusan)', 4, 'FORM', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_003 - Formulir Berita Acara Logistik (Ketidaksesuaian, Retur, Mutasi, Pemusnahan & Penghapusan).docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103793,"full_text":"Dokumen resmi Formulir Berita Acara Logistik (Ketidaksesuaian, Retur, Mutasi, Pemusnahan & Penghapusan) (PRC-INLO_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_003 - Formulir Berita Acara Logistik (Ketidaksesuaian, Retur, Mutasi, Pemusnahan & Penghapusan).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L4_004', 'Logbook Kondisi Lingkungan Penyimpanan (Suhu & Kelembapan)', 4, 'LOGBOOK', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_004 - Logbook Kondisi Lingkungan Penyimpanan (Suhu & Kelembapan).docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103990,"full_text":"Dokumen resmi Logbook Kondisi Lingkungan Penyimpanan (Suhu & Kelembapan) (PRC-INLO_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_004 - Logbook Kondisi Lingkungan Penyimpanan (Suhu & Kelembapan).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L4_005', 'Logbook Penerimaan & Pengeluaran Barang', 4, 'LOGBOOK', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_005 - Logbook Penerimaan & Pengeluaran Barang.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103791,"full_text":"Dokumen resmi Logbook Penerimaan & Pengeluaran Barang (PRC-INLO_L4_005) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_005 - Logbook Penerimaan & Pengeluaran Barang.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L4_006', 'Master Database Material, Pemasok & Suku Cadang', 4, 'FORM', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_006 - Master Database Material, Pemasok & Suku Cadang.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":104239,"full_text":"Dokumen resmi Master Database Material, Pemasok & Suku Cadang (PRC-INLO_L4_006) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_006 - Master Database Material, Pemasok & Suku Cadang.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L4_007', 'Master Database Aset Medis & Nonmedis', 4, 'FORM', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_007 - Master Database Aset Medis & Nonmedis.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":103682,"full_text":"Dokumen resmi Master Database Aset Medis & Nonmedis (PRC-INLO_L4_007) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_007 - Master Database Aset Medis & Nonmedis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('PRC-INLO_L4_008', 'Master List Dokumen Mutu LOGISTIK & PENGADAAN', 4, 'FORM', 'INVENTORY & LOGISTIK', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_008 - Master List Dokumen Mutu LOGISTIK & PENGADAAN.docx', '{"source_dir":"INVENTORY & LOGISTIK","file_size_bytes":102878,"full_text":"Dokumen resmi Master List Dokumen Mutu LOGISTIK & PENGADAAN (PRC-INLO_L4_008) tersimpan di D:/Dokumen QA-SOP Operational/PROCUREMENT & INVENTORY/INVENTORY & LOGISTIK/PRC-INLO_L4_008 - Master List Dokumen Mutu LOGISTIK & PENGADAAN.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L1_001', 'Pedoman Manajemen Fasilitas & Keselamatan (MFK & K3)', 1, 'PEDOMAN', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L1_001 - Pedoman Manajemen Fasilitas & Keselamatan (MFK & K3).docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":109577,"full_text":"Dokumen resmi Pedoman Manajemen Fasilitas & Keselamatan (MFK & K3) (QSC-FK3_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L1_001 - Pedoman Manajemen Fasilitas & Keselamatan (MFK & K3).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L2_001', 'SOP Keselamatan dan Kesehatan Kerja (K3)', 2, 'SOP', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L2_001 - SOP Keselamatan dan Kesehatan Kerja (K3).docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":107077,"full_text":"Dokumen resmi SOP Keselamatan dan Kesehatan Kerja (K3) (QSC-FK3_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L2_001 - SOP Keselamatan dan Kesehatan Kerja (K3).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L2_002', 'SOP Kesiapsiagaan Darurat & Penanggulangan Bencana', 2, 'SOP', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L2_002 - SOP Kesiapsiagaan Darurat & Penanggulangan Bencana.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":107528,"full_text":"Dokumen resmi SOP Kesiapsiagaan Darurat & Penanggulangan Bencana (QSC-FK3_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L2_002 - SOP Kesiapsiagaan Darurat & Penanggulangan Bencana.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L2_003', 'SOP Penggunaan & Pemeliharaan APAR', 2, 'SOP', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L2_003 - SOP Penggunaan & Pemeliharaan APAR.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":106361,"full_text":"Dokumen resmi SOP Penggunaan & Pemeliharaan APAR (QSC-FK3_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L2_003 - SOP Penggunaan & Pemeliharaan APAR.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L2_004', 'SOP Manajemen Siklus Hidup Alat Medis (Kualifikasi, Pemeliharaan & Kalibrasi)', 2, 'SOP', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L2_004 - SOP Manajemen Siklus Hidup Alat Medis (Kualifikasi, Pemeliharaan & Kalibrasi).docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":108218,"full_text":"Dokumen resmi SOP Manajemen Siklus Hidup Alat Medis (Kualifikasi, Pemeliharaan & Kalibrasi) (QSC-FK3_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L2_004 - SOP Manajemen Siklus Hidup Alat Medis (Kualifikasi, Pemeliharaan & Kalibrasi).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L3_001', 'WI Respons Code Red (Kebakaran)', 3, 'WI', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L3_001 - WI Respons Code Red (Kebakaran).docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":101777,"full_text":"Dokumen resmi WI Respons Code Red (Kebakaran) (QSC-FK3_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L3_001 - WI Respons Code Red (Kebakaran).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L3_002', 'WI Penggunaan APAR — Teknik PASS', 3, 'WI', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L3_002 - WI Penggunaan APAR — Teknik PASS.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":100868,"full_text":"Dokumen resmi WI Penggunaan APAR — Teknik PASS (QSC-FK3_L3_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L3_002 - WI Penggunaan APAR — Teknik PASS.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L3_003', 'WI Pembersihan & Pemeliharaan AC dan Lemari Pendingin Reagen', 3, 'WI', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L3_003 - WI Pembersihan & Pemeliharaan AC dan Lemari Pendingin Reagen.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":102463,"full_text":"Dokumen resmi WI Pembersihan & Pemeliharaan AC dan Lemari Pendingin Reagen (QSC-FK3_L3_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L3_003 - WI Pembersihan & Pemeliharaan AC dan Lemari Pendingin Reagen.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L4_001', 'Sensus Harian Indikator Mutu (Form Pengumpulan Data)', 4, 'FORM', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_001 - Sensus Harian Indikator Mutu (Form Pengumpulan Data).docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":104449,"full_text":"Dokumen resmi Sensus Harian Indikator Mutu (Form Pengumpulan Data) (QSC-FK3_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_001 - Sensus Harian Indikator Mutu (Form Pengumpulan Data).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L4_002', 'Formulir Registrasi & Verifikasi MSDS Bahan-Reagen Baru', 4, 'FORM', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_002 - Formulir Registrasi & Verifikasi MSDS Bahan-Reagen Baru.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":102600,"full_text":"Dokumen resmi Formulir Registrasi & Verifikasi MSDS Bahan-Reagen Baru (QSC-FK3_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_002 - Formulir Registrasi & Verifikasi MSDS Bahan-Reagen Baru.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L4_003', 'Notulen Rapat & Daftar Hadir', 4, 'FORM', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_003 - Notulen Rapat & Daftar Hadir.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":102842,"full_text":"Dokumen resmi Notulen Rapat & Daftar Hadir (QSC-FK3_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_003 - Notulen Rapat & Daftar Hadir.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L4_004', 'Template Laporan Bulanan Mutu', 4, 'FORM', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_004 - Template Laporan Bulanan Mutu.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":103723,"full_text":"Dokumen resmi Template Laporan Bulanan Mutu (QSC-FK3_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_004 - Template Laporan Bulanan Mutu.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L4_005', 'Master Katalog Instruksi Kerja Teknis Peralatan & Fasilitas', 4, 'FORM', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_005 - Master Katalog Instruksi Kerja Teknis Peralatan & Fasilitas.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":102963,"full_text":"Dokumen resmi Master Katalog Instruksi Kerja Teknis Peralatan & Fasilitas (QSC-FK3_L4_005) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_005 - Master Katalog Instruksi Kerja Teknis Peralatan & Fasilitas.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L4_006', 'Master List Dokumen Mutu FASILITAS & K3', 4, 'FORM', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_006 - Master List Dokumen Mutu FASILITAS & K3.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":101473,"full_text":"Dokumen resmi Master List Dokumen Mutu FASILITAS & K3 (QSC-FK3_L4_006) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_006 - Master List Dokumen Mutu FASILITAS & K3.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-FK3_L4_007', 'Checklist Inspeksi Fasilitas Bulanan & Kartu Pemeliharaan APAR serta Peralatan', 4, 'FORM', 'FASILITAS & K3', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_007 - Checklist Inspeksi Fasilitas Bulanan & Kartu Pemeliharaan APAR serta Peralatan.docx', '{"source_dir":"FASILITAS & K3","file_size_bytes":105516,"full_text":"Dokumen resmi Checklist Inspeksi Fasilitas Bulanan & Kartu Pemeliharaan APAR serta Peralatan (QSC-FK3_L4_007) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/FASILITAS & K3/QSC-FK3_L4_007 - Checklist Inspeksi Fasilitas Bulanan & Kartu Pemeliharaan APAR serta Peralatan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L1_001', 'Pedoman Pencegahan & Pengendalian Infeksi (PPI)', 1, 'PEDOMAN', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L1_001 - Pedoman Pencegahan & Pengendalian Infeksi (PPI).docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":110181,"full_text":"Dokumen resmi Pedoman Pencegahan & Pengendalian Infeksi (PPI) (QSC-PPI_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L1_001 - Pedoman Pencegahan & Pengendalian Infeksi (PPI).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L2_001', 'SOP Kebersihan Tangan (Handwash & Handrub) dan Penggunaan APD', 2, 'SOP', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_001 - SOP Kebersihan Tangan (Handwash & Handrub) dan Penggunaan APD.docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":108473,"full_text":"Dokumen resmi SOP Kebersihan Tangan (Handwash & Handrub) dan Penggunaan APD (QSC-PPI_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_001 - SOP Kebersihan Tangan (Handwash & Handrub) dan Penggunaan APD.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L2_002', 'SOP Penatalaksanaan Pajanan Okupasi (Tertusuk Jarum & Paparan Cairan Tubuh)', 2, 'SOP', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_002 - SOP Penatalaksanaan Pajanan Okupasi (Tertusuk Jarum & Paparan Cairan Tubuh).docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":109015,"full_text":"Dokumen resmi SOP Penatalaksanaan Pajanan Okupasi (Tertusuk Jarum & Paparan Cairan Tubuh) (QSC-PPI_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_002 - SOP Penatalaksanaan Pajanan Okupasi (Tertusuk Jarum & Paparan Cairan Tubuh).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L2_003', 'SOP Penanganan Tumpahan Cairan Tubuh & B3 (Spill Kit)', 2, 'SOP', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_003 - SOP Penanganan Tumpahan Cairan Tubuh & B3 (Spill Kit).docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":106043,"full_text":"Dokumen resmi SOP Penanganan Tumpahan Cairan Tubuh & B3 (Spill Kit) (QSC-PPI_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_003 - SOP Penanganan Tumpahan Cairan Tubuh & B3 (Spill Kit).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L2_004', 'SOP Pengelolaan Limbah B3, Sampah Domestik & Benda Tajam', 2, 'SOP', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_004 - SOP Pengelolaan Limbah B3, Sampah Domestik & Benda Tajam.docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":108132,"full_text":"Dokumen resmi SOP Pengelolaan Limbah B3, Sampah Domestik & Benda Tajam (QSC-PPI_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_004 - SOP Pengelolaan Limbah B3, Sampah Domestik & Benda Tajam.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L2_005', 'SOP Surveilans Infeksi (HAIs) & Respons Kejadian Luar Biasa', 2, 'SOP', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_005 - SOP Surveilans Infeksi (HAIs) & Respons Kejadian Luar Biasa.docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":107254,"full_text":"Dokumen resmi SOP Surveilans Infeksi (HAIs) & Respons Kejadian Luar Biasa (QSC-PPI_L2_005) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L2_005 - SOP Surveilans Infeksi (HAIs) & Respons Kejadian Luar Biasa.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L3_001', 'WI Enam Langkah Kebersihan Tangan WHO', 3, 'WI', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L3_001 - WI Enam Langkah Kebersihan Tangan WHO.docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":101331,"full_text":"Dokumen resmi WI Enam Langkah Kebersihan Tangan WHO (QSC-PPI_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L3_001 - WI Enam Langkah Kebersihan Tangan WHO.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L3_002', 'WI Penanganan Tumpahan Cairan Tubuh dengan Spill Kit', 3, 'WI', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L3_002 - WI Penanganan Tumpahan Cairan Tubuh dengan Spill Kit.docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":101577,"full_text":"Dokumen resmi WI Penanganan Tumpahan Cairan Tubuh dengan Spill Kit (QSC-PPI_L3_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L3_002 - WI Penanganan Tumpahan Cairan Tubuh dengan Spill Kit.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L4_001', 'Audit Tool Kepatuhan Kebersihan Tangan & PPI', 4, 'FORM', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L4_001 - Audit Tool Kepatuhan Kebersihan Tangan & PPI.docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":103986,"full_text":"Dokumen resmi Audit Tool Kepatuhan Kebersihan Tangan & PPI (QSC-PPI_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L4_001 - Audit Tool Kepatuhan Kebersihan Tangan & PPI.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L4_002', 'Logbook Pembuangan Limbah B3 & Manifest Limbah', 4, 'LOGBOOK', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L4_002 - Logbook Pembuangan Limbah B3 & Manifest Limbah.docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":104449,"full_text":"Dokumen resmi Logbook Pembuangan Limbah B3 & Manifest Limbah (QSC-PPI_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L4_002 - Logbook Pembuangan Limbah B3 & Manifest Limbah.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L4_003', 'Master Database Referensi Mutu & Kepatuhan (MSDS + Target INM)', 4, 'FORM', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L4_003 - Master Database Referensi Mutu & Kepatuhan (MSDS + Target INM).docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":103685,"full_text":"Dokumen resmi Master Database Referensi Mutu & Kepatuhan (MSDS + Target INM) (QSC-PPI_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L4_003 - Master Database Referensi Mutu & Kepatuhan (MSDS + Target INM).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-PPI_L4_004', 'Master List Dokumen Mutu PPI & KESELAMATAN', 4, 'FORM', 'PPI & KESELAMATAN', 'ISO 15189:2022 6.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L4_004 - Master List Dokumen Mutu PPI & KESELAMATAN.docx', '{"source_dir":"PPI & KESELAMATAN","file_size_bytes":100749,"full_text":"Dokumen resmi Master List Dokumen Mutu PPI & KESELAMATAN (QSC-PPI_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/PPI & KESELAMATAN/QSC-PPI_L4_004 - Master List Dokumen Mutu PPI & KESELAMATAN.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L1_001', 'SK Kebijakan Mutu, Manajemen Risiko, Visi-Misi-Tata Nilai, serta Nilai Normal dan Nilai Kritis Laboratorium', 1, 'SK', 'MUTU', 'ISO 15189:2022 8.5', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_001 - SK Kebijakan Mutu, Manajemen Risiko, Visi-Misi-Tata Nilai, serta Nilai Normal dan Nilai Kritis Laboratorium.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":105805,"full_text":"Dokumen resmi SK Kebijakan Mutu, Manajemen Risiko, Visi-Misi-Tata Nilai, serta Nilai Normal dan Nilai Kritis Laboratorium (QSC-QM_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_001 - SK Kebijakan Mutu, Manajemen Risiko, Visi-Misi-Tata Nilai, serta Nilai Normal dan Nilai Kritis Laboratorium.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L1_002', 'Pedoman Tata Kelola Klinik (Corporate Governance)', 1, 'PEDOMAN', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_002 - Pedoman Tata Kelola Klinik (Corporate Governance).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":105441,"full_text":"Dokumen resmi Pedoman Tata Kelola Klinik (Corporate Governance) (QSC-QM_L1_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_002 - Pedoman Tata Kelola Klinik (Corporate Governance).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L1_003', 'Pedoman Peningkatan Mutu & Keselamatan Pasien (PMKP)', 1, 'PEDOMAN', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_003 - Pedoman Peningkatan Mutu & Keselamatan Pasien (PMKP).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":108383,"full_text":"Dokumen resmi Pedoman Peningkatan Mutu & Keselamatan Pasien (PMKP) (QSC-QM_L1_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_003 - Pedoman Peningkatan Mutu & Keselamatan Pasien (PMKP).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L1_004', 'Pedoman Pelayanan Laboratorium & Peningkatan Mutu Klinis', 1, 'PEDOMAN', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_004 - Pedoman Pelayanan Laboratorium & Peningkatan Mutu Klinis.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":107833,"full_text":"Dokumen resmi Pedoman Pelayanan Laboratorium & Peningkatan Mutu Klinis (QSC-QM_L1_004) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_004 - Pedoman Pelayanan Laboratorium & Peningkatan Mutu Klinis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L1_005', 'Panduan Pengelolaan Indikator Mutu (INM & IMP)', 1, 'PEDOMAN', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_005 - Panduan Pengelolaan Indikator Mutu (INM & IMP).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":106250,"full_text":"Dokumen resmi Panduan Pengelolaan Indikator Mutu (INM & IMP) (QSC-QM_L1_005) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L1_005 - Panduan Pengelolaan Indikator Mutu (INM & IMP).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L2_001', 'SOP Manajemen Risiko, Insiden Keselamatan Pasien (IKP) & CAPA', 2, 'SOP', 'MUTU', 'ISO 15189:2022 8.5', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_001 - SOP Manajemen Risiko, Insiden Keselamatan Pasien (IKP) & CAPA.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":107745,"full_text":"Dokumen resmi SOP Manajemen Risiko, Insiden Keselamatan Pasien (IKP) & CAPA (QSC-QM_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_001 - SOP Manajemen Risiko, Insiden Keselamatan Pasien (IKP) & CAPA.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L2_002', 'SOP Audit Internal Mutu & Rapat Tinjauan Manajemen (RTM)', 2, 'SOP', 'MUTU', 'ISO 15189:2022 8.8', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_002 - SOP Audit Internal Mutu & Rapat Tinjauan Manajemen (RTM).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":112694,"full_text":"Dokumen resmi SOP Audit Internal Mutu & Rapat Tinjauan Manajemen (RTM) (QSC-QM_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_002 - SOP Audit Internal Mutu & Rapat Tinjauan Manajemen (RTM).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L2_003', 'SOP Pemantapan Mutu Internal (PMI), PME & Uji Banding', 2, 'SOP', 'MUTU', 'ISO 15189:2022 7.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_003 - SOP Pemantapan Mutu Internal (PMI), PME & Uji Banding.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":106959,"full_text":"Dokumen resmi SOP Pemantapan Mutu Internal (PMI), PME & Uji Banding (QSC-QM_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_003 - SOP Pemantapan Mutu Internal (PMI), PME & Uji Banding.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L2_004', 'SOP Pengendalian Hasil Pemeriksaan Tidak Sesuai', 2, 'SOP', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_004 - SOP Pengendalian Hasil Pemeriksaan Tidak Sesuai.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":105072,"full_text":"Dokumen resmi SOP Pengendalian Hasil Pemeriksaan Tidak Sesuai (QSC-QM_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_004 - SOP Pengendalian Hasil Pemeriksaan Tidak Sesuai.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L2_005', 'SOP Peninjauan Ulang Visi, Misi & Tata Nilai', 2, 'SOP', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_005 - SOP Peninjauan Ulang Visi, Misi & Tata Nilai.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":104130,"full_text":"Dokumen resmi SOP Peninjauan Ulang Visi, Misi & Tata Nilai (QSC-QM_L2_005) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_005 - SOP Peninjauan Ulang Visi, Misi & Tata Nilai.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L2_006', 'SOP Pengawasan Mutu K3 Fasilitas, Kesiapsiagaan Darurat, Utilitas & Kalibrasi Alat Medis', 2, 'SOP', 'MUTU', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_006 - SOP Pengawasan Mutu K3 Fasilitas, Kesiapsiagaan Darurat, Utilitas & Kalibrasi Alat Medis.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":105912,"full_text":"Dokumen resmi SOP Pengawasan Mutu K3 Fasilitas, Kesiapsiagaan Darurat, Utilitas & Kalibrasi Alat Medis (QSC-QM_L2_006) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_006 - SOP Pengawasan Mutu K3 Fasilitas, Kesiapsiagaan Darurat, Utilitas & Kalibrasi Alat Medis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L2_007', 'SOP Pengawasan Mutu PPI, Dekontaminasi, Pengelolaan Limbah B3 & Flebotomi Klinis', 2, 'SOP', 'MUTU', 'ISO 15189:2022 7.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_007 - SOP Pengawasan Mutu PPI, Dekontaminasi, Pengelolaan Limbah B3 & Flebotomi Klinis.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":106688,"full_text":"Dokumen resmi SOP Pengawasan Mutu PPI, Dekontaminasi, Pengelolaan Limbah B3 & Flebotomi Klinis (QSC-QM_L2_007) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L2_007 - SOP Pengawasan Mutu PPI, Dekontaminasi, Pengelolaan Limbah B3 & Flebotomi Klinis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L3_001', 'WI Pengendalian & Pengarsipan Dokumen Mutu', 3, 'WI', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_001 - WI Pengendalian & Pengarsipan Dokumen Mutu.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":104454,"full_text":"Dokumen resmi WI Pengendalian & Pengarsipan Dokumen Mutu (QSC-QM_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_001 - WI Pengendalian & Pengarsipan Dokumen Mutu.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L3_002', 'WI Pembuatan & Interpretasi Grafik Levey-Jennings', 3, 'WI', 'MUTU', 'ISO 15189:2022 7.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_002 - WI Pembuatan & Interpretasi Grafik Levey-Jennings.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":103905,"full_text":"Dokumen resmi WI Pembuatan & Interpretasi Grafik Levey-Jennings (QSC-QM_L3_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_002 - WI Pembuatan & Interpretasi Grafik Levey-Jennings.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L3_003', 'WI Uji Silang Antar-Analis', 3, 'WI', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_003 - WI Uji Silang Antar-Analis.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":103795,"full_text":"Dokumen resmi WI Uji Silang Antar-Analis (QSC-QM_L3_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_003 - WI Uji Silang Antar-Analis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L3_004', 'WI Pengisian Risk Register', 3, 'WI', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_004 - WI Pengisian Risk Register.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":104930,"full_text":"Dokumen resmi WI Pengisian Risk Register (QSC-QM_L3_004) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_004 - WI Pengisian Risk Register.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L3_005', 'WI Pencadangan & Pemulihan Data Hasil Pemeriksaan', 3, 'WI', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_005 - WI Pencadangan & Pemulihan Data Hasil Pemeriksaan.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":104273,"full_text":"Dokumen resmi WI Pencadangan & Pemulihan Data Hasil Pemeriksaan (QSC-QM_L3_005) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L3_005 - WI Pencadangan & Pemulihan Data Hasil Pemeriksaan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_001', 'Formulir Laporan Insiden Keselamatan Pasien (IKP)', 4, 'FORM', 'MUTU', 'ISO 15189:2022 8.5', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_001 - Formulir Laporan Insiden Keselamatan Pasien (IKP).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":102844,"full_text":"Dokumen resmi Formulir Laporan Insiden Keselamatan Pasien (IKP) (QSC-QM_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_001 - Formulir Laporan Insiden Keselamatan Pasien (IKP).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_002', 'Formulir Investigasi Sederhana & Lembar Kerja RCA', 4, 'FORM', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_002 - Formulir Investigasi Sederhana & Lembar Kerja RCA.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":103284,"full_text":"Dokumen resmi Formulir Investigasi Sederhana & Lembar Kerja RCA (QSC-QM_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_002 - Formulir Investigasi Sederhana & Lembar Kerja RCA.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_003', 'Formulir Risk Register (Profil Risiko)', 4, 'FORM', 'MUTU', 'ISO 15189:2022 8.5', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_003 - Formulir Risk Register (Profil Risiko).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":102216,"full_text":"Dokumen resmi Formulir Risk Register (Profil Risiko) (QSC-QM_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_003 - Formulir Risk Register (Profil Risiko).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_004', 'Formulir Pelaporan Nilai Kritis', 4, 'FORM', 'MUTU', 'ISO 15189:2022 7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_004 - Formulir Pelaporan Nilai Kritis.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":102201,"full_text":"Dokumen resmi Formulir Pelaporan Nilai Kritis (QSC-QM_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_004 - Formulir Pelaporan Nilai Kritis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_005', 'Logbook Pelaporan Nilai Kritis (Register Kumulatif)', 4, 'LOGBOOK', 'MUTU', 'ISO 15189:2022 7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_005 - Logbook Pelaporan Nilai Kritis (Register Kumulatif).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":102211,"full_text":"Dokumen resmi Logbook Pelaporan Nilai Kritis (Register Kumulatif) (QSC-QM_L4_005) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_005 - Logbook Pelaporan Nilai Kritis (Register Kumulatif).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_006', 'Lembar Kerja PMI (Kontrol Harian)', 4, 'FORM', 'MUTU', 'ISO 15189:2022 7.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_006 - Lembar Kerja PMI (Kontrol Harian).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":102465,"full_text":"Dokumen resmi Lembar Kerja PMI (Kontrol Harian) (QSC-QM_L4_006) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_006 - Lembar Kerja PMI (Kontrol Harian).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_007', 'Logbook Kontrol Harian PMI (Register & Evaluasi Bulanan)', 4, 'LOGBOOK', 'MUTU', 'ISO 15189:2022 7.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_007 - Logbook Kontrol Harian PMI (Register & Evaluasi Bulanan).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":103527,"full_text":"Dokumen resmi Logbook Kontrol Harian PMI (Register & Evaluasi Bulanan) (QSC-QM_L4_007) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_007 - Logbook Kontrol Harian PMI (Register & Evaluasi Bulanan).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_008', 'Workbook Logbook & Checklist Transaksional Harian Laboratorium (13 Tab)', 4, 'LOGBOOK', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_008 - Workbook Logbook & Checklist Transaksional Harian Laboratorium (13 Tab).docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":103687,"full_text":"Dokumen resmi Workbook Logbook & Checklist Transaksional Harian Laboratorium (13 Tab) (QSC-QM_L4_008) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_008 - Workbook Logbook & Checklist Transaksional Harian Laboratorium (13 Tab).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('QSC-QM_L4_009', 'Master List Dokumen Mutu QUALITY MANAGEMENT', 4, 'FORM', 'MUTU', 'ISO 15189:2022 8.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_009 - Master List Dokumen Mutu QUALITY MANAGEMENT.docx', '{"source_dir":"QUALITY MANAGEMENT","file_size_bytes":101815,"full_text":"Dokumen resmi Master List Dokumen Mutu QUALITY MANAGEMENT (QSC-QM_L4_009) tersimpan di D:/Dokumen QA-SOP Operational/QUALITY, SAFETY & COMPLIANCE (QSC)/QUALITY MANAGEMENT/QSC-QM_L4_009 - Master List Dokumen Mutu QUALITY MANAGEMENT.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L1_001', 'SK Kebijakan Pelayanan Home Care, Kualifikasi & Keselamatan Petugas Lapangan, serta Struktur Tarif', 1, 'SK', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L1_001 - SK Kebijakan Pelayanan Home Care, Kualifikasi & Keselamatan Petugas Lapangan, serta Struktur Tarif.docx', '{"source_dir":"HOME CARE","file_size_bytes":104271,"full_text":"Dokumen resmi SK Kebijakan Pelayanan Home Care, Kualifikasi & Keselamatan Petugas Lapangan, serta Struktur Tarif (SS-HC_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L1_001 - SK Kebijakan Pelayanan Home Care, Kualifikasi & Keselamatan Petugas Lapangan, serta Struktur Tarif.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L2_001', 'SOP Registrasi, Penjadwalan Rute & Pengelolaan Pembayaran Layanan Home Care', 2, 'SOP', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_001 - SOP Registrasi, Penjadwalan Rute & Pengelolaan Pembayaran Layanan Home Care.docx', '{"source_dir":"HOME CARE","file_size_bytes":107020,"full_text":"Dokumen resmi SOP Registrasi, Penjadwalan Rute & Pengelolaan Pembayaran Layanan Home Care (SS-HC_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_001 - SOP Registrasi, Penjadwalan Rute & Pengelolaan Pembayaran Layanan Home Care.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L2_002', 'SOP Persiapan Kunjungan & Keselamatan Petugas Lapangan (Lone Worker Safety)', 2, 'SOP', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_002 - SOP Persiapan Kunjungan & Keselamatan Petugas Lapangan (Lone Worker Safety).docx', '{"source_dir":"HOME CARE","file_size_bytes":107977,"full_text":"Dokumen resmi SOP Persiapan Kunjungan & Keselamatan Petugas Lapangan (Lone Worker Safety) (SS-HC_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_002 - SOP Persiapan Kunjungan & Keselamatan Petugas Lapangan (Lone Worker Safety).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L2_003', 'SOP Verifikasi Identitas & Pengambilan Spesimen di Lokasi Pasien', 2, 'SOP', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_003 - SOP Verifikasi Identitas & Pengambilan Spesimen di Lokasi Pasien.docx', '{"source_dir":"HOME CARE","file_size_bytes":107616,"full_text":"Dokumen resmi SOP Verifikasi Identitas & Pengambilan Spesimen di Lokasi Pasien (SS-HC_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_003 - SOP Verifikasi Identitas & Pengambilan Spesimen di Lokasi Pasien.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L2_004', 'SOP Pengemasan, Rantai Dingin & Serah Terima Spesimen Home Care', 2, 'SOP', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_004 - SOP Pengemasan, Rantai Dingin & Serah Terima Spesimen Home Care.docx', '{"source_dir":"HOME CARE","file_size_bytes":107831,"full_text":"Dokumen resmi SOP Pengemasan, Rantai Dingin & Serah Terima Spesimen Home Care (SS-HC_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_004 - SOP Pengemasan, Rantai Dingin & Serah Terima Spesimen Home Care.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L2_005', 'SOP Penyerahan Hasil, Layanan Pasca-Kunjungan & Penanganan Keluhan Home Care', 2, 'SOP', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_005 - SOP Penyerahan Hasil, Layanan Pasca-Kunjungan & Penanganan Keluhan Home Care.docx', '{"source_dir":"HOME CARE","file_size_bytes":106798,"full_text":"Dokumen resmi SOP Penyerahan Hasil, Layanan Pasca-Kunjungan & Penanganan Keluhan Home Care (SS-HC_L2_005) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L2_005 - SOP Penyerahan Hasil, Layanan Pasca-Kunjungan & Penanganan Keluhan Home Care.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L4_001', 'Master Database Zonasi, Waktu Tempuh & Tarif Layanan Home Care', 4, 'FORM', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L4_001 - Master Database Zonasi, Waktu Tempuh & Tarif Layanan Home Care.docx', '{"source_dir":"HOME CARE","file_size_bytes":102991,"full_text":"Dokumen resmi Master Database Zonasi, Waktu Tempuh & Tarif Layanan Home Care (SS-HC_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L4_001 - Master Database Zonasi, Waktu Tempuh & Tarif Layanan Home Care.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L4_002', 'Logbook Harian Home Care & Pemantauan Armada Kendaraan', 4, 'LOGBOOK', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L4_002 - Logbook Harian Home Care & Pemantauan Armada Kendaraan.docx', '{"source_dir":"HOME CARE","file_size_bytes":104012,"full_text":"Dokumen resmi Logbook Harian Home Care & Pemantauan Armada Kendaraan (SS-HC_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L4_002 - Logbook Harian Home Care & Pemantauan Armada Kendaraan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L4_003', 'Formulir Kesiapan Rute, Kunjungan & Berita Acara Lapangan Home Care', 4, 'FORM', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L4_003 - Formulir Kesiapan Rute, Kunjungan & Berita Acara Lapangan Home Care.docx', '{"source_dir":"HOME CARE","file_size_bytes":103912,"full_text":"Dokumen resmi Formulir Kesiapan Rute, Kunjungan & Berita Acara Lapangan Home Care (SS-HC_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L4_003 - Formulir Kesiapan Rute, Kunjungan & Berita Acara Lapangan Home Care.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-HC_L4_004', 'Master List Dokumen Mutu HOME CARE', 4, 'FORM', 'HOME CARE', 'KMK 1983/2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L4_004 - Master List Dokumen Mutu HOME CARE.docx', '{"source_dir":"HOME CARE","file_size_bytes":101829,"full_text":"Dokumen resmi Master List Dokumen Mutu HOME CARE (SS-HC_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/HOME CARE/SS-HC_L4_004 - Master List Dokumen Mutu HOME CARE.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L1_001', 'SK Organisasi Laboratorium Klinik, Kebijakan Teknis Operasional & Spesifikasi Mutu Analitik', 1, 'SK', 'LABORATORIUM', 'ISO 15189:2022 7.2-7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L1_001 - SK Organisasi Laboratorium Klinik, Kebijakan Teknis Operasional & Spesifikasi Mutu Analitik.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":102637,"full_text":"Dokumen resmi SK Organisasi Laboratorium Klinik, Kebijakan Teknis Operasional & Spesifikasi Mutu Analitik (SS-LAB_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L1_001 - SK Organisasi Laboratorium Klinik, Kebijakan Teknis Operasional & Spesifikasi Mutu Analitik.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L1_002', 'Pedoman Teknis Operasional Laboratorium Klinik', 1, 'PEDOMAN', 'LABORATORIUM', 'ISO 15189:2022 7.2-7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L1_002 - Pedoman Teknis Operasional Laboratorium Klinik.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":108008,"full_text":"Dokumen resmi Pedoman Teknis Operasional Laboratorium Klinik (SS-LAB_L1_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L1_002 - Pedoman Teknis Operasional Laboratorium Klinik.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L2_001', 'SOP Penerimaan, Verifikasi Identitas & Aksesi Spesimen', 2, 'SOP', 'LABORATORIUM', 'ISO 15189:2022 7.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L2_001 - SOP Penerimaan, Verifikasi Identitas & Aksesi Spesimen.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":106107,"full_text":"Dokumen resmi SOP Penerimaan, Verifikasi Identitas & Aksesi Spesimen (SS-LAB_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L2_001 - SOP Penerimaan, Verifikasi Identitas & Aksesi Spesimen.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L2_002', 'SOP Pengambilan Spesimen Darah (Flebotomi) — Vena, Kapiler & POCT', 2, 'SOP', 'LABORATORIUM', 'ISO 15189:2022 7.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L2_002 - SOP Pengambilan Spesimen Darah (Flebotomi) — Vena, Kapiler & POCT.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":107209,"full_text":"Dokumen resmi SOP Pengambilan Spesimen Darah (Flebotomi) — Vena, Kapiler & POCT (SS-LAB_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L2_002 - SOP Pengambilan Spesimen Darah (Flebotomi) — Vena, Kapiler & POCT.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L2_003', 'SOP Pasca-Analitik (Verifikasi Teknis, Validasi Klinis & Distribusi Hasil)', 2, 'SOP', 'LABORATORIUM', 'ISO 15189:2022 7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L2_003 - SOP Pasca-Analitik (Verifikasi Teknis, Validasi Klinis & Distribusi Hasil).docx', '{"source_dir":"LABORATORIUM","file_size_bytes":106132,"full_text":"Dokumen resmi SOP Pasca-Analitik (Verifikasi Teknis, Validasi Klinis & Distribusi Hasil) (SS-LAB_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L2_003 - SOP Pasca-Analitik (Verifikasi Teknis, Validasi Klinis & Distribusi Hasil).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L2_004', 'SOP Validasi & Verifikasi Metode serta Kinerja Analitik Instrumen Baru', 2, 'SOP', 'LABORATORIUM', 'ISO 15189:2022 7.3', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L2_004 - SOP Validasi & Verifikasi Metode serta Kinerja Analitik Instrumen Baru.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":105438,"full_text":"Dokumen resmi SOP Validasi & Verifikasi Metode serta Kinerja Analitik Instrumen Baru (SS-LAB_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L2_004 - SOP Validasi & Verifikasi Metode serta Kinerja Analitik Instrumen Baru.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L3_001', 'WI Teknik Flebotomi Vena & Kapiler', 3, 'WI', 'LABORATORIUM', 'ISO 15189:2022 7.2', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_001 - WI Teknik Flebotomi Vena & Kapiler.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":102032,"full_text":"Dokumen resmi WI Teknik Flebotomi Vena & Kapiler (SS-LAB_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_001 - WI Teknik Flebotomi Vena & Kapiler.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L3_002', 'WI Pengambilan Spesimen Urin (Midstream, 24 Jam & Urin Anak)', 3, 'WI', 'LABORATORIUM', 'ISO 15189:2022 7.2-7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_002 - WI Pengambilan Spesimen Urin (Midstream, 24 Jam & Urin Anak).docx', '{"source_dir":"LABORATORIUM","file_size_bytes":101527,"full_text":"Dokumen resmi WI Pengambilan Spesimen Urin (Midstream, 24 Jam & Urin Anak) (SS-LAB_L3_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_002 - WI Pengambilan Spesimen Urin (Midstream, 24 Jam & Urin Anak).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L3_003', 'WI Pengambilan Spesimen Swab (Nasofaring, Tenggorok, Luka & Uretra)', 3, 'WI', 'LABORATORIUM', 'ISO 15189:2022 7.2-7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_003 - WI Pengambilan Spesimen Swab (Nasofaring, Tenggorok, Luka & Uretra).docx', '{"source_dir":"LABORATORIUM","file_size_bytes":101515,"full_text":"Dokumen resmi WI Pengambilan Spesimen Swab (Nasofaring, Tenggorok, Luka & Uretra) (SS-LAB_L3_003) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_003 - WI Pengambilan Spesimen Swab (Nasofaring, Tenggorok, Luka & Uretra).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L3_004', 'WI Identifikasi & Penanganan Spesimen Hemolisis, Ikterik & Lipemik', 3, 'WI', 'LABORATORIUM', 'ISO 15189:2022 7.2-7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_004 - WI Identifikasi & Penanganan Spesimen Hemolisis, Ikterik & Lipemik.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":101710,"full_text":"Dokumen resmi WI Identifikasi & Penanganan Spesimen Hemolisis, Ikterik & Lipemik (SS-LAB_L3_004) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_004 - WI Identifikasi & Penanganan Spesimen Hemolisis, Ikterik & Lipemik.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L3_005', 'WI Dekontaminasi, Pembersihan & Pemeliharaan Mikroskop', 3, 'WI', 'LABORATORIUM', 'ISO 15189:2022 7.2-7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_005 - WI Dekontaminasi, Pembersihan & Pemeliharaan Mikroskop.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":101242,"full_text":"Dokumen resmi WI Dekontaminasi, Pembersihan & Pemeliharaan Mikroskop (SS-LAB_L3_005) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_005 - WI Dekontaminasi, Pembersihan & Pemeliharaan Mikroskop.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L3_006', 'WI Pelaksanaan Uji Banding Antar-Alat & Antar-Analis', 3, 'WI', 'LABORATORIUM', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_006 - WI Pelaksanaan Uji Banding Antar-Alat & Antar-Analis.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":101720,"full_text":"Dokumen resmi WI Pelaksanaan Uji Banding Antar-Alat & Antar-Analis (SS-LAB_L3_006) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L3_006 - WI Pelaksanaan Uji Banding Antar-Alat & Antar-Analis.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L4_001', 'Formulir Permintaan Pemeriksaan Laboratorium', 4, 'FORM', 'LABORATORIUM', 'ISO 15189:2022 7.2-7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L4_001 - Formulir Permintaan Pemeriksaan Laboratorium.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":102760,"full_text":"Dokumen resmi Formulir Permintaan Pemeriksaan Laboratorium (SS-LAB_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L4_001 - Formulir Permintaan Pemeriksaan Laboratorium.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L4_002', 'Checklist Pemeliharaan Harian & Mingguan Alat Laboratorium', 4, 'FORM', 'LABORATORIUM', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L4_002 - Checklist Pemeliharaan Harian & Mingguan Alat Laboratorium.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":103592,"full_text":"Dokumen resmi Checklist Pemeliharaan Harian & Mingguan Alat Laboratorium (SS-LAB_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L4_002 - Checklist Pemeliharaan Harian & Mingguan Alat Laboratorium.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('SS-LAB_L4_003', 'Master List Dokumen Mutu LABORATORIUM KLINIK', 4, 'FORM', 'LABORATORIUM', 'ISO 15189:2022 7.2-7.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L4_003 - Master List Dokumen Mutu LABORATORIUM KLINIK.docx', '{"source_dir":"LABORATORIUM","file_size_bytes":101861,"full_text":"Dokumen resmi Master List Dokumen Mutu LABORATORIUM KLINIK (SS-LAB_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/LABORATORIUM/SS-LAB_L4_003 - Master List Dokumen Mutu LABORATORIUM KLINIK.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L2_001', 'PROSEDUR PERENCANAAN DAN PENGENDALIAN PROJECT MCU B2B', 2, 'SOP', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_001 - PROSEDUR PERENCANAAN DAN PENGENDALIAN PROJECT MCU B2B.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":155743,"full_text":"Dokumen resmi PROSEDUR PERENCANAAN DAN PENGENDALIAN PROJECT MCU B2B (OLD_SS-MCU_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_001 - PROSEDUR PERENCANAAN DAN PENGENDALIAN PROJECT MCU B2B.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L2_002', 'PROSEDUR PERSIAPAN DAN MOBILISASI SUMBER DAYA PROJECT MEDICAL CHECK-UP', 2, 'SOP', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_002 - PROSEDUR PERSIAPAN DAN MOBILISASI SUMBER DAYA PROJECT MEDICAL CHECK-UP.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":96197,"full_text":"Dokumen resmi PROSEDUR PERSIAPAN DAN MOBILISASI SUMBER DAYA PROJECT MEDICAL CHECK-UP (OLD_SS-MCU_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_002 - PROSEDUR PERSIAPAN DAN MOBILISASI SUMBER DAYA PROJECT MEDICAL CHECK-UP.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L2_003', 'PROSEDUR PELAKSANAAN LAYANAN MCU B2B', 2, 'SOP', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_003 - PROSEDUR PELAKSANAAN LAYANAN MCU B2B.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":95342,"full_text":"Dokumen resmi PROSEDUR PELAKSANAAN LAYANAN MCU B2B (OLD_SS-MCU_L2_003) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_003 - PROSEDUR PELAKSANAAN LAYANAN MCU B2B.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L2_004', 'PROSEDUR PASCA MCU DAN PELAPORAN HASIL', 2, 'SOP', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_004 - PROSEDUR PASCA MCU DAN PELAPORAN HASIL.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":103498,"full_text":"Dokumen resmi PROSEDUR PASCA MCU DAN PELAPORAN HASIL (OLD_SS-MCU_L2_004) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_004 - PROSEDUR PASCA MCU DAN PELAPORAN HASIL.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L2_005', 'PROSEDUR BILLING, LAPORAN REALISASI RAB & PENUTUPAN FINANSIAL PROYEK MCU (B2B)', 2, 'SOP', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_005 - PROSEDUR BILLING, LAPORAN REALISASI RAB & PENUTUPAN FINANSIAL PROYEK MCU (B2B).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":96861,"full_text":"Dokumen resmi PROSEDUR BILLING, LAPORAN REALISASI RAB & PENUTUPAN FINANSIAL PROYEK MCU (B2B) (OLD_SS-MCU_L2_005) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_005 - PROSEDUR BILLING, LAPORAN REALISASI RAB & PENUTUPAN FINANSIAL PROYEK MCU (B2B).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L2_006', 'SOP Evaluasi & Feedback Pasca Proyek', 2, 'SOP', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_006 - SOP Evaluasi & Feedback Pasca Proyek.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":146661,"full_text":"Dokumen resmi SOP Evaluasi & Feedback Pasca Proyek (OLD_SS-MCU_L2_006) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_006 - SOP Evaluasi & Feedback Pasca Proyek.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L2_008', 'Template Kuesioner Kepuasan Klien Korporat', 2, 'SOP', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_008 - Template Kuesioner Kepuasan Klien Korporat.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":67219,"full_text":"Dokumen resmi Template Kuesioner Kepuasan Klien Korporat (OLD_SS-MCU_L2_008) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L2_008 - Template Kuesioner Kepuasan Klien Korporat.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L3_001', 'WI Set-up Station MCU Onsite', 3, 'WI', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L3_001 - WI Set-up Station MCU Onsite.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":147268,"full_text":"Dokumen resmi WI Set-up Station MCU Onsite (OLD_SS-MCU_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L3_001 - WI Set-up Station MCU Onsite.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_001', 'Form Kebutuhan Klien (Discovery)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_001 - Form Kebutuhan Klien (Discovery).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75249,"full_text":"Dokumen resmi Form Kebutuhan Klien (Discovery) (OLD_SS-MCU_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_001 - Form Kebutuhan Klien (Discovery).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_002', 'Form Mapping Parameter', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_002 - Form Mapping Parameter.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":76816,"full_text":"Dokumen resmi Form Mapping Parameter (OLD_SS-MCU_L4_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_002 - Form Mapping Parameter.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_003', 'Form Pra-Kalkulasi & Struktur Harga', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_003 - Form Pra-Kalkulasi & Struktur Harga.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":76842,"full_text":"Dokumen resmi Form Pra-Kalkulasi & Struktur Harga (OLD_SS-MCU_L4_003) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_003 - Form Pra-Kalkulasi & Struktur Harga.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_004', 'Berita Acara Technical Meeting', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_004 - Berita Acara Technical Meeting.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75270,"full_text":"Dokumen resmi Berita Acara Technical Meeting (OLD_SS-MCU_L4_004) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_004 - Berita Acara Technical Meeting.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_005', 'Form Order MCU (Single Source of Truth)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_005 - Form Order MCU (Single Source of Truth).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74858,"full_text":"Dokumen resmi Form Order MCU (Single Source of Truth) (OLD_SS-MCU_L4_005) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_005 - Form Order MCU (Single Source of Truth).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_006', 'Form Handover Project', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_006 - Form Handover Project.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75403,"full_text":"Dokumen resmi Form Handover Project (OLD_SS-MCU_L4_006) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_006 - Form Handover Project.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_007', 'Form Pengajuan Dana Kas Gantung Operasional Lapangan', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_007 - Form Pengajuan Dana Kas Gantung Operasional Lapangan.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74678,"full_text":"Dokumen resmi Form Pengajuan Dana Kas Gantung Operasional Lapangan (OLD_SS-MCU_L4_007) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_007 - Form Pengajuan Dana Kas Gantung Operasional Lapangan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_008', 'FORM REQUEST & KONTROL LOGISTIK BMHP (LOGISTICS IN-OUT CONTROL)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_008 - FORM REQUEST & KONTROL LOGISTIK BMHP (LOGISTICS IN-OUT CONTROL).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":85440,"full_text":"Dokumen resmi FORM REQUEST & KONTROL LOGISTIK BMHP (LOGISTICS IN-OUT CONTROL) (OLD_SS-MCU_L4_008) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_008 - FORM REQUEST & KONTROL LOGISTIK BMHP (LOGISTICS IN-OUT CONTROL).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_009', 'Form Penugasan SDM', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_009 - Form Penugasan SDM.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":76266,"full_text":"Dokumen resmi Form Penugasan SDM (OLD_SS-MCU_L4_009) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_009 - Form Penugasan SDM.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_010', 'Form Absensi Briefing', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_010 - Form Absensi Briefing.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75473,"full_text":"Dokumen resmi Form Absensi Briefing (OLD_SS-MCU_L4_010) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_010 - Form Absensi Briefing.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_011', 'Form Checklist Kelayakan Alat & Kalibrasi', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022 6.4', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_011 - Form Checklist Kelayakan Alat & Kalibrasi.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75597,"full_text":"Dokumen resmi Form Checklist Kelayakan Alat & Kalibrasi (OLD_SS-MCU_L4_011) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_011 - Form Checklist Kelayakan Alat & Kalibrasi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_012', 'Log Manifest Sampel Pre-Print', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_012 - Log Manifest Sampel Pre-Print.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":76576,"full_text":"Dokumen resmi Log Manifest Sampel Pre-Print (OLD_SS-MCU_L4_012) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_012 - Log Manifest Sampel Pre-Print.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_013', 'Daftar Periksa Digital per Stasiun', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_013 - Daftar Periksa Digital per Stasiun.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":76302,"full_text":"Dokumen resmi Daftar Periksa Digital per Stasiun (OLD_SS-MCU_L4_013) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_013 - Daftar Periksa Digital per Stasiun.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_014', 'Form Exception Approval (pengeluaran di luar RAB)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_014 - Form Exception Approval (pengeluaran di luar RAB).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":73337,"full_text":"Dokumen resmi Form Exception Approval (pengeluaran di luar RAB) (OLD_SS-MCU_L4_014) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_014 - Form Exception Approval (pengeluaran di luar RAB).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_015', 'BAST PELAKSANAAN (BERITA ACARA SERAH TERIMA — DASAR INVOICING)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_015 - BAST PELAKSANAAN (BERITA ACARA SERAH TERIMA — DASAR INVOICING).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75295,"full_text":"Dokumen resmi BAST PELAKSANAAN (BERITA ACARA SERAH TERIMA — DASAR INVOICING) (OLD_SS-MCU_L4_015) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_015 - BAST PELAKSANAAN (BERITA ACARA SERAH TERIMA — DASAR INVOICING).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_016', 'LOG PERSETUJUAN ADD-ON LAPANGAN', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_016 - LOG PERSETUJUAN ADD-ON LAPANGAN.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74955,"full_text":"Dokumen resmi LOG PERSETUJUAN ADD-ON LAPANGAN (OLD_SS-MCU_L4_016) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_016 - LOG PERSETUJUAN ADD-ON LAPANGAN.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_017', 'LOG KENDALA & INSIDEN LAPANGAN', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_017 - LOG KENDALA & INSIDEN LAPANGAN.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74484,"full_text":"Dokumen resmi LOG KENDALA & INSIDEN LAPANGAN (OLD_SS-MCU_L4_017) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_017 - LOG KENDALA & INSIDEN LAPANGAN.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_018', 'LOG PESERTA TAMBAHAN _ UNREGISTERED _ LOG-UNREG', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_018 - LOG PESERTA TAMBAHAN _ UNREGISTERED _ LOG-UNREG.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74061,"full_text":"Dokumen resmi LOG PESERTA TAMBAHAN _ UNREGISTERED _ LOG-UNREG (OLD_SS-MCU_L4_018) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_018 - LOG PESERTA TAMBAHAN _ UNREGISTERED _ LOG-UNREG.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_019', 'FORM REKONSILIASI DATA PASCA MCU', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_019 - FORM REKONSILIASI DATA PASCA MCU.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75940,"full_text":"Dokumen resmi FORM REKONSILIASI DATA PASCA MCU (OLD_SS-MCU_L4_019) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_019 - FORM REKONSILIASI DATA PASCA MCU.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_020', 'FORM REKAP BILLING FINAL — DASAR PENERBITAN INVOICE', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_020 - FORM REKAP BILLING FINAL — DASAR PENERBITAN INVOICE.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75636,"full_text":"Dokumen resmi FORM REKAP BILLING FINAL — DASAR PENERBITAN INVOICE (OLD_SS-MCU_L4_020) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_020 - FORM REKAP BILLING FINAL — DASAR PENERBITAN INVOICE.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_021', 'REGISTER ACCOUNTS RECEIVABLE & AGING AR MONITORING', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_021 - REGISTER ACCOUNTS RECEIVABLE & AGING AR MONITORING.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":76231,"full_text":"Dokumen resmi REGISTER ACCOUNTS RECEIVABLE & AGING AR MONITORING (OLD_SS-MCU_L4_021) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_021 - REGISTER ACCOUNTS RECEIVABLE & AGING AR MONITORING.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_022', 'FORM EVALUASI PROYEK MCU', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_022 - FORM EVALUASI PROYEK MCU.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74051,"full_text":"Dokumen resmi FORM EVALUASI PROYEK MCU (OLD_SS-MCU_L4_022) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_022 - FORM EVALUASI PROYEK MCU.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_023', 'LAPORAN HARIAN KEGIATAN (DIKIRIM MAKS PUKUL 21_00 WIB)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_023 - LAPORAN HARIAN KEGIATAN (DIKIRIM MAKS PUKUL 21_00 WIB).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74285,"full_text":"Dokumen resmi LAPORAN HARIAN KEGIATAN (DIKIRIM MAKS PUKUL 21_00 WIB) (OLD_SS-MCU_L4_023) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_023 - LAPORAN HARIAN KEGIATAN (DIKIRIM MAKS PUKUL 21_00 WIB).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_024', 'CRITICAL VALUE NOTIFICATION LOG', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_024 - CRITICAL VALUE NOTIFICATION LOG.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74545,"full_text":"Dokumen resmi CRITICAL VALUE NOTIFICATION LOG (OLD_SS-MCU_L4_024) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_024 - CRITICAL VALUE NOTIFICATION LOG.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_025', 'AUDIT TRAIL PERUBAHAN DATA (UNTUK RE-OPEN DATA PASCA LOCKING)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_025 - AUDIT TRAIL PERUBAHAN DATA (UNTUK RE-OPEN DATA PASCA LOCKING).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74318,"full_text":"Dokumen resmi AUDIT TRAIL PERUBAHAN DATA (UNTUK RE-OPEN DATA PASCA LOCKING) (OLD_SS-MCU_L4_025) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_025 - AUDIT TRAIL PERUBAHAN DATA (UNTUK RE-OPEN DATA PASCA LOCKING).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_026', 'TEMPLATE KUESIONER KEPUASAN KLIEN KORPORAT', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_026 - TEMPLATE KUESIONER KEPUASAN KLIEN KORPORAT.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":81265,"full_text":"Dokumen resmi TEMPLATE KUESIONER KEPUASAN KLIEN KORPORAT (OLD_SS-MCU_L4_026) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_026 - TEMPLATE KUESIONER KEPUASAN KLIEN KORPORAT.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_027', 'CHECKLIST SIGN-OFF QC MEDIS 5 LAPIS', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_027 - CHECKLIST SIGN-OFF QC MEDIS 5 LAPIS.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":72549,"full_text":"Dokumen resmi CHECKLIST SIGN-OFF QC MEDIS 5 LAPIS (OLD_SS-MCU_L4_027) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_027 - CHECKLIST SIGN-OFF QC MEDIS 5 LAPIS.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_028', 'BERITA ACARA _ TANDA TERIMA PENYERAHAN HASIL MCU AKHIR', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_028 - BERITA ACARA _ TANDA TERIMA PENYERAHAN HASIL MCU AKHIR.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":74013,"full_text":"Dokumen resmi BERITA ACARA _ TANDA TERIMA PENYERAHAN HASIL MCU AKHIR (OLD_SS-MCU_L4_028) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_028 - BERITA ACARA _ TANDA TERIMA PENYERAHAN HASIL MCU AKHIR.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_029', 'TEMPLATE LAPORAN EXECUTIVE SUMMARY (TREN KESEHATAN KORPORAT)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_029 - TEMPLATE LAPORAN EXECUTIVE SUMMARY (TREN KESEHATAN KORPORAT).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":75124,"full_text":"Dokumen resmi TEMPLATE LAPORAN EXECUTIVE SUMMARY (TREN KESEHATAN KORPORAT) (OLD_SS-MCU_L4_029) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_029 - TEMPLATE LAPORAN EXECUTIVE SUMMARY (TREN KESEHATAN KORPORAT).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_030', 'TEMPLATE FINANCIAL CLOSING NOTICE', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_030 - TEMPLATE FINANCIAL CLOSING NOTICE.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":72773,"full_text":"Dokumen resmi TEMPLATE FINANCIAL CLOSING NOTICE (OLD_SS-MCU_L4_030) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_030 - TEMPLATE FINANCIAL CLOSING NOTICE.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_031', 'TEMPLATE KALKULASI GROSS MARGIN AKTUAL', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_031 - TEMPLATE KALKULASI GROSS MARGIN AKTUAL.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":73122,"full_text":"Dokumen resmi TEMPLATE KALKULASI GROSS MARGIN AKTUAL (OLD_SS-MCU_L4_031) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_031 - TEMPLATE KALKULASI GROSS MARGIN AKTUAL.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_032', 'LOG KONTROL & MONITORING BUKTI POTONG PPH PASAL 23_21', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_032 - LOG KONTROL & MONITORING BUKTI POTONG PPH PASAL 23_21.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":73121,"full_text":"Dokumen resmi LOG KONTROL & MONITORING BUKTI POTONG PPH PASAL 23_21 (OLD_SS-MCU_L4_032) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_032 - LOG KONTROL & MONITORING BUKTI POTONG PPH PASAL 23_21.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_033', 'FAKTUR PAJAK RESMI (LAMPIRAN INVOICE)', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_033 - FAKTUR PAJAK RESMI (LAMPIRAN INVOICE).docx', '{"source_dir":"PROJECT MCU","file_size_bytes":72566,"full_text":"Dokumen resmi FAKTUR PAJAK RESMI (LAMPIRAN INVOICE) (OLD_SS-MCU_L4_033) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_033 - FAKTUR PAJAK RESMI (LAMPIRAN INVOICE).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-MCU_L4_034', 'KWITANSI PENGEMBALIAN SISA KAS', 4, 'FORM', 'PROJECT MCU', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_034 - KWITANSI PENGEMBALIAN SISA KAS.docx', '{"source_dir":"PROJECT MCU","file_size_bytes":90478,"full_text":"Dokumen resmi KWITANSI PENGEMBALIAN SISA KAS (OLD_SS-MCU_L4_034) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/PROJECT MCU/OLD_SS-MCU_L4_034 - KWITANSI PENGEMBALIAN SISA KAS.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-REF_L1_001', 'SK Direktur tentang Kebijakan Layanan Rujukan, Kualifikasi Laboratorium Mitra, dan Limitasi Perjanjian (PKS)', 1, 'SK', 'RUJUKAN & LOGISTIK SAMPEL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L1_001 - SK Direktur tentang Kebijakan Layanan Rujukan, Kualifikasi Laboratorium Mitra, dan Limitasi Perjanjian (PKS).docx', '{"source_dir":"RUJUKAN & LOGISTIK SAMPEL","file_size_bytes":84094,"full_text":"Dokumen resmi SK Direktur tentang Kebijakan Layanan Rujukan, Kualifikasi Laboratorium Mitra, dan Limitasi Perjanjian (PKS) (OLD_SS-REF_L1_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L1_001 - SK Direktur tentang Kebijakan Layanan Rujukan, Kualifikasi Laboratorium Mitra, dan Limitasi Perjanjian (PKS).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-REF_L2_001', 'SOP Manajemen Kontrak, Evaluasi SLAs Mitra, dan Rekonsiliasi Tagihan', 2, 'SOP', 'RUJUKAN & LOGISTIK SAMPEL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L2_001 - SOP Manajemen Kontrak, Evaluasi SLAs Mitra, dan Rekonsiliasi Tagihan.docx', '{"source_dir":"RUJUKAN & LOGISTIK SAMPEL","file_size_bytes":153086,"full_text":"Dokumen resmi SOP Manajemen Kontrak, Evaluasi SLAs Mitra, dan Rekonsiliasi Tagihan (OLD_SS-REF_L2_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L2_001 - SOP Manajemen Kontrak, Evaluasi SLAs Mitra, dan Rekonsiliasi Tagihan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-REF_L2_002', 'SOP Tata Kelola Spesimen Rujukan, Uji Banding, dan Emergency Transport', 2, 'SOP', 'RUJUKAN & LOGISTIK SAMPEL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L2_002 - SOP Tata Kelola Spesimen Rujukan, Uji Banding, dan Emergency Transport.docx', '{"source_dir":"RUJUKAN & LOGISTIK SAMPEL","file_size_bytes":142962,"full_text":"Dokumen resmi SOP Tata Kelola Spesimen Rujukan, Uji Banding, dan Emergency Transport (OLD_SS-REF_L2_002) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L2_002 - SOP Tata Kelola Spesimen Rujukan, Uji Banding, dan Emergency Transport.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-REF_L3_001', 'WI Pengepakan Spesimen Standar Internasional & Validasi Rantai Dingin', 3, 'WI', 'RUJUKAN & LOGISTIK SAMPEL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L3_001 - WI Pengepakan Spesimen Standar Internasional & Validasi Rantai Dingin.docx', '{"source_dir":"RUJUKAN & LOGISTIK SAMPEL","file_size_bytes":140272,"full_text":"Dokumen resmi WI Pengepakan Spesimen Standar Internasional & Validasi Rantai Dingin (OLD_SS-REF_L3_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L3_001 - WI Pengepakan Spesimen Standar Internasional & Validasi Rantai Dingin.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-REF_L4_001', 'Master_Logbook Ketertelusuran Spesimen Rujukan Digital (Database Cloud)', 4, 'LOGBOOK', 'RUJUKAN & LOGISTIK SAMPEL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L4_001 - Master_Logbook Ketertelusuran Spesimen Rujukan Digital (Database Cloud).docx', '{"source_dir":"RUJUKAN & LOGISTIK SAMPEL","file_size_bytes":354770,"full_text":"Dokumen resmi Master_Logbook Ketertelusuran Spesimen Rujukan Digital (Database Cloud) (OLD_SS-REF_L4_001) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L4_001 - Master_Logbook Ketertelusuran Spesimen Rujukan Digital (Database Cloud).docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS', 'REF_L4_002_Formulir Checklist Due Diligence Legalitas & Akreditasi', 4, 'FORM', 'RUJUKAN & LOGISTIK SAMPEL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L4_002_Formulir Checklist Due Diligence Legalitas & Akreditasi.docx', '{"source_dir":"RUJUKAN & LOGISTIK SAMPEL","file_size_bytes":73368,"full_text":"Dokumen resmi REF_L4_002_Formulir Checklist Due Diligence Legalitas & Akreditasi (OLD_SS) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L4_002_Formulir Checklist Due Diligence Legalitas & Akreditasi.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-REF_L4_003_', 'Template Scorecard Evaluasi Kinerja Mitra Semesteran', 4, 'FORM', 'RUJUKAN & LOGISTIK SAMPEL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L4_003_- Template Scorecard Evaluasi Kinerja Mitra Semesteran.docx', '{"source_dir":"RUJUKAN & LOGISTIK SAMPEL","file_size_bytes":73895,"full_text":"Dokumen resmi Template Scorecard Evaluasi Kinerja Mitra Semesteran (OLD_SS-REF_L4_003_) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L4_003_- Template Scorecard Evaluasi Kinerja Mitra Semesteran.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('OLD_SS-REF_L4_004_', 'Template Berita Acara Rekonsiliasi Tagihan Bulanan', 4, 'FORM', 'RUJUKAN & LOGISTIK SAMPEL', 'ISO 15189:2022', 'ACTIVE', '2026-08-15', 'D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L4_004_- Template Berita Acara Rekonsiliasi Tagihan Bulanan.docx', '{"source_dir":"RUJUKAN & LOGISTIK SAMPEL","file_size_bytes":73300,"full_text":"Dokumen resmi Template Berita Acara Rekonsiliasi Tagihan Bulanan (OLD_SS-REF_L4_004_) tersimpan di D:/Dokumen QA-SOP Operational/SUPPORT SERVICES/RUJUKAN & LOGISTIK SAMPEL/OLD_SS-REF_L4_004_- Template Berita Acara Rekonsiliasi Tagihan Bulanan.docx"}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();

