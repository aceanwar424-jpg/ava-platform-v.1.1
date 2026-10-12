// OWNED_BY: generic wrapper. Syntax validation only, never converts patient values.
let utils;
const cache = new Map();
function validateUcum(code) {
  if (typeof code !== "string" || !code || code.length > 128)
    return {
      status: "invalid",
      ucumCode: null,
      msg: ["UCUM code length invalid"],
    };
  if (!utils) {
    try {
      utils = require("@lhncbc/ucum-lhc").UcumLhcUtils.getInstance();
    } catch (e) {
      throw Error(
        "Install pinned catalog validator dependencies: npm ci --prefix lib/catalog",
      );
    }
  }
  if (!cache.has(code)) {
    let result;
    try {
      result = utils.validateUnitString(code, false);
    } catch (e) {
      result = { status: "invalid", ucumCode: null, msg: [e.message] };
    }
    if (result.status !== "valid")
      result = {
        ...result,
        validator_status: result.status,
        status: "invalid",
      };
    cache.set(code, result);
  }
  return structuredClone(cache.get(code));
}
module.exports = { validateUcum };
