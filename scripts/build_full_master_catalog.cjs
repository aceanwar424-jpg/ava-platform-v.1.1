// OWNED_BY: generic. Authorized source extraction; proposals never become approved medical limits.
const fs = require("node:fs"),
  path = require("node:path");
const { readSeedSources } = require("../lib/catalog/seed_catalog");
const {
  buildGenericCatalog,
  reviewRows,
  validateBundle,
} = require("../lib/catalog/generic_catalog");
const { CatalogValidator } = require("../lib/validator/catalog_validator"),
  { LISExporter } = require("../lib/exporter/lis_exporter");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, "data/catalog");
function build() {
  const sources = Array.from({ length: 8 }, (_, i) => {
    const file =
      "ava-platform/sql_arsip/06_seed_data/supabase_seed_part0" +
      (i + 1) +
      ".sql";
    return { file, text: fs.readFileSync(path.join(root, file), "utf8") };
  });
  const source = readSeedSources(sources),
    metadata = JSON.parse(
      fs.readFileSync(path.join(dir, "loinc_primary_metadata.json"), "utf8"),
    ),
    baseline = JSON.parse(
      fs.readFileSync(path.join(dir, "catalog_legacy_index.json"), "utf8"),
    );
  const bundle = buildGenericCatalog(source, metadata, baseline.rows);
  validateBundle(bundle);
  const rows = reviewRows(bundle),
    exporter = new LISExporter(),
    csv = exporter.export(rows, { format: "csv" }),
    validation = new CatalogValidator().validate(csv);
  if (!validation.is_valid || validation.clinical_ready)
    throw Error(
      "Generic review artifact validation failed: " +
        JSON.stringify(validation.errors.slice(0, 3)),
    );
  const files = {
    "catalog_master.json": JSON.stringify(bundle, null, 2) + "\n",
    "catalog_source_ranges_review.json":
      JSON.stringify(
        {
          owned_by: "generic",
          state: "UNREVIEWED_SOURCE_ONLY",
          clinical_import: false,
          version: bundle.version,
          note: "Source values preserved exactly, including nulls and conflicts. Not normative or import-ready; tenant professional must validate IFU/method/population.",
          ranges: source.ranges,
        },
        null,
        2,
      ) + "\n",
    "catalog_generic.csv": csv,
    "catalog_generic.tsv": exporter.export(rows, { format: "tsv" }),
    "catalog_generic.xls": exporter.export(rows, { format: "excel_xml" }),
    "catalog_hl7_spec_sample.md":
      "# Katalog generik — proposal, bukan impor klinis\n\nVersi " +
      bundle.version +
      "\n\nMapping standar: OBX-3 = LOINC; OBX-6 = UCUM. Kode/unit di bawah masih proposal, tanpa rentang pasien. Pengesahan tenant/metode diperlukan.\n\n" +
      rows
        .slice(0, 50)
        .map(
          (r) =>
            "- " +
            r["Kode Analit"] +
            " | " +
            r["Nama Analit"] +
            " | LOINC proposal " +
            (r["LOINC (OBX-3)"] || "belum terdefinisi") +
            " | UCUM proposal " +
            (r["UCUM (OBX-6)"] || "belum terdefinisi"),
        )
        .join("\n") +
      "\n",
  };
  for (const [file, content] of Object.entries(files))
    fs.writeFileSync(path.join(dir, file), content);
  console.log(
    JSON.stringify(
      {
        ...bundle.summary,
        review_rows: rows.length,
        structural_errors: validation.errors.length,
        clinical_ready: validation.clinical_ready,
        bundle_sha256: bundle.sha256,
      },
      null,
      2,
    ),
  );
  return bundle;
}
if (require.main === module) build();
module.exports = { build };
