// OWNED_BY: generic. Review artifact gates; no clinical certification or real data tests.
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { CatalogValidator } = require("../../lib/validator/catalog_validator"),
  { LISExporter } = require("../../lib/exporter/lis_exporter");
const validator = new CatalogValidator(),
  exporter = new LISExporter(),
  csv = fs.readFileSync("data/catalog/catalog_generic.csv", "utf8"),
  rows = validator.parseCSV(csv).rows,
  result = validator.validate(csv);
assert.equal(result.critical_errors_count, 0);
assert.equal(result.clinical_ready, false);
assert.equal(result.unverified_rows, rows.length);
assert.ok(
  rows.every((r) => r["Status Verifikasi Acuan"] === "PENDING_TENANT_REVIEW"),
);
assert.throws(
  () => exporter.export(rows, { format: "csv", purpose: "clinical_import" }),
  /belum clinical-ready/,
);
assert.throws(
  () =>
    exporter.export(rows, { format: "csv", includeAuditTraceability: false }),
  /status audit/,
);
console.log(
  "PASS generic catalog cannot become clinical import or lose audit flags",
);
const copy = validator.parseCSV(
  exporter.export(rows, { format: "csv", purpose: "review" }),
).rows;
assert.deepEqual(
  copy.map((r) => [r["Kode Material"], r["Nama Pemeriksaan"]]),
  rows.map((r) => [r["Kode Material"], r["Nama Pemeriksaan"]]),
);
assert.ok(
  copy.every((r) => !r.Operator && !r["Batas Bawah"] && !r["Batas Atas"]),
);
console.log(
  "PASS review export retains immutable join keys without generated patient ranges",
);
const wrong = {
  ...rows[0],
  "Status Verifikasi Acuan": "VERIFIED",
  "LOINC (OBX-3)": "718-7",
  "Nama Analit": "Darah Lengkap (Hemogram)",
  Operator: "BETWEEN",
  "Batas Bawah": "0",
  "Batas Atas": "1",
};
const wrongResult = validator.validate(
  exporter.export([wrong], { format: "csv" }),
);
assert.equal(wrongResult.clinical_ready, false);
assert.ok(
  wrongResult.warnings.some((w) => w.type === "LOINC_ANALYTE_MISMATCH"),
);
assert.ok(
  wrongResult.warnings.some(
    (w) => w.type === "CLINICAL_REVIEW_EVIDENCE_MISSING",
  ),
);
console.log(
  "PASS wrong clinical label and VERIFIED flag cannot replace method review evidence",
);
