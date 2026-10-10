// OWNED_BY: generic. Actual cashier table, legacy GL trigger and accounting with synthetic identities.
const fs=require('node:fs'),path=require('node:path'),f=require('./final-billing-fixture.cjs');
async function createCashierFixture(){const pg=await f.createFinalBillingFixture();try{
 await pg.exec('CREATE TABLE corporates(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);');
 const table=fs.readFileSync(path.join(__dirname,'../../ava-platform/sql_arsip/02_modul_lama/supabase_config_lab.sql'),'utf8'),begin=table.indexOf('CREATE TABLE IF NOT EXISTS public.cashier_transactions'),end=table.indexOf('-- ── DISABLE RLS',begin);if(begin<0||end<begin)throw Error('Cashier table source changed');await pg.exec(table.slice(begin,end));
 const source=fs.readFileSync(path.join(__dirname,'../../ava-platform/sql_arsip/04_roadmap_fase/supabase_fase4.sql'),'utf8'),start=source.indexOf('CREATE OR REPLACE FUNCTION public.trg_post_cashier()'),stop=source.indexOf('CREATE OR REPLACE FUNCTION public.trg_post_goods_issue()',start);if(start<0||stop<start)throw Error('Cashier trigger source changed');await pg.exec(source.slice(start,stop));
 await pg.exec("INSERT INTO chart_of_accounts(code,name,acc_type,normal_side,is_active) VALUES('SYN-DEPOSIT','Synthetic patient deposits','Kewajiban','K',true);INSERT INTO gl_mappings(event_key,debit_code,credit_code,description) VALUES('synthetic.deposit.receive','1-1100','SYN-DEPOSIT','Synthetic deposit receipt'),('synthetic.deposit.refund','SYN-DEPOSIT','1-1100','Synthetic deposit refund'),('synthetic.deposit.apply','SYN-DEPOSIT','1-1300','Synthetic deposit allocation'),('synthetic.deposit.pay','1-1100','1-1300','Synthetic direct payment'),('synthetic.deposit.refund_payment','1-1300','1-1100','Synthetic payment refund');");
 await pg.exec(fs.readFileSync(path.join(__dirname,'../../db/migrations/0085_inpatient_cashier_workflow.sql'),'utf8'));return pg;
 }catch(e){await pg.close();throw e;}}
module.exports={...f,createCashierFixture};
