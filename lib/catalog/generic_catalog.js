// OWNED_BY: generic. Source reconstruction and proposals are separate from clinical approval.
const { hash, normalizeUnit } = require("./seed_catalog");
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim();
function buildGenericCatalog(source, metadata, legacyRows) {
  const terms = new Map(metadata.terms.map((t) => [t.code, t]));
  const masters = source.products.map((p) => ({
    ...p,
    owned_by: "generic",
    permission: "Owner confirmed source reuse 2026-10-12",
    components: [],
    definition_state: "SOURCE_COMPONENTS_AVAILABLE",
  }));
  const byCode = new Map(masters.map((p) => [p.source_product_code, p]));
  const analytes = [],
    codes = new Set();
  for (const item of source.items) {
    const master = byCode.get(item.source_product_code);
    const code =
      "AN-" +
      hash([item.source_product_code, item.source_item_code])
        .slice(0, 24)
        .toUpperCase();
    if (codes.has(code)) throw Error("Analyte code collision");
    codes.add(code);
    const term = terms.get(item.source_loinc),
      warnings = [];
    if (term?.lookup_status !== "FOUND")
      warnings.push("PRIMARY_TERM_UNRESOLVED");
    if (!normalizeUnit(item.source_unit)) warnings.push("UNIT_NOT_DEFINED");
    if (/\b(?:panel|multiplex|profil|profile|parameters?)\b/i.test(item.name))
      warnings.push("POSSIBLE_UNEXPANDED_COMPOSITE");
    const refs = source.ranges.filter(
      (r) =>
        r.source_product_code === item.source_product_code &&
        r.source_item_code === item.source_item_code,
    );
    if (
      refs.some((r) => r.value_type === "qualitative") &&
      item.result_type === "numeric"
    )
      warnings.push("RESULT_TYPE_SOURCE_CONFLICT");
    const rangeGroups = new Map();
    for (const r of refs) {
      const key = JSON.stringify([
        r.value_type,
        r.condition_name,
        r.condition_type,
        r.sex,
        r.age_min,
        r.age_max,
      ]);
      const fingerprint = JSON.stringify([
        r.lower,
        r.upper,
        r.expected_values,
        r.source_unit,
      ]);
      if (!rangeGroups.has(key)) rangeGroups.set(key, new Set());
      rangeGroups.get(key).add(fingerprint);
    }
    if ([...rangeGroups.values()].some((g) => g.size > 1))
      warnings.push("REFERENCE_SOURCE_CONFLICT");
    const analyte = {
      code,
      source_product_code: item.source_product_code,
      source_item_code: item.source_item_code,
      name: item.name,
      source: item.source,
      source_result_type: item.result_type,
      terminology: {
        state: "TENANT_REVIEW_REQUIRED",
        proposed_code:
          term?.lookup_status === "FOUND" ? item.source_loinc : null,
        source_code: item.source_loinc,
        primary_name: term?.long_name ?? null,
        component: term?.COMPONENT ?? null,
        property: term?.PROPERTY ?? null,
        method: term?.METHOD_TYP ?? null,
        primary_units: term?.units ?? [],
        primary_datatype: term?.datatype ?? null,
        source_url: term?.canonical_url ?? null,
        accessed_at: term?.accessed_at ?? null,
        sha256: term?.sha256 ?? null,
      },
      unit: {
        source: item.source_unit,
        proposed_ucum: normalizeUnit(item.source_unit),
        state: "TENANT_REVIEW_REQUIRED",
      },
      reference: {
        state: "TENANT_METHOD_REQUIRED",
        source_range_count: refs.length,
        operator: null,
        lower: null,
        upper: null,
        age_min: null,
        age_max: null,
        sex: null,
        evidence: null,
      },
      warnings,
    };
    analyte.sha256 = hash(analyte);
    analytes.push(analyte);
    master.components.push(code);
  }
  for (const p of masters)
    if (!p.components.length) p.definition_state = "UNDEFINED_COMPONENTS";
  const keys = new Set(
    masters.map((p) => JSON.stringify([p.material_code, p.examination_name])),
  );
  const legacyKeys = new Set(
    legacyRows.map((r) =>
      JSON.stringify([r["Kode Material"], r["Nama Pemeriksaan"]]),
    ),
  );
  for (const key of legacyKeys)
    if (!keys.has(key)) throw Error("Immutable legacy join key would be lost");
  if (keys.size !== legacyKeys.size)
    throw Error("Unexpected product identity change");
  const mapping = masters.flatMap((p) =>
    p.components.map((code, index) => ({
      material_code: p.material_code,
      examination_name: p.examination_name,
      analyte_code: code,
      order: index + 1,
      state: "SOURCE_DEFINITION_REVIEW_REQUIRED",
    })),
  );
  const coverage = legacyRows.map((r, index) => {
    const master = masters.find(
      (p) =>
        p.material_code === r["Kode Material"] &&
        p.examination_name === r["Nama Pemeriksaan"],
    );
    return {
      legacy_row: index + 2,
      legacy_sha256: r.legacy_sha256 || hash(r),
      material_code: master.material_code,
      examination_name: master.examination_name,
      component_codes: master.components,
      disposition: master.components.length
        ? "RECONSTRUCTED_FROM_COMPLETE_SOURCE"
        : "MASTER_PRESERVED_DEFINITION_REQUIRED",
    };
  });
  const summary = {
    legacy_rows_accounted: coverage.length,
    products: masters.length,
    source_analytes: analytes.length,
    mappings: mapping.length,
    undefined_masters: masters.filter((p) => !p.components.length).length,
    primary_terms_found: analytes.filter((a) => a.terminology.proposed_code)
      .length,
    source_range_conflicts: analytes.filter((a) =>
      a.warnings.includes("REFERENCE_SOURCE_CONFLICT"),
    ).length,
    clinical_ready: false,
  };
  const bundle = {
    version: "2.0-20261012",
    owned_by: "generic",
    mode: "GENERIC_REVIEW",
    clinical_ready: false,
    license_notice: "LOINC_short_license.txt",
    sourceFiles: source.sourceFiles,
    terminology_source: {
      api: metadata.api_documentation,
      distribution_version: metadata.distribution_version,
      version_note: metadata.version_note,
    },
    masters,
    analytes,
    mapping,
    coverage,
    summary,
  };
  bundle.sha256 = hash(bundle);
  return bundle;
}
function reviewRows(bundle) {
  const index = new Map(bundle.analytes.map((a) => [a.code, a]));
  return bundle.masters.flatMap((p) =>
    (p.components.length ? p.components : [null]).map((code) => {
      const a = index.get(code);
      return {
        "Kode Material": p.material_code,
        "Nama Pemeriksaan": p.examination_name,
        "Nama Analit": a?.name ?? p.examination_name,
        Operator: "",
        "Batas Bawah": "",
        "Batas Atas": "",
        "Jenis Nilai": "",
        "Kelompok Usia": "",
        "Jenis Kelamin": "",
        "LOINC (OBX-3)": a?.terminology.proposed_code ?? "",
        "UCUM (OBX-6)": a?.unit.proposed_ucum ?? "",
        "Sumber Acuan": a?.terminology.source_url ?? "",
        "Status Verifikasi Acuan": "PENDING_TENANT_REVIEW",
        "Catatan Klinis":
          "Katalog generik; mapping, unit, tipe hasil dan rentang wajib disahkan untuk metode tenant. Tidak untuk impor klinis.",
        "Kode Analit": code ?? "",
        "Jenis Record": code ? "analyte_proposal" : "unresolved_master",
        "Status Rentang": "TENANT_METHOD_REQUIRED",
        "Definisi Primer": a?.terminology.primary_name ?? "",
        "Kode LOINC Sumber": a?.terminology.source_code ?? "",
        "Unit Sumber": a?.unit.source ?? "",
        "Sumber Definisi": a
          ? a.source.file + ":" + a.source.line
          : p.source.file + ":" + p.source.line,
        "SHA256 Definisi": a?.sha256 ?? hash(p),
        "Versi Katalog": bundle.version,
      };
    }),
  );
}
function validateBundle(bundle) {
  const { sha256, ...content } = bundle;
  if (hash(content) !== sha256) throw Error("Catalog bundle digest changed");
  const masters = new Set(
    bundle.masters.map((p) =>
      JSON.stringify([p.material_code, p.examination_name]),
    ),
  );
  const analytes = new Map(bundle.analytes.map((a) => [a.code, a]));
  if (
    analytes.size !== bundle.analytes.length ||
    masters.size !== bundle.masters.length
  )
    throw Error("Duplicate catalog identity");
  for (const a of analytes.values()) {
    const { sha256: digest, ...definition } = a;
    if (hash(definition) !== digest) throw Error("Analyte digest changed");
  }
  for (const m of bundle.mapping)
    if (
      !masters.has(JSON.stringify([m.material_code, m.examination_name])) ||
      !analytes.has(m.analyte_code)
    )
      throw Error("Orphan panel mapping");
  for (const p of bundle.masters) {
    const matches = bundle.mapping
      .filter(
        (m) =>
          m.material_code === p.material_code &&
          m.examination_name === p.examination_name,
      )
      .map((m) => m.analyte_code);
    if (JSON.stringify(matches) !== JSON.stringify(p.components))
      throw Error("Panel membership changed");
  }
  return true;
}
module.exports = { buildGenericCatalog, reviewRows, validateBundle, normalize };
