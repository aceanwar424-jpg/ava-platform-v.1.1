// OWNED_BY: generic. Actual MPI DDL and operational source fixture; no patient data.
const fs=require('node:fs'),path=require('node:path'),f=require('./workforce-fixture.cjs');
async function createPatientIdentityFixture(){const pg=await f.createWorkforceFixture();try{
 await pg.exec("CREATE FUNCTION uuid_generate_v7() RETURNS uuid LANGUAGE sql AS $$SELECT gen_random_uuid()$$;CREATE FUNCTION generate_ava_id() RETURNS text LANGUAGE sql AS $$SELECT 'S'||left(replace(gen_random_uuid()::text,'-',''),19)$$;CREATE TABLE brands(code varchar(10) PRIMARY KEY);");
 const root=path.resolve(__dirname,'../..');await pg.exec(fs.readFileSync(path.join(root,'db/migrations/0023_fase0_mpi_master_person.sql'),'utf8'));
 for(const name of ['0107_professional_aliases_and_credential_locks.sql','0108_professional_actor_snapshot_locks.sql','0112_patient_identity_source_workflow.sql'])await pg.exec(fs.readFileSync(path.join(root,'db/migrations',name),'utf8'));
 await pg.query("UPDATE user_profiles SET role='admin_faskes' WHERE id=$1",[f.receiver]);
 const actor=(id=f.admin,tenant=f.A)=>pg.query("SELECT set_config('app.user_id',$1,false),set_config('app.tenant_id',$2,false)",[id,tenant]);
 const q=async(sql,args=[])=>(await pg.query(sql,args)).rows,key=()=>require('node:crypto').randomUUID();
 const rpc=async(name,args)=>{await pg.exec('SET ROLE authenticated');try{return(await q('SELECT '+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args))[0].r;}finally{await pg.exec('RESET ROLE');}};
 const cmd=(action,data,k=key())=>rpc('patient_identity_command',[action,JSON.stringify({reason:'Synthetic identity workflow',...data}),k]);
 return {pg,actor,q,key,rpc,cmd};
 }catch(e){await pg.close();throw e;}}
module.exports={...f,createPatientIdentityFixture};
