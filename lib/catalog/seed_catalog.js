// OWNED_BY: generic. Reads authorized source literals; never executes SQL or exports prices.
const crypto = require("node:crypto");
const hash = (value) =>
  crypto
    .createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");

function literals(text) {
  const result = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      value += ch;
      if (quoted && text[i + 1] === "'") {
        value += text[++i];
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      result.push(value.trim());
      value = "";
    } else value += ch;
  }
  if (quoted) throw Error("Unterminated source SQL literal");
  result.push(value.trim());
  return result.map((v) =>
    v === "NULL"
      ? null
      : /^'.*'$/s.test(v)
        ? v.slice(1, -1).replace(/''/g, "'")
        : /^(?:true|false)$/.test(v)
          ? v === "true"
          : /^-?\d+(?:\.\d+)?$/.test(v)
            ? Number(v)
            : { expression: v },
  );
}

function readSeedSources(sources) {
  const products = [],
    items = [],
    ranges = [],
    sourceFiles = [];
  const productKeys = new Map(),
    itemKeys = new Map();
  for (const source of sources) {
    sourceFiles.push({ file: source.file, sha256: hash(source.text) });
    source.text.split(/\r?\n/).forEach((line, index) => {
      const sourceRef = { file: source.file, line: index + 1 };
      if (/^INSERT INTO public\.products\s/.test(line)) {
        const match = line.match(/VALUES\s*\((.*?)\)\s*ON CONFLICT/s);
        if (!match)
          throw Error(
            "Unsupported product source at " + source.file + ":" + (index + 1),
          );
        const v = literals(match[1]);
        if (v.length !== 8 || v.slice(0, 6).some((x) => typeof x !== "string"))
          throw Error("Invalid product source");
        const p = {
          source_product_code: v[0],
          material_code: v[1],
          category: v[2],
          subcategory: v[3],
          examination_name: v[4],
          source_display_name: v[5],
          active: v[7],
          source: sourceRef,
        };
        const key = p.material_code + "\u0000" + p.examination_name;
        if (
          productKeys.has(p.source_product_code) ||
          [...productKeys.values()].includes(key)
        )
          throw Error("Duplicate product identity");
        productKeys.set(p.source_product_code, key);
        products.push(p);
      } else if (
        /^INSERT INTO public\.(product_items|ref_ranges)\s/.test(line)
      ) {
        const match = line.match(
          /^INSERT INTO public\.(product_items|ref_ranges)\s*\([^)]*\)\s*SELECT\s+(.*?)\s+FROM public\.products p .*?WHERE p\.kode_internal='((?:''|[^'])+)'/s,
        );
        if (!match)
          throw Error(
            "Unsupported item/range source at " +
              source.file +
              ":" +
              (index + 1),
          );
        const v = literals(match[2]),
          product = match[3].replace(/''/g, "'");
        if (match[1] === "product_items") {
          if (
            v.length !== 8 ||
            typeof v[1] !== "string" ||
            typeof v[2] !== "string"
          )
            throw Error("Invalid item source");
          const item = {
            source_product_code: product,
            source_item_code: v[1],
            name: v[2],
            source_unit: v[3],
            source_loinc: v[4],
            order: v[5],
            result_type: v[6],
            active: v[7],
            source: sourceRef,
          };
          const key = product + "\u0000" + item.source_item_code;
          if (itemKeys.has(key))
            throw Error("Duplicate source analyte identity");
          itemKeys.set(key, item);
          items.push(item);
        } else {
          if (v.length !== 15 || typeof v[3] !== "string")
            throw Error("Invalid reference source");
          ranges.push({
            source_product_code: product,
            source_item_code: v[3],
            value_type: v[4],
            condition_name: v[5],
            condition_type: v[6],
            sex: v[7],
            age_min: v[8],
            age_max: v[9],
            lower: v[10],
            upper: v[11],
            source_unit: v[12],
            expected_values: v[13],
            source: sourceRef,
          });
        }
      }
    });
  }
  for (const x of items)
    if (!productKeys.has(x.source_product_code))
      throw Error("Orphan source analyte");
  for (const x of ranges)
    if (!itemKeys.has(x.source_product_code + "\u0000" + x.source_item_code))
      throw Error("Orphan source reference");
  return { products, items, ranges, sourceFiles };
}

function normalizeUnit(unit) {
  // Orthographic equivalents only; no numeric scaling or assay conversion.
  const exact = {
    "10^6/µL": "10*6/uL",
    "10^3/µL": "10*3/uL",
    "µg/dL": "ug/dL",
    "µg/L": "ug/L",
    "µmol/L": "umol/L",
    "µU/mL": "u[IU]/mL",
    "µIU/mL": "u[IU]/mL",
    "mIU/mL": "m[IU]/mL",
    "IU/mL": "[IU]/mL",
    "IU/L": "[IU]/L",
    "ng/mL/jam": "ng/(mL.h)",
    "mm/jam": "mm/h",
    menit: "min",
    detik: "s",
    milidetik: "ms",
  };
  const known = new Set([
    "g/dL",
    "%",
    "fL",
    "pg",
    "10*6/uL",
    "10*3/uL",
    "10^9/L",
    "ng/mL",
    "mg/dL",
    "U/L",
    "ng/L",
    "pg/mL",
    "mg/L",
    "mL/min",
    "mmol/L",
    "mmHg",
    "mOsm/kg",
    "U/mL",
    "kU/L",
    "ng/dL",
    "nmol/L",
    "pmol/L",
    "mL",
  ]);
  if (exact[unit]) return exact[unit];
  return known.has(unit) ? unit.replace("10^9/L", "10*9/L") : null;
}
module.exports = { hash, literals, readSeedSources, normalizeUnit };
