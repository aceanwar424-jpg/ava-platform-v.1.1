// OWNED_BY: generic. Standards syntax checks only, no clinical conversions.
const assert = require("node:assert/strict"),
  { validateUcum } = require("../../lib/catalog/ucum_validation");
for (const code of [
  "g/dL",
  "g/L",
  "mg/dL",
  "10*3/uL",
  "u[IU]/mL",
  "ng/(mL.h)",
]) {
  const r = validateUcum(code);
  assert.equal(r.status, "valid");
  assert.equal(r.ucumCode, code);
}
console.log(
  "PASS UCUM library validates actual unit syntax and preserves original symbols",
);
for (const code of ["fake", "Kuantitatif", "Skor 0–3+", "", "a".repeat(129)])
  assert.equal(validateUcum(code).status, "invalid");
const first = validateUcum("g/dL");
first.status = "tampered";
assert.equal(validateUcum("g/dL").status, "valid");
console.log(
  "PASS free labels and invalid unit codes rejected; cached evidence cannot be modified by callers",
);
