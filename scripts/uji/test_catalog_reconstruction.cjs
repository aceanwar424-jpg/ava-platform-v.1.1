// OWNED_BY: generic. Source reconstruction and negative integrity checks, no runtime records.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const {
  readSeedSources,
  literals,
  normalizeUnit,
  hash,
} = require("../../lib/catalog/seed_catalog");
const {
  buildGenericCatalog,
  reviewRows,
  validateBundle,
} = require("../../lib/catalog/generic_catalog");
const { CatalogValidator } = require("../../lib/validator/catalog_validator"),
  { LISExporter } = require("../../lib/exporter/lis_exporter");
const sources = Array.from({ length: 8 }, (_, i) => {
  const file =
    "ava-platform/sql_arsip/06_seed_data/supabase_seed_part0" +
    (i + 1) +
    ".sql";
  return { file, text: fs.readFileSync(file, "utf8") };
});
const source = readSeedSources(sources),
  metadata = JSON.parse(
    fs.readFileSync("data/catalog/loinc_primary_metadata.json", "utf8"),
  ),
  baseline = JSON.parse(
    fs.readFileSync("data/catalog/catalog_legacy_index.json", "utf8"),
  );
const b = buildGenericCatalog(source, metadata, baseline.rows),
  v = new CatalogValidator(),
  ex = new LISExporter();
