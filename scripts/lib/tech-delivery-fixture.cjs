// OWNED_BY: generic. Real source DDL, synthetic contracts/licenses only.
const fs=require('node:fs'),path=require('node:path'),f=require('./tech-lifecycle-fixture.cjs');
async function createDeliveryFixture(){const pg=await f.createTechFixture();try{
 for(const name of ['0081_individual_clinical_privileges.sql','0107_professional_aliases_and_credential_locks.sql','0108_professional_actor_snapshot_locks.sql'])await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations',name),'utf8'));
 const source=fs.readFileSync(path.resolve(__dirname,'../../db/migrations/0039_tech_lisensi_harga_order_terintegrasi.sql'),'utf8');
 const start=source.indexOf('CREATE TABLE IF NOT EXISTS public.tech_paket ('),end=source.indexOf('CREATE INDEX IF NOT EXISTS idx_lisensi_tenant');
 if(start<0||end<start)throw Error('License source DDL changed');await pg.exec(source.slice(start,end));
 await pg.query("UPDATE user_profiles SET role='direktur' WHERE id=$1",[f.receiver]);
 await pg.exec("INSERT INTO tech_paket(kode,nama,modul_termasuk) VALUES('SYN-PACK','Synthetic package','[\"his\"]');");
 await pg.query("INSERT INTO tech_lisensi(tenant_id,paket_id,kode_lisensi,status,tgl_mulai,tgl_berakhir) VALUES($1,1,'SYN-SECRET-NEVER-EXPORT','Aktif',current_date-1,current_date+30),($2,1,'SYN-FOREIGN-SECRET','Aktif',current_date-1,current_date+30)",[f.A,f.B]);
 await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations/0109_tech_delivery_source_workflow.sql'),'utf8'));
 let seq=0;const key=()=>`synthetic-delivery-${++seq}`;
 const q=async(sql,args=[]) => (await pg.query(sql,args)).rows;
 const actor=async(id=f.admin,tenant=f.A)=>q("SELECT set_config('app.user_id',$1,false),set_config('app.tenant_id',$2,false)",[id,tenant]);
 const command=async(action,data,k=key())=>(await q('SELECT tech_delivery_command($1,$2,$3) r',[action,JSON.stringify({reason:'Synthetic reviewed evidence',...data}),k]))[0].r;
 const next=(row,action,data={},k)=>command(action,{id:row.id,version:row.ops_version,...data},k);
 const ops=async(kind,action,data,k=key())=>(await q('SELECT tech_ops_command($1,$2,$3,$4) r',[kind,action,JSON.stringify({reason:'Synthetic source operation',...data}),k]))[0].r;
 const opsNext=(kind,row,action,data={})=>ops(kind,action,{id:row.id,version:row.ops_version,...data});
 const input=()=>({title:'Synthetic implementation',contract_reference:'SYN-CONTRACT-1',license_id:1,modules:['his'],installation:'SYN-INSTALL',environment:'test',timezone:'Asia/Jakarta',sla:{clock:'elapsed_24x7',...Object.fromEntries(['P0','P1','P2','P3'].map(p=>[p,{response_minutes:5,resolution_minutes:10}]))},milestones:[{code:'onboarding',title:'Synthetic onboarding',mandatory:true,due_at:new Date(Date.now()+86400000).toISOString()},{code:'his-install',title:'Synthetic HIS installation',mandatory:true,module:'his',due_at:new Date(Date.now()+86400000).toISOString()}]});
 return{...f,pg,q,actor,key,command,next,ops,opsNext,input};
}catch(e){await pg.close();throw e;}}
module.exports={...f,createDeliveryFixture};
