/**
 * Full Master Test Catalog Extractor & Builder (Work Item P2)
 * Mengekstrak 532 produk tes dan rentang acuan menjadi katalog siap-LIS
 * Mematuhi aturan integritas data §4.3 dan kepemilikan IP §4.1 (OWNED_BY: generic).
 */

const fs = require('fs');
const path = require('path');
const { CatalogValidator } = require('../lib/validator/catalog_validator');
const { LISExporter } = require('../lib/exporter/lis_exporter');

function buildFullCatalog() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📦 MEMBANGUN MASTER TEST CATALOG GENERIK SIAP-LIS (~530+ TES)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Ekstraksi seluruh 532 produk dari part01 dan part02
  const products = [];
  for (const part of ['part01', 'part02']) {
    const file = path.join(__dirname, `../ava-platform/sql_arsip/06_seed_data/supabase_seed_${part}.sql`);
    const content = fs.readFileSync(file, 'utf8');
    const regex = /VALUES\s*\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([0-9.]+),\s*(true|false)\)/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      products.push({
        kode_internal: m[1],
        kode_material: m[2],
        kategori: m[3],
        sub_kategori: m[4],
        nama_tes: m[5],
        nama_singkat: m[6]
      });
    }
  }
  console.log(`✓ Berhasil memuat ${products.length} master pemeriksaan klinis.`);

  // 2. Ekstraksi sub-analit dari part03
  const part3 = fs.readFileSync(path.join(__dirname, '../ava-platform/sql_arsip/06_seed_data/supabase_seed_part03.sql'), 'utf8');
  const productItems = new Map();
  const piRegex = /SELECT p\.id,\s*'([^']+)',\s*'([^']+)',\s*(?:'([^']+)'|NULL),\s*(?:'([^']+)'|NULL),\s*([0-9]+),\s*'([^']+)',\s*true FROM public\.products p WHERE p\.kode_internal='([^']+)'/g;
  let piMatch;
  while ((piMatch = piRegex.exec(part3)) !== null) {
    const pCode = piMatch[7];
    const itemCode = piMatch[1];
    const itemName = piMatch[2];
    const uom = piMatch[3] || 'U/mL';
    const loinc = piMatch[4] || '1000-0';
    if (!productItems.has(pCode)) productItems.set(pCode, []);
    productItems.get(pCode).push({ itemCode, itemName, uom, loinc });
  }

  // 3. Ekstraksi reference ranges dari part03 - part08
  const refRanges = new Map();
  for (let i = 3; i <= 8; i++) {
    const pFile = path.join(__dirname, `../ava-platform/sql_arsip/06_seed_data/supabase_seed_part0${i}.sql`);
    if (!fs.existsSync(pFile)) continue;
    const pContent = fs.readFileSync(pFile, 'utf8');
    const rrRegex = /SELECT p\.id,\s*pi\.id,\s*p\.nama_tes,\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([0-9.]+),\s*([0-9.]+),\s*([0-9.]+|NULL),\s*([0-9.]+|NULL),\s*(?:'([^']+)'|NULL),\s*(?:'([^']+)'|NULL),\s*'([^']+)' FROM public\.products p JOIN public\.product_items pi ON pi\.product_id=p\.id AND pi\.code='[^']+' WHERE p\.kode_internal='([^']+)'/g;
    let rrMatch;
    while ((rrMatch = rrRegex.exec(pContent)) !== null) {
      const pCode = rrMatch[13];
      const itemCode = rrMatch[1];
      const key = `${pCode}::${itemCode}`;
      if (!refRanges.has(key)) refRanges.set(key, []);
      refRanges.get(key).push({
        gender: rrMatch[5],
        age_min: Number(rrMatch[6]),
        age_max: Number(rrMatch[7]),
        range_min: rrMatch[8] === 'NULL' ? 0 : Number(rrMatch[8]),
        range_max: rrMatch[9] === 'NULL' ? 100 : Number(rrMatch[9]),
        unit: rrMatch[10] || ''
      });
    }
  }

  // 4. Default standard analyte reference & LOINC library for standard categories
  const categoryDefaults = {
    'HEMATOLOGY': { loinc: '718-7', uom: 'g/dL', min: 12.0, max: 17.5, ref: 'CLSI H20-A2' },
    'CLINICAL CHEMISTRY': { loinc: '2345-7', uom: 'mg/dL', min: 70.0, max: 140.0, ref: 'IFU Kit Reagen & Konsensus Nasional' },
    'IMMUNOLOGY': { loinc: '5059-1', uom: 'IU/mL', min: 0.0, max: 200.0, ref: 'CLSI I/LA21-A2' },
    'SEROLOGY': { loinc: '22312-3', uom: 'index', min: 0.0, max: 1.0, ref: 'IFU Kit Reagen' },
    'URINALYSIS': { loinc: '24356-8', uom: 'mg/dL', min: 0.0, max: 15.0, ref: 'CLSI GP16-A3' },
    'HORMONES': { loinc: '3016-3', uom: 'uIU/mL', min: 0.4, max: 4.2, ref: 'ATA Guidelines' },
    'MOLECULAR': { loinc: '21008-8', uom: 'copies/mL', min: 0.0, max: 20.0, ref: 'WHO International Standard' },
    'MICROBIOLOGY': { loinc: '634-6', uom: 'CFU/mL', min: 0.0, max: 10000.0, ref: 'CLSI M100-Ed32' },
    'TOXICOLOGY': { loinc: '14316-4', uom: 'ng/mL', min: 0.0, max: 50.0, ref: 'SAMHSA Guidelines' },
    'DEFAULT': { loinc: '1000-0', uom: 'U/L', min: 0.0, max: 100.0, ref: 'IFU Kit Reagen' }
  };

  // Kamus spesifik analit klinis standar (Prioritas di atas category fallback)
  const clinicalAnalyteMap = {
    'HEMOGLOBIN': { loinc: '718-7', uom: 'g/dL', min: 12.0, max: 17.5, ref: 'CLSI H20-A2' },
    'LEUKOSIT': { loinc: '6690-2', uom: '10*3/uL', min: 4.0, max: 10.0, ref: 'CLSI H20-A2' },
    'TROMBOSIT': { loinc: '777-3', uom: '10*3/uL', min: 150.0, max: 450.0, ref: 'CLSI H20-A2' },
    'HEMATOKRIT': { loinc: '4544-3', uom: '%', min: 36.0, max: 50.0, ref: 'CLSI H20-A2' },
    'ERITROSIT': { loinc: '789-8', uom: '10*6/uL', min: 4.0, max: 5.5, ref: 'CLSI H20-A2' },
    'LED': { loinc: '30341-2', uom: 'mm/h', min: 0.0, max: 20.0, ref: 'ICSH / CLSI H02-A5' },
    'LAJU ENDAP DARAH': { loinc: '30341-2', uom: 'mm/h', min: 0.0, max: 20.0, ref: 'ICSH / CLSI H02-A5' },
    'LAJU SEDIMEN ERITROSIT': { loinc: '30341-2', uom: 'mm/h', min: 0.0, max: 20.0, ref: 'ICSH / CLSI H02-A5' },
    'RETIKULOSIT': { loinc: '17849-1', uom: '%', min: 0.5, max: 2.5, ref: 'CLSI H44-A2' },
    'GLUKOSA SEWAKTU': { loinc: '2345-7', uom: 'mg/dL', min: 70.0, max: 140.0, ref: 'Perkeni 2021 & ADA 2024' },
    'GLUKOSA PUASA': { loinc: '1558-6', uom: 'mg/dL', min: 70.0, max: 100.0, ref: 'Perkeni 2021 & ADA 2024' },
    'GLUKOSA 2 JAM PP': { loinc: '1501-6', uom: 'mg/dL', min: 70.0, max: 140.0, ref: 'Perkeni 2021 & ADA 2024' },
    'HBA1C': { loinc: '4548-4', uom: '%', min: 4.0, max: 5.7, ref: 'NGSP & ADA 2024' },
    'TOTAL BILIRUBIN': { loinc: '1975-2', uom: 'mg/dL', min: 0.2, max: 1.2, ref: 'IFCC Reference Method' },
    'BILIRUBIN TOTAL': { loinc: '1975-2', uom: 'mg/dL', min: 0.2, max: 1.2, ref: 'IFCC Reference Method' },
    'BILIRUBIN DIREK': { loinc: '1968-7', uom: 'mg/dL', min: 0.0, max: 0.3, ref: 'IFCC Reference Method' },
    'BILIRUBIN LANGSUNG': { loinc: '1968-7', uom: 'mg/dL', min: 0.0, max: 0.3, ref: 'IFCC Reference Method' },
    'BILIRUBIN INDIREK': { loinc: '1971-1', uom: 'mg/dL', min: 0.2, max: 0.8, ref: 'IFCC Reference Method' },
    'SGOT': { loinc: '1920-8', uom: 'U/L', min: 0.0, max: 35.0, ref: 'IFCC 37°C' },
    'SGPT': { loinc: '1742-6', uom: 'U/L', min: 0.0, max: 45.0, ref: 'IFCC 37°C' },
    'GAMMA GT': { loinc: '2324-2', uom: 'U/L', min: 5.0, max: 55.0, ref: 'IFCC 37°C' },
    'FOSFATASE ALKALI': { loinc: '6768-6', uom: 'U/L', min: 40.0, max: 150.0, ref: 'IFCC 37°C' },
    'UREUM': { loinc: '3094-0', uom: 'mg/dL', min: 10.0, max: 50.0, ref: 'Konsensus Nefrologi' },
    'KREATININ': { loinc: '2160-0', uom: 'mg/dL', min: 0.6, max: 1.2, ref: 'IDMS-traceable Enzymatic' },
    'ASAM URAT': { loinc: '3084-1', uom: 'mg/dL', min: 3.5, max: 7.2, ref: 'Uricase Method' },
    'KOLESTEROL TOTAL': { loinc: '2093-3', uom: 'mg/dL', min: 0.0, max: 200.0, ref: 'NCEP ATP III' },
    'TRIGLISERIDA': { loinc: '2571-8', uom: 'mg/dL', min: 0.0, max: 150.0, ref: 'NCEP ATP III' },
    'HDL KOLESTEROL': { loinc: '2085-9', uom: 'mg/dL', min: 40.0, max: 60.0, ref: 'NCEP ATP III' },
    'LDL KOLESTEROL': { loinc: '2089-1', uom: 'mg/dL', min: 0.0, max: 130.0, ref: 'NCEP ATP III' },
    'NATRIUM': { loinc: '2951-2', uom: 'mmol/L', min: 135.0, max: 145.0, ref: 'ISE Direct' },
    'KALIUM': { loinc: '2823-3', uom: 'mmol/L', min: 3.5, max: 5.0, ref: 'ISE Direct' },
    'KLORIDA': { loinc: '2075-0', uom: 'mmol/L', min: 96.0, max: 106.0, ref: 'ISE Direct' },
    'KALSIUM': { loinc: '17861-6', uom: 'mg/dL', min: 8.5, max: 10.5, ref: 'Arsenazo III Method' },
    'MAGNESIUM': { loinc: '19123-9', uom: 'mg/dL', min: 1.7, max: 2.4, ref: 'Xylidyl Blue Method' },
    'FOSFOR': { loinc: '2777-1', uom: 'mg/dL', min: 2.5, max: 4.5, ref: 'Phosphomolybdate Method' },
    'FERITIN': { loinc: '2276-4', uom: 'ng/mL', min: 30.0, max: 400.0, ref: 'CLSI I/LA21-A2' },
    'TSH': { loinc: '3016-3', uom: 'uIU/mL', min: 0.4, max: 4.2, ref: 'ATA Guidelines' },
    'FT4': { loinc: '3024-7', uom: 'ng/dL', min: 0.8, max: 1.8, ref: 'ATA Guidelines' },
    'FT3': { loinc: '3051-0', uom: 'pg/mL', min: 2.3, max: 4.2, ref: 'ATA Guidelines' },
    'TOTAL T4': { loinc: '3026-2', uom: 'ug/dL', min: 4.5, max: 12.0, ref: 'ATA Guidelines' },
    'TOTAL T3': { loinc: '3049-4', uom: 'ng/dL', min: 80.0, max: 200.0, ref: 'ATA Guidelines' },
    'PROTEIN TOTAL': { loinc: '2885-2', uom: 'g/dL', min: 6.4, max: 8.3, ref: 'Biuret Method / IFCC' },
    'TOTAL PROTEIN': { loinc: '2885-2', uom: 'g/dL', min: 6.4, max: 8.3, ref: 'Biuret Method / IFCC' },
    'ELEKTROFORESIS PROTEIN': { loinc: '2885-2', uom: 'g/dL', min: 6.4, max: 8.3, ref: 'Capillary Electrophoresis' },
    'ALBUMIN': { loinc: '1751-7', uom: 'g/dL', min: 3.5, max: 5.2, ref: 'BCG Method / IFCC' },
    'GLOBULIN': { loinc: '2336-6', uom: 'g/dL', min: 2.0, max: 3.5, ref: 'Calculated' },
    'PROTEIN C': { loinc: '27816-8', uom: '%', min: 70.0, max: 140.0, ref: 'Chromogenic Assay' },
    'PROTEIN S': { loinc: '27821-8', uom: '%', min: 60.0, max: 130.0, ref: 'Free Antigen Assay' },
    'D-DIMER': { loinc: '48065-7', uom: 'ng/mL', min: 0.0, max: 500.0, ref: 'Immunoturbidimetric' },
    'TROPONIN I': { loinc: '10839-9', uom: 'ng/mL', min: 0.0, max: 0.04, ref: 'High-Sensitivity Troponin' },
    'TROPONIN T': { loinc: '6598-7', uom: 'ng/mL', min: 0.0, max: 0.014, ref: 'High-Sensitivity Troponin' },
    'PT': { loinc: '5902-2', uom: 's', min: 11.0, max: 15.0, ref: 'Thromboplastin Reagent' },
    'APTT': { loinc: '3173-2', uom: 's', min: 25.0, max: 35.0, ref: 'Ellagic Acid / Kaolin' },
    'INR': { loinc: '6301-6', uom: '{INR}', min: 0.8, max: 1.2, ref: 'WHO Sensitivity Index' },
    'HBSAG': { loinc: '5196-1', uom: 'index', min: 0.0, max: 0.9, ref: 'CLIA / ECLIA' },
    'ANTI HCV': { loinc: '13955-0', uom: 'index', min: 0.0, max: 0.9, ref: 'CLIA / ECLIA' },
    'ANTI HIV': { loinc: '75622-1', uom: 'index', min: 0.0, max: 0.9, ref: 'Rapid 3-Test Strategy / ECLIA' }
  };

  // Helper pembersihan terjemahan literal / mesin pada nama analit
  function cleanTranslationArtifacts(name) {
    if (!name) return name;
    let n = name;
    n = n.replace(/\bT4\s+GRATIS\b/gi, 'FT4 (Tiroksin Bebas)');
    n = n.replace(/\bT3\s+GRATIS\b/gi, 'FT3 (Triiodotironin Bebas)');
    n = n.replace(/\bSaya\s+pikir\s+Protein\s+Jones\b/gi, 'Protein Bence-Jones');
    n = n.replace(/\bSensitif\s+terhadap\s+TSH\b/gi, 'TSH Sensitif (sTSH)');
    n = n.replace(/\bKORTISOL\s+SORE\s*²?\b/gi, 'Kortisol Sore (Cortisol PM)');
    n = n.replace(/\bHITUNGAN\s+Parameter\b/gi, 'Darah Lengkap (Hemogram)');
    return n;
  }

  // Helper matching clinical analyte
  function findClinicalMatch(testName) {
    const upper = (testName || '').toUpperCase();
    for (const [k, v] of Object.entries(clinicalAnalyteMap)) {
      if (upper.includes(k)) return v;
    }
    return null;
  }

  // Helper formatting LOINC
  function formatLoinc(rawLoinc, fallback) {
    if (rawLoinc && /^\d{1,5}-\d$/.test(rawLoinc)) return rawLoinc;
    return fallback;
  }

  // Helper formatting UCUM
  function formatUcum(rawUom, fallback) {
    if (!rawUom || rawUom === 'NULL' || rawUom === '-') return fallback;
    const cleaned = rawUom.replace(/[^\x20-\x7E]/g, '').trim();
    if (/^[A-Za-z0-9%./*^()\-]+$/.test(cleaned) && cleaned.length > 0) return cleaned;
    return fallback;
  }

  // 5. Rakit baris katalog master terurai (analit individual)
  const catalogRows = [];
  const processedKeys = new Set();

  products.forEach(p => {
    const items = productItems.get(p.kode_internal);
    const catUpper = (p.kategori || '').toUpperCase();
    const defaults = Object.keys(categoryDefaults).find(k => catUpper.includes(k))
      ? categoryDefaults[Object.keys(categoryDefaults).find(k => catUpper.includes(k))]
      : categoryDefaults.DEFAULT;

    if (items && items.length > 0) {
      // Panel memiliki sub-analit spesifik
      items.forEach(it => {
        const rrList = refRanges.get(`${p.kode_internal}::${it.itemCode}`);
        const clinicalMatch = findClinicalMatch(it.itemName) || findClinicalMatch(p.nama_tes);
        const resolvedDefaults = clinicalMatch || defaults;

        const ucomUnit = formatUcum(it.uom, resolvedDefaults.uom);
        const loincCode = formatLoinc(it.loinc, resolvedDefaults.loinc);
        const cleanItemName = cleanTranslationArtifacts(it.itemName);

        if (rrList && rrList.length > 0) {
          rrList.forEach(rr => {
            const genderStr = rr.gender === 'All' ? 'Semua' : (rr.gender === 'Male' ? 'Laki-laki' : 'Perempuan');
            const ageGroupStr = rr.age_min === 0 && rr.age_max === 0 ? 'Semua' : (rr.age_max <= 18 ? 'Anak' : 'Dewasa');
            const key = `${p.kode_material}::${p.nama_tes}::${cleanItemName}::${ageGroupStr}::${genderStr}`;
            
            if (!processedKeys.has(key)) {
              processedKeys.add(key);
              catalogRows.push({
                'Kode Material': p.kode_material,
                'Nama Pemeriksaan': p.nama_tes,
                'Nama Analit': cleanItemName,
                'Operator': 'BETWEEN',
                'Batas Bawah': String(rr.range_min),
                'Batas Atas': String(rr.range_max),
                'Jenis Nilai': 'Kuantitatif',
                'Kelompok Usia': ageGroupStr,
                'Jenis Kelamin': genderStr,
                'LOINC (OBX-3)': loincCode,
                'UCUM (OBX-6)': formatUcum(rr.unit, ucomUnit),
                'Sumber Acuan': resolvedDefaults.ref,
                'Status Verifikasi Acuan': 'UNVERIFIED_GENERATED',
                'Catatan Klinis': `Evaluasi parameter analitik ${cleanItemName} pada panel ${p.nama_singkat || p.nama_tes}.`
              });
            }
          });
        } else {
          // Sub-analit tanpa rentang spesifik di SQL -> gunakan rentang baku
          const key = `${p.kode_material}::${p.nama_tes}::${cleanItemName}::Dewasa::Semua`;
          if (!processedKeys.has(key)) {
            processedKeys.add(key);
            catalogRows.push({
              'Kode Material': p.kode_material,
              'Nama Pemeriksaan': p.nama_tes,
              'Nama Analit': cleanItemName,
              'Operator': 'BETWEEN',
              'Batas Bawah': String(resolvedDefaults.min),
              'Batas Atas': String(resolvedDefaults.max),
              'Jenis Nilai': 'Kuantitatif',
              'Kelompok Usia': 'Dewasa',
              'Jenis Kelamin': 'Semua',
              'LOINC (OBX-3)': loincCode,
              'UCUM (OBX-6)': ucomUnit,
              'Sumber Acuan': resolvedDefaults.ref,
              'Status Verifikasi Acuan': 'UNVERIFIED_GENERATED',
              'Catatan Klinis': `Pemeriksaan laboratorium ${cleanItemName} untuk diagnosis klinis.`
            });
          }
        }
      });
    } else {
      // Pemeriksaan tunggal (analit mandiri)
      let analyteName = p.nama_singkat || p.nama_tes;
      analyteName = analyteName.replace(/\(.*\)/g, '').trim();
      if (!analyteName || /(?:panel|paket|profil|complete blood count|\bcbc\b)/i.test(analyteName)) {
        analyteName = p.nama_tes.split(' ')[0] + ' Parameter';
      }
      analyteName = cleanTranslationArtifacts(analyteName);

      const clinicalMatch = findClinicalMatch(analyteName) || findClinicalMatch(p.nama_tes);
      const resolvedDefaults = clinicalMatch || defaults;

      const key = `${p.kode_material}::${p.nama_tes}::${analyteName}::Dewasa::Semua`;
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        catalogRows.push({
          'Kode Material': p.kode_material,
          'Nama Pemeriksaan': p.nama_tes,
          'Nama Analit': analyteName,
          'Operator': 'BETWEEN',
          'Batas Bawah': String(resolvedDefaults.min),
          'Batas Atas': String(resolvedDefaults.max),
          'Jenis Nilai': 'Kuantitatif',
          'Kelompok Usia': 'Dewasa',
          'Jenis Kelamin': 'Semua',
          'LOINC (OBX-3)': resolvedDefaults.loinc,
          'UCUM (OBX-6)': resolvedDefaults.uom,
          'Sumber Acuan': resolvedDefaults.ref,
          'Status Verifikasi Acuan': 'UNVERIFIED_GENERATED',
          'Catatan Klinis': `Pemetaan/rentang otomatis ${analyteName}; wajib review klinis dari acuan/IFU yang sesuai sebelum digunakan.`
        });
      }
    }
  });

  console.log(`✓ Total baris analit terurai siap-LIS: ${catalogRows.length} baris.`);

  // 6. Generate CSV & Simpan ke data/catalog/catalog_generic.csv
  const headers = [
    'Kode Material',
    'Nama Pemeriksaan',
    'Nama Analit',
    'Operator',
    'Batas Bawah',
    'Batas Atas',
    'Jenis Nilai',
    'Kelompok Usia',
    'Jenis Kelamin',
    'LOINC (OBX-3)',
    'UCUM (OBX-6)',
    'Sumber Acuan',
    'Status Verifikasi Acuan',
    'Catatan Klinis'
  ];

  let csvContent = headers.join(',') + '\n';
  catalogRows.forEach(r => {
    const line = headers.map(h => {
      const val = (r[h] || '').replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
    csvContent += line + '\n';
  });

  const outCsvPath = path.join(__dirname, '../data/catalog/catalog_generic.csv');
  fs.writeFileSync(outCsvPath, csvContent, 'utf8');
  console.log(`✓ File tersimpan: data/catalog/catalog_generic.csv (${(csvContent.length / 1024).toFixed(1)} KB)`);

  // 7. Ekspor format TSV, Excel XML (.xls), dan HL7/FHIR Spec
  const exporter = new LISExporter();
  const tsvContent = exporter.export(catalogRows, { format: 'tsv' });
  fs.writeFileSync(path.join(__dirname, '../data/catalog/catalog_generic.tsv'), tsvContent, 'utf8');
  console.log(`✓ File TSV tersimpan: data/catalog/catalog_generic.tsv`);

  const excelContent = exporter.export(catalogRows, { format: 'excel_xml' });
  fs.writeFileSync(path.join(__dirname, '../data/catalog/catalog_generic.xls'), excelContent, 'utf8');
  console.log(`✓ File Excel Spreadsheet tersimpan: data/catalog/catalog_generic.xls (${(excelContent.length / 1024).toFixed(1)} KB)`);

  const hl7Spec = exporter.export(catalogRows.slice(0, 50), { format: 'hl7_spec' });
  fs.writeFileSync(path.join(__dirname, '../data/catalog/catalog_hl7_spec_sample.md'), hl7Spec, 'utf8');
  console.log(`✓ File HL7/FHIR Spec tersimpan: data/catalog/catalog_hl7_spec_sample.md`);

  // 8. Validasi Kepatuhan Integritas Data via CatalogValidator
  console.log('\n--- Menjalankan Validasi Integritas Data Relasional (§4.3) ---');
  const validator = new CatalogValidator();
  const valResult = validator.validate(csvContent);

  console.log(`Hasil Validasi Katalog:`);
  console.log(`- Status Valid: ${valResult.is_valid ? '✅ VALID (100% RELATIONAL INTEGRITY)' : '❌ INVALID'}`);
  console.log(`- Total Baris Analit: ${valResult.total_rows}`);
  console.log(`- Critical Errors: ${valResult.errors ? valResult.errors.length : 0}`);
  console.log(`- Warnings: ${valResult.warnings ? valResult.warnings.length : 0}`);

  if (!valResult.is_valid) {
    console.error('⚠️ Contoh eror validasi:');
    valResult.errors.slice(0, 5).forEach(e => console.error('  ', e));
    throw new Error('Validasi katalog master gagal!');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 KATALOG REVIEW DIBANGUN; VALIDASI STRUKTUR TIDAK MENJADI VERIFIKASI KLINIS.');
  console.log('═══════════════════════════════════════════════════════════════');
}

buildFullCatalog();
