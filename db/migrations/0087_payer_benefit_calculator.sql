-- OWNED_BY: generic. Pure benefit calculation; authorization/binding belongs to the source workflow.
BEGIN;
CREATE FUNCTION rs_payer_benefit_quote(p_contract jsonb,p_charges jsonb,p_decimals integer) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE item jsonb;seen_ids text[]:=ARRAY[]::text[];charge_id text;category text;
 amount_value numeric;total_value numeric:=0;eligible_value numeric:=0;percent_value numeric;
 ceiling_value numeric;covered_value numeric;factor_value numeric;rounding_value text;lines jsonb:='[]';
BEGIN
 IF jsonb_typeof(p_contract) IS DISTINCT FROM 'object' OR jsonb_typeof(p_charges) IS DISTINCT FROM 'array'
 OR p_decimals IS NULL OR p_decimals NOT BETWEEN 0 AND 4 OR jsonb_array_length(p_charges)>10000 THEN RAISE EXCEPTION 'Kontrak/charge/presisi tidak valid';END IF;
 IF p_contract->>'cap_scope' IS DISTINCT FROM 'stay' OR p_contract->>'unlisted_categories' IS DISTINCT FROM 'excluded'
 OR jsonb_typeof(p_contract->'covered_categories') IS DISTINCT FROM 'array' OR jsonb_array_length(p_contract->'covered_categories')=0
 OR jsonb_typeof(p_contract->'coverage_percentage') IS DISTINCT FROM 'number'
 OR jsonb_typeof(p_contract->'benefit_ceiling') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Cakupan, plafon per stay dan kategori wajib eksplisit';END IF;
 percent_value:=(p_contract->>'coverage_percentage')::numeric;ceiling_value:=(p_contract->>'benefit_ceiling')::numeric;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_contract->'covered_categories') c(value) WHERE jsonb_typeof(value)<>'string' OR coalesce(length(trim(value#>>'{}')),0)=0 OR value#>>'{}'<>trim(value#>>'{}')) OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(p_contract->'covered_categories'))<>jsonb_array_length(p_contract->'covered_categories') THEN RAISE EXCEPTION 'Kategori manfaat wajib string unik tanpa nilai kosong';END IF;
 rounding_value:=p_contract->>'benefit_rounding';factor_value:=power(10,p_decimals);
 IF percent_value NOT BETWEEN 0 AND 100 OR ceiling_value<0 OR ceiling_value<>round(ceiling_value,p_decimals)
 OR rounding_value IS NULL OR rounding_value NOT IN ('up','down','nearest') THEN RAISE EXCEPTION 'Persentase/plafon/pembulatan tidak valid';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_charges) LOOP
  charge_id:=item->>'id';category:=item->>'category';
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR coalesce(charge_id,'')!~'^[1-9][0-9]*$' OR charge_id=ANY(seen_ids)
  OR coalesce(length(trim(category)),0)=0 OR jsonb_typeof(item->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Identitas/kategori/nominal charge sumber tidak valid atau duplikat';END IF;
  seen_ids:=array_append(seen_ids,charge_id);amount_value:=(item->>'amount')::numeric;
  IF amount_value<>round(amount_value,p_decimals) THEN RAISE EXCEPTION 'Presisi charge sumber tidak sesuai';END IF;
  total_value:=total_value+amount_value;
  IF p_contract->'covered_categories' ? category THEN eligible_value:=eligible_value+amount_value;END IF;
  lines:=lines||jsonb_build_array(jsonb_build_object('source_charge_id',charge_id,'category',category,'amount',amount_value,'eligible',p_contract->'covered_categories' ? category));
 END LOOP;
 IF total_value<0 OR eligible_value<0 OR eligible_value>total_value THEN RAISE EXCEPTION 'Koreksi charge memerlukan rekonsiliasi kategori sebelum benefit';END IF;
 covered_value:=eligible_value*percent_value/100;
 covered_value:=CASE rounding_value WHEN 'up' THEN ceil(covered_value*factor_value)/factor_value WHEN 'down' THEN floor(covered_value*factor_value)/factor_value ELSE round(covered_value,p_decimals) END;
 covered_value:=least(covered_value,ceiling_value,total_value);
 RETURN jsonb_build_object('total',total_value,'eligible_total',eligible_value,'payer_amount',covered_value,'patient_amount',total_value-covered_value,'contract',p_contract,'source_lines',lines);
END $$;
REVOKE ALL ON FUNCTION rs_payer_benefit_quote(jsonb,jsonb,integer) FROM PUBLIC,anon,authenticated;
COMMIT;
