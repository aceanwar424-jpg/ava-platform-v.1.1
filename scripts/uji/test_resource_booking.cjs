const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),fixture=require('../lib/rs-engine-fixture.cjs');
let pg,n=0,results=[],cleanup=false,failure;const key=()=>`synthetic-booking-${++n}`;
async function query(sql,args=[]){return(await pg.query(sql,args)).rows;}
async function rpc(name,args){return(await query(`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))[0].result;}
async function actor(id=fixture.admin,tenant=fixture.A,role='super_admin'){await pg.query('UPDATE user_profiles SET role=$1 WHERE id=$2',[role,id]);await query("SELECT set_config('app.user_id',$1,false),set_config('app.tenant_id',$2,false)",[id,tenant]);}
async function activate(kind,scope,payload){await actor();let p=await rpc('ops_policy_command',[null,'create',JSON.stringify({kind,scope,payload,reason:'Synthetic draft'}),key()]);p=await rpc('ops_policy_command',[p.id,'submit',JSON.stringify({expected_state:'draft',reason:'Synthetic review'}),key()]);await actor(fixture.receiver,fixture.A,'direktur');p=await rpc('ops_policy_command',[p.id,'approve',JSON.stringify({expected_state:'in_review',reason:'Synthetic approval'}),key()]);p=await rpc('ops_policy_command',[p.id,'activate',JSON.stringify({expected_state:'approved',reason:'Synthetic activate',effective_at:new Date().toISOString()}),key()]);await actor();return p;}
async function check(name,fn){await fn();results.push({name,status:'passed'});console.log('PASS '+name);}
const future=m=>new Date(Date.now()+m*60000).toISOString();
async function reserve(start=60,end=90,resources=[{master_id:1,units:1}],extra={},k=key()){return rpc('rs_booking_command',['reserve',JSON.stringify({scope:'rs-operating-room',purpose:'maintenance',starts_at:future(start),ends_at:future(end),resources,reason:'Synthetic booking',...extra}),k]);}
async function transition(b,action){return rpc('rs_booking_command',[action,JSON.stringify({id:b.id,version:b.version,reason:'Synthetic '+action}),key()]);}
(async()=>{
 try{
  pg=await fixture.createEngineFixture();
  await activate('authority','rs-operating-room',{rules:['reserve','confirm','start','complete','cancel','expire'].map(action=>({action:'resource.'+action,roles:['super_admin'],separate_verifier:false}))});
  await activate('resources','rs-operating-room',{timezone:'Asia/Jakarta',expiry_minutes:30,resources:[{master_id:1,capacity:2,buffer_before_minutes:5,buffer_after_minutes:5},{master_id:2,capacity:1,buffer_before_minutes:5,buffer_after_minutes:5}]});
  await check('invalid physical capacity, foreign resource and missing policy denied',async()=>{
   await assert.rejects(()=>activate('resources','invalid',{timezone:'Asia/Jakarta',expiry_minutes:30,resources:[{master_id:2,capacity:2,buffer_before_minutes:0,buffer_after_minutes:0}]}),/fisik/);await actor();
   await assert.rejects(()=>reserve(60,90,[{master_id:3,units:1}]),/belum disahkan/);
   await assert.rejects(()=>reserve(60,90,[{master_id:1,units:1}],{scope:'unknown'}),/belum tersedia/);
  });
  await check('exact interval peak allows disjoint reservations under shared capacity',async()=>{
   await reserve(60,70);await reserve(80,90);await reserve(65,85);await assert.rejects(()=>reserve(68,82),/Benturan/);
  });
  await check('multi-resource booking rolls back completely on conflict',async()=>{
   const single=await reserve(120,150,[{master_id:2,units:1}]);const before=(await query('SELECT count(*)::int n FROM rs_resource_bookings'))[0].n;
   await assert.rejects(()=>reserve(125,140,[{master_id:1,units:1},{master_id:2,units:1}]),/Benturan/);assert.equal((await query('SELECT count(*)::int n FROM rs_resource_bookings'))[0].n,before);
   await transition(single,'cancel');await reserve(125,140,[{master_id:1,units:1},{master_id:2,units:1}]);
  });
  await check('retry stable, changed input rejected, service source and tenant enforced',async()=>{
   const d={scope:'rs-operating-room',purpose:'maintenance',starts_at:future(200),ends_at:future(230),resources:[{master_id:2,units:1}],reason:'Synthetic retry'},k=key();const b=await rpc('rs_booking_command',['reserve',JSON.stringify(d),k]);assert.equal((await rpc('rs_booking_command',['reserve',JSON.stringify(d),k])).id,b.id);await assert.rejects(()=>rpc('rs_booking_command',['reserve',JSON.stringify({...d,reason:'Different'}),k]),/Retry/);
   await assert.rejects(()=>reserve(260,280,[{master_id:1,units:1}],{purpose:'service',admission_id:1,order_id:999}),/Order sumber/);
   const order=await rpc('rs_create_order',['rs-operating-room','Synthetic surgery','Synthetic unit',1,'normal',key()]);await reserve(260,280,[{master_id:1,units:1}],{purpose:'service',admission_id:1,order_id:order.id});
   await actor(fixture.foreign,fixture.B);await assert.rejects(()=>transition(b,'confirm'),/tidak ditemukan/);await actor();
  });
  await check('expired holds free capacity and stale/invalid transitions fail',async()=>{
   let b=await reserve(350,370,[{master_id:2,units:1}]);await pg.query("UPDATE rs_resource_bookings SET expires_at=now()-interval '1 minute' WHERE id=$1",[b.id]);await assert.rejects(()=>transition(b,'confirm'),/Transisi/);await reserve(350,370,[{master_id:2,units:1}]);b=await transition(b,'expire');assert.equal(b.state,'expired');await assert.rejects(()=>transition(b,'complete'),/Transisi/);
  });
  await check('active overruns keep resources blocked until completion and recovery buffer',async()=>{
   let b=await reserve(0,20,[{master_id:2,units:1}]);b=await transition(b,'confirm');await assert.rejects(()=>transition({...b,version:1},'start'),/Data berubah/);b=await transition(b,'start');await assert.rejects(()=>reserve(500,510,[{master_id:2,units:1}]),/Benturan/);b=await transition(b,'complete');assert.equal(b.state,'completed');await assert.rejects(()=>reserve(10,15,[{master_id:2,units:1}]),/Benturan/);await reserve(30,40,[{master_id:2,units:1}]);
  });
  await check('viewer denied, authenticated mutation denied and tenant RLS isolated',async()=>{
   await actor(fixture.worker,fixture.A,'viewer');await assert.rejects(()=>reserve(),/Peran/);await actor();await pg.exec('SET ROLE authenticated');await assert.rejects(()=>pg.query("UPDATE rs_resource_bookings SET state='completed'"),/permission denied/);await query("SELECT set_config('app.tenant_id',$1,false)",[fixture.B]);assert.equal((await query('SELECT count(*)::int n FROM rs_resource_bookings'))[0].n,0);await pg.exec('RESET ROLE');await actor();
  });
 }catch(error){failure=error;}finally{if(pg){await pg.close();cleanup=true;}}
 const out=path.join(__dirname,'../../docs/audit-evidence/2026-10-09');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'resource-booking-simulation.json'),JSON.stringify({synthetic:true,backend:'isolated temporary PGlite',cleanup:{database_closed:cleanup,no_production_records_created:true},results,error:failure?.message},null,2)+'\n');if(failure)throw failure;
})().catch(e=>{console.error(e);process.exitCode=1});
