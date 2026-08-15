/**
 * Script Sinkronisasi Seluruh Dokumen QMS QA-SOP (Work Item P1/P3/P5)
 * Membaca seluruh dokumen dari D:\Dokumen QA-SOP Operational,
 * memetakan metadata (Departemen, Level, Klausul ISO 15189),
 * dan mensinkronkannya ke DB + Registry Frontend.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DOCS_DIR = 'D:\\Dokumen QA-SOP Operational';

// Pemetaan Folder ke Departemen & Klausul ISO 15189:2022
const FOLDER_MAPPING = {
  'QUALITY MANAGEMENT': { dept: 'MUTU', iso: 'ISO 15189:2022 8.2' },
  'FASILITAS & K3': { dept: 'FASILITAS & K3', iso: 'ISO 15189:2022 6.4' },
  'PPI & KESELAMATAN': { dept: 'PPI & KESELAMATAN', iso: 'ISO 15189:2022 6.3' },
  'LABORATORIUM': { dept: 'LABORATORIUM', iso: 'ISO 15189:2022 7.2-7.4' },
  'PELAYANAN KEFARMASIAN': { dept: 'FARMASI', iso: 'PMK 34/2021 & ISO 15189' },
  'PELAYANAN MEDIS': { dept: 'PELAYANAN MEDIS', iso: 'KMK 1983/2022' },
  'HOME CARE': { dept: 'HOME CARE', iso: 'KMK 1983/2022' },
  'HUMAN CAPITAL': { dept: 'SDM & KREDENSIAL', iso: 'ISO 15189:2022 6.2' },
  'FRONT OFFICE': { dept: 'FRONT OFFICE', iso: 'ISO 15189:2022 4.1' },
  'PROCUREMENT & INVENTORY': { dept: 'LOGISTIK & PENGADAAN', iso: 'ISO 15189:2022 6.5' },
  'CORPORATE AFFAIRS': { dept: 'ADMINISTRASI & LEGAL', iso: 'ISO 15189:2022 5.1' },
  'SUPPORT SERVICES': { dept: 'SUPPORT SERVICES', iso: 'ISO 15189:2022 6.4' }
};

function getAllDocFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.includes('_ARSIP') || entry.name.startsWith('.')) continue;
      getAllDocFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.docx') && !entry.name.startsWith('~$')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function parseDocMeta(filePath) {
  const fileName = path.basename(filePath, '.docx');
  const dirName = path.basename(path.dirname(filePath));
  const mapping = FOLDER_MAPPING[dirName] || { dept: dirName, iso: 'ISO 15189:2022' };

  let docNumber = 'DOC-UNKNOWN';
  let title = fileName;
  let docLevel = 2;
  let docType = 'SOP';

  // Contoh nama: QSC-QM_L1_001 - SK Kebijakan Mutu...
  const match = fileName.match(/^([A-Z0-9_\-]+)\s*-\s*(.*)$/i);
  if (match) {
    docNumber = match[1].trim();
    title = match[2].trim();
  }

  // Deteksi Level
  if (fileName.includes('_L1_') || title.toLowerCase().startsWith('sk ') || title.toLowerCase().startsWith('pedoman')) {
    docLevel = 1;
    docType = title.toLowerCase().startsWith('sk ') ? 'SK' : 'PEDOMAN';
  } else if (fileName.includes('_L2_') || title.toLowerCase().startsWith('sop ')) {
    docLevel = 2;
    docType = 'SOP';
  } else if (fileName.includes('_L3_') || title.toLowerCase().startsWith('wi ') || title.toLowerCase().startsWith('instruksi')) {
    docLevel = 3;
    docType = 'WI';
  } else if (fileName.includes('_L4_') || title.toLowerCase().startsWith('form') || title.toLowerCase().startsWith('logbook') || title.toLowerCase().startsWith('checklist') || title.toLowerCase().startsWith('lembar')) {
    docLevel = 4;
    docType = title.toLowerCase().includes('logbook') ? 'LOGBOOK' : 'FORM';
  }

  // Refine ISO Clause
  let isoClause = mapping.iso;
  if (title.toLowerCase().includes('nilai kritis') || title.toLowerCase().includes('pasca-analitik')) isoClause = 'ISO 15189:2022 7.4';
  if (title.toLowerCase().includes('flebotomi') || title.toLowerCase().includes('aksesi')) isoClause = 'ISO 15189:2022 7.2';
  if (title.toLowerCase().includes('pmi') || title.toLowerCase().includes('levey-jennings') || title.toLowerCase().includes('verifikasi metode')) isoClause = 'ISO 15189:2022 7.3';
  if (title.toLowerCase().includes('kalibrasi') || title.toLowerCase().includes('alat')) isoClause = 'ISO 15189:2022 6.4';
  if (title.toLowerCase().includes('ikp') || title.toLowerCase().includes('capa') || title.toLowerCase().includes('risiko')) isoClause = 'ISO 15189:2022 8.5';
  if (title.toLowerCase().includes('audit internal') || title.toLowerCase().includes('rtm')) isoClause = 'ISO 15189:2022 8.8';

  return {
    id: docNumber.replace(/[^A-Za-z0-9_\-]/g, '_'),
    doc_number: docNumber,
    title: title,
    doc_type: docType,
    doc_level: docLevel,
    department: mapping.dept,
    status: 'ACTIVE',
    current_revision: 1,
    iso_clause: isoClause,
    next_review_date: '2027-08-06',
    source_file_path: filePath.replace(/\\/g, '/'),
    extracted_meta: {
      source_dir: dirName,
      file_size_bytes: fs.statSync(filePath).size,
      full_text: `Dokumen resmi ${title} (${docNumber}) tersimpan di ${filePath.replace(/\\/g, '/')}`
    }
  };
}

async function syncAllDocs() {
  console.log('=====================================================');
  console.log('SINKRONISASI DOKUMEN QMS QA-SOP KE DATABASE & REGISTRY');
  console.log('=====================================================\n');

  console.log(`[1/4] Memindai folder sumber: ${ROOT_DOCS_DIR}...`);
  const files = getAllDocFiles(ROOT_DOCS_DIR);
  console.log(`✅ Ditemukan ${files.length} file dokumen operasional .docx aktif.\n`);

  console.log('[2/4] Mengekstrak metadata & klausul ISO 15189...');
  const registryItems = files.map(f => parseDocMeta(f));

  // Hitung distribusi level
  const stats = { L1: 0, L2: 0, L3: 0, L4: 0 };
  const deptStats = {};
  registryItems.forEach(item => {
    stats[`L${item.doc_level}`] = (stats[`L${item.doc_level}`] || 0) + 1;
    deptStats[item.department] = (deptStats[item.department] || 0) + 1;
  });

  console.log(`✅ Level Dokumen: L1 (SK/Pedoman)=${stats.L1}, L2 (SOP)=${stats.L2}, L3 (WI)=${stats.L3}, L4 (Form/Log)=${stats.L4}`);
  console.log(`✅ Departemen: ${Object.keys(deptStats).map(d => `${d} (${deptStats[d]})`).join(', ')}\n`);

  console.log('[3/4] Menyimpan SSOT JSON & SQL Migration...');
  const outJsonPath = path.join(__dirname, '../data/qms_registry_synced.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(registryItems, null, 2), 'utf-8');
  console.log(`✅ Saved JSON SSOT: ${outJsonPath} (${registryItems.length} items)`);

  // Generate SQL
  let sqlContent = `-- SQL SEED: SINKRONISASI SELURUH DOKUMEN QMS QA-SOP (${new Date().toISOString()})\n\n`;
  registryItems.forEach(item => {
    const escTitle = item.title.replace(/'/g, "''");
    const escMeta = JSON.stringify(item.extracted_meta).replace(/'/g, "''");
    sqlContent += `INSERT INTO agentic.document_registry (doc_number, title, doc_level, doc_type, department, iso_clause, status, effective_date, source_file_path, extracted_meta)
VALUES ('${item.doc_number}', '${escTitle}', ${item.doc_level}, '${item.doc_type}', '${item.department}', '${item.iso_clause}', '${item.status}', '${new Date().toISOString().slice(0,10)}', '${item.source_file_path}', '${escMeta}'::jsonb)
ON CONFLICT (doc_number) DO UPDATE SET
  title = EXCLUDED.title,
  doc_level = EXCLUDED.doc_level,
  doc_type = EXCLUDED.doc_type,
  department = EXCLUDED.department,
  iso_clause = EXCLUDED.iso_clause,
  source_file_path = EXCLUDED.source_file_path,
  updated_at = now();\n\n`;
  });

  const outSqlPath = path.join(__dirname, '../data/sync_qms_to_db.sql');
  fs.writeFileSync(outSqlPath, sqlContent, 'utf-8');
  console.log(`✅ Saved SQL Seed: ${outSqlPath}\n`);

  console.log('[4/4] Mengintegrasikan langsung ke modules/agentic/index.js...');
  const indexJsPath = path.join(__dirname, '../onelab-platform-main/onelab-platform/modules/agentic/index.js');
  if (fs.existsSync(indexJsPath)) {
    let indexContent = fs.readFileSync(indexJsPath, 'utf-8');
    const newRegistrySnippet = `window.agRegistry = window.agRegistry && window.agRegistry.length > 50 ? window.agRegistry : ${JSON.stringify(registryItems, null, 2)};`;
    indexContent = indexContent.replace(/window\.agRegistry = window\.agRegistry \|\| \[[\s\S]*?\];/, newRegistrySnippet);
    fs.writeFileSync(indexJsPath, indexContent, 'utf-8');
    console.log(`✅ Updated frontend cache: ${indexJsPath}`);
  }

  console.log('\n=====================================================');
  console.log(`SINKRONISASI SUKSES: ${registryItems.length} DOKUMEN SIAP DI QMS! 🚀`);
  console.log('=====================================================');
}

syncAllDocs().catch(err => {
  console.error('❌ Sinkronisasi gagal:', err);
  process.exit(1);
});
