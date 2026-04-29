-- Drop deprecated next_service_date and next_service_mileage columns
-- from maintenance_records. These have been migrated to scheduled_services.

-- WARNING: Run this ONLY after verifying that the migration
-- (005_migrate_next_service_to_scheduled.sql) completed successfully
-- and that all scheduled services are visible in the dashboard.

ALTER TABLE public.maintenance_records DROP COLUMN IF EXISTS next_service_date;
ALTER TABLE public.maintenance_records DROP COLUMN IF EXISTS next_service_mileage;