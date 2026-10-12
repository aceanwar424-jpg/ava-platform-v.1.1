/**
 * Master Test Catalog Integrity Validator (Rule §4.3)
 * Menegakkan aturan integritas data katalog master:
 * - Kunci relasional immutable (Kode Material & Nama Pemeriksaan)
 * - Panel wajib dipecah menjadi baris analit individual
 * - Variabel reference range terpisah ke kolom individual
 * - Validasi pemetaan standar LOINC (OBX-3) & UCUM (OBX-6)
 */

const REQUIRED_HEADERS = [
  "Kode Material",
  "Nama Pemeriksaan",
  "Nama Analit",
  "Operator",
  "Batas Bawah",
  "Batas Atas",
  "Jenis Nilai",
  "Kelompok Usia",
  "Jenis Kelamin",
  "LOINC (OBX-3)",
  "UCUM (OBX-6)",
];

class CatalogValidator {
  /**
   * Parse CSV sederhanan
   * @param {string} csvText
   */
  parseCSV(csvText, delimiter = ",") {
    if (![",", "\t"].includes(delimiter))
      throw Error("Delimiter katalog harus CSV atau TSV");
    if (typeof csvText !== "string" || !csvText.trim())
      return { headers: [], rows: [] };
    const records = [];
    let record = [],
      field = "",
      quoted = false;
    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      if (ch === '"') {
        if (quoted && csvText[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        record.push(field);
        field = "";
      } else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && csvText[i + 1] === "\n") i++;
        record.push(field);
        field = "";
        if (record.some((v) => v.trim())) records.push(record);
        record = [];
      } else field += ch;
    }
    if (field || record.length) {
      record.push(field);
      if (record.some((v) => v.trim())) records.push(record);
    }
    if (!records.length) return { headers: [], rows: [] };
    const headers = records[0].map((h, i) =>
      (i === 0 ? h.replace(/^\uFEFF/, "") : h).trim(),
    );
    const rows = records
      .slice(1)
      .map((values) =>
        Object.fromEntries(
          headers.map((h, idx) => [
            h,
            String(values[idx] === undefined ? "" : values[idx]),
          ]),
        ),
      );
    return { headers, rows };
  }

  /**
   * Validasi integritas katalog master
   * @param {string} csvText - Isi file CSV katalog
   * @returns {Object} Hasil Laporan Validasi
   */
  validate(csvText) {
    const { headers, rows } = this.parseCSV(csvText);
    const errors = [];
    const warnings = [];

    // 1. Validasi Kolom Wajib
    REQUIRED_HEADERS.forEach((reqHeader) => {
      if (!headers.includes(reqHeader)) {
        errors.push({
          type: "MISSING_COLUMN",
          message: `Kolom wajib '${reqHeader}' tidak ditemukan pada header CSV.`,
          severity: "CRITICAL",
        });
      }
    });

    if (errors.length > 0) {
      return {
        is_valid: false,
        total_rows: rows.length,
        errors,
        warnings,
        summary: "Gagal validasi header kolom wajib",
      };
    }

    // 2. Validasi Tiap Baris Data (Rule §4.3)
    rows.forEach((row, index) => {
      const rowNum = index + 2; // Header = baris 1

      // Rule 4.3.1: Kunci relasional tidak boleh kosong
      if (!row["Kode Material"] || !row["Nama Pemeriksaan"]) {
        errors.push({
          row: rowNum,
          type: "IMMUTABLE_KEY_EMPTY",
          message: `Baris ${rowNum}: 'Kode Material' atau 'Nama Pemeriksaan' kosong. Ini adalah kunci join yang immutable.`,
          severity: "CRITICAL",
        });
      }

      // Generic proposals deliberately contain no invented patient reference limits.
      const pending =
        row["Status Verifikasi Acuan"] === "PENDING_TENANT_REVIEW";
      if (pending) {
        if (
          !["analyte_proposal", "unresolved_master"].includes(
            row["Jenis Record"],
          ) ||
          row["Status Rentang"] !== "TENANT_METHOD_REQUIRED" ||
          !/^[a-f0-9]{64}$/.test(row["SHA256 Definisi"] || "") ||
          !row["Sumber Definisi"] ||
          !row["Versi Katalog"] ||
          (row["Jenis Record"] === "analyte_proposal" &&
            !/^AN-[A-F0-9]{24}$/.test(row["Kode Analit"] || ""))
        ) {
          errors.push({
            row: rowNum,
            type: "INVALID_REVIEW_PROVENANCE",
            severity: "CRITICAL",
            message:
              "Proposal generik wajib memiliki identity, digest, source, versi dan status review eksplisit.",
          });
        }
        if (
          [
            "Operator",
            "Batas Bawah",
            "Batas Atas",
            "Jenis Nilai",
            "Kelompok Usia",
            "Jenis Kelamin",
          ].some((k) => row[k])
        ) {
          errors.push({
            row: rowNum,
            type: "UNREVIEWED_GENERIC_RANGE",
            severity: "CRITICAL",
            message:
              "Katalog generik tidak boleh membawa rentang/metode pasien yang belum disahkan.",
          });
        }
        return;
      }

      // Rule 4.3.2: Panel wajib dipecah ke baris analit individual
      const exam = row["Nama Pemeriksaan"].toLowerCase();
      if (
        !row["Nama Analit"] ||
        (row["Nama Analit"].toLowerCase() === exam &&
          /(?:panel|paket|profil|complete blood count|\bcbc\b)/i.test(exam)) ||
        (/(?:panel|paket|profil|complete blood count|\bcbc\b)/i.test(exam) &&
          row["Nama Analit"].toLowerCase() === exam)
      ) {
        errors.push({
          row: rowNum,
          type: "UNBROKEN_PANEL_DETECTED",
          message: `Baris ${rowNum}: Peringatan analit '${row["Nama Pemeriksaan"]}'. Pastikan panel dipecah menjadi baris analit spesifik.`,
          severity: "CRITICAL",
        });
      }

      // Rule 4.3.3: Reference range terpisah
      if (!["Kuantitatif", "Kualitatif"].includes(row["Jenis Nilai"]))
        errors.push({
          row: rowNum,
          type: "INVALID_RESULT_TYPE",
          severity: "CRITICAL",
          message:
            "Jenis hasil harus Kuantitatif atau Kualitatif dengan struktur yang sesuai.",
        });
      const operator = row["Operator"].trim().toUpperCase();
      const lower = row["Batas Bawah"].trim();
      const upper = row["Batas Atas"].trim();
      const qualitative = row["Jenis Nilai"] === "Kualitatif";
      let expected;
      try {
        expected = JSON.parse(row["Nilai Diharapkan"] || "null");
      } catch {}
      if (
        qualitative
          ? operator !== "=" ||
            lower !== "" ||
            upper !== "" ||
            !Array.isArray(expected) ||
            !expected.length ||
            expected.some((v) => typeof v !== "string" || !v.trim())
          : !["<", "<=", ">", ">=", "=", "BETWEEN"].includes(operator) ||
            (operator === "BETWEEN" && (!lower || !upper)) ||
            (["<", "<="].includes(operator) && !upper) ||
            ([">", ">=", "="].includes(operator) && !lower)
      ) {
        errors.push({
          row: rowNum,
          type: "COLLAPSED_REFERENCE_RANGE",
          message: `Baris ${rowNum}: Kolom Operator/Batas Bawah/Batas Atas terkolaps atau tidak valid. Harus dipisah per kolom.`,
          severity: "CRITICAL",
        });
      }
      if (
        !qualitative &&
        ((lower !== "" && !Number.isFinite(Number(lower))) ||
          (upper !== "" && !Number.isFinite(Number(upper))) ||
          (operator === "BETWEEN" && Number(lower) > Number(upper)))
      ) {
        errors.push({
          row: rowNum,
          type: "INVALID_REFERENCE_RANGE",
          message: `Baris ${rowNum}: batas referensi harus numerik dan berurutan.`,
          severity: "CRITICAL",
        });
      }

      // Rule 4.3.4: LOINC (OBX-3) & UCUM (OBX-6)
      if (!/^\d{1,5}-\d$/.test(row["LOINC (OBX-3)"])) {
        errors.push({
          row: rowNum,
          type: "MISSING_LOINC",
          message: `Baris ${rowNum}: LOINC (OBX-3) kosong. Direkomendasikan untuk sertifikasi LIS/FHIR.`,
          severity: "CRITICAL",
        });
      }

      if (
        (!qualitative || row["UCUM (OBX-6)"]) &&
        require("../catalog/ucum_validation").validateUcum(row["UCUM (OBX-6)"])
          .status !== "valid"
      ) {
        errors.push({
          row: rowNum,
          type: "MISSING_UCUM",
          message: `Baris ${rowNum}: UCUM (OBX-6) kosong. Satuan pengukuran wajib standar LIS.`,
          severity: "CRITICAL",
        });
      }
    });

    const duplicateKeys = new Map();
    rows.forEach((row, index) => {
      const key = [
        row["Kode Material"],
        row["Nama Pemeriksaan"],
        row["Nama Analit"],
        row["Kelompok Usia"],
        row["Jenis Kelamin"],
        row["Kondisi"] || "",
      ].join("\u0000");
      if (duplicateKeys.has(key))
        errors.push({
          row: index + 2,
          type: "DUPLICATE_ANALYTE_KEY",
          message: `Baris ${index + 2}: kunci analit/kelompok berulang dengan baris ${duplicateKeys.get(key)}.`,
          severity: "CRITICAL",
        });
      else duplicateKeys.set(key, index + 2);
    });
    let unverifiedRows = 0,
      terminologyWarnings = 0,
      unprovenReviews = 0;
    rows.forEach((row, index) => {
      if (row["Status Verifikasi Acuan"] !== "VERIFIED") {
        unverifiedRows++;
        warnings.push({
          row: index + 2,
          type: "UNVERIFIED_CLINICAL_REFERENCE",
          message:
            "Hasil otomatis/unaudited belum merupakan verifikasi klinis acuan, mapping atau rentang.",
        });
      }
      // Primary reference: https://loinc.org/718-7/ (reviewed 2026-10-12).
      if (row["Status Verifikasi Acuan"] === "VERIFIED") {
        const reviewed = Date.parse(row["Tanggal Review"] || ""),
          expiry = Date.parse(row["Berlaku Sampai"] || "");
        if (
          !row["Tenant ID"] ||
          !row["Metode ID"] ||
          !row["Reviewer ID"] ||
          !row["Pembuat ID"] ||
          row["Reviewer ID"] === row["Pembuat ID"] ||
          !Number.isFinite(reviewed) ||
          reviewed > Date.now() ||
          !Number.isFinite(expiry) ||
          expiry <= Date.now() ||
          !row["Bukti Mapping"] ||
          !row["Bukti Rentang"] ||
          !row["Versi Acuan"] ||
          !/^[a-f0-9]{64}$/.test(row["SHA256 Konfigurasi"] || "")
        ) {
          unprovenReviews++;
          warnings.push({
            row: index + 2,
            type: "CLINICAL_REVIEW_EVIDENCE_MISSING",
            message:
              "Flag VERIFIED saja bukan pengesahan; tenant/metode, reviewer berbeda, bukti, versi, expiry dan digest wajib.",
          });
        }
      }
      // This narrowly detects a known mismatch; it is not a complete terminology audit.
      if (
        row["LOINC (OBX-3)"] === "718-7" &&
        !/hemoglobin|haemoglobin|\bhgb\b|\bhb\b/i.test(row["Nama Analit"] || "")
      ) {
        terminologyWarnings++;
        warnings.push({
          row: index + 2,
          type: "LOINC_ANALYTE_MISMATCH",
          message:
            "718-7 menyatakan hemoglobin; label analit ini perlu mapping ulang oleh reviewer. Kunci join tidak diubah.",
        });
      }
    });
    const isSuccess = errors.length === 0;

    return {
      is_valid: isSuccess,
      clinical_ready:
        isSuccess &&
        rows.length > 0 &&
        unverifiedRows === 0 &&
        terminologyWarnings === 0 &&
        unprovenReviews === 0,
      unverified_rows: unverifiedRows,
      total_rows: rows.length,
      critical_errors_count: errors.length,
      warnings_count: warnings.length,
      errors,
      warnings,
      summary: isSuccess
        ? `Lolos Validasi Integritas Data (${rows.length} baris analit diperiksa)`
        : `Gagal Validasi Integritas Data (${errors.length} kesalahan kritikal ditemukan)`,
    };
  }
}

module.exports = { CatalogValidator };
