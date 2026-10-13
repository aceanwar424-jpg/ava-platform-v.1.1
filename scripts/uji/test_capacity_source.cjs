// OWNED_BY: generic. Source capture and separate declared synthetic historical calculation fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),f=require('../lib/capacity-source-fixture.cjs');let pg;
(async()=>{let n=0;try{const s=await f.createCapacityFixture();pg=s.pg;const check=async(name,fn)=>{await fn();n++;console.log('PASS '+name);};let cfg;
 await check('explicit reviewed method/clock/source/zero-day rules, stable retry and separate reviewer',async()=>{
  const data={policy:s.policy()},k=s.key();cfg=await s.command('create',data,k);assert.deepEqual(await s.command('create',data,k),cfg);await assert.rejects(()=>s.command('create',{policy:{...s.policy(),census_time:'24:01'}}),/Metode/);
  await assert.rejects(()=>s.command('create',{policy:{...s.policy(),same_day_los_days:null}}),/0 atau 1/);cfg=await s.next(cfg,'submit');await assert.rejects(()=>s.next(cfg,'approve'),/berbeda/);await s.actor(s.receiver);cfg=await s.next(cfg,'approve');await s.actor();
 });
 await check('opening refuses concurrent source write; successful retry captures actual source without partial cutover',async()=>{
  const writer=await pg.connectSession();await writer.query('BEGIN');await writer.query("SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",[s.admin,s.A]);await writer.query("UPDATE inpatient_beds SET notes='Synthetic concurrent source' WHERE id=1");
  await assert.rejects(()=>s.next(cfg,'activate'),/Sumber sedang berubah/);assert.equal((await s.q('SELECT count(*)::int n FROM rs_capacity_source_events'))[0].n,0);await writer.query('COMMIT');cfg=await s.next(cfg,'activate');assert.ok(cfg.cutover_at);
  const rows=await s.q('SELECT * FROM rs_capacity_source_events WHERE setup_id=$1',[cfg.id]);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.event_type==='opening'));assert.ok(!JSON.stringify(rows).includes('patient_name'));
 });
 await check('actual bed activation change is observed append-only; missing historical coverage never returns invented zero',async()=>{
  await s.q('UPDATE inpatient_beds SET is_active=false WHERE id=2');const row=(await s.q('SELECT * FROM rs_capacity_source_events ORDER BY id DESC LIMIT 1'))[0];assert.equal(row.snapshot.is_active,false);assert.equal(row.event_type,'update');
  await assert.rejects(()=>s.q('SELECT rs_capacity_report($1,current_date-2,current_date-1)',[cfg.id]),/cutover/);
  await assert.rejects(()=>s.q('SELECT rs_capacity_report($1,current_date,current_date)',[cfg.id]),/cutover/);
  await assert.rejects(()=>s.q('DELETE FROM rs_capacity_source_events'),/append-only/);await assert.rejects(()=>s.q("UPDATE rs_capacity_setups SET policy='{}' WHERE id=$1",[cfg.id]),/immutable/);
 });
 await check('actual admission and transfer RPCs produce source stay/bed history without altering clinical records',async()=>{
  await s.q('UPDATE inpatient_beds SET is_active=true WHERE id=2');const row=(await s.q('SELECT inp_admit_patient(1,1) r'))[0].r;
  const stay=(await s.q('SELECT * FROM inpatient_stays WHERE admission_id=1'))[0];assert.ok(stay.id);
  await pg.exec("SET TIME ZONE 'Asia/Jakarta'");await s.q("SELECT inp_transfer_bed($1,2,'Synthetic observed transfer')",[stay.id]);await pg.exec("SET TIME ZONE 'UTC'");
  const events=await s.q("SELECT * FROM rs_capacity_source_events WHERE setup_id=$1 AND kind='stay' ORDER BY id",[cfg.id]);assert.equal(events.length,2);assert.equal(events[0].snapshot.bed_id,1);assert.equal(events[1].snapshot.bed_id,2);assert.equal(events[1].snapshot.status,'Dirawat');assert.equal(new Date(events[0].snapshot.admitted_epoch).getTime(),new Date(events[1].snapshot.admitted_epoch).getTime());assert.equal(events[1].snapshot.timestamp_zone,'Asia/Jakarta');assert.ok(!JSON.stringify(events).includes('Synthetic patient'));assert.ok(row);
 });
 await check('new statistical version archives old coverage and preserves known admission epoch despite source-zone change',async()=>{
  const oldEpoch=(await s.q("SELECT snapshot->>'admitted_epoch' epoch FROM rs_capacity_source_events WHERE setup_id=$1 AND kind='stay' ORDER BY id DESC LIMIT 1",[cfg.id]))[0].epoch;
  let next=await s.command('create',{policy:{...s.policy(),source_timezone:'Asia/Jakarta'}});next=await s.next(next,'submit');await s.actor(s.receiver);next=await s.next(next,'approve');await s.actor();next=await s.next(next,'activate');
  assert.equal((await s.q('SELECT state FROM rs_capacity_setups WHERE id=$1',[cfg.id]))[0].state,'retired');const newEpoch=(await s.q("SELECT snapshot->>'admitted_epoch' epoch FROM rs_capacity_source_events WHERE setup_id=$1 AND kind='stay'",[next.id]))[0].epoch;assert.equal(new Date(newEpoch).getTime(),new Date(oldEpoch).getTime());
 });
 let archive;
 await check('declared synthetic historical archive calculates inclusive patient-days, variable bed denominator and full discharge LOS',async()=>{
  // This is a calculation fixture, not an API that imports or fabricates history.
  await s.actor(s.foreign,s.B);
  archive=(await s.q("INSERT INTO rs_capacity_setups(tenant_id,policy,state,created_by,reviewed_by,cutover_at) VALUES($1,$2,'active',$3,$3,current_date-interval '5 days') RETURNING *",[s.B,JSON.stringify(s.policy()),s.foreign]))[0];
  const add=async(kind,id,snapshot,date)=>s.q("INSERT INTO rs_capacity_source_events(tenant_id,setup_id,kind,source_id,snapshot,observed_at,event_type) VALUES($1,$2,$3,$4,$5,current_date+($6::interval),'opening')",[s.B,archive.id,kind,id,JSON.stringify(snapshot),date]);
  await add('bed',3,{id:3,is_active:true,status:'Terisi'},'-5 days');await add('bed',4,{id:4,is_active:true,status:'Kosong'},'-5 days');await add('bed',4,{id:4,is_active:false,status:'Kosong'},'-2 days');
  const dates=(await s.q("SELECT (current_date-3)::text a,(current_date-2)::text b,(current_date-1)::text c"))[0];
  const stay={id:9001,bed_id:3,status:'Dirawat',admitted_at:dates.a+'T08:00:00',discharged_at:null};
  await add('stay',9001,stay,'-3 days 8 hours');await add('stay',9001,{...stay,status:'Meninggal',discharged_at:dates.c+'T12:00:00'},'-1 days 12 hours');
  await add('stay',9002,{id:9002,bed_id:3,status:'Pulang',admitted_at:dates.c+'T14:00:00',discharged_at:dates.c+'T16:00:00'},'-1 days 16 hours');
  const r=(await s.q('SELECT rs_capacity_report($1,current_date-3,current_date-1) r',[archive.id]))[0].r;
  assert.equal(r.bed_days,4);assert.equal(r.patient_days,4);assert.equal(r.discharges,2);assert.equal(r.los_total,3);assert.equal(r.BOR,100);assert.equal(r.ALOS,1.5);assert.equal(r.TOI,0);assert.equal(r.BTO,1.5);assert.equal(r.rows.length,3);assert.equal(r.national_submission,false);
  assert.equal((await s.q("SELECT after_row->>'source_watermark' watermark FROM rs_capacity_audit WHERE setup_id=$1 AND action='report' ORDER BY id DESC LIMIT 1",[archive.id]))[0].watermark,String(r.source_watermark));
 });
 await check('census method counts zero-bed/no-discharge as unavailable and rejects incomplete timestamps instead of clinical guesses',async()=>{
  await s.q("INSERT INTO rs_capacity_setups(tenant_id,policy,state,created_by,reviewed_by,cutover_at) VALUES($1,$2,'retired',$3,$3,current_date-interval '5 days')",[s.B,JSON.stringify({...s.policy(),patient_day_method:'census'}),s.foreign]);
  let id=(await s.q('SELECT max(id) id FROM rs_capacity_setups'))[0].id;let r=(await s.q('SELECT rs_capacity_report($1,current_date-3,current_date-1) r',[id]))[0].r;assert.equal(r.BOR,null);assert.equal(r.ALOS,null);assert.equal(r.BTO,null);assert.equal(r.TOI,null);
  await s.q("INSERT INTO rs_capacity_source_events(tenant_id,setup_id,kind,source_id,snapshot,observed_at,event_type) VALUES($1,$2,'stay',9999,'{\"status\":\"Dirawat\",\"admitted_at\":null}',current_date-interval '4 days','opening')",[s.B,id]);await assert.rejects(()=>s.q('SELECT rs_capacity_report($1,current_date-3,current_date-1)',[id]),/Timestamp/);
 });
 await check('census and same-day policy variants avoid double counting and use the reviewed LOS rule',async()=>{
  for(const flag of [0,1]){
   const policy={...s.policy(),patient_day_method:'census',same_day_patient_days:flag,same_day_los_days:flag};
   const id=(await s.q("INSERT INTO rs_capacity_setups(tenant_id,policy,state,created_by,reviewed_by,cutover_at) VALUES($1,$2,'retired',$3,$3,current_date-interval '5 days') RETURNING id",[s.B,JSON.stringify(policy),s.foreign]))[0].id;
   await s.q("INSERT INTO rs_capacity_source_events(tenant_id,setup_id,kind,source_id,snapshot,observed_at,event_type) SELECT tenant_id,$1,kind,source_id,snapshot,observed_at,event_type FROM rs_capacity_source_events WHERE setup_id=$2",[id,archive.id]);
   const r=(await s.q('SELECT rs_capacity_report($1,current_date-3,current_date-1) r',[id]))[0].r;assert.equal(r.patient_days,2+flag);assert.equal(r.los_total,2+flag);assert.equal(r.BOR,(2+flag)/4*100);
  }
 });
 await check('late backdated source invalidates an affected historical report instead of silently retaining obsolete counts',async()=>{
  const latest=(await s.q("SELECT snapshot FROM rs_capacity_source_events WHERE setup_id=$1 AND source_id=9002 ORDER BY id DESC LIMIT 1",[archive.id]))[0].snapshot;
  await s.q("INSERT INTO rs_capacity_source_events(tenant_id,setup_id,kind,source_id,snapshot,observed_at,event_type) VALUES($1,$2,'stay',9002,$3,clock_timestamp(),'update')",[s.B,archive.id,JSON.stringify(latest)]);
  await assert.rejects(()=>s.q('SELECT rs_capacity_report($1,current_date-3,current_date-1)',[archive.id]),/backdate perlu rekonsiliasi/);
 });
 await check('tenant/profession read isolation, immutable configuration and authenticated direct writes denied',async()=>{
  await assert.rejects(()=>s.next(cfg,'cancel'),/tidak ditemukan/);await s.actor(s.worker);assert.equal((await s.q('SELECT rs_capacity_board(0) r'))[0].r.rows.length,2);await assert.rejects(()=>s.command('create',{policy:s.policy()}),/Peran/);
  await pg.exec('SET ROLE authenticated');await assert.rejects(()=>s.q('SELECT * FROM rs_capacity_source_events'),/permission denied/);await assert.rejects(()=>s.q("UPDATE rs_capacity_setups SET state='active'"),/permission denied/);await pg.exec('RESET ROLE');
 });
 console.log(n+' capacity source/calculation scenarios passed');
}finally{if(pg)await pg.close();if(process.env.RS_TEST_RUNTIME)assert.equal(fs.existsSync(path.join(process.env.RS_TEST_RUNTIME,'cluster')),false);console.log('Dummy native database removed; no new test files retained');}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
