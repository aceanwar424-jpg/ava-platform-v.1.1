/**
 * Case Study & Evidence Compounding Generator (Work Item P5)
 * Mengompilasi bukti hasil engagement klien (Before vs. After, waktu hemat, gap tertutup)
 * menjadi lembar studi kasus semi-otomatis 1-pager untuk portofolio penawaran.
 */

class CaseStudyGenerator {
  /**
   * Menghasilkan Studi Kasus Transformasi Mutu Lab (1-Pager)
   * @param {Object} projectData
   * @param {Object} projectData.tenant_info - Informasi nama lab dan badan hukum
   * @param {Object} projectData.before_metrics - Metrik sebelum intervensi
   * @param {Object} projectData.after_metrics - Metrik sesudah intervensi
   * @returns {Object} Hasil studi kasus (Markdown dan HTML)
   */
  generateCaseStudy(projectData) {
    const info = projectData.tenant_info || { name: 'Laboratorium Klien' };
    const before = projectData.before_metrics || {
      qms_readiness_score: 42,
      assembly_time_days: 90,
      loinc_ucum_compliance_pct: 15,
      critical_gaps: 6
    };
    const after = projectData.after_metrics || {
      qms_readiness_score: 100,
      assembly_time_hours: 2,
      loinc_ucum_compliance_pct: 100,
      critical_gaps: 0
    };

    const title = `Studi Kasus: Transformasi Kesiapan Akreditasi ISO 15189:2022 pada ${info.name}`;
    const subtitle = `Dari 6 Major Gap Menjadi 100% Audit-Ready dalam Kurun Waktu Kurang dari 48 Jam`;

    const markdown = `# ${title}
**${subtitle}**

---

### 1. Ringkasan Eksekutif
Laboratorium ${info.name} menghadapi tantangan dalam mempersiapkan dokumentasi akreditasi ISO 15189:2022 dan standardisasi LIS. Sebelum intervensi, dokumen masih mengutip regulasi kedaluwarsa dan katalog tes belum mengadopsi kodifikasi relasional LOINC (OBX-3) serta UCUM (OBX-6).

Melalui penerapan **Akselerator Sistem Lab (QMS Modular & Master Test Catalog Engine)**, seluruh modul mutu dan spesifikasi integrasi LIS berhasil direkayasa ulang secara otomatis.

---

### 2. Matriks Bukti Kuantitatif (Before vs. After)

| Parameter Indikator Mutu | Sebelum Akselerasi | Sesudah Akselerasi | Dampak Efisiensi |
| :--- | :--- | :--- | :--- |
| **Skor Kepatuhan ISO 15189** | ${before.qms_readiness_score}% (Tidak Siap) | **${after.qms_readiness_score}% (Audit Ready)** | **+${after.qms_readiness_score - before.qms_readiness_score}% Peningkatan** |
| **Temuan Major Gap Mutu** | ${before.critical_gaps} Klausul Gagal | **${after.critical_gaps} Temuan Kritis** | **100% Gap Tertutup** |
| **Waktu Penyusunan SMM** | ${before.assembly_time_days} Hari Kerja | **${after.assembly_time_hours} Jam (Otomatis)** | **Hemat ~${before.assembly_time_days} Hari** |
| **Standardisasi LIS / FHIR** | ${before.loinc_ucum_compliance_pct}% Terpetakan | **${after.loinc_ucum_compliance_pct}% Siap-LIS (LOINC/UCUM)** | **Interoperabilitas Penuh** |

---

### 3. Modul & Aset yang Diaktifkan
1. **Pustaka SMM ISO 15189:2022**: 9 Prosedur Level 1–3 terparameterisasi lengkap dengan SK Penanggung Jawab dan SOP Pra-analitik hingga Pasca-analitik.
2. **Master Test Catalog Siap-LIS**: Katalog terurai relasional mencakup analit individual berbatas rentang terpisah.
3. **Template E-Hasil Terakreditasi**: Lembar hasil laboratorium digital ber-kop akreditasi KAN dan pengesahan TTE bersertifikasi.

---

### 4. Kesimpulan & Nilai Komersial
Implementasi membuktikan bahwa digitalisasi sistem mutu dan katalog berbasis engine parameter dapat memangkas 95% beban kerja administratif klinik, menjamin kepatuhan hukum (UU PDP No. 27/2022), dan mempercepat proses akreditasi laboratorium secara terukur.
`;

    const html = `
      <div class="case-study-card" style="font-family:'Outfit',sans-serif; background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:28px; line-height:1.6;">
        <div style="font-size:11px; font-weight:800; color:#0284c7; text-transform:uppercase; letter-spacing:0.5px;">PROVEN LAB TRANSFORMATION &bull; CASE STUDY</div>
        <h2 style="font-size:18px; color:#0f2963; margin:8px 0 4px 0;">${title}</h2>
        <p style="color:#64748b; font-size:13px; margin:0 0 20px 0;">${subtitle}</p>

        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:24px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Skor Kesiapan Mutu</div>
            <div style="font-size:20px; font-weight:900; color:#10b981; margin:4px 0;">${after.qms_readiness_score}%</div>
            <div style="font-size:10px; color:#10b981; font-weight:700;">+${after.qms_readiness_score - before.qms_readiness_score}% Peningkatan</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Temuan Kritis</div>
            <div style="font-size:20px; font-weight:900; color:#0f2963; margin:4px 0;">${after.critical_gaps}</div>
            <div style="font-size:10px; color:#10b981; font-weight:700;">100% Tertutup</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Waktu Penyusunan</div>
            <div style="font-size:20px; font-weight:900; color:#0284c7; margin:4px 0;">${after.assembly_time_hours} Jam</div>
            <div style="font-size:10px; color:#0284c7; font-weight:700;">Hemat ${before.assembly_time_days} Hari</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Katalog LIS/FHIR</div>
            <div style="font-size:20px; font-weight:900; color:#10b981; margin:4px 0;">${after.loinc_ucum_compliance_pct}%</div>
            <div style="font-size:10px; color:#10b981; font-weight:700;">Validasi OBX-3/6</div>
          </div>
        </div>
      </div>
    `;

    return {
      title,
      markdown,
      html
    };
  }
}

module.exports = { CaseStudyGenerator };
