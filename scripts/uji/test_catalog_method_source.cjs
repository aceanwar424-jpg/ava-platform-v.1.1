// OWNED_BY: generic. Actual master/individual review SQL; synthetic intervals are not clinical advice.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  f = require("../lib/catalog-source-fixture.cjs");
const { CatalogValidator } = require("../../lib/validator/catalog_validator"),
  { LISExporter } = require("../../lib/exporter/lis_exporter");
let pg;
(async () => {
  let n = 0;
  try {
    const s = await f.createCatalogFixture();
    pg = s.pg;
    async function check(name, fn) {
      await fn();
      n++;
      console.log("PASS " + name);
    }
    const data = await s.input();
    let active;
    await check(
      "source draft submit independent licensed approval activate and quantitative clinical export",
      async () => {
        active = await s.activate(data);
        const e = await s.rpc("lis_catalog_export", [active.id]);
        assert.equal(e.rows.length, 1);
        assert.equal(e.rows[0]["Kode Material"], "SYN-MATERIAL-CBC");
        assert.equal(e.rows[0]["Kode Analit"], data.analyte_code);
        assert.equal(e.rows[0]["Batas Bawah"], "1");
        assert.ok(!JSON.stringify(e).includes("999999"));
        const csv = new LISExporter().export(e.rows, {
          purpose: "clinical_import",
        });
        assert.equal(new CatalogValidator().validate(csv).clinical_ready, true);
        assert.equal(
          (await s.q("SELECT range_min,range_max FROM ref_ranges")).length,
          0,
        );
      },
    );
    await check(
      "retries exact and stale versions or changed actor/input rejected",
      async () => {
        const d = await s.input(),
          key = s.key();
        let r = await s.command("create", d, key);
        assert.deepEqual(await s.command("create", d, key), r);
        await assert.rejects(
          () =>
            s.command(
              "create",
              { ...d, reason: "Changed synthetic reason" },
              key,
            ),
          /Retry/,
        );
        r = await s.command("submit", { id: r.id, version: r.version });
        await assert.rejects(
          () => s.command("submit", { id: r.id, version: 1 }),
          /Data berubah/,
        );
        await s.actor(s.receiver);
        await assert.rejects(() => s.command("create", d, key), /Retry/);
        await s.actor(s.worker);
      },
    );
    await check(
      "no administrator practice, foreign tenant lookup, private source helper or direct writes",
      async () => {
        await s.actor();
        await assert.rejects(() => s.command("create", data), /Peran/);
        await s.actor(s.foreign, s.B);
        assert.deepEqual((await s.rpc("lis_catalog_board", [0])).rows, []);
        await assert.rejects(() => s.rpc("lis_catalog_export", [active.id]));
        await s.actor(s.worker);
        await pg.exec("SET ROLE authenticated");
        try {
          await assert.rejects(
            () => s.q("UPDATE lis_catalog_method_versions SET state='active'"),
            /permission denied/,
          );
          await assert.rejects(
            () => s.q("SELECT lis_catalog_source_snapshot(1,1)"),
            /permission denied/,
          );
        } finally {
          await pg.exec("RESET ROLE");
        }
      },
    );
    await check(
      "missing clinician attestations, overlap, wrong analyte code, naive date and fake numeric boundaries rejected",
      async () => {
        for (const patch of [
          { analyte_code: "AN-" + "A".repeat(24) },
          { valid_from: "2026-10-12" },
          {
            definition: {
              ...data.definition,
              ranges: [data.definition.ranges[0], data.definition.ranges[0]],
            },
          },
          {
            definition: {
              ...data.definition,
              ranges: [{ ...data.definition.ranges[0], lower: null }],
            },
          },
          { definition: { ...data.definition, reference_evidence: "" } },
        ])
          await assert.rejects(() =>
            s.command("create", { ...data, ...patch }),
          );
        let r = await s.command("create", data);
        r = await s.command("submit", { id: r.id, version: r.version });
        await s.actor(s.receiver);
        await assert.rejects(
          () => s.command("approve", { id: r.id, version: r.version }),
          /Attestasi/,
        );
        await s.actor(s.worker);
        await assert.rejects(() =>
          s.command("approve", { id: r.id, version: r.version }),
        );
      },
    );
    await check(
      "primary code/name/URL and validated UCUM registry cannot be spoofed by arbitrary strings",
      async () => {
        for (const patch of [
          { primary_name: "Synthetic wrong primary label" },
          { terminology_url: "https://loinc.org/94500-6/" },
          { loinc: "1000-0" },
          { ucum: "fake" },
        ])
          await assert.rejects(() =>
            s.command("create", {
              ...data,
              definition: { ...data.definition, ...patch },
            }),
          );
      },
    );
    await check(
      "qualitative expected values remain coded and do not invent numeric ranges or units",
      async () => {
        const term = await s.rpc("lis_catalog_primary_term", ["94500-6"]);
        const d = {
          ...s.definition,
          result_type: "qualitative",
          loinc: term.code,
          primary_name: term.long_name,
          terminology_url: term.canonical_url,
          ucum: "",
          ranges: [
            {
              age_min: 0,
              age_max: 200,
              age_lower_inclusive: true,
              age_upper_inclusive: true,
              sex: "all",
              condition: "Synthetic general reference",
              expected_values: ["Synthetic not detected"],
            },
          ],
        };
        const r = await s.activate(await s.input(2, 2, d));
        const e = await s.rpc("lis_catalog_export", [r.id]);
        assert.deepEqual(e.rows[0]["Nilai Diharapkan"], [
          "Synthetic not detected",
        ]);
        assert.equal(e.rows[0]["Batas Bawah"], "");
        assert.equal(e.rows[0]["Batas Atas"], "");
        assert.equal(e.rows[0]["UCUM (OBX-6)"], "");
        assert.equal(
          new CatalogValidator().validate(
            new LISExporter().export(e.rows, { purpose: "clinical_import" }),
          ).clinical_ready,
          true,
        );
      },
    );
    await check(
      "new method revision retires old configuration and original definitions stay immutable",
      async () => {
        const r = await s.activate({
          ...data,
          definition: {
            ...data.definition,
            source_version: "Synthetic SOP 2.0",
          },
        });
        assert.ok(r.revision > active.revision);
        assert.equal(
          (
            await s.q(
              "SELECT state FROM lis_catalog_method_versions WHERE id=$1",
              [active.id],
            )
          )[0].state,
          "retired",
        );
        await assert.rejects(
          () => s.rpc("lis_catalog_export", [active.id]),
          /aktif/,
        );
        await assert.rejects(
          () =>
            s.q(
              'UPDATE lis_catalog_method_versions SET definition=definition||\'{"ucum":"fake"}\'::jsonb WHERE id=$1',
              [r.id],
            ),
          /immutable/,
        );
        await assert.rejects(
          () =>
            s.q("DELETE FROM lis_catalog_method_versions WHERE id=$1", [r.id]),
          /Histori/,
        );
        active = r;
      },
    );
    await check(
      "master source drift or reviewer credential revocation blocks clinical export",
      async () => {
        await s.q("UPDATE product_items SET uom='mg/dL' WHERE id=1");
        await assert.rejects(
          () => s.rpc("lis_catalog_export", [active.id]),
          /Master berubah/,
        );
        await s.q("UPDATE product_items SET uom='g/dL' WHERE id=1");
        await s.actor(s.registry);
        await s.rpc("ops_workforce_command", [
          "credential",
          "revoke",
          JSON.stringify({
            id: s.reviewerCredential.id,
            version: s.reviewerCredential.version,
            reason: "Synthetic revoked license",
          }),
          s.key(),
        ]);
        await s.actor(s.worker);
        await assert.rejects(
          () => s.rpc("lis_catalog_export", [active.id]),
          /kredensial/,
        );
      },
    );
    console.log(n + " source catalog scenarios passed");
  } finally {
    if (pg) await pg.close();
    const runtime = process.env.RS_TEST_RUNTIME;
    if (runtime)
      assert.equal(fs.existsSync(path.join(runtime, "cluster")), false);
    console.log(
      "Dummy database closed and cluster removed; no test result artifacts created",
    );
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
