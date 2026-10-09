// OWNED_BY: generic. Isolated synthetic workforce enrollment.
const fs=require('node:fs'),path=require('node:path'),f=require('./care-episodes-fixture.cjs');
async function createWorkforceFixture(){const pg=await f.createCareFixture();try{await pg.exec('GRANT USAGE ON SCHEMA auth TO authenticated;');await pg.exec(fs.readFileSync(path.join(__dirname,'../../db/migrations/0081_individual_clinical_privileges.sql'),'utf8'));await pg.query("UPDATE user_profiles SET role='dokter' WHERE id=ANY($1::uuid[])",[[f.worker,f.receiver]]);return pg;}catch(e){await pg.close();throw e;}}
module.exports={...f,createWorkforceFixture};
