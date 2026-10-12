/**
 * CLI Tool: Ekspor Dokumen SMM & E-Hasil ke PDF Biner A4
 * Penggunaan:
 *   node scripts/export_doc_pdf.cjs --type smm --tenant config/tenant.klinik-medika.json --output artifacts/pdf/smm_medika.pdf
 *   node scripts/export_doc_pdf.cjs --type result --tenant config/tenant.laboratorium-sentosa.json --output artifacts/pdf/hasil_sentosa.pdf
 */

const fs = require('fs');
const path = require('path');
const { PdfExporter } = require('../lib/template_engine/pdf_exporter');
const { SMMPackAssembler } = require('../lib/assembler/smm_pack_assembler');
const { TemplateManager } = require('../lib/template_engine/template_manager');

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag, def) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
  };

  const docType = getArg('--type', 'result'); // 'result' | 'smm' | 'html'
  const tenantFile = getArg('--tenant', 'config/tenant.klinik-medika.json');
  const presetKey = getArg('--preset', null);
  const inputFile = getArg('--input', null);
  const outputFile = getArg('--output', path.join('artifacts', 'pdf', `export_${docType}_${Date.now()}.pdf`));

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   🖨️  HEADLESS PDF EXPORTER — ISO 15189:2022 LAB ENGINE       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(tenantFile) && docType !== 'html') {
    console.error(`❌ File konfigurasi tenant tidak ditemukan: ${tenantFile}`);
    process.exit(1);
  }

  const tenantConfig = fs.existsSync(tenantFile) ? JSON.parse(fs.readFileSync(tenantFile, 'utf8')) : {};
  const templateMgr = new TemplateManager();
  const customLayout = presetKey ? templateMgr.getPreset(presetKey) : {};
  const exporter = new PdfExporter();

  const outDir = path.dirname(path.resolve(outputFile));
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const startTime = Date.now();
  console.log(`▶ Memproses ekspor tipe: [${docType.toUpperCase()}]`);
  console.log(`  - Tenant: ${tenantConfig.lab_info?.name || 'Generic Tenant'}`);
  console.log(`  - Target Output: ${outputFile}`);

  try {
    if (docType === 'smm') {
      const assembler = new SMMPackAssembler();
      const smmPack = assembler.assemble(tenantConfig);
      await exporter.exportSmmBundleToPdf(smmPack, tenantConfig, outputFile, customLayout);
    } else if (docType === 'result') {
      const sampleResult = {
        nomor_lab: `LAB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0042`,
        tanggal_periksa: new Date().toISOString().slice(0, 10),
        waktu_ambil: '08:30 WIB',
        waktu_selesai: '10:15 WIB',
        pasien: {
          nama: 'Tn. Hendra Wijaya',
          rekam_medis: 'RM-2026-9901',
          nik: '3171012345670001',
          jenis_kelamin: 'Laki-laki',
          tanggal_lahir: '1982-04-12',
          usia: '44 Tahun',
          dokter_perujuk: 'dr. Siti Aminah, Sp.PD',
          ruangan: 'Poliklinik Penyakit Dalam'
        },
        items: [
          {
            test_name: 'Glukosa Darah Sewaktu',
            loinc: '2345-7',
            result: '118',
            unit: 'mg/dL',
            ref_range: '< 200',
            flag: 'NORMAL',
            method: 'Heksokinase'
          },
          {
            test_name: 'Kolesterol Total',
            loinc: '2093-3',
            result: '235',
            unit: 'mg/dL',
            ref_range: '< 200',
            flag: 'HIGH',
            method: 'CHOD-PAP'
          },
          {
            test_name: 'Trigliserida',
            loinc: '2571-8',
            result: '145',
            unit: 'mg/dL',
            ref_range: '< 150',
            flag: 'NORMAL',
            method: 'GPO-PAP'
          },
          {
            test_name: 'Hemoglobin',
            loinc: '718-7',
            result: '14.8',
            unit: 'g/dL',
            ref_range: '13.0 - 17.0',
            flag: 'NORMAL',
            method: 'SLS-Hemoglobin'
          },
          {
            test_name: 'Leukosit',
            loinc: '6690-2',
            result: '7.400',
            unit: '/µL',
            ref_range: '4.000 - 10.000',
            flag: 'NORMAL',
            method: 'Impedansi'
          }
        ],
        catatan_klinis: 'Kadar kolesterol total meningkat ringan. Disarankan evaluasi profil lipid puasa lengkap.'
      };

      await exporter.exportLabResultToPdf(sampleResult, tenantConfig, outputFile, customLayout);
    } else if (docType === 'html') {
      if (!inputFile || !fs.existsSync(inputFile)) {
        console.error(`❌ File input HTML tidak ditemukan: ${inputFile}`);
        process.exit(1);
      }
      const rawHtml = fs.readFileSync(inputFile, 'utf8');
      await exporter.generatePdfFromHtml(rawHtml, { outputPath: outputFile });
    } else {
      throw new Error(`Tipe dokumen tidak dikenal: ${docType}`);
    }

    const elapsedMs = Date.now() - startTime;
    const stats = fs.statSync(outputFile);
    console.log(`\n✅ SUKSES: File PDF berhasil dihasilkan (${(stats.size / 1024).toFixed(1)} KB) dalam ${elapsedMs}ms`);
    console.log(`📁 Lokasi: ${outputFile}\n`);
  } catch (err) {
    console.error(`❌ GAGAL melakukan ekspor PDF:`, err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
