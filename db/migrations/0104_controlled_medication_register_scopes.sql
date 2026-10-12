-- OWNED_BY: generic. Scope the actual controlled-drug register to newly typed source ledger movements.
BEGIN;
CREATE TABLE rs_controlled_register_scopes(register_id bigint PRIMARY KEY REFERENCES narcotic_register(id),tenant_id uuid NOT NULL REFERENCES tenants(id),ledger_id bigint NOT NULL REFERENCES pharmacy_stock_ledger(id),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE rs_controlled_register_scopes ENABLE ROW LEVEL SECURITY;REVOKE ALL ON rs_controlled_register_scopes FROM PUBLIC,anon,authenticated;
ALTER FUNCTION rs_pharmacy_stock_command(text,jsonb,text) RENAME TO rs_pharmacy_stock_command_before_controlled_scope;
ALTER FUNCTION rs_pharmacy_rx_command(text,jsonb,text) RENAME TO rs_pharmacy_rx_command_before_controlled_scope;
ALTER FUNCTION rs_medication_custody_command(text,jsonb,text) RENAME TO rs_medication_custody_command_before_controlled_scope;
REVOKE ALL ON FUNCTION rs_pharmacy_stock_command_before_controlled_scope(text,jsonb,text),rs_pharmacy_rx_command_before_controlled_scope(text,jsonb,text),rs_medication_custody_command_before_controlled_scope(text,jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_pharmacy_controlled_command(p_family text,p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();before_register bigint;result_value jsonb;source_function text;
BEGIN
 source_function:=CASE p_family WHEN 'stock' THEN 'rs_pharmacy_stock_command_before_controlled_scope' WHEN 'rx' THEN 'rs_pharmacy_rx_command_before_controlled_scope' WHEN 'custody' THEN 'rs_medication_custody_command_before_controlled_scope' END;
 IF source_function IS NULL THEN RAISE EXCEPTION 'Controlled source family tidak valid';END IF;
 SELECT coalesce(max(id),0) INTO before_register FROM narcotic_register;
 EXECUTE format('SELECT %I($1,$2,$3)',source_function) INTO result_value USING p_action,p_data,p_key;
 -- Native register/ledger rows share the source transaction clock and exact drug/ref identity.
 -- Never assign pre-cutover register history merely because its batch is owned today.
 INSERT INTO rs_controlled_register_scopes(register_id,tenant_id,ledger_id)
 SELECT DISTINCT ON (n.id) n.id,t,l.id FROM narcotic_register n JOIN pharmacy_stock_ledger l ON l.drug_id=n.drug_id AND l.ref_type=n.ref_type AND l.ref_id=n.ref_id AND l.created_at=n.created_at JOIN rs_pharmacy_ledger_scopes scope ON scope.ledger_id=l.id AND scope.tenant_id=t AND scope.actor_id=auth.uid()
 WHERE n.id>before_register AND ((p_family='rx' AND p_action='dispense' AND n.ref_type='dispense' AND n.ref_id=(result_value->>'dispense_id')::bigint) OR (p_family='stock' AND p_action IN ('receive','adjust') AND n.ref_type=p_action AND n.ref_id=CASE WHEN p_action='receive' THEN (result_value->>'batch_id')::bigint ELSE (p_data->>'batch_id')::bigint END) OR (p_family='custody' AND p_action='approve' AND l.id=(result_value->>'source_ledger_id')::bigint))
 ORDER BY n.id,l.id DESC ON CONFLICT(register_id) DO NOTHING;
 RETURN result_value;
END $$;
CREATE FUNCTION rs_pharmacy_stock_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$SELECT rs_pharmacy_controlled_command('stock',p_action,p_data,p_key)$$;
CREATE FUNCTION rs_pharmacy_rx_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$SELECT rs_pharmacy_controlled_command('rx',p_action,p_data,p_key)$$;
CREATE FUNCTION rs_medication_custody_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$SELECT rs_pharmacy_controlled_command('custody',p_action,p_data,p_key)$$;
ALTER FUNCTION rs_pharmacy_board(bigint,integer) RENAME TO rs_pharmacy_board_before_controlled_scope;
REVOKE ALL ON FUNCTION rs_pharmacy_board_before_controlled_scope(bigint,integer) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION rs_pharmacy_board(p_admission_id bigint DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result_value jsonb;
BEGIN result_value:=rs_pharmacy_board_before_controlled_scope(p_admission_id,p_offset);
 RETURN result_value||jsonb_build_object('controlled_movements',coalesce((SELECT jsonb_agg(row_value) FROM (SELECT (to_jsonb(n)-'balance_after')||jsonb_build_object('source_ledger_id',s.ledger_id,'tenant_stock_after',l.local_balance_after) row_value FROM rs_controlled_register_scopes s JOIN narcotic_register n ON n.id=s.register_id JOIN rs_pharmacy_ledger_scopes l ON l.ledger_id=s.ledger_id AND l.tenant_id=s.tenant_id WHERE s.tenant_id=current_tenant_id() ORDER BY n.id DESC LIMIT 201 OFFSET p_offset) selected),'[]'));
END $$;
CREATE TRIGGER rs_controlled_register_original BEFORE UPDATE OR DELETE ON narcotic_register FOR EACH ROW EXECUTE FUNCTION rs_pharmacy_signed_metadata_guard();
REVOKE ALL ON FUNCTION rs_pharmacy_controlled_command(text,text,jsonb,text),rs_pharmacy_stock_command(text,jsonb,text),rs_pharmacy_rx_command(text,jsonb,text),rs_medication_custody_command(text,jsonb,text),rs_pharmacy_board(bigint,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rs_pharmacy_controlled_command(text,text,jsonb,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION rs_pharmacy_stock_command(text,jsonb,text),rs_pharmacy_rx_command(text,jsonb,text),rs_medication_custody_command(text,jsonb,text),rs_pharmacy_board(bigint,integer) TO authenticated;
COMMIT;
