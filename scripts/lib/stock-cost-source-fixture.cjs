// OWNED_BY: generic. Actual clinical, stock and accounting functions; synthetic only.
const fs=require('node:fs'),path=require('node:path'),f=require('./pharmacy-source-fixture.cjs'),{createPharmacyScenario}=require('./pharmacy-scenario.cjs');
const finance='20000000-0000-0000-0000-000000000009',finance2='20000000-0000-0000-0000-000000000010';
async function createCostFixture(options={}){const pg=await f.createPharmacyFixture();try{
 const root=path.resolve(__dirname,'../..');
 if(!(await pg.query("SELECT to_regprocedure('ops_professional_role(text)') id")).rows[0].id)await pg.exec(fs.readFileSync(path.join(root,'db/migrations/0107_professional_aliases_and_credential_locks.sql'),'utf8'));
 if(!(await pg.query("SELECT pg_get_functiondef('ops_actor(text[])'::regprocedure) body")).rows[0].body.includes('FOR SHARE'))await pg.exec(fs.readFileSync(path.join(root,'db/migrations/0108_professional_actor_snapshot_locks.sql'),'utf8'));
 if(!(await pg.query("SELECT to_regprocedure('rs_clinical_amendment_choices(bigint,integer)') id")).rows[0].id)await pg.exec(fs.readFileSync(path.join(root,'db/migrations/0111_clinical_template_sources_and_metadata.sql'),'utf8'));
 const s=await createPharmacyScenario(pg,{qtyStep:options.qtyStep??1});
 await s.q("INSERT INTO user_profiles(id,tenant_id,role,full_name) VALUES($1,$3,'finance_staff','Synthetic cost reviewer'),($2,$3,'finance_staff','Synthetic second cost reviewer')",[finance,finance2,f.A]);
 await s.q("UPDATE user_profiles SET tenant_id=$1,role='finance_staff' WHERE id=$2",[f.B,f.foreign]);
 await s.actor();
 const policy=(await s.q("SELECT * FROM ops_policy_versions WHERE kind='authority' AND scope='rs-ward-pharmacy' AND state='active' ORDER BY effective_at DESC,id DESC LIMIT 1"))[0];
 let authority=await s.rpc('ops_policy_command',[null,'create',JSON.stringify({kind:'authority',scope:'rs-ward-pharmacy',payload:{rules:[...policy.payload.rules,{action:'pharmacy.binding.revoke',roles:['pharmacist'],separate_verifier:false}]},reason:'Synthetic explicit formulary lifecycle source authority'}),s.key()]);
 authority=await s.rpc('ops_policy_command',[authority.id,'submit',JSON.stringify({expected_state:'draft',reason:'Synthetic authority submit'}),s.key()]);
 await s.actor(f.receiver);authority=await s.rpc('ops_policy_command',[authority.id,'approve',JSON.stringify({expected_state:'in_review',reason:'Synthetic competent authority review'}),s.key()]);
 await s.actor();await s.rpc('ops_policy_command',[authority.id,'activate',JSON.stringify({expected_state:'approved',effective_at:new Date().toISOString(),reason:'Synthetic reviewed lifecycle activation'}),s.key()]);
 await s.actor(f.receiver);
 await s.rpc('rs_pharmacy_binding_command',['revoke',JSON.stringify({id:s.binding.id,version:s.binding.version,reason:'Synthetic reviewed two-batch ownership'}),s.key()]);
 await s.actor();
 let binding=await s.rpc('rs_pharmacy_binding_command',['create',JSON.stringify({drug_id:1,unit_price:12.5,qty_step:options.qtyStep??1,amount_decimals:2,is_formulary:true,timezone:'UTC',opening_batches:[1,2],valid_until:s.dates.t,evidence:'Synthetic explicit A/B ownership',reason:'Synthetic actual cost FEFO ownership'}),s.key()]);
 await s.actor(f.receiver);binding=await s.rpc('rs_pharmacy_binding_command',['approve',JSON.stringify({id:binding.id,version:binding.version,reason:'Synthetic independently reviewed A/B ownership'}),s.key()]);
 const dispense=async(qty=8)=>{await s.actor(f.worker);const rx=await s.rx('create',{reconciliation_id:s.reconciliation.id,signature_attestation:true,header:{diagnosis:'Synthetic source assessment'},items:[{drug_id:1,qty,dose:'Synthetic prescribed instruction',frequency:'Synthetic frequency',duration_days:1,instruction:'Synthetic source clinical instruction'}]});await s.actor(f.receiver);await s.rx('verify',{rx_id:rx.rx_id,allergy_review:'Synthetic independent allergy review',interaction_review:'Synthetic independent interaction review',dose_review:'Synthetic independent source dose review'});return s.rx('dispense',{rx_id:rx.rx_id,recipient:{recipient_name:'Synthetic source recipient'}});};
 let beforeCutover;if(options.preCutoverDispense)beforeCutover=await dispense(1);
 await pg.exec(fs.readFileSync(path.join(root,'db/migrations/0115_actual_batch_stock_valuation.sql'),'utf8'));
 const rbac=fs.readFileSync(path.join(root,'db/migrations/0003_rbac.sql'),'utf8');await pg.exec(rbac.slice(rbac.indexOf('CREATE TABLE IF NOT EXISTS public.permissions'),rbac.indexOf('-- Halaman yang boleh')));
 const access=fs.readFileSync(path.join(root,'db/migrations/0069_rbac_user_provisioning.sql'),'utf8');await pg.exec(access.slice(access.indexOf('CREATE OR REPLACE FUNCTION public.get_my_access()'),access.indexOf('CREATE OR REPLACE FUNCTION public.list_user_access()')));await pg.exec('REVOKE ALL ON FUNCTION get_my_access() FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION get_my_access() TO authenticated;');
 const accounts={receive:{debit:'1-1400',credit:'2-1150'},dispense:{debit:'5-1100',credit:'1-1400'},return:{debit:'1-1400',credit:'5-1100'},adjust_gain:{debit:'1-1400',credit:'5-1900'},adjust_loss:{debit:'5-1900',credit:'1-1400'}};
 for(const [kind,codes] of Object.entries(accounts))await s.q('INSERT INTO gl_mappings(event_key,debit_code,credit_code,description) VALUES($1,$2,$3,$4)',['rs.stock.cost.'+f.A+'.'+kind,codes.debit,codes.credit,'Synthetic configured '+kind]);
 const cost=async(entity,action,data={},key=s.key())=>{await pg.exec('SET ROLE authenticated');try{return await s.rpc('rs_stock_cost_command',[entity,action,JSON.stringify({reason:'Synthetic cost review evidence',...(['approve','approve_void'].includes(action)?{review_evidence:'Synthetic independent source evidence review'}:{}),...data}),key]);}finally{await pg.exec('RESET ROLE');}};
 const next=(entity,row,action,data={},key)=>cost(entity,action,{id:row.id,version:row.version,...data},key);
 const setupInput=()=>({cost_center:'SYN-RI',currency:'IDR',timezone:'UTC',amount_decimals:2,mappings:Object.fromEntries(['receive','dispense','return','adjust_gain','adjust_loss'].map(k=>[k,'rs.stock.cost.'+f.A+'.'+k])),evidence:'Synthetic explicitly reviewed account mapping/opening references'});
 const activeSetup=async()=>{await s.actor();let setup=await cost('setup','create',setupInput());await s.actor(finance);return next('setup',setup,'approve');};
 const activeBasis=async(batch,price)=>{await s.actor();let basis=await cost('basis','create',{batch_id:batch,unit_cost:price,evidence:'Synthetic reviewed actual purchase evidence'});await s.actor(finance);return next('basis',basis,'approve');};
 const posting=async(movement,setup)=>{await s.actor();const day=(await s.q("SELECT to_char(clock_timestamp() AT TIME ZONE $1,'YYYY-MM-DD') d",[setup.timezone]))[0].d;let p=await cost('posting','create',{movement_id:movement.id,setup_id:setup.id,entry_date:day});await s.actor(finance);return next('posting',p,'approve');};
 await s.actor();
 return {...s,pg,binding,finance,finance2,cost,next,setupInput,accounts,activeSetup,activeBasis,posting,dispense,beforeCutover};
}catch(e){await pg.close();throw e;}}
module.exports={...f,finance,finance2,createCostFixture};
