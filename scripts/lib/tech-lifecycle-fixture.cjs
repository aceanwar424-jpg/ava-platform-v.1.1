// OWNED_BY: generic. In-memory only; caller closes in finally.
const fs=require('node:fs'),path=require('node:path'),f=require('./rs-engine-fixture.cjs');
async function createTechFixture(){const pg=await f.createEngineFixture();try{for(const name of ['0065_tech_operations_control_plane.sql','0079_tech_operational_lifecycle.sql'])await pg.exec(fs.readFileSync(path.join(__dirname,'../../db/migrations',name),'utf8'));await pg.query('UPDATE user_profiles SET role=$1 WHERE id=$2',['tech',f.worker]);return pg;}catch(e){await pg.close();throw e;}}
module.exports={...f,createTechFixture};
