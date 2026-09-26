// OWNED_BY: generic. Synthetic contract test; never connects to production.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../desktop-app/node_modules/@electric-sql/pglite');

const migration = fs.readFileSync('db/migrations/0058_wellness_cardiometabolic_program.sql', 'utf8');
const consentMigration = fs.readFileSync('db/migrations/0059_wellness_consent_gate.sql', 'utf8');
const migrations = `${migration}\n${consentMigration}`;
const navigation = fs.readFileSync('ava-platform/apps/navigation.js', 'utf8');
const html = fs.readFileSync('ava-platform/apps/index.html', 'utf8');
const ui = fs.readFileSync('ava-platform/apps/wellness.js', 'utf8') + fs.readFileSync('ava-platform/js/wellness-flow.js', 'utf8');

for (const token of ['wellness_programs','wellness_enrollments','wellness_observations','wellness_import_batches','wellness_reminder_rules','wellness_tasks']) {
  assert(migration.includes(token), `missing ${token}`);
}
for (const rpc of ['wellness_personal_dashboard','wellness_accept_consent','wellness_record_self','wellness_corporate_dashboard','wellness_import_ihc','wellness_admin_save_program']) {
  assert(migrations.includes(`FUNCTION public.${rpc}`), `missing ${rpc}`);
  assert(ui.includes(`'${rpc}'`), `UI does not call ${rpc}`);
}
assert(!/Astra Honda|\bAHM\b/i.test(migration + navigation + ui), 'client identity leaked into generic core');
for (const view of ['wellness-personal-view','corporate-wellness-view','wellness-admin-view','wellness-import-view']) {
  assert(navigation.includes(`'${view}'`), `menu missing ${view}`);
  assert.equal((html.match(new RegExp(`id="${view}"`, 'g')) || []).length, 1, `HTML target ${view}`);
}
assert(migration.includes("'privacy_mode','aggregate_only'"));
assert(migration.includes('small_cell_threshold'));
assert(migration.includes("'self_reported','unverified'"));
assert(migration.includes("'ihc_bulk','verified'"));

async function main() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE TABLE public.corporates(id bigint PRIMARY KEY,corporate_name text,status text);
    CREATE TABLE public.corporate_employees(id bigint PRIMARY KEY,corporate_id bigint REFERENCES public.corporates(id),employee_id text,email text,status text);
    CREATE TABLE public.mpi_person(id uuid PRIMARY KEY);
    CREATE TABLE public.user_profiles(id uuid PRIMARY KEY,tenant_id uuid,role text,corporate_id bigint);
    INSERT INTO public.corporates VALUES(10,'Synthetic Corporate','Aktif');
    INSERT INTO public.corporate_employees VALUES(100,10,'SYN-001','participant@example.invalid','Aktif');
    INSERT INTO auth.users VALUES
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin@example.invalid'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','participant@example.invalid'),
      ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','hr@example.invalid');
    INSERT INTO public.user_profiles VALUES
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','super_admin',NULL),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','patient',NULL),
      ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','corporate',10);
    SELECT set_config('test.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
  `);
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(consentMigration);
  await db.exec(consentMigration);

  const saved = await db.query(`SELECT wellness_admin_save_program($1::jsonb) AS value`, [JSON.stringify({
    corporate_id: 10, code: 'SYN-CARDIO', name: 'Synthetic Cardiometabolic', starts_on: '2026-09-22', status: 'pilot',
    measurement_plan: { blood_pressure: 'daily', blood_glucose: 'daily' }
  })]);
  const programId = saved.rows[0].value.id;
  assert(programId);
  const enrolled = await db.query(`SELECT wellness_admin_enroll_roster($1) AS value`, [programId]);
  assert.equal(enrolled.rows[0].value.linked_accounts, 1);

  await db.exec(`SELECT set_config('test.uid','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);`);
  const personalBefore = (await db.query(`SELECT wellness_personal_dashboard() AS value`)).rows[0].value;
  assert.equal(personalBefore.programs.length, 1);
  assert.equal(personalBefore.programs[0].consent_status, 'pending');
  await assert.rejects(
    db.query(`SELECT wellness_record_self($1,'blood_pressure',$2::jsonb,$3,'resting','synthetic device',NULL,'self-before-consent')`, [
      programId, JSON.stringify({ systolic: 120, diastolic: 80, pulse: 72 }), '2026-09-22T08:00:00+07:00'
    ]),
    /Persetujuan peserta belum diberikan/
  );
  await assert.rejects(
    db.query(`SELECT wellness_accept_consent($1,'wellness-privacy-v1',false)`, [programId]),
    /Persetujuan harus diberikan secara eksplisit/
  );
  const consent = await db.query(`SELECT wellness_accept_consent($1,'wellness-privacy-v1',true) AS value`, [programId]);
  assert.equal(consent.rows[0].value.consent_status, 'granted');
  await db.query(`SELECT wellness_record_self($1,'blood_pressure',$2::jsonb,$3,'resting','synthetic device',NULL,'self-001')`, [
    programId, JSON.stringify({ systolic: 120, diastolic: 80, pulse: 72 }), '2026-09-22T08:00:00+07:00'
  ]);
  const personalAfter = (await db.query(`SELECT wellness_personal_dashboard() AS value`)).rows[0].value;
  assert.equal(personalAfter.observations.length, 3);
  assert(personalAfter.observations.every(row => row.source === 'self_reported' && row.verification_status === 'unverified'));
  await assert.rejects(
    db.query(`SELECT wellness_record_self($1,'blood_glucose','{}'::jsonb,$2,'fasting',NULL,NULL,'self-empty')`, [programId, '2026-09-22T08:05:00+07:00']),
    /Nilai gula darah tidak valid/
  );
  await assert.rejects(db.query(`SELECT wellness_corporate_dashboard(NULL,NULL)`), /Akses monitoring corporate diperlukan/);

  await db.exec(`SELECT set_config('test.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);`);
  const imported = await db.query(`SELECT wellness_import_ihc($1,'synthetic.csv','synthetic-checksum',$2::jsonb) AS value`, [programId, JSON.stringify([{
    employee_id: 'SYN-001', measured_at: '2026-09-22T09:00:00+07:00', glucose: '105', glucose_context: 'fasting', external_id: 'IHC-SYN-001'
  }])]);
  assert.equal(imported.rows[0].value.accepted_rows, 1);

  await db.exec(`SELECT set_config('test.uid','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);`);
  const corporate = (await db.query(`SELECT wellness_corporate_dashboard(NULL,NULL) AS value`)).rows[0].value;
  assert.equal(corporate.privacy_mode, 'aggregate_only');
  assert.equal(corporate.programs.length, 1);
  assert.equal(corporate.programs[0].avg_glucose_30d, null);
  assert(!JSON.stringify(corporate).includes('SYN-001'));

  await db.exec(`SET ROLE authenticated;`);
  await assert.rejects(db.query(`SELECT count(*) FROM public.wellness_observations`), /permission denied/i);
  const corporateAsAuthenticated = (await db.query(`SELECT wellness_corporate_dashboard(NULL,NULL) AS value`)).rows[0].value;
  assert.equal(corporateAsAuthenticated.privacy_mode, 'aggregate_only');
  await db.exec(`RESET ROLE;`);

  await db.close();
  console.log('PASS wellness cardiometabolic: repeatable migrations, explicit consent gate, personal self-entry, verified IHC import, aggregate-only HR view, small-cell suppression, generic menus.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
