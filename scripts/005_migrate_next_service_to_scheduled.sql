-- Migrate existing next_service_date/next_service_mileage from maintenance_records
-- to the new scheduled_services table.
-- This script is idempotent: it can be run multiple times without duplicating data.

-- Migrate records with either a date or mileage forecast that have not been migrated yet
-- Match nullable criteria using null-safe equality so replay does not duplicate forecasts.
-- Run before 006; already-dropped source values require a pre-drop backup to recover.
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
  AND ss.scheduled_date IS NOT DISTINCT FROM mr.next_service_date
  AND ss.scheduled_mileage IS NOT DISTINCT FROM mr.next_service_mileage
  AND ss.type = mr.type
  AND ss.notes LIKE '%Migrado automáticamente%'
WHERE (mr.next_service_date IS NOT NULL OR mr.next_service_mileage IS NOT NULL)
  AND ss.id IS NULL;
