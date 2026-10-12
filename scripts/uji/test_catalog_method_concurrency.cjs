// OWNED_BY: generic. Native sessions really wait on locks; synthetic source values only.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  f = require("../lib/catalog-source-fixture.cjs");
let pg;
(async () => {
  try {
    const s = await f.createCatalogFixture();
    pg = s.pg;
    const input = await s.input();
    const old = await s.activate(input);
    async function approve() {
      await s.actor(s.worker);
      let r = await s.command("create", input);
      r = await s.command("submit", { id: r.id, version: r.version });
      await s.actor(s.receiver);
      r = await s.command("approve", {
        id: r.id,
        version: r.version,
        mapping_reviewed: true,
        method_reviewed: true,
        reference_reviewed: true,
      });
      await s.actor(s.worker);
      return r;
    }
    const r1 = await approve(),
      r2 = await approve(),
      one = await pg.connectSession(),
      two = await pg.connectSession(),
      pids = [
        (await one.query("SELECT pg_backend_pid() id")).rows[0].id,
        (await two.query("SELECT pg_backend_pid() id")).rows[0].id,
      ];
    assert.notEqual(...pids);
    async function begin(client) {
      await client.query("BEGIN");
      await client.query(
        "SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",
        [s.worker, s.A],
      );
      await client.query("SET LOCAL ROLE authenticated");
    }
    await begin(one);
    await begin(two);
    const data = (r) =>
      JSON.stringify({
        id: r.id,
        version: r.version,
        reason: "Synthetic concurrent activation",
      });
    await one.query("SELECT lis_catalog_command($1,$2,$3)", [
      "activate",
      data(r1),
      s.key(),
    ]);
    const second = two.query("SELECT lis_catalog_command($1,$2,$3)", [
      "activate",
      data(r2),
      s.key(),
    ]);
    let waiting = false;
    for (let i = 0; i < 30; i++) {
      const rows = await s.q(
        "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
        [pids[1]],
      );
      if (rows[0]?.wait_event_type === "Lock") {
        waiting = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(waiting, true);
    await one.query("COMMIT");
    await second;
    await two.query("COMMIT");
    const active = await s.q(
      "SELECT id FROM lis_catalog_method_versions WHERE state='active'",
    );
    assert.deepEqual(
      active.map((r) => r.id),
      [r2.id],
    );
    assert.equal(
      (
        await s.q(
          "SELECT count(*) n FROM lis_catalog_events WHERE action='superseded'",
        )
      )[0].n,
      2,
    );
    assert.equal(
      (
        await s.q("SELECT state FROM lis_catalog_method_versions WHERE id=$1", [
          old.id,
        ])
      )[0].state,
      "retired",
    );
    console.log(
      "PASS concurrent activation of two reviewed revisions waits on source method lock, leaves one active, preserves retirement audit",
    );
    await assert.rejects(
      () => s.q("UPDATE lis_catalog_events SET reason='tampered'"),
      /append-only/,
    );
    await assert.rejects(
      () => s.q("DELETE FROM lis_catalog_requests"),
      /append-only/,
    );
    console.log("PASS original activation/retry audit cannot be overwritten");
  } finally {
    if (pg) await pg.close();
    if (process.env.RS_TEST_RUNTIME)
      assert.equal(
        fs.existsSync(path.join(process.env.RS_TEST_RUNTIME, "cluster")),
        false,
      );
    console.log(
      "Both sessions and dummy database closed, cluster removed; no output artifacts retained",
    );
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
