// OWNED_BY: generic. Native SQL lifecycle/security/source drift/concurrency, no retained result files.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),f=require('../lib/tech-delivery-fixture.cjs');let pg;
(async()=>{let count=0;try{const s=await f.createDeliveryFixture();pg=s.pg;
 const check=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
 let p,change,deployment,ticket;
 await check('explicit scope/license/module/SLA validation and stable retry',async()=>{
  const data=s.input(),key=s.key();p=await s.command('create',data,key);assert.deepEqual(await s.command('create',data,key),p);
  await assert.rejects(()=>s.command('create',{...data,title:'Changed'},key),/Retry/);
  await assert.rejects(()=>s.command('create',{...data,license_id:2}),/Lisensi tenant/);
  await assert.rejects(()=>s.command('create',{...data,modules:['lis']}),/paket/);
  await assert.rejects(()=>s.command('create',{...data,sla:{clock:'business_hours'}}),/elapsed_24x7/);
  await assert.rejects(()=>s.command('create',{...data,milestones:[data.milestones[0]]}),/Setiap modul/);
  await assert.rejects(()=>s.command('create',{...data,milestones:[{...data.milestones[0],due_at:'2026-11-01'},data.milestones[1]]}),/offset/);
 });
 await check('scope approval requires separate reviewer and stale updates reject',async()=>{
  p=await s.next(p,'submit');await assert.rejects(()=>s.next(p,'approve'),/berbeda/);
  await s.actor(s.receiver);p=await s.next(p,'approve');await s.actor(s.worker);
  await assert.rejects(()=>s.next({...p,ops_version:1},'start'),/berubah/);p=await s.next(p,'start');
  await assert.rejects(()=>s.next(p,'handover'),/belum siap/);
 });
 await check('actual successful release and independently verified deployment',async()=>{
  change=await s.ops('change','create',{title:'Synthetic HIS release',type:'code',risk:'Synthetic assessed risk',rollback:'Synthetic rollback SOP'});
  change=await s.opsNext('change',change,'submit');await s.actor(s.receiver);change=await s.opsNext('change',change,'approve');await s.actor(s.worker);
  change=await s.opsNext('change',change,'start',{preflight:{reference:'SYN-LOCAL-TEST'}});change=await s.opsNext('change',change,'complete',{release:'SYN-1.0',result:{reference:'SYN-TEST-PASS'}});
  deployment=await s.ops('deployment','report',{change_id:change.id,release:'SYN-1.0',module:'his',installation:'SYN-INSTALL',environment:'test',evidence:'SYN-INSTALL-OBSERVATION'});
  await s.actor(s.receiver);deployment=await s.opsNext('deployment',deployment,'verify',{evidence:'SYN-INDEPENDENT-OBSERVATION'});await s.actor(s.worker);
 });
 await check('source milestone submission, independent acceptance and immutable accepted transitions',async()=>{
  let milestones=await s.q('SELECT * FROM tech_delivery_milestones WHERE project_id=$1 ORDER BY id',[p.id]);
  for(let m of milestones){
   if(m.module_key)await assert.rejects(()=>s.next(p,'milestone_submit',{milestone_id:m.id,milestone_version:m.ops_version,evidence:'SYN-EVIDENCE',deployment_id:999}),/Deployment/);
   p=await s.next(p,'milestone_submit',{milestone_id:m.id,milestone_version:m.ops_version,evidence:'SYN-EVIDENCE',...(m.module_key?{deployment_id:deployment.id}:{})});m=p.milestone;
   await s.actor(s.receiver);p=await s.next(p,'milestone_accept',{milestone_id:m.id,milestone_version:m.ops_version});await s.actor(s.worker);
   await assert.rejects(()=>s.next(p,'milestone_return',{milestone_id:m.id,milestone_version:p.milestone.ops_version}),/Transisi/);
  }
 });
 await check('linked ticket uses source timestamps with explicit SLA; open ticket blocks handover',async()=>{
  ticket=await s.ops('ticket','create',{title:'Synthetic delivery incident',description:'Synthetic actual source issue',priority:'P1'});
  p=await s.next(p,'ticket_link',{ticket_id:ticket.id});await assert.rejects(()=>s.next(p,'handover'),/Tiket/);
  for(const kind of ['ticket','change','deployment']){const board=(await s.q('SELECT tech_ops_board($1,0) r',[kind]))[0].r;assert.equal(board.rows[0].deliveries[0].id,p.id);}
  await s.q("UPDATE tech_support_tickets SET created_at=now()-interval '20 minutes' WHERE id=$1",[ticket.id]);
  let row=(await s.q('SELECT tech_delivery_board(0) r'))[0].r.rows[0];assert.equal(row.tickets[0].response_breached,true);assert.equal(row.tickets[0].resolution_breached,true);
  ticket=await s.opsNext('ticket',ticket,'triage',{owner:s.worker});ticket=await s.opsNext('ticket',ticket,'start');ticket=await s.opsNext('ticket',ticket,'resolve',{resolution:'Synthetic verified fix'});
  await s.actor(s.receiver);ticket=await s.opsNext('ticket',ticket,'close');await s.actor(s.worker);
  p=await s.next(p,'handover');await s.actor();await assert.rejects(()=>s.next(p,'accept',{acceptance_reference:'SYN-CUSTOMER-EVIDENCE'}),/berbeda/);
  await s.actor(s.receiver);p=await s.next(p,'accept',{acceptance_reference:'SYN-CUSTOMER-EVIDENCE'});
  await assert.rejects(()=>s.next(p,'close'),/follow-up/);p=await s.next(p,'close',{followup_reference:'SYN-FOLLOWUP',followup_outcome:'Synthetic adoption observed and reviewed'});assert.equal(p.state,'closed');
 });
 await check('closed record preserves acceptance while source rollback/reopen visibly invalidates current readiness',async()=>{
  await s.actor(s.worker);ticket=await s.opsNext('ticket',ticket,'reopen');
  let row=(await s.q('SELECT tech_delivery_board(0) r'))[0].r.rows[0];assert.equal(row.state,'closed');assert.equal(row.health.current_source_valid,false);assert.match(row.health.issues.join(' '),/Tiket/);
  await s.opsNext('change',change,'rollback',{result:{reference:'SYN-ROLLBACK'}});row=(await s.q('SELECT tech_delivery_board(0) r'))[0].r.rows[0];assert.match(row.health.issues.join(' '),/Deployment/);
  await s.q("UPDATE tech_lisensi SET status='Dicabut' WHERE id=1");row=(await s.q('SELECT tech_delivery_board(0) r'))[0].r.rows[0];assert.match(row.health.issues.join(' '),/Lisensi/);
  assert.equal(row.acceptance_reference,'SYN-CUSTOMER-EVIDENCE');assert.equal(row.accepted_by,s.receiver);
 });
 await check('tenant/RBAC isolation, source projection excludes license secrets/prices and authenticated DML is denied',async()=>{
  const source=(await s.q("SELECT tech_delivery_sources('license',0) r"))[0].r;assert.ok(!JSON.stringify(source).includes('SYN-SECRET'));assert.ok(!JSON.stringify(source).includes('nilai'));
  await s.actor(s.foreign,s.B);assert.equal((await s.q('SELECT tech_delivery_board(0) r'))[0].r.rows.length,0);await assert.rejects(()=>s.next(p,'cancel'),/tidak ditemukan/);
  await s.actor(s.worker);await s.q("UPDATE user_profiles SET role='viewer' WHERE id=$1",[s.worker]);await assert.rejects(()=>s.q('SELECT tech_delivery_board(0)'),/Peran/);await s.q("UPDATE user_profiles SET role='tech' WHERE id=$1",[s.worker]);
  await assert.rejects(()=>s.q('SELECT tech_delivery_board(-1)'),/Offset/);await pg.exec('SET ROLE authenticated');
  await assert.rejects(()=>s.q("UPDATE tech_delivery_projects SET state='closed'"),/permission denied/);await assert.rejects(()=>s.q('DELETE FROM tech_delivery_history'),/permission denied/);await assert.rejects(()=>s.q('SELECT tech_delivery_health(1)'),/permission denied/);await pg.exec('RESET ROLE');
 });
 await check('scope, accepted milestone, final state and audit history resist direct mutation',async()=>{
  await assert.rejects(()=>s.q("UPDATE tech_delivery_projects SET title='Changed' WHERE id=$1",[p.id]),/immutable/);
  await assert.rejects(()=>s.q("UPDATE tech_delivery_milestones SET evidence='Changed' WHERE project_id=$1",[p.id]),/immutable/);
  await assert.rejects(()=>s.q("UPDATE tech_delivery_projects SET state='running' WHERE id=$1",[p.id]),/immutable/);
  await assert.rejects(()=>s.q('DELETE FROM tech_delivery_history WHERE project_id=$1',[p.id]),/append-only/);
  assert.ok((await s.q('SELECT tech_delivery_audit($1,0) r',[p.id]))[0].r.rows.length>5);
 });
 await check('native milestone contenders wait on source project and enforce version; identical retry remains single-write',async()=>{
  await s.q("UPDATE tech_lisensi SET status='Aktif' WHERE id=1");
  const one=await pg.connectSession(),two=await pg.connectSession();
  const pid=(await two.query('SELECT pg_backend_pid() id')).rows[0].id;
  const begin=async client=>{await client.query('BEGIN');await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",[s.worker,s.A]);await client.query('SET LOCAL ROLE authenticated');};
  const waiting=async()=>{for(let i=0;i<60;i++){if((await s.q('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid]))[0]?.wait_event_type==='Lock')return true;await new Promise(r=>setTimeout(r,20));}return false;};
  for(const sameKey of [false,true]){
   await s.actor();let r=await s.command('create',s.input());r=await s.next(r,'submit');await s.actor(s.receiver);r=await s.next(r,'approve');await s.actor(s.worker);r=await s.next(r,'start');
   const milestone=(await s.q("SELECT * FROM tech_delivery_milestones WHERE project_id=$1 AND code='onboarding'",[r.id]))[0];
   const data={id:r.id,version:r.ops_version,milestone_id:milestone.id,milestone_version:milestone.ops_version,evidence:'SYN-CONCURRENT-EVIDENCE',reason:'Synthetic concurrency'};
   const key=s.key(),query=(client,k)=>client.query("SELECT tech_delivery_command('milestone_submit',$1,$2) r",[JSON.stringify(data),k]);
   await begin(one);const first=(await query(one,key)).rows[0].r;await begin(two);
   const contender=query(two,sameKey?key:s.key()).then(value=>({value}),error=>({error}));assert.equal(await waiting(),true);await one.query('COMMIT');const result=await contender;
   if(sameKey){assert.deepEqual(result.value.rows[0].r,first);await two.query('COMMIT');}else{assert.match(result.error?.message||'',/Data berubah/);await two.query('ROLLBACK');}
   assert.equal((await s.q("SELECT count(*)::int n FROM tech_delivery_history WHERE project_id=$1 AND action='milestone_submit'",[r.id]))[0].n,1);
  }
 });
 console.log(count+' delivery source scenarios passed');
}finally{if(pg)await pg.close();if(process.env.RS_TEST_RUNTIME)assert.equal(fs.existsSync(path.join(process.env.RS_TEST_RUNTIME,'cluster')),false);console.log('Dummy database removed; no result artifacts retained');}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
