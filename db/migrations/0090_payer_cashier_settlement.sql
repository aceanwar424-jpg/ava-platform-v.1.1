-- OWNED_BY: generic. Payer receipts/refunds use existing cashier_transactions and source GL.
BEGIN;
ALTER TABLE rs_cashier_intents ADD COLUMN payer_claim_id bigint REFERENCES rs_payer_claims(id);
DO $$DECLARE c record;BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='rs_cashier_intents'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%kind%' LOOP EXECUTE format('ALTER TABLE rs_cashier_intents DROP CONSTRAINT %I',c.conname);END LOOP;END $$;
ALTER TABLE rs_cashier_intents ADD CONSTRAINT rs_cashier_kind CHECK(kind IN ('receive','refund','apply','pay','refund_payment','payer_pay','payer_refund'));
ALTER TABLE rs_cashier_intents ADD CONSTRAINT rs_cashier_references CHECK(
 kind='receive' AND receipt_id IS NULL AND invoice_id IS NULL AND payer_claim_id IS NULL OR
 kind='refund' AND receipt_id IS NOT NULL AND invoice_id IS NULL AND payer_claim_id IS NULL OR
 kind='apply' AND receipt_id IS NOT NULL AND invoice_id IS NOT NULL AND payer_claim_id IS NULL OR
 kind='pay' AND receipt_id IS NULL AND invoice_id IS NOT NULL AND payer_claim_id IS NULL OR
 kind='refund_payment' AND receipt_id IS NOT NULL AND invoice_id IS NOT NULL AND payer_claim_id IS NULL OR
 kind='payer_pay' AND receipt_id IS NULL AND invoice_id IS NOT NULL AND payer_claim_id IS NOT NULL OR
 kind='payer_refund' AND receipt_id IS NOT NULL AND invoice_id IS NOT NULL AND payer_claim_id IS NOT NULL);
