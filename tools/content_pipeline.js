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
}

module.exports = { ContentPipeline };
