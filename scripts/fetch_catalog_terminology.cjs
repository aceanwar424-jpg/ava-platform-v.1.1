// OWNED_BY: generic. Read-only terminology research. No patient/tenant/vendor integration.
const fs = require("node:fs"),
  path = require("node:path");
const { readSeedSources, hash } = require("../lib/catalog/seed_catalog");
const root = path.resolve(__dirname, "..");
const target = path.join(root, "data/catalog/loinc_primary_metadata.json");
const fields = [
  "COMPONENT",
  "PROPERTY",
  "METHOD_TYP",
  "units",
  "datatype",
  "EXTERNAL_COPYRIGHT_NOTICE",
];
async function retrieve(code) {
  const url = new URL(
    "https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search",
  );
  url.search = new URLSearchParams({
    terms: code,
    sf: "LOINC_NUM",
    q: 'LOINC_NUM:"' + code + '"',
    df: "LOINC_NUM,LONG_COMMON_NAME",
    ef: fields.join(","),
    maxList: "5",
    excludeCopyrighted: "true",
  });
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Error("Primary source HTTP " + r.status);
  const value = await r.json(),
    at = value[1].indexOf(code);
  if (at < 0)
    return {
      code,
      lookup_status: "NOT_RETURNED",
      source_url: url.href,
      accessed_at: new Date().toISOString(),
    };
  const term = {
    code,
    lookup_status: "FOUND",
    long_name: value[3][at][1],
    source_url: url.href,
    accessed_at: new Date().toISOString(),
    canonical_url: "https://loinc.org/" + code + "/",
  };
  for (const field of fields) term[field] = value[2][field]?.[at] ?? null;
  term.sha256 = hash({
    code,
    name: term.long_name,
    fields: fields.map((f) => term[f]),
  });
  return term;
}
async function main() {
  const sources = Array.from({ length: 8 }, (_, i) => {
    const file =
      "ava-platform/sql_arsip/06_seed_data/supabase_seed_part0" +
      (i + 1) +
      ".sql";
    return { file, text: fs.readFileSync(path.join(root, file), "utf8") };
  });
  const source = readSeedSources(sources);
  const codes = [
    ...new Set(
      source.items
        .map((x) => x.source_loinc)
        .filter((x) => /^\d{1,5}-\d$/.test(x || "")),
    ),
  ].sort();
  const previous =
    fs.existsSync(target) && !process.argv.includes("--refresh")
      ? JSON.parse(fs.readFileSync(target, "utf8")).terms
      : [];
  const terms = new Map(previous.map((x) => [x.code, x]));
  let completed = 0;
  const missing = codes.filter((c) => !terms.has(c));
  for (let i = 0; i < missing.length; i += 4) {
    const results = await Promise.allSettled(
      missing.slice(i, i + 4).map(retrieve),
    );
    for (let n = 0; n < results.length; n++) {
      const item = results[n];
      if (item.status === "fulfilled") terms.set(item.value.code, item.value);
      else
        terms.set(missing[i + n], {
          code: missing[i + n],
          lookup_status: "LOOKUP_FAILED",
          error: item.reason.message,
          accessed_at: new Date().toISOString(),
        });
      completed++;
    }
    const document = {
      owned_by: "generic",
      source: "NLM Clinical Table Search Service / Regenstrief LOINC",
      api_documentation:
        "https://clinicaltables.nlm.nih.gov/apidoc/loinc/v3/doc.html",
      license: "https://loinc.org/license",
      distribution_version: null,
      version_note:
        "API does not report a distribution version; access timestamp and content digest recorded. Do not assume latest LOINC release.",
      generated_at: new Date().toISOString(),
      terms: [...terms.values()].sort((a, b) => a.code.localeCompare(b.code)),
    };
    fs.writeFileSync(target, JSON.stringify(document, null, 2) + "\n");
    if (completed % 40 === 0 || i + 4 >= missing.length)
      console.log(completed + "/" + missing.length + " primary code lookups");
  }
  console.log(
    "Total " +
      terms.size +
      "; found " +
      [...terms.values()].filter((t) => t.lookup_status === "FOUND").length +
      "; unresolved " +
      [...terms.values()].filter((t) => t.lookup_status !== "FOUND").length,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
