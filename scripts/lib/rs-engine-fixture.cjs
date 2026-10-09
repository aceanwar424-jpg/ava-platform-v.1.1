// OWNED_BY: generic. Temporary in-memory database only; always close in finally.
const fs=require('node:fs'),path=require('node:path'),base=require('./hospital-fixture.cjs');
async function createEngineFixture(providedPg){
 const pg=await base.createHospitalFixture(providedPg);
 try{
  // Master fixture contract matches 0050. No real master is modified or seeded.
  await pg.exec(`CREATE TABLE his_master_records(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),domain_key text NOT NULL,code text NOT NULL,name text NOT NULL,status text NOT NULL,effective_from date,effective_to date,payload jsonb NOT NULL DEFAULT '{}');`);
  await pg.query(`INSERT INTO his_master_records(tenant_id,domain_key,code,name,status,payload) VALUES($1,'unit_room','SYN-ROOM','Synthetic shared room','active','{"capacity":2}'),($1,'equipment','SYN-MACHINE','Synthetic single machine','active','{}'),($2,'unit_room','SYN-FOREIGN','Synthetic foreign room','active','{"capacity":2}')`,[base.A,base.B]);
  for(const name of ['0074_operational_policy_governance.sql','0075_team_sprint_lifecycle.sql','0076_clinical_form_records.sql','0077_resource_booking_engine.sql'])await pg.exec(fs.readFileSync(path.join(__dirname,'../../db/migrations',name),'utf8'));
  await pg.exec(`CREATE TABLE inventory_items(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid,item_code text,item_name text,stock_qty numeric NOT NULL DEFAULT 0,is_active boolean DEFAULT true,updated_at timestamptz DEFAULT now());
CREATE TABLE inventory_batches(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,item_id bigint REFERENCES inventory_items(id),batch_no text,expiry_date date,qty_received numeric NOT NULL DEFAULT 0,qty_remaining numeric NOT NULL DEFAULT 0,updated_at timestamptz DEFAULT now());
CREATE TABLE warehouses(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid,name text);
CREATE TABLE stock_by_location(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,item_id bigint,warehouse_id bigint,qty numeric,updated_at timestamptz,UNIQUE(item_id,warehouse_id));
CREATE TABLE stock_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,created_at timestamptz DEFAULT now(),item_id bigint,item_code text,item_name text,movement_type text,qty numeric,balance_after numeric,ref_type text,ref_id bigint,notes text,created_by text);`);
  await pg.query(`INSERT INTO inventory_items(tenant_id,item_code,item_name) VALUES($1,'SYN-STOCK','Synthetic stock'),($2,'SYN-FOREIGN','Synthetic foreign stock')`,[base.A,base.B]);
  await pg.query(`INSERT INTO warehouses(tenant_id,name) VALUES($1,'Synthetic source'),($1,'Synthetic destination'),($2,'Synthetic foreign warehouse')`,[base.A,base.B]);
  await pg.exec(`INSERT INTO inventory_batches(item_id,batch_no,expiry_date) VALUES(1,'SYN-LOT',current_date+365),(2,'SYN-FOREIGN',current_date+365);`);
  await pg.exec('GRANT SELECT ON user_profiles TO authenticated;');
  await pg.exec(fs.readFileSync(path.join(__dirname,'../../db/migrations/0078_shared_inventory_operations.sql'),'utf8'));
  return pg;
 }catch(error){await pg.close();throw error;}
}
module.exports={...base,createEngineFixture};
