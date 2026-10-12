// OWNED_BY: generic. Actual catalog master DDL and workforce/policy commands, synthetic rows only.
const fs = require("node:fs"),
  path = require("node:path"),
  f = require("./rs-engine-fixture.cjs"),
  { hash } = require("../../lib/catalog/seed_catalog");
async function createCatalogFixture() {
  const pg = await f.createEngineFixture();
  try {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../ava-platform/sql_arsip/02_modul_lama/supabase_config_lab.sql",
      ),
      "utf8",
    );
    await pg.exec(source.split("-- ── ANALYZERS")[0]);
    const items = fs
      .readFileSync(
        path.resolve(
          __dirname,
          "../../ava-platform/sql_arsip/01_fondasi_awal/supabase_setup_all.sql",
        ),
        "utf8",
      )
      .match(
        /CREATE TABLE IF NOT EXISTS public\.product_items \([\s\S]+?\n\);/,
      )[0];
    await pg.exec(items);
    await pg.exec(
      "ALTER TABLE product_items ADD COLUMN loinc_code text,ADD COLUMN result_type text; INSERT INTO products(kode_internal,kode_material,nama_tes,is_panel,harga_normal) VALUES('SYN-CBC','SYN-MATERIAL-CBC','Synthetic CBC',true,999999),('SYN-QUAL','SYN-MATERIAL-QUAL','Synthetic qualitative',false,999999); INSERT INTO product_items(product_id,code,name_id,uom,loinc_code,result_type) VALUES(1,'HB','Hemoglobin','g/dL','718-7','numeric'),(2,'SYN-Q','Synthetic qualitative result',NULL,'94500-6','select');",
    );
    for (const name of [
      "0081_individual_clinical_privileges.sql",
      "0105_tenant_catalog_method_review.sql",
      "0106_catalog_primary_terminology_snapshot.sql",
    ])
      await pg.exec(
        fs.readFileSync(
          path.resolve(__dirname, "../../db/migrations", name),
          "utf8",
        ),
      );
    let n = 0;
    const registry = "20000000-0000-0000-0000-000000000005",
      key = () => `catalog-source-synthetic-${++n}`,
      q = async (s, a = []) => (await pg.query(s, a)).rows,
      rpc = async (name, args) =>
        (
          await q(
            `SELECT ${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
            args,
          )
        )[0].r;
    const actor = async (id = f.admin, tenant = f.A) =>
      q(
        "SELECT set_config('app.user_id',$1,false),set_config('app.tenant_id',$2,false)",
        [id, tenant],
      );
    await q(
      "INSERT INTO roles(kode,label) VALUES('lab','Synthetic lab professional') ON CONFLICT DO NOTHING",
    );
    await q("UPDATE user_profiles SET role='lab' WHERE id=$1", [f.worker]);
    await q("UPDATE user_profiles SET role='dokter' WHERE id=$1", [f.receiver]);
    await q(
      "INSERT INTO user_profiles(id,tenant_id,role,full_name) VALUES($1,$2,'dokter','Synthetic registry reviewer')",
      [registry, f.A],
    );
    const dates = (
      await q("SELECT (current_date-1)::text f,(current_date+30)::text t")
    )[0];
    const work = (entity, action, data) =>
      rpc("ops_workforce_command", [
        entity,
        action,
        JSON.stringify({ reason: "Synthetic catalog authorization", ...data }),
        key(),
      ]);
    async function reviewWork(entity, data) {
      await actor();
      let r = await work(entity, "create", data);
      r = await work(entity, "submit", { id: r.id, version: r.version });
      await actor(registry);
      r = await work(entity, "approve", { id: r.id, version: r.version });
      await actor();
      return r;
    }
    async function license(id, actions) {
      const c = await reviewWork("credential", {
        user_id: id,
        kind: "professional_authorization",
        reference: "SYN-CATALOG-" + id.slice(-1),
        evidence: "Synthetic individual authorization",
        valid_from: dates.f,
        valid_until: dates.t,
      });
      await reviewWork("privilege", {
        user_id: id,
        scope: "catalog-export",
        actions,
        credential_ids: [c.id],
        evidence: "Synthetic catalog scope",
        valid_from: dates.f,
        valid_until: dates.t,
      });
      return c;
    }
    const workerCredential = await license(f.worker, [
        "clinical.catalog.configure",
        "clinical.catalog.export",
      ]),
      reviewerCredential = await license(f.receiver, [
        "clinical.authority.review",
        "clinical.catalog.review",
        "clinical.catalog.export",
      ]);
    let policy = await rpc("ops_policy_command", [
      null,
      "create",
      JSON.stringify({
        kind: "authority",
        scope: "catalog-export",
        payload: {
          rules: [
            {
              action: "clinical.catalog.configure",
              roles: ["lab"],
              separate_verifier: false,
            },
            {
              action: "clinical.catalog.review",
              roles: ["dokter"],
              separate_verifier: true,
            },
            {
              action: "clinical.catalog.export",
              roles: ["lab", "dokter"],
              separate_verifier: false,
            },
          ],
        },
        reason: "Synthetic catalog authority",
      }),
      key(),
    ]);
    policy = await rpc("ops_policy_command", [
      policy.id,
      "submit",
      JSON.stringify({ expected_state: "draft", reason: "Synthetic submit" }),
      key(),
    ]);
    await actor(f.receiver);
    policy = await rpc("ops_policy_command", [
      policy.id,
      "approve",
      JSON.stringify({
        expected_state: "in_review",
        reason: "Synthetic competent review",
      }),
      key(),
    ]);
    await actor();
    await rpc("ops_policy_command", [
      policy.id,
      "activate",
      JSON.stringify({
        expected_state: "approved",
        effective_at: new Date().toISOString(),
        reason: "Synthetic activate",
      }),
      key(),
    ]);
    const definition = {
      result_type: "numeric",
      loinc: "718-7",
      primary_name: "Hemoglobin [Mass/volume] in Blood",
      terminology_url: "https://loinc.org/718-7/",
      ucum: "g/dL",
      specimen: "Synthetic whole blood",
      method: "Synthetic method",
      device_reagent: "Synthetic reagent device",
      mapping_evidence: "SYN mapping professional evidence",
      reference_evidence:
        "SYN IFU evidence, test values not medical references",
      source_version: "Synthetic SOP 1.0",
      timezone: "UTC",
      age_unit: "a",
      ranges: [
        {
          age_min: 0,
          age_max: 200,
          age_lower_inclusive: true,
          age_upper_inclusive: true,
          sex: "all",
          condition: "Synthetic general reference",
          operator: "BETWEEN",
          lower: 1,
          upper: 2,
        },
      ],
    };
    const command = (action, data, k = key()) =>
      rpc("lis_catalog_command", [
        action,
        JSON.stringify({
          reason: "Synthetic catalog source evidence",
          ...data,
        }),
        k,
      ]);
    async function input(product = 1, item = 1, def = definition) {
      const snapshot = (
        await q("SELECT lis_catalog_source_snapshot($1,$2) r", [product, item])
      )[0].r;
      return {
        product_id: product,
        item_id: item,
        source_snapshot: snapshot,
        analyte_code:
          "AN-" +
          hash([snapshot.source_product_code, snapshot.item_code])
            .slice(0, 24)
            .toUpperCase(),
        catalog_version: "SYN-2.0",
        method_id: "SYN-METHOD-1",
        definition: structuredClone(def),
        valid_from: new Date(Date.now() - 3600000).toISOString(),
        valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
    }
    async function activate(data) {
      await actor(f.worker);
      let row = await command("create", data);
      row = await command("submit", { id: row.id, version: row.version });
      await actor(f.receiver);
      row = await command("approve", {
        id: row.id,
        version: row.version,
        mapping_reviewed: true,
        method_reviewed: true,
        reference_reviewed: true,
      });
      await actor(f.worker);
      return command("activate", { id: row.id, version: row.version });
    }
    await actor(f.worker);
    return {
      ...f,
      pg,
      q,
      rpc,
      actor,
      key,
      command,
      input,
      definition,
      activate,
      registry,
      workerCredential,
      reviewerCredential,
    };
  } catch (e) {
    await pg.close();
    throw e;
  }
}
module.exports = { ...f, createCatalogFixture };
