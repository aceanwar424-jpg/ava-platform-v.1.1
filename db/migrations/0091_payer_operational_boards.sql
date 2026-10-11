-- OWNED_BY: generic. Tenant-scoped source boards for eligibility, allocation and settlement.
BEGIN;
CREATE FUNCTION rs_payer_board(p_setup_id bigint DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();ids bigint[];
BEGIN PERFORM ops_actor(ARRAY['super_admin','head_operation','direktur','admin_faskes','finance','cashier','finance_staff']);
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM rs_billing_setups WHERE tenant_id=t AND state='active' AND (p_setup_id IS NULL OR id=p_setup_id) ORDER BY id DESC LIMIT 50)b;
 RETURN jsonb_build_object('setups',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'stay_id',s.id,'patient_name',s.patient_name,'guarantor',s.guarantor,'stay_number',s.stay_number)) FROM rs_billing_setups b JOIN inpatient_stays s ON s.id=b.stay_id WHERE b.id=ANY(ids)),'[]'),
 'contracts',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM his_master_records c WHERE c.tenant_id=t AND c.domain_key='corporate_contract' AND c.status='active' AND current_date BETWEEN c.effective_from AND c.effective_to),'[]'),
 'eligibilities',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT * FROM rs_payer_eligibilities WHERE tenant_id=t AND setup_id=ANY(ids) ORDER BY id DESC LIMIT 200)e),'[]'),
 'claims',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('balance',rs_payer_claim_balance(c.id))) FROM (SELECT * FROM rs_payer_claims WHERE tenant_id=t AND setup_id=ANY(ids) ORDER BY (state='posted') DESC,id DESC LIMIT 200)c),'[]'),
 'invoices',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'setup_id',i.setup_id,'total',i.total,'balance',rs_cashier_invoice_balance(i.id))) FROM rs_final_invoices i WHERE i.tenant_id=t AND i.setup_id=ANY(ids) AND i.state='posted'),'[]'),
 'gl_mappings',coalesce((SELECT jsonb_agg(jsonb_build_object('event_key',event_key,'debit_code',debit_code,'credit_code',credit_code)) FROM gl_mappings WHERE is_active),'[]'),
 'cost_centers',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'name',name)) FROM cost_centers WHERE is_active),'[]'));
END $$;
REVOKE ALL ON FUNCTION rs_payer_board(bigint) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION rs_payer_board(bigint) TO authenticated;
ALTER FUNCTION rs_cashier_board(bigint,integer,integer) RENAME TO rs_cashier_board_before_payer;
REVOKE ALL ON FUNCTION rs_cashier_board_before_payer(bigint,integer,integer) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_cashier_board(p_setup_id bigint DEFAULT NULL,p_offset integer DEFAULT 0,p_intent_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result_value jsonb;ids bigint[];
BEGIN result_value:=rs_cashier_board_before_payer(p_setup_id,p_offset,p_intent_offset);SELECT array_agg((value->>'id')::bigint) INTO ids FROM jsonb_array_elements(result_value->'setups');
 RETURN result_value||jsonb_build_object('payer_claims',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'invoice_id',c.invoice_id,'setup_id',c.setup_id,'amount',c.amount,'balance',rs_payer_claim_balance(c.id))) FROM rs_payer_claims c WHERE c.tenant_id=current_tenant_id() AND c.setup_id=ANY(ids) AND c.state='posted'),'[]'));
END $$;
REVOKE ALL ON FUNCTION rs_cashier_board(bigint,integer,integer) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION rs_cashier_board(bigint,integer,integer) TO authenticated;
-- Old receipt display now includes the refundable net of payer receipts.
DO $$DECLARE body text;BEGIN SELECT pg_get_functiondef('rs_cashier_board_before_payer(bigint,integer,integer)'::regprocedure) INTO body;
 body:=replace(body,'WHEN kind=''pay'' AND state=''posted'' THEN','WHEN kind IN (''pay'',''payer_pay'') AND state=''posted'' THEN');body:=replace(body,'r.kind=''refund_payment'' AND','r.kind=CASE WHEN i.kind=''payer_pay'' THEN ''payer_refund'' ELSE ''refund_payment'' END AND');EXECUTE body;END $$;
COMMIT;
