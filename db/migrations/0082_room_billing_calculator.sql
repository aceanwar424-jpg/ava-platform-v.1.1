-- OWNED_BY: generic. Pure calculation; no charge/payment writes and no historical reconstruction.
BEGIN;
CREATE FUNCTION rs_room_billing_quote(p_policy jsonb,p_start timestamptz,p_end timestamptz,p_segments jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE method text:=p_policy->>'room_method';transfer_method text:=p_policy->>'transfer_method';zone text:=p_policy->>'timezone';rounding_method text:=p_policy->>'rounding';minimum_units numeric;amount_decimals integer;segment jsonb;cursor_value timestamptz:=p_start;segment_start timestamptz;segment_end timestamptz;rate numeric;period_start timestamptz;period_end timestamptz;actual_start timestamptz;actual_end timestamptz;local_day date;cutoff time;cutoff_at timestamptz;period_units numeric;raw_units numeric:=0;billed_units numeric;raw_amount numeric:=0;period_amount numeric;seconds_value numeric;total_seconds numeric;weighted_rate numeric;selected_rate numeric;overlap_start timestamptz;overlap_end timestamptz;lines jsonb:='[]';factor_value numeric;result_lines jsonb:='[]';line jsonb;line_amount numeric;total_amount numeric:=0;iterations integer:=0;
BEGIN
 IF jsonb_typeof(p_policy) IS DISTINCT FROM 'object' OR method IS NULL OR method NOT IN ('calendar','24_hour','hourly') OR transfer_method IS NULL OR transfer_method NOT IN ('prorata','highest','cutoff') OR rounding_method IS NULL OR rounding_method NOT IN ('up','nearest','down') OR zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=zone) THEN RAISE EXCEPTION 'Metode, perpindahan, pembulatan dan timezone eksplisit wajib';END IF;
 IF jsonb_typeof(p_policy->'minimum_units') IS DISTINCT FROM 'number' OR jsonb_typeof(p_policy->'amount_decimals') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Minimum unit dan presisi nominal eksplisit wajib';END IF;
 minimum_units:=(p_policy->>'minimum_units')::numeric;amount_decimals:=(p_policy->>'amount_decimals')::integer;
 IF minimum_units<0 OR minimum_units>10000 OR amount_decimals NOT BETWEEN 0 AND 4 OR (p_policy->>'amount_decimals')::numeric<>amount_decimals THEN RAISE EXCEPTION 'Minimum/presisi tidak valid';END IF;
 IF p_policy->>'rounding_rate_basis' IS DISTINCT FROM 'weighted_period_average' THEN RAISE EXCEPTION 'Basis pembulatan weighted_period_average wajib disahkan';END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR p_end-p_start>interval '365 days' OR NOT isfinite(p_start) OR NOT isfinite(p_end) OR jsonb_typeof(p_segments) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Interval/segmen tidak valid';END IF;
 IF method='calendar' OR transfer_method='cutoff' THEN
  IF coalesce(p_policy->>'cutoff','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Cutoff HH:MM wajib';END IF;cutoff:=(p_policy->>'cutoff')::time;
 END IF;
 IF transfer_method='cutoff' AND (jsonb_typeof(p_policy->'opening_cutoff_rate') IS DISTINCT FROM 'number' OR (p_policy->>'opening_cutoff_rate')::numeric<0) THEN RAISE EXCEPTION 'Tarif opening saat cutoff eksplisit wajib; jangan rekonstruksi histori';END IF;
 IF transfer_method='cutoff' AND p_policy->>'cutoff_rate_reference' IS DISTINCT FROM 'latest_daily_at_period_start' THEN RAISE EXCEPTION 'Referensi cutoff latest_daily_at_period_start harus eksplisit dan disahkan';END IF;
 IF p_end=p_start THEN RETURN jsonb_build_object('raw_units',0,'billed_units',0,'total',0,'lines','[]'::jsonb);END IF;
 IF jsonb_array_length(p_segments)=0 OR jsonb_array_length(p_segments)>10000 THEN RAISE EXCEPTION 'Segmen sumber wajib';END IF;
 FOR segment IN SELECT value FROM jsonb_array_elements(p_segments) LOOP
  segment_start:=(segment->>'starts_at')::timestamptz;segment_end:=coalesce((segment->>'ends_at')::timestamptz,p_end);rate:=(segment->>'rate')::numeric;
  IF segment_start IS DISTINCT FROM cursor_value OR segment_end<=segment_start OR segment_end>p_end OR jsonb_typeof(segment->'rate') IS DISTINCT FROM 'number' OR rate<0 OR rate IS NULL OR coalesce(length(trim(segment->>'class_code')),0)=0 THEN RAISE EXCEPTION 'Segmen harus berurutan, kontinu, bertarif sah dan berkode kelas';END IF;cursor_value:=segment_end;
 END LOOP;
 IF cursor_value<>p_end THEN RAISE EXCEPTION 'Segmen tidak mencakup interval sumber';END IF;
 IF method='calendar' THEN local_day:=(p_start AT TIME ZONE zone)::date;period_start:=(local_day+cutoff) AT TIME ZONE zone;IF period_start>p_start THEN local_day:=local_day-1;period_start:=(local_day+cutoff) AT TIME ZONE zone;END IF;ELSE period_start:=p_start;END IF;
 WHILE period_start<p_end LOOP
  iterations:=iterations+1;IF iterations>10000 THEN RAISE EXCEPTION 'Terlalu banyak periode';END IF;
  IF method='calendar' THEN period_end:=((local_day+1)+cutoff) AT TIME ZONE zone;ELSE period_end:=period_start+CASE WHEN method='24_hour' THEN interval '24 hours' ELSE interval '1 hour' END;END IF;
  IF period_end<=period_start THEN RAISE EXCEPTION 'Periode timezone tidak valid';END IF;
  actual_start:=greatest(period_start,p_start);actual_end:=least(period_end,p_end);total_seconds:=extract(epoch FROM actual_end-actual_start);period_units:=CASE WHEN method='calendar' THEN 1 ELSE total_seconds/extract(epoch FROM period_end-period_start) END;weighted_rate:=0;selected_rate:=0;
  FOR segment IN SELECT value FROM jsonb_array_elements(p_segments) LOOP
   segment_start:=(segment->>'starts_at')::timestamptz;segment_end:=coalesce((segment->>'ends_at')::timestamptz,p_end);overlap_start:=greatest(actual_start,segment_start);overlap_end:=least(actual_end,segment_end);
   IF overlap_end>overlap_start THEN seconds_value:=extract(epoch FROM overlap_end-overlap_start);rate:=(segment->>'rate')::numeric;weighted_rate:=weighted_rate+rate*seconds_value/total_seconds;selected_rate:=greatest(selected_rate,rate);END IF;
  END LOOP;
  IF transfer_method='cutoff' THEN
   local_day:=(actual_start AT TIME ZONE zone)::date;cutoff_at:=(local_day+cutoff) AT TIME ZONE zone;IF cutoff_at>actual_start THEN cutoff_at:=((local_day-1)+cutoff) AT TIME ZONE zone;END IF;
   IF cutoff_at<p_start THEN selected_rate:=(p_policy->>'opening_cutoff_rate')::numeric;ELSE SELECT (s->>'rate')::numeric INTO selected_rate FROM jsonb_array_elements(p_segments) s WHERE (s->>'starts_at')::timestamptz<=cutoff_at AND coalesce((s->>'ends_at')::timestamptz,p_end)>cutoff_at LIMIT 1;IF selected_rate IS NULL THEN RAISE EXCEPTION 'Tarif sumber pada cutoff tidak tersedia';END IF;END IF;
  ELSIF transfer_method='prorata' THEN selected_rate:=weighted_rate;END IF;
  period_amount:=selected_rate*period_units;raw_units:=raw_units+period_units;raw_amount:=raw_amount+period_amount;lines:=lines||jsonb_build_array(jsonb_build_object('starts_at',actual_start,'ends_at',actual_end,'raw_units',period_units,'rate',selected_rate,'raw_amount',period_amount,'method',method,'transfer_method',transfer_method));
  IF method='calendar' THEN local_day:=(period_end AT TIME ZONE zone)::date;END IF;period_start:=period_end;
 END LOOP;
 billed_units:=greatest(minimum_units,CASE rounding_method WHEN 'up' THEN ceil(raw_units) WHEN 'down' THEN floor(raw_units) ELSE round(raw_units) END);factor_value:=billed_units/raw_units;
 FOR line IN SELECT value FROM jsonb_array_elements(lines) LOOP line_amount:=round((line->>'raw_amount')::numeric*factor_value,amount_decimals);total_amount:=total_amount+line_amount;result_lines:=result_lines||jsonb_build_array(line||jsonb_build_object('billed_units',(line->>'raw_units')::numeric*factor_value,'amount',line_amount));END LOOP;
 -- Preserve line sums exactly; amount rounding is per displayed line, never an invisible residual.
 RETURN jsonb_build_object('starts_at',p_start,'ends_at',p_end,'timezone',zone,'raw_units',raw_units,'billed_units',billed_units,'raw_amount',raw_amount,'total',total_amount,'lines',result_lines);
END $$;
REVOKE ALL ON FUNCTION rs_room_billing_quote(jsonb,timestamptz,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
COMMIT;
