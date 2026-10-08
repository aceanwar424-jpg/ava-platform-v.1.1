// OWNED_BY: generic; real SQL with isolated synthetic fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=require('../lib/hospital-fixture.cjs');
let pg,seq=0;const results=[];
const key=()=>`policy-sprint-synthetic-${++seq}`;
const query=async(sql,args=[])=> (await pg.query(sql,args)).rows;
const rpc=async(name,args)=> (await query(`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))[0].result;
async function actor(id=fixture.admin,tenant=fixture.A,role='super_admin'){
 await pg.query('UPDATE user_profiles SET role=$1 WHERE id=$2',[role,id]);
 await query("SELECT set_config('app.user_id',$1,false),set_config('app.tenant_id',$2,false)",[id,tenant]);
}
async function check(name,fn){await fn();results.push({name,status:'passed'});console.log('PASS '+name);}
async function policy(action,id,data,k=key()){return rpc('ops_policy_command',[id,action,JSON.stringify(data),k]);}
async function sprint(action,data,k=key()){return rpc('tech_sprint_command',[action,JSON.stringify({team:'synthetic-team',reason:'Synthetic request',...data}),k]);}
const settings={duration_days:14,velocity_window:3,points:[1,2,3,5,8],done_checks:['review','test'],carry_over:'backlog',members:[fixture.admin]};
async function activePolicy(kind,scope,payload){await actor();let p=await policy('create',null,{kind,scope,payload,reason:'Synthetic draft'});p=await policy('submit',p.id,{expected_state:p.state,reason:'Synthetic review'});const clinical=kind==='clinical_template'||kind==='authority'&&payload.rules.some(r=>r.action.startsWith('clinical.'));await actor(fixture.receiver,fixture.A,clinical?'dokter':'direktur');p=await policy('approve',p.id,{expected_state:p.state,reason:'Synthetic approved'});await actor(fixture.receiver,fixture.A,'direktur');p=await policy('activate',p.id,{expected_state:p.state,reason:'Synthetic activation',effective_at:new Date().toISOString()});await actor();return p;}
(async()=>{
 pg=await fixture.createHospitalFixture();
 for(const f of ['0074_operational_policy_governance.sql','0075_team_sprint_lifecycle.sql','0076_clinical_form_records.sql'])await pg.exec(fs.readFileSync(path.join(__dirname,'../../db/migrations',f),'utf8'));
 await check('missing policy fails closed; invalid configuration rejected',async()=>{
  await assert.rejects(()=>rpc('ops_active_policy',['sprint','synthetic-team']),/belum tersedia/);
  await assert.rejects(()=>policy('create',null,{kind:'sprint',scope:'synthetic-team',payload:{},reason:'Synthetic'}),/wajib/);
  await assert.rejects(()=>policy('create',null,{kind:'administrative',scope:'default',payload:{},reason:'Synthetic'}),/wajib/);
 });
 await check('administrative policy requires timezone, cutoff and bounded deposit percentage',async()=>{
  const data={room_method:'calendar',transfer_method:'cutoff',deposit_method:'percentage',deposit_value:20,timezone:'Asia/Jakarta',cutoff:'12:00',rounding:'up',minimum_units:1,payer_precedence:'explicit_contract_only'};
  const make=payload=>policy('create',null,{kind:'administrative',scope:'synthetic-class',payload,reason:'Synthetic rules'});
  await assert.rejects(()=>make({...data,cutoff:'24:00'}),/Cutoff/);await assert.rejects(()=>make({...data,timezone:'invalid-zone'}),/Timezone/);await assert.rejects(()=>make({...data,deposit_value:101}),/maksimal/);assert.equal((await make(data)).state,'draft');
 });
 let p;
 await check('versioned draft, retries and maker-checker approval',async()=>{
  const k=key(),d={kind:'sprint',scope:'synthetic-team',payload:settings,reason:'Synthetic draft'};
  p=await policy('create',null,d,k);assert.equal((await policy('create',null,d,k)).id,p.id);
  await assert.rejects(()=>policy('create',null,{...d,reason:'Different'},k),/Retry/);
  p=await policy('submit',p.id,{expected_state:'draft',reason:'Synthetic review'});
  await assert.rejects(()=>policy('approve',p.id,{expected_state:'in_review',reason:'Synthetic approval'}),/berbeda/);
  await actor(fixture.receiver,fixture.A,'direktur');p=await policy('approve',p.id,{expected_state:'in_review',reason:'Synthetic approved'});
  await assert.rejects(()=>policy('activate',p.id,{expected_state:'approved',reason:'Synthetic activation'}),/Tanggal/);
  p=await policy('activate',p.id,{expected_state:'approved',reason:'Synthetic activation',effective_at:new Date().toISOString()});
  await actor();assert.equal((await rpc('ops_active_policy',['sprint','synthetic-team'])).id,p.id);
 });
 await check('clinical template cannot be approved by administrator',async()=>{
  let c=await policy('create',null,{kind:'clinical_template',scope:'synthetic-ward',payload:{title:'Synthetic assessment',fields:[{key:'note',label:'Note',type:'text',required:true}],signer_roles:['dokter']},reason:'Synthetic draft'});
  c=await policy('submit',c.id,{expected_state:'draft',reason:'Synthetic review'});
  await actor(fixture.receiver,fixture.A,'super_admin');await assert.rejects(()=>policy('approve',c.id,{expected_state:c.state,reason:'Synthetic review'}),/Peran/);
  await actor(fixture.receiver,fixture.A,'dokter');c=await policy('approve',c.id,{expected_state:c.state,reason:'Synthetic clinical review'});assert.equal(c.state,'approved');await actor();
 });
 await check('cross tenant and viewer cannot mutate or activate policies',async()=>{
  await actor(fixture.foreign,fixture.B);await assert.rejects(()=>policy('retire',p.id,{expected_state:'active',reason:'Synthetic forbidden'}),/tidak ditemukan/);
  await actor(fixture.worker,fixture.A,'viewer');await assert.rejects(()=>policy('create',null,{kind:'sprint',scope:'x',payload:settings,reason:'Synthetic forbidden'}),/Peran/);await actor();
 });
 let s,i,j;
 await check('team scale, planning, assignment and active sprint gates',async()=>{
  await actor(fixture.receiver,fixture.A,'tech');await assert.rejects(()=>rpc('tech_sprint_board',['synthetic-team']),/anggota/);await actor();
  await assert.rejects(()=>sprint('create_item',{title:'Synthetic invalid',points:99}),/skala/);
  s=await sprint('create_sprint',{title:'Synthetic sprint 1'});i=await sprint('create_item',{title:'Synthetic item',points:5});j=await sprint('create_item',{title:'Synthetic unfinished',points:3});
  i=await sprint('assign',{id:i.id,version:i.version,sprint_id:s.id});j=await sprint('assign',{id:j.id,version:j.version,sprint_id:s.id});
  await assert.rejects(()=>sprint('doing',{id:i.id,version:i.version}),/aktif/);
  s=await sprint('start',{id:s.id,version:s.version});
  i=await sprint('doing',{id:i.id,version:i.version});
  await assert.rejects(()=>sprint('done',{id:i.id,version:i.version,checks:{review:true},evidence:'Synthetic done'}),/DoD/);
 });
 await check('DoD evidence, retry and stale version protection',async()=>{
  const d={id:i.id,version:i.version,checks:{review:true,test:true},evidence:'Synthetic tested'},k=key();i=await sprint('done',d,k);assert.equal((await sprint('done',d,k)).version,i.version);
  await assert.rejects(()=>sprint('return',{id:i.id,version:1}),/Data berubah/);
 });
 await check('backlog re-estimation and correction of Done preserve before-events',async()=>{
  let b=await sprint('create_item',{title:'Synthetic estimate',points:1});b=await sprint('edit_item',{id:b.id,version:b.version,title:'Synthetic revised',points:2});assert.equal(b.points,2);
  const event=(await query("SELECT evidence FROM tech_sprint_events WHERE action='edit_item' AND object_id=$1",[b.id]))[0].evidence;assert.equal(event.before.points,1);
  await assert.rejects(()=>sprint('edit_item',{id:i.id,version:i.version,title:'Forbidden',points:8}),/backlog/);
  i=await sprint('reopen',{id:i.id,version:i.version});assert.equal(i.state,'doing');i=await sprint('done',{id:i.id,version:i.version,checks:{review:true,test:true},evidence:'Synthetic reverified'});
 });
 await check('closing snapshots completed points and moves unfinished work without duplication',async()=>{
  s=await sprint('close',{id:s.id,version:s.version});assert.equal(s.closed_points,5);assert.equal(s.closed_items.length,1);
  const board=await rpc('tech_sprint_board',['synthetic-team']);assert.equal(board.velocity,5);assert.equal(board.sample_size,1);assert.equal(board.items.find(x=>x.id===j.id).state,'backlog');
  await assert.rejects(()=>sprint('return',{id:i.id,version:i.version}),/tertutup/);
 });
 await check('second sprint velocity uses only closed Done snapshots',async()=>{
  let s2=await sprint('create_sprint',{title:'Synthetic sprint 2'});j=(await rpc('tech_sprint_board',['synthetic-team'])).items.find(x=>x.id===j.id);
  j=await sprint('assign',{id:j.id,version:j.version,sprint_id:s2.id});s2=await sprint('start',{id:s2.id,version:s2.version});j=await sprint('doing',{id:j.id,version:j.version});j=await sprint('done',{id:j.id,version:j.version,checks:{review:true,test:true},evidence:'Synthetic completed'});s2=await sprint('close',{id:s2.id,version:s2.version});
  const b=await rpc('tech_sprint_board',['synthetic-team']);assert.equal(b.velocity,4);assert.equal(b.sample_size,2);assert.equal(Number((await query('SELECT closed_points FROM tech_team_sprints WHERE id=$1',[s.id]))[0].closed_points),5);
 });
 await check('new policy revision preserves closed velocity and next-planning carry-over history',async()=>{
  const v2=await activePolicy('sprint','synthetic-team',{...settings,carry_over:'next_planning'});assert.equal(v2.revision,2);
  let s3=await sprint('create_sprint',{title:'Synthetic sprint 3'});let x=await sprint('create_item',{title:'Synthetic carry item',points:2});x=await sprint('assign',{id:x.id,version:x.version,sprint_id:s3.id});s3=await sprint('start',{id:s3.id,version:s3.version});s3=await sprint('close',{id:s3.id,version:s3.version});
  const b=await rpc('tech_sprint_board',['synthetic-team']);const carry=b.items.find(y=>y.id===x.id);assert.equal(carry.state,'planned');assert.notEqual(carry.sprint_id,s3.id);assert.equal(b.sprints.find(y=>y.id===carry.sprint_id).state,'planning');assert.equal(b.sample_size,3);assert.equal((await query("SELECT count(*)::int n FROM tech_sprint_events WHERE action='carry_over' AND object_id=$1",[x.id]))[0].n,1);
 });
 await check('clinical templates, authority, role signing and immutable amendment',async()=>{
  await activePolicy('authority','synthetic-ward',{rules:[{action:'clinical.record',roles:['nurse','dokter'],separate_verifier:false},{action:'clinical.sign',roles:['dokter'],separate_verifier:true}]});
  let c=(await query("SELECT * FROM ops_policy_versions WHERE kind='clinical_template'"))[0];
  c=await policy('activate',c.id,{expected_state:'approved',reason:'Synthetic activate',effective_at:new Date().toISOString()});
  const d={admission_id:1,policy_id:c.id,values:{note:'Synthetic note'},reason:'Synthetic assessment'};
  await assert.rejects(()=>rpc('rs_clinical_command',['record',JSON.stringify(d),key()]),/Peran/);
  await actor(fixture.worker,fixture.A,'nurse');
  await assert.rejects(()=>rpc('rs_clinical_command',['record',JSON.stringify({...d,values:{}}),key()]),/wajib/);
  await assert.rejects(()=>rpc('rs_clinical_command',['record',JSON.stringify({...d,admission_id:3}),key()]),/tenant/);
  let r=await rpc('rs_clinical_command',['record',JSON.stringify(d),key()]);
  await assert.rejects(()=>rpc('rs_clinical_command',['sign',JSON.stringify({id:r.id,reason:'Synthetic sign'}),key()]),/Profesi/);
  await actor(fixture.receiver,fixture.A,'dokter');r=await rpc('rs_clinical_command',['sign',JSON.stringify({id:r.id,reason:'Synthetic sign'}),key()]);assert.ok(r.signed_at);
  await actor(fixture.worker,fixture.A,'nurse');const amended=await rpc('rs_clinical_command',['record',JSON.stringify({...d,amendment_of:r.id,values:{note:'Synthetic correction'}}),key()]);assert.equal(amended.amendment_of,r.id);
  assert.equal((await query('SELECT form_values FROM rs_clinical_records WHERE id=$1',[r.id]))[0].form_values.note,'Synthetic note');await actor();
 });
 await check('RLS and direct mutation denied for authenticated session',async()=>{
  await pg.exec('SET ROLE authenticated');await assert.rejects(()=>query('UPDATE ops_policy_versions SET payload=\'{}\''),/permission denied/);await assert.rejects(()=>query('DELETE FROM tech_backlog_items'),/permission denied/);
  await query("SELECT set_config('app.tenant_id',$1,false)",[fixture.B]);assert.equal((await query('SELECT count(*)::int n FROM ops_policy_versions'))[0].n,0);await pg.exec('RESET ROLE');await actor(fixture.worker,fixture.A,'nurse');await pg.exec('SET ROLE authenticated');assert.equal((await query('SELECT count(*)::int n FROM rs_clinical_records'))[0].n,2);await assert.rejects(()=>query('UPDATE rs_clinical_records SET form_values=\'{}\''),/permission denied/);await pg.exec('RESET ROLE');await actor(fixture.worker,fixture.A,'finance_staff');await pg.exec('SET ROLE authenticated');assert.equal((await query('SELECT count(*)::int n FROM rs_clinical_records'))[0].n,0);await pg.exec('RESET ROLE');await actor();
 });
 const out=path.join(__dirname,'../../docs/audit-evidence/2026-10-08');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'policy-sprint-simulation.json'),JSON.stringify({environment:'isolated PGlite SQL; synthetic only',production:false,results},null,2)+'\n');
 await pg.close();
})().catch(async e=>{console.error(e);if(pg)await pg.close();process.exitCode=1});
