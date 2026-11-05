-- Equality scope precedes the stable history ordering; separate account and vehicle paths.
CREATE INDEX IF NOT EXISTS idx_maintenance_account_history
  ON public.maintenance_records(user_id, service_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_history
  ON public.maintenance_records(user_id, vehicle_id, service_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_vehicles_account_id ON public.vehicles(user_id, id);
CREATE INDEX IF NOT EXISTS idx_scheduled_pending_account_id
  ON public.scheduled_services(user_id, id) WHERE status = 'pending';

-- A scalar aggregate runs before PostgREST's response cap. NULL costs contribute zero;
-- count includes every record. No caller-supplied account identity or definer privilege.
CREATE OR REPLACE FUNCTION public.maintenance_totals(p_vehicle_id uuid DEFAULT NULL)
RETURNS TABLE(record_count bigint, total_cost numeric)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  -- Separate statements avoid a generic optional-filter plan scanning the entire
  -- account for a vehicle total after repeated calls.
  IF p_vehicle_id IS NULL THEN
    RETURN QUERY SELECT count(*), coalesce(sum(cost), 0)
      FROM public.maintenance_records WHERE user_id = (SELECT auth.uid());
  ELSE
    RETURN QUERY SELECT count(*), coalesce(sum(cost), 0)
      FROM public.maintenance_records
      WHERE user_id = (SELECT auth.uid()) AND vehicle_id = p_vehicle_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.maintenance_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maintenance_totals(uuid) TO authenticated;
