// OWNED_BY: generic. Actual billing/cashier/GL source, synthetic payer master only.
const fs=require('node:fs'),path=require('node:path'),f=require('./cashier-workflow-fixture.cjs');
async function createPayerFixture(){const pg=await f.createCashierFixture();try{
for(const name of ['0087_payer_benefit_calculator.sql','0088_payer_eligibility_workflow.sql','0089_payer_invoice_allocation.sql','0090_payer_cashier_settlement.sql','0091_payer_operational_boards.sql'])await pg.exec(fs.readFileSync(path.resolve(__dirname,'../../db/migrations',name),'utf8'));
await pg.exec("INSERT INTO chart_of_accounts(code,name,acc_type,normal_side,is_active) VALUES('SYN-PAYER-AR','Synthetic payer receivable','Aset','D',true);INSERT INTO gl_mappings(event_key,debit_code,credit_code,description) VALUES('synthetic.payer.allocate','SYN-PAYER-AR','1-1300','Synthetic payer allocation'),('synthetic.payer.pay','1-1100','SYN-PAYER-AR','Synthetic payer receipt'),('synthetic.payer.refund','SYN-PAYER-AR','1-1100','Synthetic payer refund');");return pg;
}catch(e){await pg.close();throw e;}}
module.exports={...f,createPayerFixture};
