/**
 * Content Pipeline Tool (Work Item P4)
 * Menghasilkan:
 * 1. Deskripsi Tes Patient-Facing (Bahasa Indonesia awam, siap-tayang di web/portal)
 * 2. Konten Otoritas LinkedIn (berdasarkan temuan audit mutu & praktik terbaik lab)
 */

class ContentPipeline {
  /**
   * Generasi Deskripsi Tes Pasien (Patient-Facing)
   * @param {Object} item - Item tes dari catalog
   * @returns {Object} Content patient-facing
   */
  generatePatientFacingDescription(item) {
    const examName = item['Nama Pemeriksaan'] || 'Pemeriksaan Laboratorium';
    const analyteName = item['Nama Analit'] || examName;
    const loinc = item['LOINC (OBX-3)'] || '-';

    return {
      title: `Panduan Pasien: ${examName}`,
      summary_awam: `Pemeriksaan ${examName} digunakan untuk menilai kesehatan ${analyteName} Anda secara akurat dan objektif.`,
      manfaat_klinis: `Membantu dokter dalam mendiagnosis, memantau respons terapi, serta melakukan evaluasi pencegahan penyakit sejak dini.`,
      persiapan_pasien: [
        'Puasa 8–10 jam sebelum pengambilan darah jika disyaratkan oleh dokter.',
        'Informasikan obat-obatan atau suplemen yang sedang dikonsumsi.',
        'Istirahat cukup dan hindari aktivitas fisik berat sebelum sampel diambil.'
      ],
      proses_sampel: 'Pengambilan darah vena steril yang dilakukan oleh analis kesehatan profesional.',
      estimasi_hasil: 'Hasil pemeriksaan umumnya selesai dalam 2–4 jam kerja.',
      tags: [examName.toLowerCase(), 'laboratorium', 'skrining kesehatan', loinc]
    };
  }

  /**
   * Generasi Draf Konten Otoritas LinkedIn (Work Item P4 & P5)
   * @param {Object} auditTopic - Topik temuan audit / ISO 15189
   * @returns {string} Post Markdown LinkedIn
   */
  generateLinkedInPost(auditTopic) {
    const topicType = auditTopic.type || 'AUDIT_LESSON';

    if (topicType === 'AUDIT_LESSON') {
      return `🚨 **Banyak Lab & Klinik Mengutip Standar Akreditasi yang Salah — Apakah Lab Anda Salah Satunya?**

Saat mengaudit dokumen mutu laboratorium klinik, kami menemukan fakta mengejutkan:
👉 **100% dokumen mengutip KMK 1128/2022 (Standar Akreditasi RUMAH SAKIT)** untuk dokumen klinik/lab mandiri!

Padahal, acuan resmi klinik adalah **KMK HK.01.07/MENKES/1983/2022**.

Temuan minor seperti salah sitasi regulasi dapat berakibat *Major Nonconformity* pada survei KAN atau LAFKESPRI.

---

💡 **3 Langkah Cepat Perbaikan Mutu Dokumen Lab:**
1️⃣ **Auditing Kode & Citasi**: Periksa kembali bab 'Dokumen Acuan' pada seluruh SOP Level 1–4.
2️⃣ **Header & Traceability Control**: Pastikan Nomor Dokumen, Revisi, dan Tanggal Efektif tercantum jelas di setiap halaman.
3️⃣ **Prosedur Spesifik, Bukan Mail-Merge**: Jangan gunakan kalimat generik — cantumkan parameter kuantitatif (suhu, waktu, batas penolakan spesimen).

Di **Akselerator Mutu Lab**, kami membantu laboratorium mentransformasi dokumen normatif menjadi **Sistem Manajemen Mutu ISO 15189:2022 Siap-Audit**.

📩 *Ingin tahu status kelaikan dokumen lab Anda? DM kami untuk Audit Kesiapan Akreditasi 1-On-1.*

#ISO15189 #AkreditasiKlinik #LaboratoriumKlinik #QualityManagement #ManagementSystem #HealthTech`;
    }

    return `🔬 **Mengapa LIS Tanpa Kode LOINC & UCUM Akan Menyulitkan Integrasi FaskES di Masa Depan?**

Banyak manajemen klinik menganggap integrasi LIS (Laboratory Information System) hanyalah soal mencetak hasil pemeriksaan. 

Namun di era interoperabilitas (HL7 v2 / FHIR / SATUSEHAT), struktur data katalog adalah **fondasi utama**:

⚠️ **3 Kesalahan Fatal Setup Katalog Tes:**
1. Menyimpan data rentang rujukan dalam 1 sel teks panjang (harus dipisah: Operator, Min, Max, Gender, Usia).
2. Membiarkan pemeriksaan Panel (seperti CBC) tanpa kode analit individual.
3. Tidak menyertakan **LOINC (OBX-3)** dan **UCUM (OBX-6)** sejak hari pertama.

Katalog terstandardisasi adalah aset bernilai tinggi yang bisa dilisensikan dan diintegrasikan tanpa perbaikan manual.

---
💡 *Kami menyediakan Master Test Catalog ~530+ tes siap-LIS yang sudah tervalidasi ISO 15189 dan FHIR.*

#LIS #HL7 #FHIR #LaboratoriumInformatika #HealthTech #SIMRS`;
  }