let count = 0;
function check(name, fn) {
  fn();
  count++;
  console.log("PASS " + name);
}
check(
  "all 633 legacy rows and 532 immutable examination joins accounted",
  () => {
    assert.equal(b.coverage.length, 633);
    assert.equal(b.masters.length, 532);
    assert.deepEqual(
      new Set(
        b.masters.map((p) =>
          JSON.stringify([p.material_code, p.examination_name]),
        ),
      ),
      new Set(
        baseline.rows.map((p) =>
          JSON.stringify([p["Kode Material"], p["Nama Pemeriksaan"]]),
        ),
      ),
    );
    assert.deepEqual(
      b.coverage.map((r) => r.legacy_sha256),
      baseline.rows.map((r) => r.legacy_sha256),
    );
  },
);
check(
  "all eight seed parts restore CBC and distinct source analyte codes",
  () => {
    assert.equal(b.analytes.length, 682);
    assert.equal(
      b.masters.find((p) => p.material_code === "ODL1001-RGN-0001").components
        .length,
      8,
    );
    assert.equal(
      b.masters.find((p) => p.material_code === "ODL1001-RGN-0003").components
        .length,
      14,
    );
    assert.equal(new Set(b.analytes.map((a) => a.code)).size, 682);
    assert.ok(
      b.analytes
        .find(
          (a) =>
            a.source_product_code === "ODL1001-RGN-0001" &&
            a.source_item_code === "HB",
        )
        .name.includes("Hemoglobin"),
    );
  },
);
check(
  "exact null reference values and source contradictions retained outside clinical export",
  () => {
    assert.equal(source.ranges.length, 1774);
    assert.equal(
      source.ranges.filter((r) => r.lower === null && r.upper === null).length,
      722,
    );
    assert.equal(b.summary.source_range_conflicts, 81);
    assert.ok(
      b.analytes.every(
        (a) => a.reference.lower === null && a.reference.upper === null,
      ),
    );
  },
);
check(
  "no category/default code, reference interval, or source price exported",
  () => {
    assert.ok(!/harga_normal|price|harga_normal/.test(JSON.stringify(b)));
    assert.ok(
      b.analytes.every(
        (a) =>
          a.terminology.proposed_code === null ||
          source.items.some(
            (i) =>
              i.source_product_code === a.source_product_code &&
              i.source_item_code === a.source_item_code &&
              i.source_loinc === a.terminology.proposed_code,
          ),
      ),
    );
    assert.equal(normalizeUnit("Kuantitatif"), null);
    assert.equal(normalizeUnit("mg/mg (mg/g)"), null);
    assert.equal(normalizeUnit("10^3/µL"), "10*3/uL");
  },
);
check(
  "primary terminology lookup does not assert clinical matching or reference verification",
  () => {
    assert.equal(metadata.terms.length, 415);
    assert.equal(
      metadata.terms.filter((t) => t.lookup_status === "FOUND").length,
      363,
    );
    assert.equal(b.clinical_ready, false);
    assert.ok(
      b.analytes.every((a) => a.terminology.state === "TENANT_REVIEW_REQUIRED"),
    );
    assert.ok(
      b.analytes
        .filter((a) => a.terminology.proposed_code)
        .every((a) => a.terminology.source_url && a.terminology.sha256),
    );
    assert.ok(
      b.analytes
        .filter((a) => !a.terminology.proposed_code)
        .every((a) => a.warnings.includes("PRIMARY_TERM_UNRESOLVED")),
    );
  },
);
check(
  "undefined masters and composite placeholders remain visible and cannot become normal analytes",
  () => {
    assert.equal(
      b.masters.filter((p) => p.definition_state === "UNDEFINED_COMPONENTS")
        .length,
      4,
    );
    assert.ok(
      b.analytes.some((a) =>
        a.warnings.includes("POSSIBLE_UNEXPANDED_COMPOSITE"),
      ),
    );
    assert.ok(
      !b.analytes
        .find((a) => a.name.includes("profilaksis"))
        .warnings.includes("POSSIBLE_UNEXPANDED_COMPOSITE"),
    );
  },
);
check(
  "rebuild deterministic and changed source/analyte/membership detected",
  () => {
    assert.equal(
      buildGenericCatalog(source, metadata, baseline.rows).sha256,
      b.sha256,
    );
    assert.equal(validateBundle(b), true);
    let c = structuredClone(b);
    c.analytes[0].name = "tampered";
    assert.throws(() => validateBundle(c), /digest/);
    c = structuredClone(b);
    c.mapping[0].analyte_code = "AN-UNKNOWN";
    delete c.sha256;
    c.sha256 = hash(c);
    assert.throws(() => validateBundle(c), /Orphan/);
  },
);
check(
  "generic CSV TSV and XLS share rows and keep clinical bounds blank",
  () => {
    const rows = reviewRows(b),
      csv = ex.export(rows, { format: "csv" }),
      tsv = ex.export(rows, { format: "tsv" });
    assert.equal(rows.length, 686);
    assert.deepEqual(v.parseCSV(csv).rows, v.parseCSV(tsv, "\t").rows);
    assert.equal(v.validate(csv).is_valid, true);
    assert.equal(v.validate(csv).clinical_ready, false);
    assert.ok(
      rows.every((r) => !r.Operator && !r["Batas Bawah"] && !r["Batas Atas"]),
    );
    assert.equal(
      (ex.export(rows, { format: "excel_xml" }).match(/<Row /g) || []).length,
      687,
    );
    assert.equal(
      fs.readFileSync("data/catalog/catalog_generic.csv", "utf8"),
      csv,
    );
    assert.throws(
      () => ex.export(rows, { purpose: "clinical_import" }),
      /clinical-ready/,
    );
  },
);
check("fake review row or generated patient interval rejected", () => {
  const rows = reviewRows(b);
  const fake = { ...rows[0], "SHA256 Definisi": "fake" };
  assert.equal(v.validate(ex.export([fake])).is_valid, false);
  const numeric = {
    ...rows[0],
    Operator: "BETWEEN",
    "Batas Bawah": "0",
    "Batas Atas": "100",
  };
  assert.ok(
    v
      .validate(ex.export([numeric]))
      .errors.some((e) => e.type === "UNREVIEWED_GENERIC_RANGE"),
  );
});
check(
  "source escaped literals parsed without SQL execution and orphan sources rejected",
  () => {
    assert.deepEqual(literals("'Test, O''Brien',NULL,0,true"), [
      "Test, O'Brien",
      null,
      0,
      true,
    ]);
    assert.throws(() => literals("'unclosed"), /Unterminated/);
    assert.throws(
      () =>
        readSeedSources([
          {
            file: "synthetic.sql",
            text: "INSERT INTO public.product_items (product_id,code,name_id,uom,loinc_code,display_order,result_type,is_active) SELECT p.id,'X','Synthetic','mg/dL','2345-7',1,'numeric',true FROM public.products p WHERE p.kode_internal='ORPHAN';",
          },
        ]),
      /Orphan/,
    );
    const escaped = v.parseCSV(
      ex.export([
        {
          "Kode Material": " 01",
          "Nama Pemeriksaan": "O'Brien, test\nsecond line",
          other: '"quoted"',
        },
      ]),
    );
    assert.equal(escaped.rows[0]["Kode Material"], " 01");
    assert.equal(
      escaped.rows[0]["Nama Pemeriksaan"],
      "O'Brien, test\nsecond line",
    );
  },
);
console.log(
  count +
    " catalog reconstruction scenarios passed; no dummy database or test artifacts created",
);
