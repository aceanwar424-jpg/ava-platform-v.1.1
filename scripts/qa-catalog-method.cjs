// OWNED_BY: generic. Authenticated browser→actual disposable SQL. No workspace screenshots/results retained.
const { chromium } = require("./lib/playwright.cjs"),
  {
    createAuthenticatedBrowserSql,
  } = require("./lib/authenticated-browser-sql.cjs"),
  f = require("./lib/catalog-source-fixture.cjs"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
let pg, browser;
(async () => {
  let count = 0;
  try {
    const s = await f.createCatalogFixture();
    pg = s.pg;
    const bridge = await createAuthenticatedBrowserSql(pg, [
      "lis_catalog_board",
      "lis_catalog_sources",
      "lis_catalog_command",
      "lis_catalog_export",
      "lis_catalog_primary_term",
    ]);
    browser = await chromium.launch({ headless: true, channel: "msedge" });
    const page = await browser.newPage({
        viewport: { width: 1366, height: 900 },
        acceptDownloads: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (r) =>
      r.request().url() === "http://127.0.0.1:43823/"
        ? r.fulfill({
            contentType: "text/html",
            body: '<!doctype html><meta charset=utf-8><body style="font-family:Arial;margin:0"><main id=main-content></main>',
          })
        : r.abort(),
    );
    await page.exposeFunction("sbRpc", bridge);
    await page.goto("http://127.0.0.1:43823/");
    await page.addScriptTag({
      path: path.resolve("ava-platform/modules/logistics/catalog_export.js"),
    });
    const actor = async (id = s.worker) => {
      await s.actor(id);
      await page.evaluate(
        ({ id, tenant }) => {
          window.currentUser = { id, tenant_id: tenant };
          window.currentPage = "catalog-export";
          return renderCatalogExport();
        },
        { id, tenant: s.A },
      );
    };
    const save = async () => {
      await page
        .locator("#ce-editor [name=reason]")
        .fill("Synthetic browser source evidence");
      await page.locator("#ce-editor [type=submit]").click();
      try {
        await page
          .locator("#ce-editor form")
          .waitFor({ state: "detached", timeout: 10000 });
      } catch (e) {
        throw Error(await page.locator("#ce-form-error").textContent());
      }
    };
    await actor();
    await page.locator("#ce-new").click();
    await page.locator("[name=item_id]").selectOption("1");
    await page.waitForFunction(() =>
      document.querySelector("[name=analyte_code]").value.startsWith("AN-"),
    );
    const d = await s.input();
    for (const name of ["catalog_version", "method_id"])
      await page.locator(`[name=${name}]`).fill(d[name]);
    for (const [name, value] of Object.entries(d.definition)) {
      if (["ranges", "primary_name", "terminology_url"].includes(name))
        continue;
      if (["result_type", "age_unit"].includes(name))
        await page.locator(`[name=${name}]`).selectOption(value);
      else await page.locator(`[name=${name}]`).fill(value);
    }
    await page.locator("#ce-lookup").click();
    await page.waitForFunction(() =>
      document
        .querySelector("[name=primary_name]")
        .value.includes("Hemoglobin"),
    );
    const local = (value) => {
      const date = new Date(value);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    await page.locator("[name=valid_from]").fill(local(d.valid_from));
    await page.locator("[name=valid_until]").fill(local(d.valid_until));
    const r = d.definition.ranges[0];
    for (const [name, value] of Object.entries(r)) {
      if (
        [
          "age_lower_inclusive",
          "age_upper_inclusive",
          "sex",
          "operator",
        ].includes(name)
      )
        await page.locator(`[name=r_${name}]`).selectOption(String(value));
      else await page.locator(`[name=r_${name}]`).fill(String(value));
    }
    await page.locator("[name=r_age_min]").fill("");
    await page
      .locator("#ce-editor [name=reason]")
      .fill("Synthetic UI missing age proof");
    await page.evaluate(() =>
      document
        .querySelector("#ce-editor form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    await page
      .locator("#ce-form-error")
      .filter({ hasText: "age_min" })
      .waitFor();
    assert.equal(
      (await s.q("SELECT count(*) n FROM lis_catalog_method_versions"))[0].n,
      0,
    );
    await page.locator("[name=r_age_min]").fill("0");
    count++;
    console.log(
      "PASS missing demographic value is not converted silently to zero",
    );
    await save();
    let row = (
      await s.q("SELECT * FROM lis_catalog_method_versions ORDER BY id")
    )[0];
    assert.equal(row.state, "draft");
    assert.equal(row.source_snapshot.material_code, "SYN-MATERIAL-CBC");
    count++;
    console.log(
      "PASS authenticated UI creates actual source method and exact analyte code",
    );
    await page.locator(`[data-action=submit][data-id="${row.id}"]`).click();
    await save();
    await actor(s.receiver);
    await page.locator(`[data-action=approve][data-id="${row.id}"]`).click();
    for (const name of [
      "mapping_reviewed",
      "method_reviewed",
      "reference_reviewed",
    ])
      await page.locator(`[name=${name}]`).check();
    await save();
    await actor();
    await page.locator(`[data-action=activate][data-id="${row.id}"]`).click();
    await save();
    assert.equal(
      (
        await s.q("SELECT state FROM lis_catalog_method_versions WHERE id=$1", [
          row.id,
        ])
      )[0].state,
      "active",
    );
    count++;
    console.log(
      "PASS authenticated UI submit→independent professional review→activation",
    );
    const pending = page.waitForEvent("download");
    await page.locator(`[data-action=export][data-id="${row.id}"]`).click();
    const download = await pending;
    const stream = await download.createReadStream();
    let text = "";
    for await (const chunk of stream) text += chunk.toString();
    assert.match(text, /SYN-MATERIAL-CBC/);
    assert.match(text, /SHA256 Konfigurasi/);
    assert.match(text, /VERIFIED/);
    assert.ok(!text.includes("999999"));
    count++;
    console.log(
      "PASS real CSV download includes source keys and professional audit, excludes private price",
    );
    await s.q("UPDATE product_items SET uom='mg/dL' WHERE id=1");
    await page.locator(`[data-action=export][data-id="${row.id}"]`).click();
    await page
      .locator("#ce-error")
      .filter({ hasText: "Master berubah" })
      .waitFor();
    await s.q("UPDATE product_items SET uom='g/dL' WHERE id=1");
    count++;
    console.log("PASS source drift rejects UI clinical export");
    await page.locator("#ce-new").click();
    await page.evaluate(
      () => (currentUser = { id: "changed", tenant_id: "changed" }),
    );
    await page.evaluate(() =>
      document
        .querySelector("#ce-editor form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(
      (await s.q("SELECT count(*) n FROM lis_catalog_method_versions"))[0].n,
      1,
    );
    await actor();
    count++;
    console.log(
      "PASS stale tenant form cannot create another source configuration",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.addScriptTag({
      path: path.resolve("ava-platform/modules/compliance/catalog_exporter.js"),
    });
    assert.equal(
      await page.evaluate(() => renderCatalogExport === renderReviewedCatalog),
      true,
    );
    assert.deepEqual(errors, []);
    count++;
    console.log(
      "PASS mobile layout, compatibility module cannot overwrite source renderer, no browser errors",
    );
    console.log(count + " authenticated catalog browser scenarios passed");
  } finally {
    if (browser) await browser.close();
    if (pg) await pg.close();
    if (process.env.RS_TEST_RUNTIME)
      assert.equal(
        fs.existsSync(path.join(process.env.RS_TEST_RUNTIME, "cluster")),
        false,
      );
    console.log(
      "Browser/download temp data closed; dummy database removed; no retained test outputs",
    );
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
