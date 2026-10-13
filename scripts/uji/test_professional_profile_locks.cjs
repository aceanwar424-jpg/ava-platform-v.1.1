// OWNED_BY: generic. Actual source roles, reviewed authority and native credential revocation races.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  f = require("../lib/catalog-source-fixture.cjs");
let pg;
(async () => {
  let count = 0;
  try {
    const s = await f.createCatalogFixture();
    pg = s.pg;
    await pg.exec(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../../db/migrations/0107_professional_aliases_and_credential_locks.sql",
        ),
        "utf8",
      ),
    );
    await s.q(
      "INSERT INTO roles(kode,label) VALUES('lab_analyst','Synthetic LIS analyst'),('lab_supervisor','Synthetic LIS supervisor'),('sp_pk','Synthetic pathology physician'),('doctor_sppk','Synthetic pathology physician') ON CONFLICT DO NOTHING",
    );
    await s.q("UPDATE user_profiles SET role='lab_analyst' WHERE id=$1", [
      s.worker,
    ]);
    await s.q("UPDATE user_profiles SET role='sp_pk' WHERE id=$1", [
      s.receiver,
    ]);
    await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations/0108_professional_actor_snapshot_locks.sql'),'utf8'));
    const input = await s.input();
    await s.actor(s.worker);
    await assert.rejects(() => s.command("create", input), /Peran|kewenangan/i);
    count++;
    console.log(
      "PASS profession aliases do not silently match an authority rule for another raw role code",
    );
    await s.actor();
    let p = await s.rpc("ops_policy_command", [
      null,
      "create",
      JSON.stringify({
        kind: "authority",
        scope: "catalog-export",
        payload: {
          rules: [
            {
              action: "clinical.catalog.configure",
              roles: ["lab_analyst"],
              separate_verifier: false,
            },
            {
              action: "clinical.catalog.review",
              roles: ["sp_pk"],
              separate_verifier: true,
            },
            {
              action: "clinical.catalog.export",
              roles: ["lab_analyst", "sp_pk"],
              separate_verifier: false,
            },
          ],
        },
        reason: "Synthetic explicit LIS alias authority",
      }),
      s.key(),
    ]);
    p = await s.rpc("ops_policy_command", [
      p.id,
      "submit",
      JSON.stringify({ expected_state: "draft", reason: "Synthetic submit" }),
      s.key(),
    ]);
    await s.actor(s.receiver);
    p = await s.rpc("ops_policy_command", [
      p.id,
      "approve",
      JSON.stringify({
        expected_state: "in_review",
        reason: "Synthetic licensed pathology review",
      }),
      s.key(),
    ]);
    await s.actor();
    await s.rpc("ops_policy_command", [
      p.id,
      "activate",
      JSON.stringify({
        expected_state: "approved",
        effective_at: new Date().toISOString(),
        reason: "Synthetic activate",
      }),
      s.key(),
    ]);
    const active = await s.activate(input);
    assert.equal(
      (await s.rpc("lis_catalog_export", [active.id])).rows.length,
      1,
    );
    count++;
    console.log(
      "PASS LIS analyst and pathology physician execute actual configure/review/export with explicit role authority and individual licenses",
    );
    const staff = await s.rpc("ops_workforce_board", ["credential", 0]);
    assert.ok(
      staff.staff.some((u) => u.id === s.receiver && u.role === "sp_pk"),
    );
    count++;
    console.log(
      "PASS registry staff projection preserves actual role code while recognizing professional aliases",
    );
    const unlicensed = "20000000-0000-0000-0000-000000000006";
    await s.q(
      "INSERT INTO user_profiles(id,tenant_id,role,full_name) VALUES($1,$2,'lab_analyst','Synthetic unlicensed analyst')",
      [unlicensed, s.A],
    );
    await s.actor(unlicensed);
    await assert.rejects(
      () => s.command("create", input),
      /Privilege|kredensial/,
    );
    await s.actor();
    await assert.rejects(() => s.command("create", input), /Peran/);
    count++;
    console.log(
      "PASS alias without individual grant and administrator without profession cannot configure clinical sources",
    );
    const dates = (
      await s.q("SELECT (current_date-1)::text f,(current_date+30)::text t")
    )[0];
    const work = (entity, action, data) =>
      s.rpc("ops_workforce_command", [
        entity,
        action,
        JSON.stringify({
          reason: "Synthetic source professional review",
          ...data,
        }),
        s.key(),
      ]);
    async function licenseAndGrant() {
      await s.actor();
      let c = await work("credential", "create", {
        user_id: s.receiver,
        kind: "professional_authorization",
        reference: "SYN-NEW-PATHOLOGY-LICENSE",
        evidence: "Synthetic reviewed authorization",
        valid_from: dates.f,
        valid_until: dates.t,
      });
      c = await work("credential", "submit", { id: c.id, version: c.version });
      await s.actor(s.registry);
      c = await work("credential", "approve", { id: c.id, version: c.version });
      await s.actor();
      let g = await work("privilege", "create", {
        user_id: s.receiver,
        scope: "catalog-export",
        actions: [
          "clinical.catalog.review",
          "clinical.authority.review",
          "clinical.catalog.export",
        ],
        credential_ids: [c.id],
        evidence: "Synthetic reviewed scope",
        valid_from: dates.f,
        valid_until: dates.t,
      });
      g = await work("privilege", "submit", { id: g.id, version: g.version });
      await s.actor(s.registry);
      g = await work("privilege", "approve", { id: g.id, version: g.version });
      await s.actor(s.worker);
      return { c, g };
    }
    const one = await pg.connectSession(),
      two = await pg.connectSession(),
      pids = [
        (await one.query("SELECT pg_backend_pid() id")).rows[0].id,
        (await two.query("SELECT pg_backend_pid() id")).rows[0].id,
      ];
    assert.notEqual(...pids);
    async function begin(client, id) {
      await client.query("BEGIN");
      await client.query(
        "SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",
        [id, s.A],
      );
      await client.query("SET LOCAL ROLE authenticated");
    }
    async function waiting(pid) {
      for (let i = 0; i < 40; i++) {
        const a = await s.q(
          "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
          [pid],
        );
        if (a[0]?.wait_event_type === "Lock") return true;
        await new Promise((r) => setTimeout(r, 20));
      }
      return false;
    }
    for (const subject of [s.worker,s.receiver]) {
      const original=subject===s.worker?'lab_analyst':'sp_pk';
      await begin(one,s.worker);
      await one.query('SELECT lis_catalog_export($1)',[active.id]);
      await two.query('BEGIN');
      const change=two.query("UPDATE user_profiles SET role='admin' WHERE id=$1",[subject]);
      assert.equal(await waiting(pids[1]),true);
      await one.query('COMMIT');await change;await two.query('COMMIT');
      await s.actor(s.worker);
      await assert.rejects(()=>s.rpc('lis_catalog_export',[active.id]));
      await s.q('UPDATE user_profiles SET role=$1 WHERE id=$2',[original,subject]);
      await two.query('BEGIN');
      await two.query("UPDATE user_profiles SET role='admin' WHERE id=$1",[subject]);
      await begin(one,s.worker);
      const pending=one.query('SELECT lis_catalog_export($1)',[active.id]).then(value=>({value}),error=>({error}));
      assert.equal(await waiting(pids[0]),true);
      await two.query('COMMIT');const outcome=await pending;
      assert.ok(outcome.error,'Changed actor/reviewer role must reject clinical export');
      await one.query('ROLLBACK');
      await s.q('UPDATE user_profiles SET role=$1 WHERE id=$2',[original,subject]);
      count+=2;
      console.log('PASS actor/reviewer source profile locks in both transaction orders: '+original);
    }
    const revoke = (client, c) =>
      client.query("SELECT ops_workforce_command($1,$2,$3,$4)", [
        "credential",
        "revoke",
        JSON.stringify({
          id: c.id,
          version: c.version,
          reason: "Synthetic concurrent revocation",
        }),
        s.key(),
      ]);
    await begin(one, s.worker);
    await one.query("SELECT lis_catalog_export($1)", [active.id]);
    await begin(two, s.registry);
    const revocation = revoke(two, s.reviewerCredential);
    assert.equal(await waiting(pids[1]), true);
    await one.query("COMMIT");
    await revocation;
    await two.query("COMMIT");
    await s.actor(s.worker);
    await assert.rejects(
      () => s.rpc("lis_catalog_export", [active.id]),
      /Privilege|kredensial/,
    );
    count++;
    console.log(
      "PASS clinical transaction holds source credential; revocation waits and subsequent export is blocked",
    );
    const fresh = await licenseAndGrant();
    await begin(two, s.registry);
    await revoke(two, fresh.c);
    await begin(one, s.worker);
    const clinical = one.query("SELECT lis_catalog_export($1)", [active.id]);
    const outcome = clinical.then(
      (v) => ({ value: v }),
      (error) => ({ error }),
    );
    assert.equal(await waiting(pids[0]), true);
    await two.query("COMMIT");
    const result = await outcome;
    assert.match(result.error?.message || "", /Kredensial sumber berubah/);
    await one.query("ROLLBACK");
    count++;
    console.log(
      "PASS revocation already in flight blocks clinical read then rejects after rechecking current credential state",
    );
    console.log(count + " professional source scenarios passed");
  } finally {
    if (pg) await pg.close();
    if (process.env.RS_TEST_RUNTIME)
      assert.equal(
        fs.existsSync(path.join(process.env.RS_TEST_RUNTIME, "cluster")),
        false,
      );
    console.log(
      "Native sessions/cluster and dummy records removed; no new result artifacts retained",
    );
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