  /**
   * Generasi Massal (Batch) Kamus Deskripsi Pasien untuk Seluruh Katalog
   * @param {Array<Object>} catalogRows - Seluruh baris katalog
   * @returns {Object} Kamus edukasi pasien per pemeriksaan
   */
  generateBatchPatientCatalog(catalogRows) {
    if (!catalogRows || !Array.isArray(catalogRows)) return { total_tests: 0, items: [] };

    // Grouping analit per Nama Pemeriksaan
    const testMap = new Map();

    catalogRows.forEach(row => {
      const examName = row['Nama Pemeriksaan'] || 'Pemeriksaan Klinis';
      if (!testMap.has(examName)) {
        testMap.set(examName, {
          material_code: row['Kode Material'],
          exam_name: examName,
          analytes: [],
          loinc_codes: new Set(),
          specimen: 'Serum / Darah Vena'
        });
      }
      const entry = testMap.get(examName);
      if (row['Nama Analit'] && !entry.analytes.includes(row['Nama Analit'])) {
        entry.analytes.push(row['Nama Analit']);
      }
      if (row['LOINC (OBX-3)']) {
        entry.loinc_codes.add(row['LOINC (OBX-3)']);
      }
    });

    const patientCatalog = [];

    testMap.forEach((val, examName) => {
      const isFasting = /glukosa|lipid|kolesterol|trigliserida|asam urat/i.test(examName);
      const isUrinalysis = /urin|urine/i.test(examName);
      const sampleType = isUrinalysis ? 'Urin Pagi Porsi Tengah (Clean-Catch Midstream)' : 'Darah Vena Steril (Tabung Vakum)';

      patientCatalog.push({
        kode_material: val.material_code,
        nama_pemeriksaan: examName,
        judul_panduan: `Panduan Pasien: ${examName}`,
        penjelasan_awam: `Pemeriksaan ${examName} adalah tes laboratorium yang mengukur parameter ${val.analytes.slice(0, 4).join(', ')}${val.analytes.length > 4 ? ' dan parameter terkait lainnya' : ''} untuk mengevaluasi fungsi fisiologis tubuh.`,
        tujuan_klinis: `Membantu dokter mengevaluasi kondisi kesehatan secara menyeluruh, skrining dini kelainan metabolisme atau organ, serta memantau efektivitas pengobatan.`,
        persiapan_sebelum_tes: [
          isFasting ? 'Wajib berpuasa 10–12 jam sebelum pengambilan sampel (hanya boleh minum air putih netral).' : 'Tidak diwajibkan puasa khusus kecuali diinstruksikan oleh dokter pengirim.',
          'Hindari konsumsi alkohol, merokok, dan latihan fisik berat minimal 24 jam sebelum tes.',
          'Beri tahu petugas laboratorium mengenai obat rutin atau suplemen yang sedang dikonsumsi.'
        ],
        jenis_spesimen: sampleType,
        waktu_selesai_standar: '2–4 Jam Kerja',
        loinc_references: Array.from(val.loinc_codes),
        tags: [examName.toLowerCase(), 'edukasi-pasien', 'laboratorium-klinik', 'iso-15189']
      });
    });

    return {
      generated_at: new Date().toISOString(),
      total_examinations: patientCatalog.length,
      catalog: patientCatalog
    };
  }

  /**
   * Generasi Kalender Editorial Konten Otoritas LinkedIn (4 Minggu)
   * @returns {string} Konten Kalender Markdown LinkedIn
   */
  generateLinkedInEditorialCalendar() {
    let md = `# KALENDER EDITORIAL OTORITAS LINKEDIN (AKSELERATOR LAB)\n\n`;
    md += `Diproduksi otomatis untuk membangun otoritas B2B klinik & laboratorium klinik.\n\n`;

    const weeks = [
      {
        week: 'Minggu 1: Fondasi Mutu & Interoperabilitas LIS',
        topic: 'LIS Tanpa Standar LOINC (OBX-3) & UCUM (OBX-6)',
        hook: '🚨 Mengapa 80% Faskes Kesulitan Saat Diminta Mengirimkan Data Laboratorium ke Platform Interoperabilitas Nasional?',
        cta: 'Konsultasi Katalog Siap-LIS'
      },
      {
        week: 'Minggu 2: Audit Trail & Regulasi ISO 15189:2022',
        topic: 'Salah Kutip Standar Akreditasi pada Dokumen Mutu',
        hook: '⚠️ Banyak Lab Klinik Masih Mengutip Standar Akreditasi Rumah Sakit (KMK 1128/2022) pada SOP Internal Mereka.',
        cta: 'Audit Gap Analysis Dokumen SMM'
      },
      {
        week: 'Minggu 3: Tata Kelola Pra-Analitik & Kriteria Penolakan',
        topic: 'Biaya Tersembunyi dari Penolakan Sampel Hemolisis & Lipemik',
        hook: '🩸 70% Kesalahan Hasil Laboratorium Terjadi di Meja Flebotomi, Bukan di Mesin Analyzer.',
        cta: 'SOP Flebotomi & Order of Draw Standar CLSI'
      },
      {
        week: 'Minggu 4: Manajemen Nilai Kritis & Keselamatan Pasien',
        topic: 'Waktu Tanggap Pelaporan Nilai Kritis < 15 Menit',
        hook: '⏱️ Berapa Menit Waktu yang Dibutuhkan Lab Anda dari Pembacaan Glukosa 35 mg/dL Hingga Diterima Dokter Jaga?',
        cta: 'Sistem Alert Nilai Kritis Berbasis LIS'
      }
    ];

    weeks.forEach((w, idx) => {
      md += `### 📅 ${w.week}\n`;
      md += `- **Topik Utama:** ${w.topic}\n`;
      md += `- **Hook Pembuka:** *${w.hook}*\n`;
      md += `- **Inti Edukasi:** Menyajikan data komparatif operasional, klausul ISO 15189 terkait, dan solusi teknis terukur.\n`;
      md += `- **Call To Action:** *${w.cta}*\n\n`;
      md += `---\n\n`;
    });

    return md;
  }
}

module.exports = { ContentPipeline };

