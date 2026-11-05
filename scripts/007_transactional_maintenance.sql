-- Canonical script 007. Apply after 001–006. Existing invalid data makes this
-- transaction fail for explicit repair; never silently discard or rewrite history.
BEGIN;

-- Validate the original numeric input before any precision rounding can turn a
-- small negative into zero. Retain the existing monetary range and cent precision.
ALTER TABLE public.maintenance_records ALTER COLUMN cost TYPE numeric;

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('vehicles', 'vehicles_identity_nonempty', 'CHECK (length(btrim(make)) > 0 AND length(btrim(model)) > 0)'),
    ('vehicles', 'vehicles_year_range', 'CHECK (year BETWEEN 1 AND 9999)'),
    ('vehicles', 'vehicles_mileage_nonnegative', 'CHECK (mileage >= 0)'),
    ('vehicles', 'vehicles_id_user_unique', 'UNIQUE (id, user_id)'),
    ('maintenance_records', 'maintenance_id_vehicle_user_unique', 'UNIQUE (id, vehicle_id, user_id)'),
    ('maintenance_records', 'maintenance_vehicle_owner', 'FOREIGN KEY (vehicle_id, user_id) REFERENCES public.vehicles(id, user_id) ON DELETE CASCADE'),
    ('maintenance_records', 'maintenance_cost_precision', 'CHECK (cost = round(cost, 2))'),
    ('maintenance_records', 'maintenance_cost_nonnegative', 'CHECK (cost BETWEEN 0 AND 99999999.99)'),
    ('maintenance_records', 'maintenance_mileage_nonnegative', 'CHECK (mileage >= 0)'),
    ('maintenance_records', 'maintenance_day_range', 'CHECK (service_date BETWEEN DATE ''0001-01-01'' AND DATE ''9999-12-31'')'),
    ('scheduled_services', 'scheduled_vehicle_owner', 'FOREIGN KEY (vehicle_id, user_id) REFERENCES public.vehicles(id, user_id) ON DELETE CASCADE'),
    ('scheduled_services', 'scheduled_mileage_nonnegative', 'CHECK (scheduled_mileage >= 0)'),
    ('scheduled_services', 'scheduled_day_range', 'CHECK (scheduled_date BETWEEN DATE ''0001-01-01'' AND DATE ''9999-12-31'')'),
    ('scheduled_services', 'scheduled_completion_state', 'CHECK ((status = ''completed'') = (completed_record_id IS NOT NULL))'),
    ('scheduled_services', 'scheduled_completion_vehicle', 'FOREIGN KEY (completed_record_id, vehicle_id, user_id) REFERENCES public.maintenance_records(id, vehicle_id, user_id) ON DELETE SET NULL (completed_record_id) DEFERRABLE INITIALLY DEFERRED')
  ) AS constraints(table_name, name, definition)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name AND conrelid = ('public.' || c.table_name)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', c.table_name, c.name, c.definition);
    END IF;
  END LOOP;
  FOR c IN SELECT unnest(ARRAY['maintenance_records', 'scheduled_services']) AS table_name LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.table_name || '_known_type') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (type IN (''oil_change'', ''tire_rotation'', ''brake_service'', ''transmission'', ''engine_tune'', ''battery'', ''air_filter'', ''coolant'', ''spark_plugs'', ''belts_hoses'', ''suspension'', ''exhaust'', ''other''))', c.table_name, c.table_name || '_known_type');
    END IF;
  END LOOP;
END $$;

-- Composite owner-aware keys replace the redundant single-column relations;
-- retain one unambiguous PostgREST relationship for existing nested selects.
ALTER TABLE public.maintenance_records DROP CONSTRAINT IF EXISTS maintenance_records_vehicle_id_fkey;
ALTER TABLE public.scheduled_services DROP CONSTRAINT IF EXISTS scheduled_services_vehicle_id_fkey;
ALTER TABLE public.scheduled_services DROP CONSTRAINT IF EXISTS scheduled_services_completed_record_id_fkey;

