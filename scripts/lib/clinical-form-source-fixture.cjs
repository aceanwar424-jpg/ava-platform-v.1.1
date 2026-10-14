// OWNED_BY: generic. Actual professional enrollments and source clinical policies, local synthetic only.
const fs=require('node:fs'),path=require('node:path'),f=require('./pharmacy-source-fixture.cjs'),{createPharmacyScenario}=require('./pharmacy-scenario.cjs');
async function createClinicalSourceFixture(){const pg=await f.createPharmacyFixture();try{
 if(!(await pg.query("SELECT to_regprocedure('ops_professional_role(text)') id")).rows[0].id)await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations/0107_professional_aliases_and_credential_locks.sql'),'utf8'));
 if(!(await pg.query("SELECT pg_get_functiondef('ops_actor(text[])'::regprocedure) body")).rows[0].body.includes('FOR SHARE'))await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations/0108_professional_actor_snapshot_locks.sql'),'utf8'));
 const s=await createPharmacyScenario(pg);await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations/0111_clinical_template_sources_and_metadata.sql'),'utf8'));
 if(process.env.RS_TEST_CLINICAL_AFTER_0113==='1')await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations/0113_nursing_tasks_and_shift_handover.sql'),'utf8'));
 const simple=(purpose='synthetic_observation',form_code='SYN-OBS')=>({purpose,form_code,title:'Synthetic '+purpose,timezone:'UTC',signer_roles:['dokter'],fields:[{key:'note',label:'Clinical note',type:'text',required:true},{key:'number_value',label:'Optional quantity',type:'number',required:false},{key:'confirmed',label:'Optional confirmation',type:'boolean',required:false}]});
 const record=(policy,values,amendment_of,k=s.key())=>s.rpc('rs_clinical_command',['record',JSON.stringify({admission_id:1,policy_id:policy.id,values,amendment_of:amendment_of??null,reason:'Synthetic clinical source record'}),k]);
 const sign=(row,k=s.key())=>s.rpc('rs_clinical_command',['sign',JSON.stringify({id:row.id,reason:'Synthetic professional signature'}),k]);
 const schedulePolicy=()=>({form_code:'SYN-MAR',title:'Synthetic source schedule',purpose:'medication_schedule',timezone:'UTC',early_minutes:60,late_minutes:60,allow_fractional_stock_units:true,administration_qty_decimals:6,identity_fields:['mr_number','visit_number'],signer_roles:['dokter'],fields:[['rx_item_id','number'],['dispense_item_id','number'],['quantity_stock_units','number'],['due_times','text'],['route','text']].map(([key,type])=>({key,type,label:key,required:true}))});
 return{...s,pg,simple,record,sign,schedulePolicy};
}catch(e){await pg.close();throw e;}}
module.exports={...f,createClinicalSourceFixture};