CREATE UNIQUE INDEX rs_payer_one_cashier_source ON rs_cashier_intents(source_cashier_id) WHERE kind IN ('payer_pay','payer_refund') AND source_cashier_id IS NOT NULL;
CREATE FUNCTION rs_payer_claim_balance(p_claim bigint) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.amount-coalesce((SELECT sum(CASE WHEN i.kind='payer_refund' THEN -s.paid_amount ELSE s.paid_amount END) FROM rs_cashier_intents i JOIN cashier_transactions s ON s.id=i.source_cashier_id WHERE i.payer_claim_id=c.id AND i.kind IN ('payer_pay','payer_refund') AND i.state='posted'),0) FROM rs_payer_claims c WHERE c.id=p_claim AND c.state='posted'
$$;
CREATE FUNCTION rs_payer_validate_cashier(p_setup bigint,p_kind text,p_data jsonb,p_mapping jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c rs_payer_claims;r rs_cashier_intents;b rs_billing_setups;cash_codes jsonb;account_code text;d text:=p_mapping->'mapping'->>'debit_code';k text:=p_mapping->'mapping'->>'credit_code';
BEGIN
 IF p_kind NOT IN ('payer_pay','payer_refund') THEN IF p_data->>'payer_claim_id' IS NOT NULL THEN RAISE EXCEPTION 'Claim hanya untuk pembayaran penjamin';END IF;RETURN;END IF;
 SELECT * INTO b FROM rs_billing_setups WHERE id=p_setup;SELECT * INTO c FROM rs_payer_claims WHERE id=(p_data->>'payer_claim_id')::bigint AND setup_id=p_setup AND tenant_id=b.tenant_id AND state='posted' FOR UPDATE;
 IF c.id IS NULL OR c.invoice_id IS DISTINCT FROM (p_data->>'invoice_id')::bigint THEN RAISE EXCEPTION 'Claim/invoice penjamin sumber tidak valid';END IF;
 cash_codes:=b.policy_snapshot->'deposit_cash_accounts';account_code:=c.accounting_snapshot->'mapping'->>'debit_code';
 IF jsonb_typeof(cash_codes) IS DISTINCT FROM 'array' OR p_kind='payer_pay' AND (NOT cash_codes ? d OR k IS DISTINCT FROM account_code) OR p_kind='payer_refund' AND (d IS DISTINCT FROM account_code OR NOT cash_codes ? k) THEN RAISE EXCEPTION 'Mapping wajib kas/piutang penjamin sumber';END IF;
 IF p_kind='payer_refund' THEN SELECT * INTO r FROM rs_cashier_intents WHERE id=(p_data->>'receipt_id')::bigint AND kind='payer_pay' AND state='posted';IF r.payer_claim_id IS DISTINCT FROM c.id OR r.invoice_id IS DISTINCT FROM c.invoice_id THEN RAISE EXCEPTION 'Refund penjamin harus mengacu receipt claim/invoice asal';END IF;END IF;
END $$;
REVOKE ALL ON FUNCTION rs_payer_claim_balance(bigint),rs_payer_validate_cashier(bigint,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
DO $$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('rs_cashier_command(text,jsonb,text)'::regprocedure) INTO body;
 IF position('rs_cashier_assert_mapping' IN body)=0 OR position('refund_payment' IN body)=0 THEN RAISE EXCEPTION 'Cashier source contract changed';END IF;
 body:=replace(body,'''receive'',''refund'',''apply'',''pay'',''refund_payment''','''receive'',''refund'',''apply'',''pay'',''refund_payment'',''payer_pay'',''payer_refund''');
 body:=replace(body,'''receive'',''refund'',''pay'',''refund_payment''','''receive'',''refund'',''pay'',''refund_payment'',''payer_pay'',''payer_refund''');
 body:=replace(body,'''refund'',''apply'',''refund_payment''','''refund'',''apply'',''refund_payment'',''payer_refund''');
 body:=replace(body,'''apply'',''pay'',''refund_payment''','''apply'',''pay'',''refund_payment'',''payer_pay'',''payer_refund''');
 body:=replace(body,'WHEN kind_value=''refund_payment'' THEN ''pay'' ELSE ''receive''','WHEN kind_value=''refund_payment'' THEN ''pay'' WHEN kind_value=''payer_refund'' THEN ''payer_pay'' ELSE ''receive''');
 body:=replace(body,'WHEN intent.kind=''refund_payment'' THEN ''pay'' ELSE ''receive''','WHEN intent.kind=''refund_payment'' THEN ''pay'' WHEN intent.kind=''payer_refund'' THEN ''payer_pay'' ELSE ''receive''');
 body:=replace(body,'IF intent.kind=''refund_payment'' THEN','IF intent.kind IN (''refund_payment'',''payer_refund'') THEN');
 body:=replace(body,'AND kind=''refund_payment'' AND state=''posted''','AND kind=CASE WHEN intent.kind=''payer_refund'' THEN ''payer_refund'' ELSE ''refund_payment'' END AND state=''posted''');
 body:=replace(body,'balance_value:=rs_cashier_invoice_balance(invoice.id);','balance_value:=CASE WHEN intent.kind=''payer_pay'' THEN rs_payer_claim_balance(intent.payer_claim_id) ELSE rs_cashier_invoice_balance(invoice.id) END;');
 body:=replace(body,'IF intent.kind<>''refund_payment'' AND','IF intent.kind NOT IN (''refund_payment'',''payer_refund'') AND');
 body:=replace(body,'intent.kind IN (''receive'',''pay'') THEN ''Payment''','intent.kind IN (''receive'',''pay'',''payer_pay'') THEN ''Payment''');
 body:=replace(body,'accounting_snapshot,created_by,reason) VALUES','accounting_snapshot,created_by,reason,payer_claim_id) VALUES');
 body:=replace(body,'accounting_value,a,p_data->>''reason'') RETURNING','accounting_value,a,p_data->>''reason'',(p_data->>''payer_claim_id'')::bigint) RETURNING');
 body:=replace(body,'PERFORM rs_cashier_assert_mapping(b.id,kind_value,','PERFORM rs_payer_validate_cashier(b.id,kind_value,p_data,accounting_value);PERFORM rs_cashier_assert_mapping(b.id,kind_value,');
 body:=replace(body,'PERFORM rs_cashier_assert_mapping(b.id,intent.kind,','PERFORM rs_payer_validate_cashier(b.id,intent.kind,to_jsonb(intent),intent.accounting_snapshot);PERFORM rs_cashier_assert_mapping(b.id,intent.kind,');EXECUTE body;
 SELECT pg_get_functiondef('rs_cashier_source_guard()'::regprocedure) INTO body;body:=replace(body,'''receive'',''refund'',''pay'',''refund_payment''','''receive'',''refund'',''pay'',''refund_payment'',''payer_pay'',''payer_refund''');body:=replace(body,'intent.kind IN (''receive'',''pay'')','intent.kind IN (''receive'',''pay'',''payer_pay'')');EXECUTE body;
 SELECT pg_get_functiondef('rs_payer_claim_command(text,jsonb,text)'::regprocedure) INTO body;body:=replace(body,'ELSIF p_action=''void'' THEN','ELSIF p_action=''void'' THEN IF rs_payer_claim_balance(c.id) IS DISTINCT FROM c.amount THEN RAISE EXCEPTION ''Refund penerimaan penjamin dahulu'';END IF;');EXECUTE body;
END $$;
COMMIT;
