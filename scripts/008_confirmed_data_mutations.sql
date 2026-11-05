-- Canonical script008: narrow CRUD receipts, including deletes and cancellation.
BEGIN;
CREATE TABLE IF NOT EXISTS keepel_private.data_operations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (user_id, operation_id)
);
ALTER TABLE keepel_private.data_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON keepel_private.data_operations FROM PUBLIC, anon, authenticated;

-- Match script007: private definer owns inaccessible immutable receipts; every
-- resource statement explicitly scopes ownership. Public API is invoker only.
CREATE OR REPLACE FUNCTION keepel_private.mutate_data(p_operation_id uuid, p_action text, p_id uuid, p_values jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  request jsonb := jsonb_build_object('action', p_action, 'id', p_id, 'values', p_values);
  prior keepel_private.data_operations;
  v public.vehicles;
  m public.maintenance_records;
  s public.scheduled_services;
  result_row jsonb;
  receipt jsonb;
  allowed text[];
  key text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_operation_id IS NULL OR p_id IS NULL OR p_action IS NULL OR jsonb_typeof(p_values) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid operation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text || p_operation_id::text, 0));
  SELECT * INTO prior FROM keepel_private.data_operations WHERE user_id = actor AND operation_id = p_operation_id;
  IF FOUND THEN
    IF prior.request IS DISTINCT FROM request THEN RAISE EXCEPTION 'Operation identity already used'; END IF;
    RETURN prior.result;
  END IF;
  CASE p_action
    WHEN 'vehicle.create', 'vehicle.update' THEN allowed := ARRAY['make','model','year','license_plate','vin','color','mileage'];
    WHEN 'maintenance.update' THEN allowed := ARRAY['type','description','cost','mileage','service_date','notes'];
    WHEN 'schedule.create' THEN allowed := ARRAY['vehicle_id','type','description','scheduled_date','scheduled_mileage','notes'];
    WHEN 'schedule.update' THEN allowed := ARRAY['type','description','scheduled_date','scheduled_mileage','notes'];
    WHEN 'vehicle.delete', 'maintenance.delete', 'schedule.cancel' THEN allowed := ARRAY[]::text[];
    ELSE RAISE EXCEPTION 'Unknown operation';
  END CASE;
  IF p_values - allowed <> '{}'::jsonb THEN RAISE EXCEPTION 'Unexpected fields'; END IF;
  IF p_action NOT IN ('vehicle.delete','maintenance.delete','schedule.cancel') THEN
    -- Complete editor payloads prevent accidental NULL/omission discrepancies.
    IF NOT p_values ?& allowed THEN RAISE EXCEPTION 'Incomplete values'; END IF;
  END IF;
  FOREACH key IN ARRAY ARRAY['mileage','scheduled_mileage','year','cost'] LOOP
    IF p_values ? key AND p_values->key <> 'null'::jsonb THEN
      IF jsonb_typeof(p_values->key) <> 'number' OR (p_values->>key)::numeric < 0 OR
        (key <> 'cost' AND trunc((p_values->>key)::numeric) <> (p_values->>key)::numeric) THEN
        RAISE EXCEPTION 'Invalid numeric value';
      END IF;
    END IF;
  END LOOP;
  FOREACH key IN ARRAY ARRAY['make','model','license_plate','vin','color','type','description','notes','service_date','scheduled_date','vehicle_id'] LOOP
    IF p_values ? key AND jsonb_typeof(p_values->key) NOT IN ('string','null') THEN RAISE EXCEPTION 'Invalid text'; END IF;
  END LOOP;
  FOREACH key IN ARRAY ARRAY['service_date','scheduled_date'] LOOP
    IF p_values ? key AND p_values->key <> 'null'::jsonb AND (p_values->>key) !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Invalid calendar day';
    END IF;
  END LOOP;
  IF p_action IN ('schedule.create','schedule.update') AND
    coalesce(p_values->>'scheduled_date', p_values->>'scheduled_mileage') IS NULL THEN
    RAISE EXCEPTION 'A schedule requires a date or mileage';
  END IF;
  IF p_action = 'vehicle.create' THEN
    v := jsonb_populate_record(NULL::public.vehicles, p_values);
    INSERT INTO public.vehicles(id,user_id,make,model,year,license_plate,vin,color,mileage)
      VALUES(p_id,actor,v.make,v.model,v.year,v.license_plate,v.vin,v.color,v.mileage) RETURNING * INTO v;
    result_row := to_jsonb(v);
  ELSIF p_action = 'vehicle.update' THEN
    v := jsonb_populate_record(NULL::public.vehicles, p_values);
    UPDATE public.vehicles SET make=v.make,model=v.model,year=v.year,license_plate=v.license_plate,vin=v.vin,color=v.color,mileage=v.mileage,updated_at=now()
      WHERE id=p_id AND user_id=actor RETURNING * INTO v;
    IF NOT FOUND THEN RAISE EXCEPTION 'No affected vehicle'; END IF;
    result_row := to_jsonb(v);
  ELSIF p_action = 'vehicle.delete' THEN
    DELETE FROM public.vehicles WHERE id=p_id AND user_id=actor RETURNING * INTO v;
    IF NOT FOUND THEN RAISE EXCEPTION 'No affected vehicle'; END IF;
    result_row := to_jsonb(v);
  ELSIF p_action = 'maintenance.update' THEN
    m := jsonb_populate_record(NULL::public.maintenance_records, p_values);
    UPDATE public.maintenance_records SET type=m.type,description=m.description,cost=m.cost,mileage=m.mileage,service_date=m.service_date,notes=m.notes,updated_at=now()
      WHERE id=p_id AND user_id=actor RETURNING * INTO m;
    IF NOT FOUND THEN RAISE EXCEPTION 'No affected maintenance'; END IF;
    result_row := to_jsonb(m);
  ELSIF p_action = 'maintenance.delete' THEN
    DELETE FROM public.maintenance_records WHERE id=p_id AND user_id=actor RETURNING * INTO m;
    IF NOT FOUND THEN RAISE EXCEPTION 'No affected maintenance'; END IF;
    result_row := to_jsonb(m);
  ELSIF p_action = 'schedule.create' THEN
    s := jsonb_populate_record(NULL::public.scheduled_services, p_values);
    IF NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=s.vehicle_id AND user_id=actor) THEN RAISE EXCEPTION 'Vehicle unavailable' USING ERRCODE='42501'; END IF;
    INSERT INTO public.scheduled_services(id,user_id,vehicle_id,type,description,scheduled_date,scheduled_mileage,notes,status)
      VALUES(p_id,actor,s.vehicle_id,s.type,s.description,s.scheduled_date,s.scheduled_mileage,s.notes,'pending') RETURNING * INTO s;
    result_row := to_jsonb(s);
  ELSIF p_action = 'schedule.update' THEN
    s := jsonb_populate_record(NULL::public.scheduled_services, p_values);
    UPDATE public.scheduled_services SET type=s.type,description=s.description,scheduled_date=s.scheduled_date,scheduled_mileage=s.scheduled_mileage,notes=s.notes,updated_at=now()
      WHERE id=p_id AND user_id=actor AND status='pending' RETURNING * INTO s;
    IF NOT FOUND THEN RAISE EXCEPTION 'No affected pending schedule'; END IF;
    result_row := to_jsonb(s);
  ELSIF p_action = 'schedule.cancel' THEN
    UPDATE public.scheduled_services SET status='cancelled',completed_record_id=NULL,updated_at=now()
      WHERE id=p_id AND user_id=actor AND status='pending' RETURNING * INTO s;
    IF NOT FOUND THEN RAISE EXCEPTION 'No affected pending schedule'; END IF;
    result_row := to_jsonb(s);
  END IF;
  receipt := jsonb_build_object('operation_id',p_operation_id,'action',p_action,'row',result_row);
  INSERT INTO keepel_private.data_operations VALUES(actor,p_operation_id,request,receipt);
  RETURN receipt;
END $$;
CREATE OR REPLACE FUNCTION keepel_private.get_data_operation(p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  RETURN (SELECT result FROM keepel_private.data_operations WHERE user_id=auth.uid() AND operation_id=p_operation_id);
END $$;
CREATE OR REPLACE FUNCTION public.mutate_data(p_operation_id uuid,p_action text,p_id uuid,p_values jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT keepel_private.mutate_data(p_operation_id,p_action,p_id,p_values);
$$;
CREATE OR REPLACE FUNCTION public.get_data_operation(p_operation_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT keepel_private.get_data_operation(p_operation_id);
$$;
REVOKE ALL ON FUNCTION keepel_private.mutate_data(uuid,text,uuid,jsonb), keepel_private.get_data_operation(uuid), public.mutate_data(uuid,text,uuid,jsonb), public.get_data_operation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION keepel_private.mutate_data(uuid,text,uuid,jsonb), keepel_private.get_data_operation(uuid), public.mutate_data(uuid,text,uuid,jsonb), public.get_data_operation(uuid) TO authenticated;
COMMIT;
