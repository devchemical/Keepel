-- Migrate existing next_service_date/next_service_mileage from maintenance_records
-- to the new scheduled_services table.
-- This script is idempotent: it can be run multiple times without duplicating data.

-- Only migrate records that have a next_service_date set and haven't been migrated yet
-- (uses a LEFT JOIN to check if a scheduled_service already exists for this record)
INSERT INTO public.scheduled_services (
  vehicle_id,
  user_id,
  type,
  description,
  scheduled_date,
  scheduled_mileage,
  status,
  notes,
  created_at,
  updated_at
)
SELECT
  mr.vehicle_id,
  mr.user_id,
  mr.type,
  CONCAT('Seguimiento de: ', mr.description) AS description,
  mr.next_service_date AS scheduled_date,
  mr.next_service_mileage AS scheduled_mileage,
  'pending' AS status,
  CONCAT('Migrado automáticamente desde registro de mantenimiento del ', mr.service_date) AS notes,
  NOW() AS created_at,
  NOW() AS updated_at
FROM public.maintenance_records mr
LEFT JOIN public.scheduled_services ss
  ON ss.vehicle_id = mr.vehicle_id
  AND ss.user_id = mr.user_id
  AND ss.scheduled_date = mr.next_service_date
  AND ss.scheduled_mileage = mr.next_service_mileage
  AND ss.type = mr.type
  AND ss.notes LIKE '%Migrado automáticamente%'
WHERE mr.next_service_date IS NOT NULL
  AND ss.id IS NULL;