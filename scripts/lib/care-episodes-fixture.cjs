// OWNED_BY: generic. Temporary DB only; close by caller in finally.
const fs=require('node:fs'),path=require('node:path'),f=require('./rs-engine-fixture.cjs');
async function createCareFixture(){const pg=await f.createEngineFixture();try{await pg.exec(fs.readFileSync(path.join(__dirname,'../../db/migrations/0080_encounter_unit_episodes.sql'),'utf8'));return pg;}catch(e){await pg.close();throw e;}}
module.exports={...f,createCareFixture};
