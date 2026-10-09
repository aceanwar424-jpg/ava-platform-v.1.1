// OWNED_BY: generic. Reusable synthetic baseline for SQL and browser simulation.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002';
const admin='20000000-0000-0000-0000-000000000001',receiver='20000000-0000-0000-0000-000000000002',worker='20000000-0000-0000-0000-000000000003',foreign='20000000-0000-0000-0000-000000000004';
async function createHospitalFixture(providedPg){
 let pg=providedPg;
 if(!pg){const {PGlite}=await import('file://'+path.join(root,'desktop-app/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g,'/'));pg=new PGlite();}
 try{
 await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('app.user_id',true),'')::uuid$$;
 CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('app.tenant_id',true),'')::uuid$$;
 CREATE TABLE tenants(id uuid PRIMARY KEY);
 CREATE TABLE user_profiles(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),role text,full_name text,updated_at timestamptz DEFAULT now());
 CREATE TABLE roles(kode text PRIMARY KEY,label text NOT NULL,warna text);
 CREATE TABLE role_pages(role_kode text REFERENCES roles(kode),page text,PRIMARY KEY(role_kode,page));
 CREATE TABLE user_pages(user_id uuid REFERENCES user_profiles(id),page text,PRIMARY KEY(user_id,page));
 INSERT INTO roles(kode,label) VALUES('super_admin','Synthetic admin'),('dokter','Synthetic doctor'),('operasional','Synthetic lab'),('finance_staff','Synthetic finance'),('admin','Synthetic admin'),('admin_faskes','Synthetic admin'),('direktur','Synthetic director');
 CREATE TABLE admissions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid,patient_name text,mr_number text,visit_number text,patient_gender text,patient_dob date,patient_age integer,updated_at timestamp DEFAULT now());
 CREATE TABLE cost_centers(code text,name text,unit_type text);
 CREATE TABLE gl_mappings(event_key text,debit_code text,credit_code text,description text);
 CREATE TABLE icd_diagnostics(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,admission_id bigint,mr_number text,icd_code text,diagnose_name text,is_primary boolean);
 CREATE TABLE synthetic_audit(action text,ref_id text);
 CREATE TABLE synthetic_journal(amount numeric,source_id bigint);
 CREATE FUNCTION current_app_role() RETURNS text LANGUAGE sql AS $$SELECT role FROM user_profiles WHERE id=auth.uid()$$;
 CREATE FUNCTION current_app_name() RETURNS text LANGUAGE sql AS $$SELECT full_name FROM user_profiles WHERE id=auth.uid()$$;
 CREATE FUNCTION write_audit(text,text,text,text,text) RETURNS void LANGUAGE sql AS $$INSERT INTO synthetic_audit(action,ref_id) VALUES($1,$3)$$;
 CREATE FUNCTION post_journal(text,numeric,text,text,bigint,text,date) RETURNS void LANGUAGE sql AS $$INSERT INTO synthetic_journal(amount,source_id) VALUES($2,$5)$$;
 INSERT INTO tenants VALUES('${A}'),('${B}');
 INSERT INTO user_profiles(id,tenant_id,role,full_name) VALUES('${admin}','${A}','super_admin','Synthetic admin'),('${receiver}','${A}','nurse','Synthetic receiver'),('${worker}','${A}','housekeeping','Synthetic worker'),('${foreign}','${B}','super_admin','Synthetic foreign admin');
 INSERT INTO admissions(tenant_id,patient_name,mr_number,visit_number,patient_gender) VALUES('${A}','Synthetic patient 1','SYN-1','SYN-V1','P'),('${A}','Synthetic patient 2','SYN-2','SYN-V2','P'),('${B}','Synthetic patient B','SYN-B','SYN-VB','L');`);
 await pg.query("SELECT set_config('app.user_id',$1,false),set_config('app.tenant_id',$2,false)",[admin,A]);
 // Load the real existing inpatient RPCs. Accounting/audit sinks are explicit test fixtures.
 await pg.exec(fs.readFileSync(path.join(root,'ava-platform/sql_arsip/05_modul_baru/supabase_inpatient.sql'),'utf8'));
 for(const name of ['0070_hospital_operations.sql','0071_hospital_bed_flow.sql','0072_hospital_staff_roles.sql','0073_hospital_operations_hardening.sql'])await pg.exec(fs.readFileSync(path.join(root,'db/migrations',name),'utf8'));
 return pg;
 }catch(error){await pg.close();throw error;}
}
module.exports={createHospitalFixture,A,B,admin,receiver,worker,foreign};
