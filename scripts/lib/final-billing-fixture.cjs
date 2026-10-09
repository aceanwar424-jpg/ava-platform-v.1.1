// OWNED_BY: generic. Actual accounting functions, not a journal sink.
const fs=require('node:fs'),path=require('node:path'),f=require('./billing-source-fixture.cjs');
async function createFinalBillingFixture(){const pg=await f.createBillingFixture();try{
 await pg.exec('DROP FUNCTION post_journal(text,numeric,text,text,bigint,text,date); DROP TABLE cost_centers; DROP TABLE gl_mappings;');
 const source=fs.readFileSync(path.join(__dirname,'../../ava-platform/sql_arsip/04_roadmap_fase/supabase_fase4.sql'),'utf8'),end=source.indexOf('ALTER TABLE public.vendor_invoices');if(end<0)throw Error('Accounting source contract changed');await pg.exec(source.slice(0,end));
 await pg.exec("INSERT INTO cost_centers(code,name,unit_type) VALUES('SYN-RI','Synthetic inpatient','Pendapatan'); INSERT INTO gl_mappings(event_key,debit_code,credit_code,description) VALUES('synthetic.inpatient.bill','1-1300','4-1500','Synthetic accrued invoice');");
 await pg.exec(fs.readFileSync(path.join(__dirname,'../../db/migrations/0084_inpatient_financial_finalization.sql'),'utf8'));return pg;
 }catch(e){await pg.close();throw e;}}
module.exports={...f,createFinalBillingFixture};