-- Clearing a deleted completion preserves the forecast as pending, so deletion
-- works without leaving an impossible completed-without-intervention state.
CREATE OR REPLACE FUNCTION public.clear_deleted_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.completed_record_id IS NOT NULL AND NEW.completed_record_id IS NULL THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clear_deleted_completion ON public.scheduled_services;
CREATE TRIGGER clear_deleted_completion BEFORE UPDATE ON public.scheduled_services
FOR EACH ROW EXECUTE FUNCTION public.clear_deleted_completion();

CREATE INDEX IF NOT EXISTS maintenance_vehicle_owner_idx ON public.maintenance_records(vehicle_id, user_id);
CREATE INDEX IF NOT EXISTS scheduled_vehicle_owner_idx ON public.scheduled_services(vehicle_id, user_id);
CREATE INDEX IF NOT EXISTS scheduled_completion_idx ON public.scheduled_services(completed_record_id, vehicle_id, user_id);

-- Receipts are immutable and unreachable through the Data API. Only the narrow
-- authenticated functions below can create/read them. No client supplied user ID.
CREATE SCHEMA IF NOT EXISTS keepel_private;
REVOKE ALL ON SCHEMA keepel_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA keepel_private TO authenticated;
CREATE TABLE IF NOT EXISTS keepel_private.maintenance_operations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (user_id, operation_id)
);
ALTER TABLE keepel_private.maintenance_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON keepel_private.maintenance_operations FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION keepel_private.create_maintenance_batch(
  p_operation_id uuid, p_vehicle_id uuid, p_today text, p_batch jsonb, p_completion jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  request jsonb := jsonb_build_object('vehicle_id', p_vehicle_id, 'today', p_today, 'batch', p_batch, 'completion', p_completion);
  prior keepel_private.maintenance_operations;
  vehicle public.vehicles;
  forecast public.scheduled_services;
  intervention public.maintenance_records;
  services jsonb := '[]';
  item jsonb;
  day date;
  today date;
  batch_mileage integer;
  completion_index integer;
  completion_record uuid;
  receipt jsonb;
  row_index integer := 0;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_operation_id IS NULL OR p_vehicle_id IS NULL THEN RAISE EXCEPTION 'Operation and vehicle required'; END IF;
  -- Serialize identical operations even if a caller changes the vehicle.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text || p_operation_id::text, 0));
  SELECT * INTO prior FROM keepel_private.maintenance_operations WHERE user_id = actor AND operation_id = p_operation_id;
  IF FOUND THEN
    IF prior.request IS DISTINCT FROM request THEN RAISE EXCEPTION 'Operation identity already used for a different request'; END IF;
    RETURN prior.result;
  END IF;
  IF jsonb_typeof(p_batch) IS DISTINCT FROM 'object' OR
     p_batch - ARRAY['service_date','mileage','notes','services'] <> '{}'::jsonb OR
     jsonb_typeof(p_batch->'services') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid maintenance batch';
  END IF;
  IF p_today IS NULL OR p_today !~ '^\d{4}-\d{2}-\d{2}$' OR
     coalesce(p_batch->>'service_date', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid calendar day'; END IF;
  today := p_today::date;
  day := (p_batch->>'service_date')::date;
  IF today NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31' OR day NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31' THEN RAISE EXCEPTION 'Invalid calendar day'; END IF;
  IF p_batch->'mileage' IS NOT NULL AND p_batch->'mileage' <> 'null'::jsonb THEN
    IF jsonb_typeof(p_batch->'mileage') <> 'number' OR (p_batch->>'mileage')::numeric < 0 OR
       trunc((p_batch->>'mileage')::numeric) <> (p_batch->>'mileage')::numeric THEN RAISE EXCEPTION 'Invalid mileage'; END IF;
    batch_mileage := (p_batch->>'mileage')::numeric::integer;
  END IF;
  IF p_batch->'notes' IS NOT NULL AND jsonb_typeof(p_batch->'notes') NOT IN ('string', 'null') THEN RAISE EXCEPTION 'Invalid notes'; END IF;
  IF jsonb_array_length(p_batch->'services') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'A batch requires 1 to 100 services'; END IF;
  SELECT * INTO vehicle FROM public.vehicles WHERE id = p_vehicle_id AND user_id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle unavailable' USING ERRCODE = '42501'; END IF;
  IF p_completion IS NOT NULL AND p_completion <> 'null'::jsonb THEN
    IF jsonb_typeof(p_completion) <> 'object' OR p_completion - ARRAY['scheduled_service_id','service_index'] <> '{}'::jsonb OR
       jsonb_typeof(p_completion->'service_index') IS DISTINCT FROM 'number' OR
       (p_completion->>'service_index') !~ '^\d+$' OR day > today THEN RAISE EXCEPTION 'Invalid completion'; END IF;
    completion_index := (p_completion->>'service_index')::integer;
    IF completion_index >= jsonb_array_length(p_batch->'services') THEN RAISE EXCEPTION 'Invalid completion row'; END IF;
    SELECT * INTO forecast FROM public.scheduled_services WHERE id = (p_completion->>'scheduled_service_id')::uuid AND vehicle_id = p_vehicle_id AND user_id = actor AND status = 'pending' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pending schedule unavailable'; END IF;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_batch->'services') LOOP
    IF jsonb_typeof(item) <> 'object' OR item - ARRAY['type','description','cost'] <> '{}'::jsonb OR
       jsonb_typeof(item->'type') IS DISTINCT FROM 'string' OR
       (item->'description' IS NOT NULL AND jsonb_typeof(item->'description') NOT IN ('string','null')) OR
       (item->'cost' IS NOT NULL AND jsonb_typeof(item->'cost') NOT IN ('number','null')) THEN
      RAISE EXCEPTION 'Invalid service at row %', row_index + 1;
    END IF;
    INSERT INTO public.maintenance_records (vehicle_id, user_id, type, description, cost, mileage, service_date, notes)
    VALUES (p_vehicle_id, actor, item->>'type', nullif(btrim(item->>'description'), ''), (item->>'cost')::numeric, batch_mileage, day, nullif(btrim(p_batch->>'notes'), ''))
    RETURNING * INTO intervention;
    services := services || jsonb_build_array(to_jsonb(intervention));
    IF row_index = completion_index THEN completion_record := intervention.id; END IF;
    row_index := row_index + 1;
  END LOOP;
  IF completion_record IS NOT NULL THEN
    UPDATE public.scheduled_services SET status = 'completed', completed_record_id = completion_record, updated_at = now() WHERE id = forecast.id RETURNING * INTO forecast;
  END IF;
  IF day <= today AND batch_mileage IS NOT NULL THEN
    UPDATE public.vehicles SET mileage = greatest(coalesce(public.vehicles.mileage, 0), batch_mileage), updated_at = now() WHERE id = vehicle.id RETURNING * INTO vehicle;
  END IF;
  receipt := jsonb_build_object('operation_id', p_operation_id, 'records', services, 'vehicle', to_jsonb(vehicle), 'scheduled_service', CASE WHEN completion_record IS NOT NULL THEN to_jsonb(forecast) ELSE 'null'::jsonb END);
  INSERT INTO keepel_private.maintenance_operations VALUES (actor, p_operation_id, request, receipt);
  RETURN receipt;
END $$;

CREATE OR REPLACE FUNCTION keepel_private.get_maintenance_batch_operation(p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT result FROM keepel_private.maintenance_operations WHERE user_id = auth.uid() AND operation_id = p_operation_id);
END $$;
REVOKE ALL ON FUNCTION keepel_private.create_maintenance_batch(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION keepel_private.get_maintenance_batch_operation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION keepel_private.create_maintenance_batch(uuid, uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION keepel_private.get_maintenance_batch_operation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_maintenance_batch(p_operation_id uuid, p_vehicle_id uuid, p_today text, p_batch jsonb, p_completion jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT keepel_private.create_maintenance_batch(p_operation_id, p_vehicle_id, p_today, p_batch, p_completion);
$$;
CREATE OR REPLACE FUNCTION public.get_maintenance_batch_operation(p_operation_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT keepel_private.get_maintenance_batch_operation(p_operation_id);
$$;
REVOKE ALL ON FUNCTION public.clear_deleted_completion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_maintenance_batch(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_maintenance_batch_operation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_maintenance_batch(uuid, uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_maintenance_batch_operation(uuid) TO authenticated;
COMMIT;
