// OWNED_BY: generic. Actual source DDL and local-only synthetic archives.
const fs=require('node:fs'),path=require('node:path'),f=require('./rs-engine-fixture.cjs');
async function createCapacityFixture(){const pg=await f.createEngineFixture();try{
 await pg.exec("SET TIME ZONE 'UTC';");
 for(const name of ['0081_individual_clinical_privileges.sql','0107_professional_aliases_and_credential_locks.sql','0108_professional_actor_snapshot_locks.sql','0110_historical_bed_capacity.sql'])await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations',name),'utf8'));
 await pg.query("UPDATE user_profiles SET role='direktur' WHERE id=$1",[f.receiver]);await pg.query("UPDATE user_profiles SET role='nurse' WHERE id=$1",[f.worker]);
 await pg.query("INSERT INTO inpatient_beds(tenant_id,ward_id,room_no,bed_no,class_code,status,is_active) VALUES($1,1,'SYN-CAPACITY','SYN-1','1','Kosong',true),($1,1,'SYN-CAPACITY','SYN-2','1','Kosong',true),($2,2,'SYN-FOREIGN','SYN-B','1','Kosong',true)",[f.A,f.B]);
 let seq=0;const key=()=>`synthetic-capacity-${++seq}`,q=async(sql,args=[])=>(await pg.query(sql,args)).rows;
 const actor=async(id=f.admin,tenant=f.A)=>q("SELECT set_config('app.user_id',$1,false),set_config('app.tenant_id',$2,false)",[id,tenant]);
 const command=async(action,data,k=key())=>(await q('SELECT rs_capacity_command($1,$2,$3) r',[action,JSON.stringify({reason:'Synthetic reviewed statistical SOP',...data}),k]))[0].r;
 const next=(row,action,data={},k)=>command(action,{id:row.id,version:row.version,...data},k);
 const policy=()=>({method:'observed_daily_v1',timezone:'UTC',source_timezone:'UTC',patient_day_method:'calendar_inclusive',census_time:'00:00',bed_denominator:'active',los_method:'calendar_date_difference',same_day_patient_days:1,same_day_los_days:1,source_reference:'https://www.kemkes.go.id/app_asset/file_content_download/172247989066aaf512936579.51341712.pdf',source_version:'Juknis profil 2022, published December 2023; formula basis, tenant rules explicit',review_reference:'SYN-STATISTICS-SOP'});
 return{...f,pg,q,actor,key,command,next,policy};
}catch(e){await pg.close();throw e;}}
module.exports={...f,createCapacityFixture};
